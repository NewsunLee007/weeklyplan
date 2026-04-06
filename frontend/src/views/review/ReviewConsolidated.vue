<template>
  <div class="page-container">
    <div class="page-header">
      <h2>整合审核</h2>
      <div>
        <el-button type="success" :icon="Download" @click="exportWord">导出 Word</el-button>
        <el-button @click="router.back()">返回</el-button>
      </div>
    </div>

    <el-card shadow="never" v-loading="loading">
      <el-form :inline="true" label-width="80px" style="margin-bottom: 16px">
        <el-form-item label="学期">
          <el-input v-model="semester" style="width: 120px" />
        </el-form-item>
        <el-form-item label="周次">
          <el-input-number v-model="weekNumber" :min="1" :max="25" style="width: 120px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
        </el-form-item>
      </el-form>

      <el-alert v-if="!data.items || !data.items.length" type="info" :closable="false">暂无待审核的计划</el-alert>

      <template v-else>
        <div class="plan-summary">
          共 <strong>{{ data.plans.length }}</strong> 个计划，<strong>{{ data.items.length }}</strong> 条待审核条目
        </div>

        <div v-if="['DEPT_HEAD', 'ACADEMIC_HEAD', 'OFFICE_HEAD', 'PRINCIPAL', 'ADMIN'].includes(role)">
          <el-table :data="groupedByDate" border stripe size="small" style="margin-top: 16px">
            <el-table-column type="index" label="序" width="50" align="center" />
            <el-table-column label="日期" width="110">
              <template #default="{row}">
                {{ formatDate(row.plan_date) }}
              </template>
            </el-table-column>
            <el-table-column prop="weekday" label="星期" width="70" align="center" />
            <el-table-column prop="dept_name" label="部门" width="110" />
            <el-table-column prop="creator_name" label="提交人" width="100" />
            <el-table-column prop="content" label="工作内容">
              <template #default="{row}">
                <el-input v-model="row.content" type="textarea" :rows="1" placeholder="工作内容" size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="responsible" label="负责人/部门" width="130">
              <template #default="{row}">
                <el-input v-model="row.responsible" placeholder="负责人" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center">
              <template #default="{$index}">
                <el-button link type="danger" :icon="Delete" @click="removeItem($index)" />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 审核操作区 -->
        <div class="action-area" style="margin-top: 24px">
          <el-form label-width="100px">
            <el-form-item label="审核意见">
              <el-input v-model="comment" type="textarea" :rows="3" placeholder="请输入审核意见（退回时必填）" style="max-width: 600px" />
            </el-form-item>
            <el-form-item>
              <el-button type="success" :icon="Check" @click="approveAll" :loading="acting" v-if="role !== 'PRINCIPAL'">
                {{ role === 'OFFICE_HEAD' ? '批量通过并交校长审核' : '批量审核通过' }}
              </el-button>
              <el-button type="primary" :icon="Check" @click="approveAndPublishAll" :loading="acting" v-if="['OFFICE_HEAD', 'PRINCIPAL'].includes(role)">
                批量一键发布
              </el-button>
              <el-button type="danger" :icon="Close" @click="rejectAll" :loading="acting">批量退回</el-button>
            </el-form-item>
          </el-form>
        </div>
      </template>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import request from '../../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Close, Plus, Delete, Download } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()

const semester = ref('')
const weekNumber = ref(1)
const data = reactive({ plans: [], items: [] })
const loading = ref(false)
const acting = ref(false)
const comment = ref('')

