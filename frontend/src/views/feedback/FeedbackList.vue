<template>
  <div class="page-container">
    <div class="page-header">
      <h2>反馈管理</h2>
    </div>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="semester" label="学期" width="100" />
        <el-table-column prop="week_number" label="周次" width="70" align="center">
          <template #default="{row}">第{{ row.week_number }}周</template>
        </el-table-column>
        <el-table-column prop="title" label="工作内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="dept_name" label="部门" width="100" />
        <el-table-column prop="published_at" label="发布时间" width="160" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}">
            <el-button 
              :type="row.has_feedback ? 'success' : 'primary'" 
              size="small" 
              @click="router.push(`/feedback/plan/${row.id}`)"
            >
              {{ row.has_feedback ? '已反馈 (编辑)' : '填写反馈' }}
            </el-button>
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

const router = useRouter()
const list = ref([])
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const res = await request.get('/published')
    list.value = res
  } finally { loading.value = false }
}
onMounted(loadData)
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
