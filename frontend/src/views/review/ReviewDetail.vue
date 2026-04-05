<template>
  <div class="page-container">
    <div class="page-header">
      <h2>审核操作</h2>
      <el-button @click="router.back()">返回</el-button>
    </div>

    <el-skeleton :loading="loading" animated>
      <template #default>
        <!-- 计划信息 -->
        <el-card shadow="never" class="info-card">
          <el-descriptions :column="4" border>
            <el-descriptions-item label="标题" :span="2">{{ plan.title }}</el-descriptions-item>
            <el-descriptions-item label="部门">{{ plan.dept_name }}</el-descriptions-item>
            <el-descriptions-item label="提交人">{{ plan.creator_name }}</el-descriptions-item>
            <el-descriptions-item label="学期">{{ plan.semester }}</el-descriptions-item>
            <el-descriptions-item label="周次">第{{ plan.week_number }}周</el-descriptions-item>
            <el-descriptions-item label="日期">{{ formatDate(plan.start_date) }} ~ {{ formatDate(plan.end_date) }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="STATUS_MAP[plan.status]?.type">{{ STATUS_MAP[plan.status]?.label }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 计划条目（可编辑） -->
        <el-card shadow="never" class="items-card">
          <template #header>
            <div class="card-header">
              <span>计划条目（审核时可编辑）</span>
              <el-button type="primary" @click="addItem" class="add-item-btn">
                <el-icon><Plus /></el-icon> 添加条目
              </el-button>
            </div>
          </template>
          <el-table :data="plan.items || []" border stripe size="small">
            <el-table-column type="index" label="序" width="50" align="center" />
            <el-table-column label="日期" width="150">
              <template #default="{row}">
                <el-input v-if="canReview" v-model="row.plan_date" placeholder="YYYY-MM-DD" size="small" @focus="formatInputDate(row)" />
                <span v-else>{{ formatDate(row.plan_date) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="星期" width="70" align="center">
              <template #default="{row}">
                <el-input v-if="canReview" v-model="row.weekday" placeholder="星期" size="small" style="text-align:center" />
                <span v-else>{{ row.weekday }}</span>
              </template>
            </el-table-column>
            <el-table-column label="工作内容">
              <template #default="{row}">
                <el-input v-if="canReview" v-model="row.content" type="textarea" :rows="1" placeholder="工作内容" size="small" />
                <span v-else>{{ row.content }}</span>
              </template>
            </el-table-column>
            <el-table-column label="负责人/部门" width="140">
              <template #default="{row}">
                <el-input v-if="canReview" v-model="row.responsible" placeholder="负责人" size="small" />
                <span v-else>{{ row.responsible }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center" v-if="canReview">
              <template #default="{$index}">
                <el-button link type="danger" :icon="Delete" @click="removeItem($index)" />
              </template>
            </el-table-column>
          </el-table>
          <div v-if="plan.remark" class="remark">备注：{{ plan.remark }}</div>
        </el-card>

        <!-- 历史审核记录 -->
        <el-card shadow="never" class="review-history" v-if="plan.reviews && plan.reviews.length">
          <template #header>历史审核记录</template>
          <el-timeline>
            <el-timeline-item
              v-for="r in plan.reviews"
              :key="r.id"
              :type="r.result === 'APPROVED' ? 'success' : 'danger'"
              :timestamp="formatDate(r.create_time)"
            >
              <el-tag :type="r.result === 'APPROVED' ? 'success' : 'danger'" size="small">
                {{ r.result === 'APPROVED' ? '通过' : '退回' }}
              </el-tag>
              <span class="reviewer">{{ r.reviewer_name }}（第{{ r.step }}步）</span>
              <div v-if="r.comment" class="comment">{{ r.comment }}</div>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <!-- 审核操作区 -->
        <el-card shadow="never" class="action-card" v-if="canReview">
          <template #header>审核操作</template>
          <el-form label-width="100px">
            <el-form-item label="审核意见">
              <el-input v-model="comment" type="textarea" :rows="3" placeholder="请输入审核意见（退回时必填）" />
            </el-form-item>
            <el-form-item>
              <el-button type="success" :icon="Check" @click="approve" :loading="acting">通过并保存修改</el-button>
              <el-button type="danger" :icon="Close" @click="reject" :loading="acting">退 回</el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </template>
    </el-skeleton>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '../../stores/user'
import request from '../../utils/request'
import { STATUS_MAP } from '../../utils/helper'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Close, Plus, Delete } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const plan = ref({})
const loading = ref(true)
const acting = ref(false)
const comment = ref('')

const role = computed(() => userStore.userInfo?.role)

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatInputDate(row) {
  if (row.plan_date && row.plan_date.includes('T')) {
    row.plan_date = formatDate(row.plan_date)
  }
}

const canReview = computed(() => {
  const s = plan.value.status
  const r = role.value
  if (r === 'ADMIN') return ['SUBMITTED','DEPT_APPROVED','OFFICE_APPROVED'].includes(s)
  if (r === 'DEPT_HEAD') return s === 'SUBMITTED'
  if (r === 'OFFICE_HEAD') return s === 'DEPT_APPROVED'
  if (r === 'PRINCIPAL') return s === 'OFFICE_APPROVED'
  return false
})

async function loadData() {
  loading.value = true
  try {
    plan.value = await request.get(`/plans/${route.params.id}`)
    // 格式化所有条目的日期
    if (plan.value.items && plan.value.items.length > 0) {
      plan.value.items.forEach(item => {
        if (item.plan_date && item.plan_date.includes('T')) {
          item.plan_date = formatDate(item.plan_date)
        }
      })
    }
  } finally { loading.value = false }
}

function addItem() {
  plan.value.items.push({ plan_date: '', weekday: '', content: '', responsible: '', _isNew: true })
}

function removeItem(index) {
  plan.value.items.splice(index, 1)
}

async function approve() {
  await ElMessageBox.confirm('确认审核通过并保存修改？', '提示', { type: 'success' })
  acting.value = true
  try {
    await request.post(`/reviews/${route.params.id}/approve`, { comment: comment.value, updatedItems: plan.value.items })
    ElMessage.success('审核通过')
    router.push('/review/pending')
  } finally { acting.value = false }
}

async function reject() {
  if (!comment.value.trim()) return ElMessage.warning('退回时必须填写审核意见')
  await ElMessageBox.confirm('确认退回此计划？', '警告', { type: 'warning' })
  acting.value = true
  try {
    await request.post(`/reviews/${route.params.id}/reject`, { comment: comment.value })
    ElMessage.success('已退回')
    router.push('/review/pending')
  } finally { acting.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: #1e293b; }
.info-card, .items-card, .review-history, .action-card { margin-bottom: 16px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.remark { margin-top: 10px; color: #64748b; font-size: 13px; }
.reviewer { font-weight: 500; margin: 0 8px; }
.comment { color: #64748b; font-size: 13px; margin-top: 4px; }

/* 深色模式支持 */
:global(.dark-mode) .page-header h2 {
  color: #f8fafc;
}

:global(.dark-mode) .remark {
  color: #94a3b8;
}

:global(.dark-mode) .comment {
  color: #94a3b8;
}

:global(.dark-mode) .reviewer {
  color: #cbd5e1;
}

/* 添加条目按钮样式 */
.add-item-btn {
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.add-item-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
}
</style>
