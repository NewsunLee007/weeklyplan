<template>
  <div class="page-container">
    <div class="page-header">
      <h2>整合审核</h2>
      <div>
        <el-button type="success" :icon="Download" @click="exportWord">导出全校整合 Word</el-button>
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

        <!-- 部门主任：按部门Tab展示 -->
        <el-tabs v-if="role === 'DEPT_HEAD' && deptGroups.length > 0" v-model="activeDeptTab" type="border-card" style="margin-top: 16px">
          <el-tab-pane v-for="dept in deptGroups" :key="dept.deptId || 'unknown'" :label="dept.deptName" :name="(dept.deptId || 0).toString()">
            <div class="dept-info">
              <strong>{{ dept.deptName }}</strong> - 共 <strong>{{ dept.items?.length || 0 }}</strong> 条计划
            </div>
            <el-table :data="dept.items" border stripe size="small" style="margin-top: 12px">
              <el-table-column type="index" label="序" width="50" align="center" />
              <el-table-column prop="creator_name" label="提交人" width="100" />
              <el-table-column label="日期" width="110">
                <template #default="{row}">
                  {{ formatDate(row.plan_date) }}
                </template>
              </el-table-column>
              <el-table-column prop="weekday" label="星期" width="70" align="center" />
              <el-table-column prop="content" label="工作内容">
                <template #default="{row}">
                  <el-input v-model="row.content" type="textarea" :rows="1" placeholder="工作内容" size="small" />
                </template>
              </el-table-column>
              <el-table-column prop="responsible" label="负责人" width="120">
                <template #default="{row}">
                  <el-input v-model="row.responsible" placeholder="负责人" size="small" />
                </template>
              </el-table-column>
              <el-table-column label="操作" width="70" align="center">
                <template #default="{$index}">
                  <el-button link type="danger" :icon="Delete" @click="removeItemInDept(dept.deptId, $index)" />
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>

        <!-- 办公室主任：按部门Tab展示 -->
        <el-tabs v-else-if="role === 'OFFICE_HEAD' && officeGroups.length > 0" v-model="activeOfficeTab" type="border-card" style="margin-top: 16px">
          <el-tab-pane v-for="dept in officeGroups" :key="dept.deptId || 'unknown'" :label="dept.deptName" :name="(dept.deptId || 0).toString()">
            <div class="dept-info">
              <strong>{{ dept.deptName }}</strong> - 共 <strong>{{ dept.items?.length || 0 }}</strong> 条计划
            </div>
            <el-table :data="dept.items" border stripe size="small" style="margin-top: 12px">
              <el-table-column type="index" label="序" width="50" align="center" />
              <el-table-column prop="creator_name" label="提交人" width="100" />
              <el-table-column label="日期" width="110">
                <template #default="{row}">
                  {{ formatDate(row.plan_date) }}
                </template>
              </el-table-column>
              <el-table-column prop="weekday" label="星期" width="70" align="center" />
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
                  <el-button link type="danger" :icon="Delete" @click="removeItemInOffice(dept.deptId, $index)" />
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>

        <!-- 校长：按星期时间先后罗列 -->
        <div v-else-if="role === 'PRINCIPAL'">
          <el-table :data="groupedByDate" border stripe size="small" style="margin-top: 16px">
            <el-table-column type="index" label="序" width="50" align="center" />
            <el-table-column prop="plan_date" label="日期" width="110" />
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

        <!-- 管理员：按星期时间先后罗列 -->
        <div v-else>
          <el-table :data="groupedByDate" border stripe size="small" style="margin-top: 16px">
            <el-table-column type="index" label="序" width="50" align="center" />
            <el-table-column prop="plan_date" label="日期" width="110" />
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
              <el-button type="success" :icon="Check" @click="approveAll" :loading="acting">整体审核通过并保存修改</el-button>
              <el-button type="danger" :icon="Close" @click="rejectAll" :loading="acting">整体退回</el-button>
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

const semester = ref('2025-2')
const weekNumber = ref(6)
const data = reactive({ plans: [], items: [] })
const loading = ref(false)
const acting = ref(false)
const comment = ref('')

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

