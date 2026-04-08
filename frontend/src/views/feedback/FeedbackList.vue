<template>
  <div class="page-container">
    <div class="page-header">
      <h2>反馈管理</h2>
      <div class="header-actions">
        <el-button type="success" :icon="Download" @click="exportExcel" :disabled="!filter.week_number">
          导出本周汇总 (Excel)
        </el-button>
      </div>
    </div>

    <!-- 筛选 -->
    <el-card shadow="never" class="filter-card">
      <el-form :model="filter" inline class="filter-form">
        <el-form-item label="学期" class="filter-item">
          <el-input v-model="filter.semester" placeholder="如 2025-2026学年第二学期" clearable class="filter-input" style="width:200px" />
        </el-form-item>
        <el-form-item label="周次" class="filter-item">
          <el-select v-model="filter.week_number" placeholder="全部" clearable class="filter-select" style="width:120px" popper-class="custom-dropdown">
            <el-option v-for="w in 25" :key="w" :label="`第${w}周`" :value="w" />
          </el-select>
        </el-form-item>
        <el-form-item class="filter-item filter-actions">
          <el-button type="primary" @click="loadData">查询</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" style="margin-top: 20px">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="semester" label="学期" width="100" />
        <el-table-column prop="week_number" label="周次" width="70" align="center">
          <template #default="{row}">第{{ row.week_number }}周</template>
        </el-table-column>
        <el-table-column prop="title" label="工作内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="dept_name" label="部门" width="100" />
        <el-table-column prop="published_at" label="发布时间" width="160" />
        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{row}">
            <el-button 
              v-if="row.department_id === userStore.userInfo?.departmentId"
              :type="row.has_feedback ? 'success' : 'primary'" 
              size="small" 
              @click="router.push(`/feedback/plan/${row.id}`)"
            >
              {{ row.has_feedback ? '已反馈 (编辑)' : '填写反馈' }}
            </el-button>
            <el-button 
              v-else-if="['ADMIN', 'PRINCIPAL', 'OFFICE_HEAD'].includes(userStore.userInfo?.role)"
              type="info" 
              size="small" 
              @click="openPreview(row)"
            >
              查看明细
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 反馈预览弹窗 -->
    <el-dialog v-model="previewVisible" title="反馈明细" width="80%">
      <div v-if="previewPlan.title" class="preview-title">{{ previewPlan.title }}</div>
      <el-table :data="previewItems" border stripe size="small" v-loading="previewLoading">
        <el-table-column label="日期" width="110">
          <template #default="{row}">{{ formatDate(row.plan_date) }}</template>
        </el-table-column>
        <el-table-column prop="weekday" label="星期" width="60" align="center" />
        <el-table-column prop="content" label="工作内容" min-width="200">
          <template #default="{row}">
            <span style="white-space: pre-wrap;">{{ row.content }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="responsible" label="负责人" width="120">
          <template #default="{row}">
            <span style="white-space: pre-wrap;">{{ row.responsible }}</span>
          </template>
        </el-table-column>
        <el-table-column label="完成状态" width="100" align="center">
          <template #default="{row}">
            <el-tag :type="getStatusType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="feedback_content" label="反馈说明" min-width="200">
          <template #default="{row}">
            <span style="white-space: pre-wrap;">{{ row.feedback_content || '-' }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import request from '../../utils/request'
import { useUserStore } from '../../stores/user'
import { Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'

const router = useRouter()
const userStore = useUserStore()
const list = ref([])
const loading = ref(false)

const filter = reactive({
  semester: '',
  week_number: null
})

// 预览弹窗相关
const previewVisible = ref(false)
const previewLoading = ref(false)
const previewPlan = ref({})
const previewItems = ref([])

function formatDate(val) {
  if (!val) return ''
  return dayjs(val).format('YYYY-MM-DD')
}

function getStatusLabel(status) {
  const map = {
    'COMPLETED': '已完成',
    'PARTIALLY': '部分完成',
    'NOT_COMPLETED': '未完成',
    'PENDING': '待反馈'
  }
  return map[status] || '待反馈'
}

function getStatusType(status) {
  const map = {
    'COMPLETED': 'success',
    'PARTIALLY': 'warning',
    'NOT_COMPLETED': 'danger',
    'PENDING': 'info'
  }
  return map[status] || 'info'
}

async function loadData() {
  loading.value = true
  try {
    const res = await request.get('/published', { params: filter })
    list.value = res
  } finally { loading.value = false }
}

async function openPreview(row) {
  previewPlan.value = row
  previewVisible.value = true
  previewLoading.value = true
  try {
    const planData = await request.get(`/plans/${row.id}`)
    const feedbacks = await request.get('/feedbacks', { params: { plan_id: row.id } })
    const fbMap = {}
    feedbacks.forEach(fb => { fbMap[fb.plan_item_id] = fb })
    previewItems.value = (planData.items || []).map(item => {
      const fb = fbMap[item.id] || {}
      return { 
        ...item, 
        status: fb.status || 'PENDING', 
        feedback_content: fb.content || '' 
      }
    })
  } catch (e) {
    ElMessage.error('加载详情失败')
  } finally {
    previewLoading.value = false
  }
}

async function exportExcel() {
  if (!filter.semester || !filter.week_number) {
    return ElMessage.warning('请先选择学期和周次')
  }
  try {
    const response = await request.get('/feedbacks/export/excel', {
      params: {
        semester: filter.semester,
        weekNumber: filter.week_number
      },
      responseType: 'blob'
    })
    const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `周反馈汇总_${filter.semester}_第${filter.week_number}周.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error('导出失败，请重试')
  }
}

onMounted(async () => {
  // 尝试获取当前配置
  try {
    const stats = await request.get('/dashboard/stats')
    if (stats.currentSemester) filter.semester = stats.currentSemester
    if (stats.currentWeekNum) filter.week_number = stats.currentWeekNum
  } catch (e) {}
  loadData()
})
</script>

<style scoped>
.page-container {
  padding: 24px;
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

.preview-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #164E63);
  margin-bottom: 16px;
}

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

.el-button--primary {
  background: var(--color-primary, #3B82F6);
  border: none;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transition: all var(--transition-base);
  font-weight: 600;
}

.el-button--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
}

.el-button--success {
  background: var(--color-success, #10B981);
  border: none;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  transition: all var(--transition-base);
  font-weight: 600;
}

.el-button--success:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
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
}
</style>
