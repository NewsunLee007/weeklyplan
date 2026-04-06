<template>
  <div class="page-container">
    <div class="page-header">
      <h2>已发布计划</h2>
      <div class="header-actions">
        <el-button type="primary" :icon="Download" @click="exportSummary" :disabled="!filter.week_number">
          导出 Word
        </el-button>
        <!-- 因云端环境限制暂不支持直接导出PDF，如需PDF请导出Word后另存为
        <el-button type="success" :icon="Document" @click="exportSummaryPdf" :disabled="!filter.week_number">
          导出 PDF
        </el-button>
        -->
      </div>
    </div>

    <!-- 筛选 -->
    <el-card shadow="never" class="filter-card">
      <el-form :model="filter" inline class="filter-form">
        <el-form-item label="视图模式" class="filter-item">
          <el-radio-group v-model="viewMode" @change="loadData">
            <el-radio value="personal">个人视图</el-radio>
            <el-radio value="department">部门视图</el-radio>
            <el-radio value="school">全校视图</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="学期" class="filter-item">
          <el-input v-model="filter.semester" placeholder="如 2025-2" clearable class="filter-input" style="width:120px" />
        </el-form-item>
        <el-form-item label="周次" class="filter-item">
          <el-select v-model="filter.week_number" placeholder="全部" clearable class="filter-select" style="width:100px" popper-class="custom-dropdown">
            <el-option v-for="w in 20" :key="w" :label="`第${w}周`" :value="w" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-item filter-actions">
          <el-button type="primary" @click="loadData">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 个人视图：只看自己提交的条目 -->
    <el-card shadow="never" v-if="viewMode === 'personal' && personalItems.length">
      <template #header>我的已发布条目（{{ filter.week_number ? `第${filter.week_number}周` : '全部' }}）</template>
      <el-table :data="personalItems" border stripe size="small">
        <el-table-column type="index" label="序" width="50" align="center" />
        <el-table-column label="日期" width="110">
          <template #default="{row}">
            {{ formatDate(row.plan_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="weekday" label="星期" width="60" align="center" />
        <el-table-column prop="content" label="工作内容" />
        <el-table-column prop="responsible" label="负责人/部门" width="150" />
      </el-table>
    </el-card>

    <!-- 部门视图：按部门Tab展示（同一部门合并） -->
    <el-card shadow="never" v-if="viewMode === 'department' && deptGroups.length">
      <el-tabs v-model="activeTab" type="card">
        <el-tab-pane
          v-for="group in deptGroups"
          :key="group.deptId"
          :label="group.deptName"
          :name="(group.deptId || 0).toString()"
        >
          <div class="dept-plan-info">
            <strong>{{ group.deptName }}</strong>
            <span class="plan-count">共 {{ group.plans.length }} 个计划，{{ group.items.length }} 条工作内容</span>
          </div>
          <el-table :data="group.items" border stripe size="small" style="margin-top: 12px">
            <el-table-column type="index" label="序" width="50" align="center" />
            <el-table-column label="日期" width="110">
              <template #default="{row}">
                {{ formatDate(row.plan_date) }}
              </template>
            </el-table-column>
            <el-table-column prop="weekday" label="星期" width="60" align="center" />
            <el-table-column prop="content" label="工作内容" />
            <el-table-column prop="responsible" label="负责人/部门" width="150" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 全校视图：按日期整合全校所有条目 -->
    <el-card shadow="never" v-if="viewMode === 'school' && allItems.length">
      <template #header>全校已发布计划汇总（{{ filter.week_number ? `第${filter.week_number}周` : '全部' }}）</template>
      <el-table :data="allItems" border stripe size="small">
        <el-table-column type="index" label="序" width="50" align="center" />
        <el-table-column label="日期" width="110">
          <template #default="{row}">
            {{ formatDate(row.plan_date) }}
          </template>
        </el-table-column>
        <el-table-column prop="weekday" label="星期" width="60" align="center" />
        <el-table-column prop="dept_name" label="部门" width="110" />
        <el-table-column prop="content" label="工作内容" />
        <el-table-column prop="responsible" label="负责人/部门" width="150" />
      </el-table>
    </el-card>

    <el-empty v-if="!hasData" description="暂无已发布计划，请选择学期和周次查询" />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useUserStore } from '../../stores/user'
import request from '../../utils/request'
import { ElMessage } from 'element-plus'
import { Download } from '@element-plus/icons-vue'

const userStore = useUserStore()

const viewMode = ref('school') // personal | department | school
const plans = ref([])
const activeTab = ref('0')
const personalItems = ref([])
const allItems = ref([])
const departments = ref([]) // 部门列表
const filter = reactive({ semester: '', week_number: 1 })

async function loadConfig() {
  try {
    const configs = await request.get('/configs')
    const map = {}
    configs.forEach(c => { map[c.config_key] = c.config_value })
    if (map.current_semester) filter.semester = map.current_semester
    if (map.current_week_start) {
      const { calcWeekNumber } = await import('../../utils/helper')
      const weekFirstDay = parseInt(map.week_first_day) || 0
      const currentWeek = calcWeekNumber(map.current_week_start, weekFirstDay)
      const semesterWeeks = parseInt(map.semester_weeks) || 20
      // 已发布计划：默认显示当前周次（不加 1）
      filter.week_number = Math.min(Math.max(1, currentWeek), semesterWeeks)
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

const hasData = computed(() => {
  if (viewMode.value === 'personal') return personalItems.value.length > 0
  if (viewMode.value === 'department') return deptGroups.value.length > 0
  if (viewMode.value === 'school') return allItems.value.length > 0
  return false
})

// 从负责人的字段中提取部门名称
function extractDepartment(responsible) {
  if (!responsible) return '未分配部门'
  
  // 获取所有部门名称（注意：部门表字段名是 name，不是 dept_name）
  const deptNames = departments.value.map(d => d.name)
  console.log('提取部门 - responsible:', responsible, '部门列表:', deptNames)
  
  // 按部门名称长度降序排序，优先匹配更长的名称
  const sortedDepts = [...deptNames].sort((a, b) => b.length - a.length)
  
  // 遍历部门名称，查找包含的部门
  for (const deptName of sortedDepts) {
    if (responsible.includes(deptName)) {
      console.log('匹配到部门:', deptName)
      return deptName
    }
  }
  
  // 如果没有匹配到，尝试从 responsible 中分割出部门（按中文逗号、顿号、英文逗号分割）
  const parts = responsible.split(/[,，、]/).map(p => p.trim()).filter(p => p)
  if (parts.length > 0) {
    // 返回第一个部分作为部门（通常是主要部门）
    console.log('未匹配到，返回第一部分:', parts[0])
    return parts[0]
  }
  
  // 如果没有匹配到，返回"其他"
  console.log('未匹配到任何部门，返回其他')
  return '其他'
}

// 部门视图：从所有条目中提取部门并分组
const deptGroups = computed(() => {
  const map = {}
  
  // 遍历所有计划的条目
  plans.value.forEach(plan => {
    const items = plan.items || []
    items.forEach(item => {
      // 从 responsible 字段中提取部门
      const deptName = extractDepartment(item.responsible)
      console.log('条目:', item.content, 'responsible:', item.responsible, '提取的部门:', deptName)
      
      if (!map[deptName]) {
        map[deptName] = {
          deptId: departments.value.find(d => d.name === deptName)?.id || 0,
          deptName,
          plans: [],
          items: []
        }
      }
      
      // 添加计划（如果还未添加）
      if (!map[deptName].plans.some(p => p.id === plan.id)) {
        map[deptName].plans.push(plan)
      }
      
      // 添加条目
      map[deptName].items.push(item)
    })
  })
  
  console.log('最终分组结果:', map)
  
  return Object.values(map).sort((a, b) => {
    // 有 ID 的排前面，没有的排后面
    if (a.deptId !== 0 && b.deptId !== 0) return a.deptId - b.deptId
    if (a.deptId !== 0) return -1
    if (b.deptId !== 0) return 1
    return a.deptName.localeCompare(b.deptName)
  })
})

async function loadData() {
  // 先加载部门列表
  const depts = await request.get('/departments')
  departments.value = depts || []
  console.log('部门列表:', departments.value)
  
  const params = {}
  if (filter.semester) params.semester = filter.semester

  if (filter.week_number) {
    params.week_number = filter.week_number
    // 获取指定周次的已发布计划
    const data = await request.get(`/published/${filter.week_number}`, { params })
    plans.value = data
    console.log('计划数据:', plans.value)

    // 提取个人条目
    const myUserId = userStore.userInfo?.id
    personalItems.value = data
      .filter(p => p.creator_id === myUserId)
      .flatMap(p => (p.items || []).map(i => ({ ...i, dept_name: p.dept_name })))

    // 提取全校条目，按日期排序
    allItems.value = data
      .flatMap(p => (p.items || []).map(i => ({ ...i, dept_name: p.dept_name })))
      .sort((a, b) => a.plan_date.localeCompare(b.plan_date))
  } else {
    // 获取全部已发布计划
    const data = await request.get('/published', { params })
    plans.value = data

    // 个人条目
    const myUserId = userStore.userInfo?.id
    personalItems.value = data
      .filter(p => p.creator_id === myUserId)
      .flatMap(p => (p.items || []).map(i => ({ ...i, dept_name: p.dept_name })))

    // 全校条目
    allItems.value = data
      .flatMap(p => (p.items || []).map(i => ({ ...i, dept_name: p.dept_name })))
      .sort((a, b) => a.plan_date.localeCompare(b.plan_date))
  }

  console.log('部门分组:', deptGroups.value)

  // 设置部门视图的默认Tab
  if (deptGroups.value.length > 0) {
    activeTab.value = (deptGroups.value[0].deptId || 0).toString()
  }
}

async function exportPlan(plan) {
  const blob = await request.get(`/export/plan/${plan.id}`, { responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${plan.dept_name}第${plan.week_number}周工作计划.docx`
  a.click()
  URL.revokeObjectURL(url)
}

async function exportSummary() {
  if (!filter.week_number) return ElMessage.warning('请先选择周次')
  const params = {}
  if (filter.semester) params.semester = filter.semester
  const blob = await request.get(`/export/weekly-summary/${filter.week_number}`, { params, responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `第${filter.week_number}周全校工作计划汇总.docx`
  a.click()
  URL.revokeObjectURL(url)
}

// async function exportSummaryPdf() {
//   if (!filter.week_number) return ElMessage.warning('请先选择周次')
//   const params = {}
//   if (filter.semester) params.semester = filter.semester
//   const blob = await request.get(`/export/weekly-summary/${filter.week_number}/pdf`, { params, responseType: 'blob' })
//   const url = URL.createObjectURL(blob)
//   const a = document.createElement('a')
//   a.href = url
//   a.download = `第${filter.week_number}周全校工作计划汇总.pdf`
//   a.click()
//   URL.revokeObjectURL(url)
// }

onMounted(async () => {
  await loadConfig()
  if (filter.week_number) {
    await loadData()
  }
})
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h2 { font-size: 24px; font-weight: 600; color: var(--color-text-primary, #164E63); margin: 0; }
.header-actions { display: flex; gap: 12px; }
.filter-card { margin-bottom: 24px; background: var(--color-bg-primary, #ffffff); border-color: var(--color-border-light, #e2e8f0); border-radius: 16px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.filter-card:hover { box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1); border-color: var(--color-border-medium, #BAE6FD); }
.dept-plan-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; font-size: 14px; padding: 12px 16px; background: var(--color-bg-secondary, #f8fafc); border-radius: 8px; border: 1px solid var(--color-border-light, #E0F2FE); }
.dept-plan-info strong { color: var(--color-text-primary, #1e293b); font-size: 15px; }
.dept-plan-info .plan-count { color: var(--color-text-secondary, #64748b); font-size: 13px; }
.remark { margin-top: 10px; color: var(--color-text-secondary, #64748b); font-size: 13px; }

:deep(.el-card) {
  background: var(--color-bg-primary, #ffffff);
  border-color: var(--color-border-light, #e2e8f0);
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

:deep(.el-card__header) {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #164E63);
  border-bottom: 1px solid var(--color-border-light, #e2e8f0);
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

:deep(.el-table__empty-text) {
  color: var(--color-text-secondary, #64748B);
}

/* 标签页 */
:deep(.el-tabs--card > .el-tabs__header .el-tabs__item.is-active) {
  background-color: var(--color-bg-primary, #ffffff);
  border-bottom-color: var(--color-bg-primary, #ffffff);
  color: var(--color-primary, #3B82F6);
}

:root.dark-mode :deep(.el-tabs--card > .el-tabs__header .el-tabs__item.is-active) {
  border-bottom-color: var(--color-bg-primary, #ffffff);
}

:deep(.el-tabs--card > .el-tabs__header) {
  border-bottom: 1px solid var(--color-border-light, #e2e8f0);
}

:deep(.el-tabs--card > .el-tabs__header .el-tabs__nav) {
  border: 1px solid var(--color-border-light, #e2e8f0);
  border-bottom: none;
  border-radius: 4px 4px 0 0;
}

:deep(.el-tabs--card > .el-tabs__header .el-tabs__item) {
  border-left: 1px solid var(--color-border-light, #e2e8f0);
  color: var(--color-text-secondary, #64748b);
}

:deep(.el-pagination button) {
  background-color: var(--color-bg-secondary, #F8FAFC) !important;
  color: var(--color-text-secondary, #64748B);
}

:deep(.el-pagination.is-background .el-pager li) {
  background-color: var(--color-bg-secondary, #F8FAFC) !important;
  color: var(--color-text-secondary, #64748B);
}

:deep(.el-pagination.is-background .el-pager li.is-active) {
  background-color: var(--color-primary, #3B82F6) !important;
  color: #FFFFFF !important;
}

:deep(.el-input__wrapper),
:deep(.el-select__wrapper) {
  background-color: var(--color-bg-secondary, #F8FAFC);
  box-shadow: 0 0 0 1px var(--color-border-light, #E0F2FE) inset;
}

:deep(.el-input__inner),
:deep(.el-select__placeholder) {
  color: var(--color-text-primary, #164E63);
}

:deep(.el-select-dropdown__item) {
  color: var(--color-text-primary, #164E63);
}

:deep(.el-select-dropdown__item.hover),
:deep(.el-select-dropdown__item:hover) {
  background-color: var(--color-bg-secondary, #F8FAFC);
}
</style>
