<template>
  <div class="page-container">
    <div class="page-header">
      <h2>我的计划</h2>
      <el-button type="primary" :icon="Plus" @click="router.push('/plan/create')">新建计划</el-button>
    </div>

    <!-- 筛选 -->
    <el-card class="filter-card" shadow="never">
      <el-form :model="filter" inline>
        <el-form-item label="学期">
          <el-input v-model="filter.semester" placeholder="如 2025-2" clearable style="width:120px" />
        </el-form-item>
        <el-form-item label="周次">
          <el-select v-model="filter.week_number" placeholder="全部" clearable style="width:100px">
            <el-option v-for="w in 20" :key="w" :label="`第${w}周`" :value="w" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filter.status" placeholder="全部" clearable style="width:130px">
            <el-option v-for="(v,k) in STATUS_MAP" :key="k" :label="v.label" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 按部门Tab展示 -->
    <el-card shadow="never" v-loading="loading">
      <el-tabs v-model="activeDeptTab" type="card">
        <el-tab-pane label="全部" name="all">
          <el-table :data="filteredPlans('all')" stripe>
            <el-table-column prop="semester" label="学期" width="100" />
            <el-table-column prop="week_number" label="周次" width="70" align="center">
              <template #default="{row}">第{{ row.week_number }}周</template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
            <el-table-column prop="dept_name" label="部门" width="120" />
            <el-table-column label="日期范围" width="180">
              <template #default="{row}">{{ row.start_date }} ~ {{ row.end_date }}</template>
            </el-table-column>
            <el-table-column label="状态" width="130" align="center">
              <template #default="{row}">
                <el-tag :type="STATUS_MAP[row.status]?.type">{{ STATUS_MAP[row.status]?.label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{row}">
                <el-button link type="primary" @click="router.push(`/plan/detail/${row.id}`)">详情</el-button>
                <el-button link type="primary" v-if="canEdit(row)" @click="router.push(`/plan/edit/${row.id}`)">编辑</el-button>
                <el-button link type="primary" v-if="canSubmit(row)" @click="submitPlan(row)">提交</el-button>
                <el-button link type="danger" v-if="canDelete(row)" @click="deletePlan(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="getTotal('all')"
            layout="total, prev, pager, next"
            @change="loadData"
            class="pagination"
          />
        </el-tab-pane>
        <el-tab-pane
          v-for="dept in userDepts"
          :key="dept.deptId"
          :label="dept.deptName"
          :name="dept.deptId.toString()"
        >
          <el-table :data="filteredPlans(dept.deptId)" stripe>
            <el-table-column prop="semester" label="学期" width="100" />
            <el-table-column prop="week_number" label="周次" width="70" align="center">
              <template #default="{row}">第{{ row.week_number }}周</template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
            <el-table-column prop="dept_name" label="部门" width="120" />
            <el-table-column label="日期范围" width="180">
              <template #default="{row}">{{ row.start_date }} ~ {{ row.end_date }}</template>
            </el-table-column>
            <el-table-column label="状态" width="130" align="center">
              <template #default="{row}">
                <el-tag :type="STATUS_MAP[row.status]?.type">{{ STATUS_MAP[row.status]?.label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{row}">
                <el-button link type="primary" @click="router.push(`/plan/detail/${row.id}`)">详情</el-button>
                <el-button link type="primary" v-if="canEdit(row)" @click="router.push(`/plan/edit/${row.id}`)">编辑</el-button>
                <el-button link type="primary" v-if="canSubmit(row)" @click="submitPlan(row)">提交</el-button>
                <el-button link type="danger" v-if="canDelete(row)" @click="deletePlan(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="getTotal(dept.deptId)"
            layout="total, prev, pager, next"
            @change="loadData"
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
import { Plus } from '@element-plus/icons-vue'

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

.filter-card {
  background-color: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-sm);
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

.el-tabs--card {
  background-color: var(--color-bg-secondary);
  border-radius: 12px 12px 0 0;
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

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.el-pagination button {
  border-radius: 8px;
  transition: all var(--transition-fast);
}

.el-pagination button:hover {
  color: var(--color-primary);
}

.el-pagination.is-background .el-pager li.is-active {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
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

  .filter-card {
    padding: 16px;
  }
}
</style>
