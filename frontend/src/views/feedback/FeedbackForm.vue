<template>
  <div class="page-container">
    <div class="page-header">
      <h2>填写反馈</h2>
      <el-button @click="router.back()">返回</el-button>
    </div>

    <el-card shadow="never" v-loading="loading">
      <div v-if="plan.title" class="plan-title">{{ plan.title }}</div>

      <el-table :data="items" border stripe>
        <el-table-column label="日期" width="120">
          <template #default="{row}">
            {{ formatDate(row.plan_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="weekday" label="星期" width="60" align="center" />
        <el-table-column prop="content" label="工作内容" min-width="200" />
        <el-table-column prop="responsible" label="负责人" width="130" />
        <el-table-column label="完成状态" width="150">
          <template #default="{row}">
            <el-select v-if="feedbacks[row.id]" v-model="feedbacks[row.id].status" size="small" style="width:120px">
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="部分完成" value="PARTIALLY" />
              <el-option label="未完成" value="NOT_COMPLETED" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="反馈说明" min-width="200">
          <template #default="{row}">
            <el-input v-if="feedbacks[row.id]" v-model="feedbacks[row.id].content" type="textarea" :rows="2" size="small" placeholder="可选" />
          </template>
        </el-table-column>
      </el-table>

      <div class="footer-actions">
        <el-button type="primary" :loading="saving" @click="saveFeedbacks">保存反馈</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import request from '../../utils/request'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const router = useRouter()
const route = useRoute()
const plan = ref({})
const items = ref([])
const feedbacks = reactive({})
const loading = ref(false)
const saving = ref(false)

// 格式化日期，去掉多余的时区尾巴
function formatDate(val) {
  if (!val) return ''
  return dayjs(val).format('YYYY-MM-DD')
}

async function loadData() {
  loading.value = true
  try {
    plan.value = await request.get(`/plans/${route.params.planId}`)
    items.value = plan.value.items || []

    // 初始化反馈对象
    items.value.forEach(item => {
      feedbacks[item.id] = { status: 'COMPLETED', content: '' }
    })

    // 加载已有反馈
    const existing = await request.get('/feedbacks', { params: { plan_id: route.params.planId } })
    existing.forEach(fb => {
      if (feedbacks[fb.plan_item_id]) {
        feedbacks[fb.plan_item_id].status = fb.status
        feedbacks[fb.plan_item_id].content = fb.content || ''
      }
    })
  } finally { loading.value = false }
}

async function saveFeedbacks() {
  saving.value = true
  try {
    for (const item of items.value) {
      const fb = feedbacks[item.id]
      await request.post('/feedbacks', {
        plan_item_id: item.id,
        plan_id: Number(route.params.planId),
        status: fb.status,
        content: fb.content
      })
    }
    ElMessage.success('反馈已保存')
    router.back()
  } finally { saving.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h2 { font-size: 24px; font-weight: 600; color: var(--color-text-primary, #164E63); margin: 0; }
.plan-title { font-size: 15px; font-weight: 600; color: var(--color-text-primary, #334155); margin-bottom: 16px; }
.footer-actions { margin-top: 20px; display: flex; justify-content: flex-end; }

:deep(.el-card) {
  border: 1px solid var(--color-border-light, #E0F2FE);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all var(--transition-base);
  background: var(--color-bg-primary, #ffffff);
}

:deep(.el-card:hover) {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1);
  border-color: var(--color-border-medium, #BAE6FD);
}

:deep(.el-table) {
  --el-table-border-color: var(--color-border-light, #E0F2FE);
  --el-table-header-bg-color: var(--color-bg-secondary, #F8FAFC);
  --el-table-header-text-color: var(--color-text-primary, #164E63);
  --el-table-text-color: var(--color-text-secondary, #64748B);
  --el-table-row-hover-bg-color: var(--color-primary-bg-subtle, rgba(59, 130, 246, 0.05));
  --el-table-tr-bg-color: var(--color-bg-primary, #ffffff);
  background-color: var(--color-bg-primary, #ffffff);
  color: var(--color-text-primary, #334155);
}

:deep(.el-table__body) tr.el-table__row--striped td.el-table__cell {
  background-color: var(--color-bg-secondary, #F8FAFC);
}

:deep(.el-table td.el-table__cell),
:deep(.el-table th.el-table__cell.is-leaf) {
  border-bottom: 1px solid var(--color-border-light, #E0F2FE);
}

:deep(.el-table__empty-text) {
  color: var(--color-text-secondary, #64748B);
}

:deep(.el-button--primary) {
  background: var(--color-primary, #3B82F6);
  border: none;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transition: all var(--transition-base);
  font-weight: 600;
}

:deep(.el-button--primary:hover) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}
</style>
