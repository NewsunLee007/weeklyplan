<template>
  <div class="page-container">
    <div class="page-header">
      <h2>部门管理</h2>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增部门</el-button>
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
import { Plus } from '@element-plus/icons-vue'

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
onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: #1e293b; }
</style>