// 部门主任：按部门分组（只显示本部门）
const deptGroups = computed(() => {
  const map = {}
  data.items.forEach(item => {
    // 过滤掉没有dept_id的条目
    if (item.dept_id == null) return
    if (!map[item.dept_id]) {
      map[item.dept_id] = { deptId: item.dept_id, deptName: item.dept_name || '未知部门', items: [] }
    }
    map[item.dept_id].items.push(item)
  })
  return Object.values(map).sort((a, b) => a.deptId - b.deptId)
})

// 办公室主任：按部门分组（显示所有部门）
const officeGroups = computed(() => {
  const map = {}
  data.items.forEach(item => {
    // 过滤掉没有dept_id的条目
    if (item.dept_id == null) return
    if (!map[item.dept_id]) {
      map[item.dept_id] = { deptId: item.dept_id, deptName: item.dept_name || '未知部门', items: [] }
    }
    map[item.dept_id].items.push(item)
  })
  return Object.values(map).sort((a, b) => a.deptId - b.deptId)
})

// 校长/管理员：按日期排序
const groupedByDate = computed(() => {
  return [...data.items].sort((a, b) => {
    if (a.plan_date !== b.plan_date) {
      return a.plan_date.localeCompare(b.plan_date)
    }
    return (a.dept_id || 0) - (b.dept_id || 0)
  })
})

async function loadData() {
  loading.value = true
  try {
    const res = await request.get(`/reviews/consolidated/${weekNumber.value}/${semester.value}`)
    data.plans = res.plans || []
    data.items = res.items || []
    // 默认选中第一个Tab
    if (role.value === 'DEPT_HEAD' && deptGroups.value.length > 0 && deptGroups.value[0].deptId !== undefined) {
      activeDeptTab.value = deptGroups.value[0].deptId.toString()
    } else if (role.value === 'OFFICE_HEAD' && officeGroups.value.length > 0 && officeGroups.value[0].deptId !== undefined) {
      activeOfficeTab.value = officeGroups.value[0].deptId.toString()
    }
  } finally { loading.value = false }
}

function removeItem(index) {
  data.items.splice(index, 1)
}

function removeItemInDept(deptId, index) {
  const group = deptGroups.value.find(g => g.deptId == deptId)
  if (group) {
    const item = group.items[index]
    const globalIndex = data.items.findIndex(i => i.id === item.id)
    if (globalIndex !== -1) {
      data.items.splice(globalIndex, 1)
    }
  }
}

function removeItemInOffice(deptId, index) {
  const group = officeGroups.value.find(g => g.deptId == deptId)
  if (group) {
    const item = group.items[index]
    const globalIndex = data.items.findIndex(i => i.id === item.id)
    if (globalIndex !== -1) {
      data.items.splice(globalIndex, 1)
    }
  }
}

async function approveAll() {
  await ElMessageBox.confirm(`确认审核通过并保存所有修改？涉及 ${data.plans.length} 个计划`, '提示', { type: 'success' })
  acting.value = true
  try {
    await request.post(`/reviews/consolidated/${weekNumber.value}/${semester.value}/approve`, {
      comment: comment.value,
      updatedItems: data.items,
      publish: false
    })
    ElMessage.success(`已审核通过 ${data.plans.length} 个计划`)
    router.push('/review/pending')
  } finally { acting.value = false }
}

async function approveAndPublishAll() {
  await ElMessageBox.confirm(`确认批量一键发布？发布后全校可见。涉及 ${data.plans.length} 个计划`, '警告', { type: 'warning' })
  acting.value = true
  try {
    await request.post(`/reviews/consolidated/${weekNumber.value}/${semester.value}/approve`, {
      comment: comment.value,
      updatedItems: data.items,
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
    // 批量退回（需要逐个调用 reject）
    for (const plan of data.plans) {
      await request.post(`/reviews/${plan.id}/reject`, { comment: comment.value })
    }
    ElMessage.success(`已退回 ${data.plans.length} 个计划`)
    router.push('/review/pending')
  } finally { acting.value = false }
}

onMounted(loadData)
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
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.5px;
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

.el-card {
  border: 1px solid var(--color-border-light);
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.el-card:hover {
  box-shadow: var(--shadow-md);
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
  background: linear-gradient(135deg, var(--color-success) 0%, #34D399 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  font-weight: 600;
}

.el-button--danger {
  background: linear-gradient(135deg, var(--color-danger) 0%, #F87171 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  font-weight: 600;
}

.el-button--primary {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
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
