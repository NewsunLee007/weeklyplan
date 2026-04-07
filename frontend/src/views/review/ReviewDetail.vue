<template>
  <div class="review-detail">
    <div class="page-header">
      <h2>审核操作</h2>
      <div>
        <el-button type="success" :icon="Download" v-if="['OFFICE_APPROVED', 'PUBLISHED'].includes(plan.status) && ['OFFICE_HEAD', 'ADMIN'].includes(role)" @click="exportWord">导出 Word</el-button>
        <el-button @click="router.back()">返回</el-button>
      </div>
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
              <el-button v-if="canReview" type="primary" @click="addItem" class="add-item-btn">
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
                <el-input v-if="isEditable" v-model="row.content" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" placeholder="工作内容" size="small" />
                <span v-else style="white-space: pre-wrap;">{{ row.content }}</span>
              </template>
            </el-table-column>
            <el-table-column label="负责人/部门" width="140">
              <template #default="{row}">
                <el-input v-if="isEditable" v-model="row.responsible" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" placeholder="负责人" size="small" />
                <span v-else style="white-space: pre-wrap;">{{ row.responsible }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center" v-if="isEditable">
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
              <el-button type="warning" plain :icon="Check" @click="saveChanges" :loading="acting">
                仅保存修改
              </el-button>
              <el-button type="success" :icon="Check" @click="approve" :loading="acting" v-if="role !== 'PRINCIPAL'">
                {{ (role === 'OFFICE_HEAD' && plan.status === 'DEPT_APPROVED') ? '通过并交校长审核' : '通过并保存修改' }}
              </el-button>
              <el-button type="primary" :icon="Check" @click="approveAndPublish" :loading="acting" v-if="['OFFICE_HEAD', 'PRINCIPAL'].includes(role)">
                一键发布
              </el-button>
              <el-button type="danger" :icon="Close" @click="reject" :loading="acting">退 回</el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 二次修改区 -->
        <el-card shadow="never" class="action-card" v-if="canEditPublished">
          <template #header>二次修改 (已发布状态)</template>
          <el-form label-width="100px">
            <el-form-item>
              <el-button type="warning" :icon="Check" @click="savePublished" :loading="acting">保存二次修改</el-button>
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
import { Check, Close, Plus, Delete, Download } from '@element-plus/icons-vue'

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
  const creatorId = plan.value.creator_id
  const userId = userStore.userInfo?.userId
  
  if (r === 'ADMIN') return ['SUBMITTED','DEPT_APPROVED','OFFICE_APPROVED'].includes(s)
  
  // 部门主任或教务处主任审核本部门提交的计划，但不能审核自己提交的（因为自己提交的免审，会自动跳到下一步）
  if (r === 'DEPT_HEAD' || r === 'ACADEMIC_HEAD') {
    return s === 'SUBMITTED' && creatorId !== userId
  }
  
  if (r === 'OFFICE_HEAD') return ['DEPT_APPROVED', 'OFFICE_APPROVED'].includes(s)
  if (r === 'PRINCIPAL') return s === 'OFFICE_APPROVED'
  return false
})

const canEditPublished = computed(() => {
  const s = plan.value.status
  const r = role.value
  return s === 'PUBLISHED' && ['OFFICE_HEAD', 'ADMIN'].includes(r)
})

const isEditable = computed(() => canReview.value || canEditPublished.value)

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
    await request.post(`/reviews/${route.params.id}/approve`, { comment: comment.value, updatedItems: plan.value.items, publish: false })
    ElMessage.success('审核通过')
    router.push('/review/pending')
  } finally { acting.value = false }
}

async function approveAndPublish() {
  await ElMessageBox.confirm('确认一键发布并保存修改？发布后所有人可见。', '提示', { type: 'warning' })
  acting.value = true
  try {
    await request.post(`/reviews/${route.params.id}/approve`, { comment: comment.value, updatedItems: plan.value.items, publish: true })
    ElMessage.success('已发布')
    router.push('/review/pending')
  } finally { acting.value = false }
}

async function saveChanges() {
  acting.value = true
  try {
    await request.post(`/reviews/${route.params.id}/save`, { updatedItems: plan.value.items })
    ElMessage.success('暂存修改成功')
  } finally { acting.value = false }
}

