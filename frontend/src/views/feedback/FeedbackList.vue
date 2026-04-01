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
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="dept_name" label="部门" width="100" />
        <el-table-column prop="published_at" label="发布时间" width="160" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}">
            <el-button type="primary" size="small" @click="router.push(`/feedback/plan/${row.id}`)">填写反馈</el-button>
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
