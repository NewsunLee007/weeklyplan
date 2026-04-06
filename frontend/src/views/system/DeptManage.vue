<template>
  <div class="page-container">
    <div class="page-header">
      <h2>部门管理</h2>
      <div class="header-buttons">
        <el-button type="primary" :icon="Plus" @click="openDialog()">新增部门</el-button>
        <el-button type="success" :icon="Download" @click="exportDepts">导出部门</el-button>
        <el-upload
          class="upload-demo"
          action="#"
          :auto-upload="false"
          :on-change="handleImport"
          :show-file-list="false"
          accept=".xlsx,.xls"
        >
          <el-button type="warning" :icon="Upload">导入部门</el-button>
        </el-upload>
      </div>
    </div>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="name" label="部门名称" width="150" />
        <el-table-column prop="code" label="编码" width="150" />
        <el-table-column prop="sort_order" label="排序" width="80" align="center" />
        <el-table-column prop="description" label="描述" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{row}">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{row}">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="deleteDept(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="editDept ? '编辑部门' : '新增部门'" width="480px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
        <el-form-item label="部门名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" placeholder="英文大写，如 OFFICE" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="状态" v-if="editDept">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveDept">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import request from '../../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Download, Upload } from '@element-plus/icons-vue'

const list = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editDept = ref(null)
const formRef = ref()
const form = reactive({ name: '', code: '', sort_order: 0, description: '', status: 1 })
const rules = {
  name: [{ required: true, message: '请输入部门名称' }],
  code: [{ required: true, message: '请输入编码' }]
}

async function loadData() {
  loading.value = true
  try { list.value = await request.get('/departments') }
  finally { loading.value = false }
}

function openDialog(dept = null) {
  editDept.value = dept
  if (dept) {
    Object.assign(form, { name: dept.name, code: dept.code, sort_order: dept.sort_order, description: dept.description || '', status: dept.status })
  } else {
    Object.assign(form, { name: '', code: '', sort_order: 0, description: '', status: 1 })
  }
  dialogVisible.value = true
}

async function saveDept() {
  await formRef.value.validate()
  saving.value = true
  try {
    if (editDept.value) {
      await request.put(`/departments/${editDept.value.id}`, form)
    } else {
      await request.post('/departments', form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadData()
  } finally { saving.value = false }
}

async function deleteDept(row) {
  await ElMessageBox.confirm(`确认删除部门【${row.name}】？`, '警告', { type: 'warning' })
  await request.delete(`/departments/${row.id}`)
  ElMessage.success('删除成功')
  loadData()
}
async function exportDepts() {
  try {
    const blob = await request.get('/departments/export', { responseType: 'blob' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `部门数据_${new Date().toISOString().slice(0, 10)}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

async function handleImport(file) {
  const formData = new FormData()
  formData.append('file', file.raw)
  try {
    const res = await request.post('/departments/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    ElMessage.success(`导入成功，成功${res.success}条，失败${res.fail}条`)
    loadData()
  } catch (error) {
    ElMessage.error('导入失败')
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.page-header h2 { font-size: 24px; font-weight: 600; color: var(--color-text-primary, #164E63); margin: 0; }
.header-buttons { display: flex; gap: 10px; }

:deep(.el-card) {
  background: var(--color-bg-primary, #ffffff);
  border-color: var(--color-border-light, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
</style>
