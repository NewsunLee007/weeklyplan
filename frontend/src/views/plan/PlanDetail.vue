<template>
  <div class="page-container">
    <div class="page-header">
      <h2>计划详情</h2>
      <div>
        <el-button v-if="canEdit" @click="router.push(`/plan/edit/${plan.id}`)">编辑</el-button>
        <el-button v-if="canSubmit" type="primary" @click="submitPlan">提交审核</el-button>
        <el-button @click="router.back()">返回</el-button>
      </div>
    </div>

    <el-skeleton :loading="loading" animated>
      <template #default>
        <!-- 基本信息 -->
        <el-card shadow="never" class="info-card">
          <el-descriptions :column="4" border>
            <el-descriptions-item label="学期">{{ plan.semester }}</el-descriptions-item>
            <el-descriptions-item label="周次">第{{ plan.week_number }}周</el-descriptions-item>
            <el-descriptions-item label="日期范围">{{ plan.start_date }} ~ {{ plan.end_date }}</el-descriptions-item>
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
            <el-table-column prop="plan_date" label="日期" width="120" />
            <el-table-column prop="weekday" label="星期" width="70" align="center" />
            <el-table-column prop="content" label="工作内容" />
            <el-table-column prop="responsible" label="负责人/部门" width="160" />
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
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: #1e293b; }
.info-card, .items-card, .review-card { margin-bottom: 16px; }
.card-header { display: flex; justify-content: space-between; align-items: center; }
.remark { margin-top: 12px; color: #64748b; font-size: 13px; }
.reviewer-name { font-weight: 600; margin: 0 6px; }
.review-step { color: #94a3b8; font-size: 12px; }
.review-comment { color: #64748b; font-size: 13px; margin-top: 4px; }
</style>
