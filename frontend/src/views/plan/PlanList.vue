<template>
  <div class="page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h2 class="page-title">我的计划</h2>
        <p class="page-description">管理和查看您创建的所有工作计划</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="router.push('/plan/create')" class="create-btn">
        新建计划
      </el-button>
    </div>

    <!-- 筛选区域 -->
    <div class="filter-section">
      <el-card class="filter-card" shadow="never">
        <el-form :model="filter" inline class="filter-form">
          <el-form-item label="学期" class="filter-item">
            <el-input v-model="filter.semester" placeholder="如 2025-2" clearable class="filter-input" />
          </el-form-item>
          <el-form-item label="周次" class="filter-item">
            <el-select v-model="filter.week_number" placeholder="全部" clearable class="filter-select">
              <el-option v-for="w in 20" :key="w" :label="`第${w}周`" :value="w" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" class="filter-item">
            <el-select v-model="filter.status" placeholder="全部" clearable class="filter-select">
              <el-option v-for="(v,k) in STATUS_MAP" :key="k" :label="v.label" :value="k" />
            </el-select>
          </el-form-item>
          <el-form-item class="filter-item filter-actions">
            <el-button type="primary" @click="loadData" class="filter-btn filter-search-btn">
              <el-icon><Search /></el-icon> 查询
            </el-button>
            <el-button @click="resetFilter" class="filter-btn filter-reset-btn">
              <el-icon><Refresh /></el-icon> 重置
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(8, 145, 178, 0.15); color: #0891B2;">
          <el-icon><Document /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ list.length }}</div>
          <div class="stat-label">总计划数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(34, 197, 94, 0.15); color: #22C55E;">
          <el-icon><Check /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ list.filter(p => p.status === 'COMPLETED').length }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B;">
          <el-icon><Clock /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ list.filter(p => ['DRAFT', 'REJECTED'].includes(p.status)).length }}</div>
          <div class="stat-label">待处理</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background: rgba(239, 68, 68, 0.15); color: #EF4444;">
          <el-icon><AlertCircle /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ list.filter(p => p.status === 'REJECTED').length }}</div>
          <div class="stat-label">已拒绝</div>
        </div>
      </div>
    </div>

    <!-- 按部门Tab展示 -->
    <el-card class="main-card" shadow="never" v-loading="loading">
      <el-tabs v-model="activeDeptTab" type="card" class="dept-tabs">
        <el-tab-pane label="全部" name="all" class="tab-pane">
          <div class="table-wrapper">
            <el-table :data="filteredPlans('all')" stripe class="plan-table">
              <el-table-column prop="semester" label="学期" width="100" class="table-column" />
              <el-table-column prop="week_number" label="周次" width="70" align="center" class="table-column">
                <template #default="{row}">
                  <div class="week-badge">{{ row.week_number }}周</div>
                </template>
              </el-table-column>
              <el-table-column prop="title" label="标题" min-width="250" class="table-column">
                <template #default="{row}">
                  <div class="plan-title" @click="router.push(`/plan/detail/${row.id}`)">{{ row.title }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="dept_name" label="部门" width="120" class="table-column" />
              <el-table-column label="日期范围" width="180" class="table-column">
                <template #default="{row}">
                  <div class="date-range">{{ row.start_date }} ~ {{ row.end_date }}</div>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="130" align="center" class="table-column">
                <template #default="{row}">
                  <el-tag :type="STATUS_MAP[row.status]?.type" class="status-tag">{{ STATUS_MAP[row.status]?.label }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="240" fixed="right" class="table-column">
                <template #default="{row}">
                  <div class="table-actions">
                    <el-button link type="primary" @click="router.push(`/plan/detail/${row.id}`)" class="action-btn view-btn">
                      <el-icon><View /></el-icon> 详情
                    </el-button>
                    <el-button link type="primary" v-if="canEdit(row)" @click="router.push(`/plan/edit/${row.id}`)" class="action-btn edit-btn">
                      <el-icon><Edit /></el-icon> 编辑
                    </el-button>
                    <el-button link type="primary" v-if="canSubmit(row)" @click="submitPlan(row)" class="action-btn submit-btn">
                      <el-icon><Check /></el-icon> 提交
                    </el-button>
                    <el-button link type="danger" v-if="canDelete(row)" @click="deletePlan(row)" class="action-btn delete-btn">
                      <el-icon><Delete /></el-icon> 删除
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="getTotal('all')"
            layout="total, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            class="pagination"
          />
        </el-tab-pane>
        <el-tab-pane
          v-for="dept in userDepts"
          :key="dept.deptId"
          :label="dept.deptName"
          :name="dept.deptId.toString()"
          class="tab-pane"
        >
          <div class="table-wrapper">
            <el-table :data="filteredPlans(dept.deptId)" stripe class="plan-table">
              <el-table-column prop="semester" label="学期" width="100" class="table-column" />
              <el-table-column prop="week_number" label="周次" width="70" align="center" class="table-column">
                <template #default="{row}">
                  <div class="week-badge">{{ row.week_number }}周</div>
                </template>
              </el-table-column>
              <el-table-column prop="title" label="标题" min-width="250" class="table-column">
                <template #default="{row}">
                  <div class="plan-title" @click="router.push(`/plan/detail/${row.id}`)">{{ row.title }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="dept_name" label="部门" width="120" class="table-column" />
              <el-table-column label="日期范围" width="180" class="table-column">
                <template #default="{row}">
                  <div class="date-range">{{ row.start_date }} ~ {{ row.end_date }}</div>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="130" align="center" class="table-column">
                <template #default="{row}">
                  <el-tag :type="STATUS_MAP[row.status]?.type" class="status-tag">{{ STATUS_MAP[row.status]?.label }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="240" fixed="right" class="table-column">
                <template #default="{row}">
                  <div class="table-actions">
                    <el-button link type="primary" @click="router.push(`/plan/detail/${row.id}`)" class="action-btn view-btn">
                      <el-icon><View /></el-icon> 详情
                    </el-button>
                    <el-button link type="primary" v-if="canEdit(row)" @click="router.push(`/plan/edit/${row.id}`)" class="action-btn edit-btn">
                      <el-icon><Edit /></el-icon> 编辑
                    </el-button>
                    <el-button link type="primary" v-if="canSubmit(row)" @click="submitPlan(row)" class="action-btn submit-btn">
                      <el-icon><Check /></el-icon> 提交
                    </el-button>
                    <el-button link type="danger" v-if="canDelete(row)" @click="deletePlan(row)" class="action-btn delete-btn">
                      <el-icon><Delete /></el-icon> 删除
                    </el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="getTotal(dept.deptId)"
            layout="total, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            class="pagination"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../../stores/user'
import request from '../../utils/request'
import { STATUS_MAP } from '../../utils/helper'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Refresh, View, Edit, Check, Delete, Document, Clock, AlertCircle } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const list = ref([])
const loading = ref(false)
const activeDeptTab = ref('all')
const filter = reactive({ semester: '', week_number: '', status: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

// 用户所属部门
const userDepts = computed(() => {
  const depts = userStore.userInfo?.departments || []
  return depts.map(d => ({
    deptId: d.id,
    deptName: d.name
  }))
})

// 按部门过滤计划
function filteredPlans(deptId) {
  if (deptId === 'all') return list.value
  return list.value.filter(p => p.department_id == deptId)
}

// 获取某个部门的计划总数
function getTotal(deptId) {
  return filteredPlans(deptId).length
}

function canEdit(row) { return ['DRAFT','REJECTED'].includes(row.status) }
function canSubmit(row) { return ['DRAFT','REJECTED'].includes(row.status) }
function canDelete(row) { return row.status === 'DRAFT' }

async function loadData() {
  loading.value = true
  try {
    const params = { page: pagination.page, pageSize: pagination.pageSize }
    if (filter.semester) params.semester = filter.semester
    if (filter.week_number) params.week_number = filter.week_number
    if (filter.status) params.status = filter.status
    const res = await request.get('/plans', { params })
    list.value = res.records
    pagination.total = res.total
  } finally { loading.value = false }
}

function resetFilter() {
  filter.semester = ''; filter.week_number = ''; filter.status = ''
  pagination.page = 1
  loadData()
}

async function submitPlan(row) {
  await ElMessageBox.confirm('确认提交该计划进行审核？', '提示', { type: 'warning' })
  await request.post(`/plans/${row.id}/submit`)
  ElMessage.success('已提交审核')
  loadData()
}

async function deletePlan(row) {
  await ElMessageBox.confirm('确认删除该计划？', '警告', { type: 'warning' })
  await request.delete(`/plans/${row.id}`)
  ElMessage.success('已删除')
  loadData()
}

// 处理分页大小变化
function handleSizeChange(size) {
  pagination.pageSize = size
  pagination.page = 1
  loadData()
}

// 处理页码变化
function handleCurrentChange(page) {
  pagination.page = page
  loadData()
}

onMounted(loadData)
</script>

<style scoped>
.page-container {
  padding: 32px;
  max-width: 1400px;
  margin: 0 auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 页面头部 */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: #164E63;
  margin: 0;
  letter-spacing: -0.5px;
  transition: all 0.3s var(--transition-base);
}

.page-description {
  font-size: 14px;
  color: #64748B;
  margin: 0;
  transition: all 0.3s var(--transition-base);
}

.create-btn {
  height: 48px;
  padding: 0 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.create-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(8, 145, 178, 0.4);
}

.create-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.create-btn:hover::before {
  left: 100%;
}

/* 筛选区域 */
.filter-section {
  margin-bottom: 24px;
  transition: all 0.3s var(--transition-base);
}

.filter-card {
  background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%);
  border: 1px solid #E0F2FE;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.filter-card:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1);
  border-color: #BAE6FD;
  transform: translateY(-2px);
}

.filter-form {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  transition: all 0.3s var(--transition-base);
}

.filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s var(--transition-base);
}

.filter-input,
.filter-select {
  min-width: 120px;
  border-radius: 8px;
  border: 1px solid #E0F2FE;
  transition: all 0.3s var(--transition-base);
}

.filter-input:focus,
.filter-select:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filter-actions {
  margin-left: auto;
  display: flex;
  gap: 12px;
  transition: all 0.3s var(--transition-base);
}

.filter-btn {
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
}

.filter-search-btn {
  background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
  border: none;
  box-shadow: 0 2px 8px rgba(8, 145, 178, 0.2);
}

.filter-search-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
}

.filter-reset-btn {
  background: #FFFFFF;
  border: 1px solid #E0F2FE;
  color: #64748B;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.filter-reset-btn:hover {
  background: #F8FAFC;
  border-color: #BAE6FD;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}

/* 统计卡片 */
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
  transition: all 0.3s var(--transition-base);
}

.stat-card {
  background: #FFFFFF;
  border: 1px solid #E0F2FE;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background: linear-gradient(90deg, #0891B2, #06B6D4);
}

.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(8, 145, 178, 0.12);
  border-color: #BAE6FD;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s var(--transition-base);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.stat-info {
  flex: 1;
  transition: all 0.3s var(--transition-base);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #164E63;
  line-height: 1;
  margin-bottom: 4px;
  transition: all 0.3s var(--transition-base);
}

.stat-label {
  font-size: 13px;
  color: #64748B;
  font-weight: 500;
  transition: all 0.3s var(--transition-base);
}

/* 主卡片 */
.main-card {
  border: 1px solid #E0F2FE;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.main-card:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1);
  border-color: #BAE6FD;
}

/* 标签页 */
.dept-tabs {
  background: #F8FAFC;
  border-radius: 16px 16px 0 0;
  transition: all 0.3s var(--transition-base);
}

.el-tabs__item {
  color: #64748B;
  font-weight: 500;
  transition: all 0.3s var(--transition-base);
  border-radius: 8px 8px 0 0;
  padding: 12px 24px;
}

.el-tabs__item:hover {
  color: #3B82F6;
  background: rgba(59, 130, 246, 0.05);
}

.el-tabs__item.is-active {
  color: #3B82F6;
  font-weight: 600;
  background: #FFFFFF;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.tab-pane {
  padding: 24px;
  transition: all 0.3s var(--transition-base);
}

/* 表格 */
.table-wrapper {
  margin-bottom: 20px;
  transition: all 0.3s var(--transition-base);
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.plan-table {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s var(--transition-base);
}

.plan-table th {
  background: linear-gradient(90deg, #F8FAFC 0%, #FFFFFF 100%);
  color: #164E63;
  font-weight: 600;
  padding: 16px;
  border-bottom: 1px solid #E0F2FE;
}

.plan-table .el-table__row:hover td {
  background: rgba(59, 130, 246, 0.05);
}

.plan-table .el-table__row {
  transition: all 0.2s var(--transition-base);
}

.plan-table .el-table__row:hover {
  transform: translateX(4px);
}

.table-column {
  transition: all 0.3s var(--transition-base);
}

/* 周次徽章 */
.week-badge {
  background: rgba(59, 130, 246, 0.1);
  color: #3B82F6;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s var(--transition-base);
}

/* 计划标题 */
.plan-title {
  color: #164E63;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s var(--transition-base);
  display: inline-block;
  position: relative;
}

.plan-title:hover {
  color: #3B82F6;
  transform: translateX(4px);
}

.plan-title::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: #3B82F6;
  transition: width 0.3s var(--transition-base);
}

.plan-title:hover::after {
  width: 100%;
}

/* 日期范围 */
.date-range {
  font-size: 13px;
  color: #64748B;
  transition: all 0.3s var(--transition-base);
}

/* 状态标签 */
.status-tag {
  border-radius: 12px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s var(--transition-base);
}

/* 表格操作 */
.table-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  transition: all 0.3s var(--transition-base);
}

.action-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.view-btn:hover {
  color: #3B82F6;
}

.edit-btn:hover {
  color: #10B981;
}

.submit-btn:hover {
  color: #F59E0B;
}

.delete-btn:hover {
  color: #EF4444;
}

/* 分页 */
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  transition: all 0.3s var(--transition-base);
}

.el-pagination button {
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.el-pagination button:hover {
  color: #3B82F6;
  transform: translateY(-2px);
}

.el-pagination.is-background .el-pager li {
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.el-pagination.is-background .el-pager li:hover {
  color: #3B82F6;
  transform: translateY(-2px);
}

.el-pagination.is-background .el-pager li.is-active {
  background: linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%);
  color: #FFFFFF;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .page-container {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .filter-form {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-actions {
    margin-left: 0;
    justify-content: space-between;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .tab-pane {
    padding: 16px;
  }

  .table-actions {
    flex-wrap: wrap;
  }

  .pagination {
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .page-container {
    padding: 24px;
  }

  .filter-form {
    gap: 12px;
  }

  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