async function savePublished() {
  await ElMessageBox.confirm('确认保存对已发布计划的二次修改？', '提示', { type: 'warning' })
  acting.value = true
  try {
    await request.put(`/plans/${route.params.id}/published-items`, { updatedItems: plan.value.items })
    ElMessage.success('修改已保存')
    loadData()
  } finally { acting.value = false }
}

function exportWord() {
  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset="utf-8"><title>${plan.value.title}</title></head>
    <body>
      <h2 style="text-align:center">${plan.value.title}</h2>
      <p><strong>部门：</strong>${plan.value.dept_name || ''} &nbsp;&nbsp; <strong>日期：</strong>${formatDate(plan.value.start_date)} ~ ${formatDate(plan.value.end_date)}</p>
      <table border="1" cellspacing="0" cellpadding="5" style="width:100%;border-collapse:collapse;">
        <tr><th>日期</th><th>星期</th><th>工作内容</th><th>负责人/部门</th></tr>
        ${plan.value.items.map(i => `
          <tr>
            <td align="center">${formatDate(i.plan_date)}</td>
            <td align="center">${i.weekday}</td>
            <td>${i.content}</td>
            <td align="center">${i.responsible}</td>
          </tr>
        `).join('')}
      </table>
    </body>
    </html>
  `
  const blob = new Blob(['\ufeff', content], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${plan.value.title}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
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
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h2 { font-size: 24px; font-weight: 600; color: var(--color-text-primary, #164E63); margin: 0; }
.info-card, .items-card, .review-history, .action-card { margin-bottom: 20px; background: var(--color-bg-primary, #ffffff); border-color: var(--color-border-light, #E0F2FE); border-radius: 12px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.info-card:hover, .items-card:hover, .review-history:hover, .action-card:hover { box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04); }
.card-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: var(--color-text-primary, #164E63); }
.remark { margin-top: 16px; font-size: 14px; color: var(--color-text-secondary, #64748B); padding: 12px; background: var(--color-bg-secondary, #F8FAFC); border-radius: 8px; }
.reviewer { font-weight: 500; margin: 0 8px; color: var(--color-text-primary, #334155); }
.comment { color: var(--color-text-secondary, #64748B); font-size: 13px; margin-top: 4px; padding-left: 8px; border-left: 2px solid var(--color-border-medium, #CBD5E1); }

/* 深色模式支持 */
:root.dark-mode .page-header h2 { color: var(--color-text-primary, #f8fafc); }
:root.dark-mode .remark { color: var(--color-text-secondary, #94a3b8); }
:root.dark-mode .comment { color: var(--color-text-secondary, #94a3b8); }
:root.dark-mode .reviewer { color: var(--color-text-primary, #cbd5e1); }

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

:deep(.el-descriptions__label) { background-color: var(--color-bg-secondary, #F8FAFC) !important; color: var(--color-text-secondary, #64748B); font-weight: 500; }
:deep(.el-descriptions__content) { color: var(--color-text-primary, #164E63); font-weight: 500; }
:deep(.el-table) { --el-table-border-color: var(--color-border-light, #E0F2FE); --el-table-header-bg-color: var(--color-bg-secondary, #F8FAFC); --el-table-header-text-color: var(--color-text-primary, #164E63); --el-table-text-color: var(--color-text-secondary, #64748B); --el-table-row-hover-bg-color: var(--color-primary-bg-subtle, rgba(59, 130, 246, 0.05)); --el-table-tr-bg-color: var(--color-bg-primary, #ffffff); background-color: var(--color-bg-primary, #ffffff); color: var(--color-text-primary, #334155); }
:deep(.el-table__body) tr.el-table__row--striped td.el-table__cell { background-color: var(--color-bg-secondary, #F8FAFC); }
:deep(.el-table td.el-table__cell), :deep(.el-table th.el-table__cell.is-leaf) { border-bottom: 1px solid var(--color-border-light, #E0F2FE); }
:deep(.el-table__empty-text) { color: var(--color-text-secondary, #64748B); }
</style>
