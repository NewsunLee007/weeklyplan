<template>
  <div class="page-container">
    <div class="page-header"><h2>待我审核</h2></div>

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
import { STATUS_MAP } from '../../utils/helper'
import dayjs from 'dayjs'

const router = useRouter()
const list = ref([])
const loading = ref(false)

function formatDateTime(val) {
  if (!val) return ''
  return dayjs(val).format('YYYY-MM-DD HH:mm:ss')
}

async function loadData() {
  loading.value = true
  try { list.value = await request.get('/reviews/pending') }
  finally { loading.value = false }
}
onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: #1e293b; }
</style>
