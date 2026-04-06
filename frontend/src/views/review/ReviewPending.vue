<template>
  <div class="page-container">
    <div class="page-header">
      <h2>待我审核</h2>
      <div>
        <el-button type="success" :icon="Download" @click="exportWord">导出 Word</el-button>
      </div>
    </div>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="semester" label="学期" width="100" />
        <el-table-column prop="week_number" label="周次" width="70" align="center">
          <template #default="{row}">第{{ row.week_number }}周</template>
        </el-table-column>
        <el-table-column prop="content" label="工作内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="dept_name" label="部门" width="100" />
        <el-table-column prop="creator_name" label="提交人" width="100" />
        <el-table-column label="状态" width="130" align="center">
          <template #default="{row}">
            <el-tag :type="STATUS_MAP[row.status]?.type">{{ STATUS_MAP[row.status]?.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="update_time" label="最后更新" width="160">
          <template #default="{row}">
            {{ formatDateTime(row.update_time) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{row}">
            <el-button type="primary" size="small" @click="router.push(`/review/detail/${row.id}`)">审核</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import request from '../../utils/request'
import { STATUS_MAP, calcWeekNumber } from '../../utils/helper'
import dayjs from 'dayjs'
import { Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const router = useRouter()
const list = ref([])
const loading = ref(false)
const semester = ref('')
const weekNumber = ref(1)

async function loadConfig() {
  try {
    const configs = await request.get('/configs')
    const map = {}
    configs.forEach(c => { map[c.config_key] = c.config_value })
    if (map.current_semester) semester.value = map.current_semester
    if (map.current_week_start) {
      const weekFirstDay = parseInt(map.week_first_day) || 0
      const currentWeek = calcWeekNumber(map.current_week_start, weekFirstDay)
      const semesterWeeks = parseInt(map.semester_weeks) || 20
      weekNumber.value = Math.min(Math.max(1, currentWeek + 1), semesterWeeks)
    }
  } catch (e) {
    console.warn('读取系统配置失败', e)
  }
}

function formatDateTime(val) {
  if (!val) return ''
  return dayjs(val).format('YYYY-MM-DD HH:mm:ss')
}

async function loadData() {
  loading.value = true
  try { list.value = await request.get('/reviews/pending') }
  finally { loading.value = false }
}

async function exportWord() {
  if (!semester.value || !weekNumber.value) return ElMessage.warning('未能获取当周配置')
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

onMounted(async () => {
  await loadConfig()
  if (weekNumber.value) {
    await loadData()
  }
})
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h2 { font-size: 24px; font-weight: 600; color: var(--color-text-primary, #164E63); margin: 0; }

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
</style>
