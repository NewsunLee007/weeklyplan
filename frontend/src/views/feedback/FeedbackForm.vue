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
            <el-select v-model="feedbacks[row.id].status" size="small" style="width:120px">
              <el-option label="已完成" value="COMPLETED" />
              <el-option label="部分完成" value="PARTIALLY" />
              <el-option label="未完成" value="NOT_COMPLETED" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="反馈说明" min-width="200">
          <template #default="{row}">
            <el-input v-model="feedbacks[row.id].content" type="textarea" :rows="2" size="small" placeholder="可选" />
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
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: #1e293b; }
.plan-title { font-size: 15px; font-weight: 600; color: #334155; margin-bottom: 16px; }
.footer-actions { margin-top: 20px; display: flex; justify-content: flex-end; }
</style>