async function loadConfig() {
  try {
    const configs = await request.get('/configs')
    const map = {}
    configs.forEach(c => { map[c.config_key] = c.config_value })
    if (map.current_semester) semester.value = map.current_semester
    
    // 如果有动态计算周次的逻辑，也可以加在这里
    if (map.current_week_start) {
      const { calcWeekNumber } = await import('../../utils/helper')
      const weekFirstDay = parseInt(map.week_first_day) || 0
      const currentWeek = calcWeekNumber(map.current_week_start, weekFirstDay)
      const semesterWeeks = parseInt(map.semester_weeks) || 20
      weekNumber.value = Math.min(Math.max(1, currentWeek + 1), semesterWeeks)
    }
  } catch (e) {
    console.warn('读取系统配置失败', e)
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const role = computed(() => userStore.userInfo?.role)
const activeDeptTab = ref('')
const activeOfficeTab = ref('')

// 所有角色：按日期排序
const groupedByDate = computed(() => {
  return [...data.items].sort((a, b) => {
    if (a.plan_date !== b.plan_date) {
      return a.plan_date.localeCompare(b.plan_date)
    }
    return (a.dept_id || 0) - (b.dept_id || 0)
  })
})

async function loadData() {
  if (!semester.value || !weekNumber.value) return
  loading.value = true
  try {
    const res = await request.get(`/reviews/consolidated/${weekNumber.value}/${semester.value}`)
    data.plans = res.plans || []
    data.items = res.items || []
  } finally { loading.value = false }
}

function removeItem(index) {
  data.items.splice(index, 1)
}

async function approveAll() {
  await ElMessageBox.confirm(`确认审核通过并保存所有修改？涉及 ${data.plans.length} 个计划`, '提示', { type: 'success' })
  acting.value = true
  try {
    const updatedItems = []
    data.items.forEach(i => { if(i.id || i._isNew) updatedItems.push(i) })
    await request.post(`/reviews/consolidated/${weekNumber.value}/${semester.value}/approve`, {
      comment: comment.value,
      updatedItems: updatedItems,
      publish: false
    })
    ElMessage.success(`操作成功`)
    router.push('/review/pending')
  } finally { acting.value = false }
}

async function approveAndPublishAll() {
  await ElMessageBox.confirm(`确认批量一键发布？发布后全校可见。涉及 ${data.plans.length} 个计划`, '警告', { type: 'warning' })
  acting.value = true
  try {
    const updatedItems = []
    data.items.forEach(i => { if(i.id || i._isNew) updatedItems.push(i) })
    await request.post(`/reviews/consolidated/${weekNumber.value}/${semester.value}/approve`, {
      comment: comment.value,
      updatedItems: updatedItems,
      publish: true
    })
    ElMessage.success(`操作成功，已发布 ${data.plans.length} 个计划`)
    router.push('/review/pending')
  } finally { acting.value = false }
}

async function exportWord() {
  try {
    const res = await request.get(`/export/weekly-summary/${weekNumber.value}?semester=${semester.value}&status=REVIEW`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data || res)
    const a = document.createElement('a')
    a.href = url
    a.download = `${semester.value}第${weekNumber.value}周整合计划.docx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

async function rejectAll() {
  if (!comment.value.trim()) return ElMessage.warning('退回时必须填写审核意见')
  await ElMessageBox.confirm(`确认整体退回？涉及 ${data.plans.length} 个计划`, '警告', { type: 'warning' })
  acting.value = true
  try {
    await request.post(`/reviews/consolidated/${weekNumber.value}/${semester.value}/reject`, {
      comment: comment.value
    })
    ElMessage.success(`已退回 ${data.plans.length} 个计划`)
    router.push('/review/pending')
  } finally { acting.value = false }
}

onMounted(async () => {
  await loadConfig()
  if (semester.value && weekNumber.value) {
    await loadData()
  }
})
</script>

<style scoped>
.page-container {
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary, #164E63);
  margin: 0;
}

.plan-summary {
  padding: 16px;
  background: linear-gradient(135deg, var(--color-primary-bg) 0%, #F0FDFA 100%);
  border-radius: 12px;
  margin-bottom: 20px;
  font-size: 14px;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
}

.plan-summary strong {
  color: var(--color-primary-dark);
  font-weight: 600;
}

:deep(.el-card) {
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all var(--transition-base);
  background: var(--color-bg-primary, #ffffff);
}

:deep(.el-card:hover) {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1);
  border-color: var(--color-border-medium);
}

.el-table {
  border-radius: 12px;
  overflow: hidden;
}

.el-table th {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-weight: 600;
}

.el-table .el-table__row:hover td {
  background-color: var(--color-primary-bg);
}

.el-button--success {
  background: var(--color-success) !important;
  border: none;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  font-weight: 600;
}

.el-button--danger {
  background: var(--color-danger) !important;
  border: none;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  font-weight: 600;
}

.el-button--primary {
  background: var(--color-primary) !important;
  border: none;
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
  transition: all var(--transition-base);
  font-weight: 600;
}

.el-button--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(8, 145, 178, 0.4);
}

.el-tabs--border-card {
  background-color: var(--color-bg-secondary);
  border-radius: 12px;
  box-shadow: var(--shadow-sm);
}

.el-tabs__item {
  color: var(--color-text-secondary);
  font-weight: 500;
  transition: all var(--transition-fast);
}

.el-tabs__item.is-active {
  color: var(--color-primary);
  font-weight: 600;
}

.el-tabs__item:hover {
  color: var(--color-primary-light);
}

.dept-info {
  padding: 12px 16px;
  background: var(--color-bg-primary);
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-light);
}

.dept-info strong {
  color: var(--color-primary);
}

/* 表格样式修复 */
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

:deep(.el-tabs--border-card > .el-tabs__header) {
  background-color: var(--color-bg-secondary, #F8FAFC);
  border-bottom: 1px solid var(--color-border-light, #e2e8f0);
}

:deep(.el-tabs--border-card > .el-tabs__header .el-tabs__item.is-active) {
  color: var(--color-primary, #3B82F6);
  background-color: var(--color-bg-primary, #ffffff);
  border-right-color: var(--color-border-light, #e2e8f0);
  border-left-color: var(--color-border-light, #e2e8f0);
}

:root.dark-mode :deep(.el-tabs--border-card > .el-tabs__header .el-tabs__item.is-active) {
  background-color: var(--color-bg-primary, #ffffff);
}

:deep(.el-tabs--border-card) {
  border: 1px solid var(--color-border-light, #e2e8f0);
}

:deep(.el-table__empty-text) {
  color: var(--color-text-secondary, #64748b);
}

.action-area {
  padding: 24px;
  background: linear-gradient(135deg, var(--color-bg-tertiary) 0%, var(--color-bg-secondary) 100%);
  border-radius: 12px;
  border: 1px solid var(--color-border-default);
  box-shadow: var(--shadow-sm);
}

@media (max-width: 768px) {
  .page-container {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .page-header h2 {
    font-size: 20px;
  }

  .plan-summary {
    padding: 12px;
    font-size: 13px;
  }

  .action-area {
    padding: 16px;
  }
}

/* 深色模式支持 */
:global(.dark-mode) .page-header h2 {
  color: #f8fafc;
}

:global(.dark-mode) .plan-summary {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.1) 0%, rgba(8, 145, 178, 0.1) 100%);
  border: 1px solid rgba(96, 165, 250, 0.2);
  color: #cbd5e1;
}

:global(.dark-mode) .plan-summary strong {
  color: #60a5fa;
}

:global(.dark-mode) .dept-info {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(96, 165, 250, 0.2);
  color: #cbd5e1;
}

:global(.dark-mode) .dept-info strong {
  color: #60a5fa;
}

:global(.dark-mode) .action-area {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.8) 100%);
  border: 1px solid rgba(96, 165, 250, 0.2);
}
</style>
