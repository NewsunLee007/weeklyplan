<template>
  <div class="page-container">
    <div class="page-header">
      <h2>用户管理</h2>
      <div class="header-buttons">
        <el-button type="primary" :icon="Plus" @click="openDialog()">新增用户</el-button>
        <el-button type="success" :icon="Download" @click="exportUsers">导出用户</el-button>
        <el-upload
          class="upload-demo"
          action="#"
          :auto-upload="false"
          :on-change="handleImport"
          :show-file-list="false"
          accept=".xlsx,.xls"
        >
          <el-button type="warning" :icon="Upload">导入用户</el-button>
        </el-upload>
        <el-button type="danger" :icon="Delete" @click="clearUsers">一键清空</el-button>
      </div>
    </div>

    <!-- 搜索 -->
    <el-card shadow="never" class="filter-card">
      <el-form :model="filter" inline>
        <el-form-item label="关键词">
          <el-input v-model="filter.keyword" placeholder="用户名/姓名" clearable style="width:160px" />
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="filter.department_id" placeholder="全部" clearable style="width:120px">
            <el-option v-for="d in depts" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="filter.role" placeholder="全部" clearable style="width:130px">
            <el-option v-for="(v,k) in ROLES" :key="k" :label="v" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadData">查询</el-button>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="real_name" label="姓名" width="100" />
        <el-table-column prop="dept_name" label="部门" width="100" />
        <el-table-column label="角色" width="120">
          <template #default="{row}">{{ ROLES[row.role] || row.role }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{row}">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{row}">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="warning" @click="resetPwd(row)">重置密码</el-button>
            <el-button link type="danger" v-if="row.id !== 1" @click="deleteUser(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @change="loadData"
        class="pagination"
      />
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editUser ? '编辑用户' : '新增用户'" width="500px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="!!editUser" />
        </el-form-item>
        <el-form-item label="姓名" prop="real_name">
          <el-input v-model="form.real_name" />
        </el-form-item>
        <el-form-item v-if="!editUser" label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="默认123456" />
        </el-form-item>
        <el-form-item label="部门" prop="department_id">
          <el-select v-model="form.department_id" style="width:100%">
            <el-option v-for="d in depts" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width:100%">
            <el-option v-for="(v,k) in ROLES" :key="k" :label="v" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="状态" v-if="editUser">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import request from '../../utils/request'
import { ROLES } from '../../utils/helper'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Download, Upload, Delete } from '@element-plus/icons-vue'

const list = ref([])
const depts = ref([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editUser = ref(null)
const formRef = ref()

const filter = reactive({ keyword: '', department_id: '', role: '' })
const pagination = reactive({ page: 1, pageSize: 10, total: 0 })
const form = reactive({ username: '', real_name: '', password: '', department_id: '', role: 'STAFF', phone: '', status: 1 })
const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  real_name: [{ required: true, message: '请输入姓名' }],
  department_id: [{ required: true, message: '请选择部门' }],
  role: [{ required: true, message: '请选择角色' }]
}

async function loadData() {
  loading.value = true
  try {
    const params = { page: pagination.page, pageSize: pagination.pageSize }
    if (filter.keyword) params.keyword = filter.keyword
    if (filter.department_id) params.department_id = filter.department_id
    if (filter.role) params.role = filter.role
    const res = await request.get('/users', {
      params,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    list.value = res.records
    pagination.total = res.total
  } finally { loading.value = false }
}

function resetFilter() {
  filter.keyword = ''; filter.department_id = ''; filter.role = ''
  pagination.page = 1
  loadData()
}

function openDialog(user = null) {
  editUser.value = user
  if (user) {
    Object.assign(form, { username: user.username, real_name: user.real_name, department_id: user.department_id, role: user.role, phone: user.phone || '', status: user.status })
  } else {
    Object.assign(form, { username: '', real_name: '', password: '', department_id: '', role: 'STAFF', phone: '', status: 1 })
  }
  dialogVisible.value = true
}

async function saveUser() {
  await formRef.value.validate()
  saving.value = true
  try {
    if (editUser.value) {
      await request.put(`/users/${editUser.value.id}`, form)
    } else {
      await request.post('/users', form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadData()
  } finally { saving.value = false }
}

async function resetPwd(row) {
  await ElMessageBox.confirm(`确认将【${row.real_name}】密码重置为 123456？`, '提示', { type: 'warning' })
  await request.put(`/users/${row.id}/reset-password`)
  ElMessage.success('密码已重置')
}

async function deleteUser(row) {
  await ElMessageBox.confirm(`确认删除用户【${row.real_name}】？`, '警告', { type: 'warning' })
  await request.delete(`/users/${row.id}`)
  ElMessage.success('删除成功')
  loadData()
}

async function clearUsers() {
  await ElMessageBox.confirm('确定要一键清空所有【非管理员】用户吗？此操作将删除所有普通用户，且不可恢复！', '极度危险操作', {
    confirmButtonText: '确定清空',
    cancelButtonText: '取消',
    type: 'error',
  })
  try {
    loading.value = true
    await request.delete('/users/clear/all')
    ElMessage.success('已成功清空所有非管理员用户')
    pagination.page = 1
    loadData()
  } catch (error) {
    console.error('清空失败', error)
  } finally {
    loading.value = false
  }
}

async function exportUsers() {
  try {
    const blob = await request.get('/users/export', { responseType: 'blob' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `用户数据_${new Date().toISOString().slice(0, 10)}.xlsx`)
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
    const res = await request.post('/users/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    ElMessage.success(`导入成功，成功${res.success}条，失败${res.fail}条`)
    loadData()
  } catch (error) {
    ElMessage.error('导入失败')
  }
}

onMounted(async () => {
  depts.value = await request.get('/departments')
  loadData()
})
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: #1e293b; }
.header-buttons { display: flex; gap: 10px; }
.filter-card { margin-bottom: 16px; }
.pagination { margin-top: 16px; justify-content: flex-end; }
</style>
