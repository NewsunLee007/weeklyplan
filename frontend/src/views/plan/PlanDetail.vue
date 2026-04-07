<template>
  <div class="page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h2 class="page-title">计划详情</h2>
      </div>
      <div>
        <el-button type="success" :icon="Download" @click="exportWord" class="action-btn" v-if="plan.status === 'PUBLISHED'">导出为 Word</el-button>
        <el-button type="primary" :icon="Check" v-if="canSubmit" @click="submitPlan" class="action-btn">提交审核</el-button>
        <el-button type="warning" :icon="RefreshLeft" v-if="canWithdraw" @click="withdrawPlan" class="action-btn">撤回</el-button>
        <el-button @click="router.back()" class="action-btn back-btn">
          <el-icon><ArrowLeft /></el-icon> 返回
        </el-button>
      </div>
    </div>

    <el-skeleton :loading="loading" animated>
      <template #default>
        <!-- 基本信息 -->
        <el-card shadow="never" class="info-card">
          <el-descriptions :column="4" border>
            <el-descriptions-item label="学期">{{ plan.semester }}</el-descriptions-item>
            <el-descriptions-item label="周次">第{{ plan.week_number }}周</el-descriptions-item>
            <el-descriptions-item label="日期范围">{{ formatDate(plan.start_date) }} ~ {{ formatDate(plan.end_date) }}</el-descriptions-item>
            <el-descriptions-item label="部门">{{ plan.dept_name }}</el-descriptions-item>
            <el-descriptions-item label="标题" :span="3">{{ plan.title }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="STATUS_MAP[plan.status]?.type">{{ STATUS_MAP[plan.status]?.label }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 计划条目 -->
        <el-card shadow="never" class="items-card">
          <template #header>
            <div class="card-header">
              <span>计划条目</span>
              <el-button v-if="plan.status === 'PUBLISHED'" type="primary" text size="small" @click="exportWord">导出 Word</el-button>
            </div>
          </template>
          <el-table :data="plan.items || []" border stripe>
            <el-table-column type="index" label="序" width="50" align="center" />
            <el-table-column label="日期" width="120">
              <template #default="{row}">
                {{ formatDate(row.plan_date) }}
              </template>
            </el-table-column>
            <el-table-column prop="weekday" label="星期" width="70" align="center" />
            <el-table-column prop="content" label="工作内容" min-width="300">
              <template #default="{row}">
                <span style="white-space: pre-wrap;">{{ row.content }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="responsible" label="负责人/部门" width="140">
              <template #default="{row}">
                <span style="white-space: pre-wrap;">{{ row.responsible }}</span>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="plan.remark" class="remark">备注：{{ plan.remark }}</div>
        </el-card>

        <!-- 审核流程 -->
        <el-card shadow="never" class="review-card">
          <template #header>审核流程</template>
          <el-timeline v-if="plan.reviews && plan.reviews.length">
            <el-timeline-item
              v-for="r in plan.reviews"
              :key="r.id"
              :type="r.result === 'APPROVED' ? 'success' : 'danger'"
              :timestamp="r.create_time"
            >
              <div>
                <el-tag :type="r.result === 'APPROVED' ? 'success' : 'danger'" size="small">
                  {{ r.result === 'APPROVED' ? '通过' : '退回' }}
                </el-tag>
                <span class="reviewer-name">{{ r.reviewer_name }}</span>
                <span class="review-step">（第{{ r.step }}步）</span>
              </div>
              <div v-if="r.comment" class="review-comment">意见：{{ r.comment }}</div>
            </el-timeline-item>
          </el-timeline>
          <el-empty v-else description="暂无审核记录" />
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

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const plan = ref({})
const loading = ref(true)

const canEdit = computed(() => ['DRAFT','REJECTED'].includes(plan.value.status))
const canSubmit = computed(() => ['DRAFT','REJECTED'].includes(plan.value.status))

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function loadData() {
  loading.value = true
  try { plan.value = await request.get(`/plans/${route.params.id}`) }
  finally { loading.value = false }
}

async function submitPlan() {
  await ElMessageBox.confirm('确认提交该计划进行审核？', '提示', { type: 'warning' })
  await request.post(`/plans/${plan.value.id}/submit`)
  ElMessage.success('已提交审核')
  loadData()
}

async function withdrawPlan() {
  await ElMessageBox.confirm('确认撤回该计划？撤回后可再次编辑。', '提示', { type: 'warning' })
  await request.post(`/plans/${plan.value.id}/withdraw`)
  ElMessage.success('已成功撤回')
  loadData()
}

async function exportWord() {
  const res = await request.get(`/export/plan/${plan.value.id}`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `第${plan.value.week_number}周工作计划.docx`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-title { font-size: 24px; font-weight: 600; color: var(--color-text-primary, #164E63); margin: 0; }
.action-btn { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 8px; }
.action-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); }
.back-btn { font-weight: 500; }
.info-card, .items-card, .review-card { margin-bottom: 20px; background: var(--color-bg-primary, #ffffff); border-color: var(--color-border-light, #E0F2FE); border-radius: 12px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.info-card:hover, .items-card:hover, .review-card:hover { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: var(--color-text-primary, #164E63); }
.remark { margin-top: 16px; font-size: 14px; color: var(--color-text-secondary, #64748B); padding: 12px; background: var(--color-bg-secondary, #F8FAFC); border-radius: 8px; }
.reviewer-name { font-weight: 500; margin: 0 8px; color: var(--color-text-primary, #334155); }
.review-step { color: var(--color-text-tertiary, #94A3B8); font-size: 12px; }
.review-comment { color: var(--color-text-secondary, #64748B); font-size: 13px; margin-top: 4px; padding-left: 8px; border-left: 2px solid var(--color-border-medium, #CBD5E1); }

:deep(.el-descriptions__label) { background-color: var(--color-bg-secondary, #F8FAFC) !important; color: var(--color-text-secondary, #64748B); font-weight: 500; }
:deep(.el-descriptions__content) { color: var(--color-text-primary, #164E63); font-weight: 500; }
:deep(.el-table) { --el-table-border-color: var(--color-border-light, #E0F2FE); --el-table-header-bg-color: var(--color-bg-secondary, #F8FAFC); --el-table-header-text-color: var(--color-text-primary, #164E63); --el-table-text-color: var(--color-text-secondary, #64748B); --el-table-row-hover-bg-color: var(--color-primary-bg-subtle, rgba(59, 130, 246, 0.05)); --el-table-tr-bg-color: var(--color-bg-primary, #ffffff); background-color: var(--color-bg-primary, #ffffff); color: var(--color-text-primary, #334155); }
:deep(.el-table__body) tr.el-table__row--striped td.el-table__cell { background-color: var(--color-bg-secondary, #F8FAFC); }
:deep(.el-table td.el-table__cell), :deep(.el-table th.el-table__cell.is-leaf) { border-bottom: 1px solid var(--color-border-light, #E0F2FE); }
:deep(.el-table__empty-text) { color: var(--color-text-secondary, #64748B); }
</style>
