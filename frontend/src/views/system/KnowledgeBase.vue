<template>
  <div class="knowledge-base">
    <el-card class="main-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">知识库管理</span>
          <el-button type="primary" @click="showCreateBaseDialog">
            <el-icon><Plus /></el-icon>
            新建知识库
          </el-button>
        </div>
      </template>

      <div v-loading="loading" class="content-wrapper">
        <el-empty v-if="!loading && knowledgeBases.length === 0" description="暂无知识库，点击上方按钮创建">
          <el-button type="primary" @click="showCreateBaseDialog">创建知识库</el-button>
        </el-empty>

        <div v-else class="bases-grid">
          <div v-for="base in knowledgeBases" :key="base.id" class="base-card">
            <div class="base-header">
              <div class="base-icon" :style="{ background: getTypeColor(base.type) }">
                <el-icon :size="24">
                  <component :is="getTypeIcon(base.type)" />
                </el-icon>
              </div>
              <div class="base-info">
                <h3 class="base-name">{{ base.name }}</h3>
                <p class="base-type">{{ getTypeName(base.type) }}</p>
              </div>
              <el-switch
                v-model="base.is_active"
                @change="toggleBaseStatus(base)"
                active-text="启用"
                inactive-text="禁用"
              />
            </div>
            <p v-if="base.description" class="base-description">{{ base.description }}</p>
            <div class="base-actions">
              <el-button link size="small" @click="viewBaseItems(base)">
                <el-icon><Document /></el-icon>
                管理内容
              </el-button>
              <el-button link size="small" type="primary" @click="editBase(base)">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button link size="small" type="danger" @click="deleteBase(base)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="baseDialogVisible"
      :title="editingBase ? '编辑知识库' : '新建知识库'"
      width="500px"
      class="knowledge-dialog"
    >
      <el-form :model="baseForm" label-width="80px" class="dialog-form">
        <el-form-item label="名称" required>
          <el-input 
            v-model="baseForm.name" 
            placeholder="请输入知识库名称" 
            class="form-input"
          />
        </el-form-item>
        <el-form-item label="类型" required>
          <el-select 
            v-model="baseForm.type" 
            placeholder="请选择类型" 
            style="width: 100%"
            class="form-select"
          >
            <el-option label="学期计划" value="semester" />
            <el-option label="学校行事历" value="calendar" />
            <el-option label="工作安排" value="workplan" />
            <el-option label="规章制度" value="regulation" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="baseForm.description"
            type="textarea"
            :rows="4"
            placeholder="请输入知识库描述"
            class="form-textarea"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="baseDialogVisible = false" class="dialog-button">取消</el-button>
        <el-button type="primary" @click="saveBase" class="dialog-button primary-button">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="itemsDialogVisible"
      :title="`${currentBase?.name || ''} - 内容管理`"
      width="900px"
      class="items-dialog"
    >
      <div class="items-header">
        <el-input
          v-model="searchQuery"
          placeholder="搜索知识项..."
          style="width: 300px"
          clearable
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" @click="showCreateItemDialog">
          <el-icon><Plus /></el-icon>
          添加内容
        </el-button>
      </div>

      <div class="items-list">
        <el-empty v-if="!itemsLoading && currentItems.length === 0" description="暂无内容">
          <el-button type="primary" @click="showCreateItemDialog">添加内容</el-button>
        </el-empty>

        <div v-else class="items-grid">
          <div v-for="item in filteredItems" :key="item.id" class="item-card">
            <div class="item-header">
              <h4 class="item-title">{{ item.title }}</h4>
              <el-tag v-if="item.is_active" type="success" size="small">启用</el-tag>
              <el-tag v-else type="info" size="small">禁用</el-tag>
            </div>
            <p v-if="item.content" class="item-content">{{ item.content }}</p>
            <div v-if="item.file_name" class="item-file">
              <el-icon><Paperclip /></el-icon>
              <span>{{ item.file_name }}</span>
            </div>
            <div class="item-actions">
              <el-button link size="small" type="primary" @click="editItem(item)">
                <el-icon><Edit /></el-icon>
                编辑
              </el-button>
              <el-button link size="small" @click="toggleItemStatus(item)">
                <el-icon><Switch /></el-icon>
                {{ item.is_active ? '禁用' : '启用' }}
              </el-button>
              <el-button link size="small" type="danger" @click="deleteItem(item)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="itemsDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="itemDialogVisible"
      :title="editingItem ? '编辑知识项' : '添加知识项'"
      width="600px"
      class="knowledge-dialog"
    >
      <el-form :model="itemForm" label-width="80px" class="dialog-form">
        <el-form-item label="标题" required>
          <el-input 
            v-model="itemForm.title" 
            placeholder="请输入知识项标题" 
            class="form-input"
          />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input
            v-model="itemForm.content"
            type="textarea"
            :rows="6"
            placeholder="请输入知识项内容"
            class="form-textarea"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="itemDialogVisible = false" class="dialog-button">取消</el-button>
        <el-button type="primary" @click="saveItem" class="dialog-button primary-button">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Document, Edit, Delete, Search, Paperclip, Switch, Notebook, Calendar, Files, Guide, Folder } from '@element-plus/icons-vue'
import request from '../../utils/request'

const loading = ref(false)
const itemsLoading = ref(false)
const knowledgeBases = ref([])
const currentItems = ref([])
const currentBase = ref(null)
const searchQuery = ref('')

const baseDialogVisible = ref(false)
const itemsDialogVisible = ref(false)
const itemDialogVisible = ref(false)

const editingBase = ref(null)
const editingItem = ref(null)

const baseForm = ref({
  name: '',
  type: 'other',
  description: ''
})

const itemForm = ref({
  title: '',
  content: ''
})

const filteredItems = computed(() => {
  if (!searchQuery.value) return currentItems.value
  const query = searchQuery.value.toLowerCase()
  return currentItems.value.filter(item =>
    item.title.toLowerCase().includes(query) ||
    (item.content && item.content.toLowerCase().includes(query))
  )
})

const typeColors = {
  semester: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  calendar: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  workplan: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  regulation: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  other: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
}

const typeIcons = {
  semester: Notebook,
  calendar: Calendar,
  workplan: Files,
  regulation: Guide,
  other: Folder
}

const typeNames = {
  semester: '学期计划',
  calendar: '学校行事历',
  workplan: '工作安排',
  regulation: '规章制度',
  other: '其他'
}

function getTypeColor(type) {
  return typeColors[type] || typeColors.other
}

function getTypeIcon(type) {
  return typeIcons[type] || typeIcons.other
}

function getTypeName(type) {
  return typeNames[type] || typeNames.other
}

async function fetchKnowledgeBases() {
  loading.value = true
  try {
    const data = await request.get('/knowledge/bases')
    knowledgeBases.value = data || []
  } catch (error) {
    ElMessage.error('获取知识库列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function fetchBaseItems(baseId) {
  itemsLoading.value = true
  try {
    const data = await request.get(`/knowledge/bases/${baseId}/items`)
    currentItems.value = data || []
  } catch (error) {
    ElMessage.error('获取知识项列表失败')
    console.error(error)
  } finally {
    itemsLoading.value = false
  }
}

function showCreateBaseDialog() {
  editingBase.value = null
  baseForm.value = { name: '', type: 'other', description: '' }
  baseDialogVisible.value = true
}

function editBase(base) {
  editingBase.value = base
  baseForm.value = {
    name: base.name,
    type: base.type,
    description: base.description
  }
  baseDialogVisible.value = true
}

async function saveBase() {
  if (!baseForm.value.name) {
    ElMessage.warning('请输入知识库名称')
    return
  }

  try {
    if (editingBase.value) {
      await request.put(`/knowledge/bases/${editingBase.value.id}`, {
        ...baseForm.value,
        is_active: editingBase.value.is_active
      })
      ElMessage.success('知识库更新成功')
    } else {
      await request.post('/knowledge/bases', baseForm.value)
      ElMessage.success('知识库创建成功')
    }
    baseDialogVisible.value = false
    fetchKnowledgeBases()
  } catch (error) {
    ElMessage.error('保存知识库失败')
    console.error(error)
  }
}

async function toggleBaseStatus(base) {
  try {
    await request.put(`/knowledge/bases/${base.id}`, {
      name: base.name,
      description: base.description,
      type: base.type,
      is_active: base.is_active
    })
    ElMessage.success(base.is_active ? '知识库已启用' : '知识库已禁用')
  } catch (error) {
    base.is_active = !base.is_active
    ElMessage.error('操作失败')
    console.error(error)
  }
}

async function deleteBase(base) {
  try {
    await ElMessageBox.confirm(`确定要删除知识库"${base.name}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await request.delete(`/knowledge/bases/${base.id}`)
    ElMessage.success('知识库删除成功')
    fetchKnowledgeBases()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除知识库失败')
      console.error(error)
    }
  }
}

function viewBaseItems(base) {
  currentBase.value = base
  fetchBaseItems(base.id)
  itemsDialogVisible.value = true
}

function showCreateItemDialog() {
  editingItem.value = null
  itemForm.value = { title: '', content: '' }
  itemDialogVisible.value = true
}

function editItem(item) {
  editingItem.value = item
  itemForm.value = {
    title: item.title,
    content: item.content
  }
  itemDialogVisible.value = true
}

async function saveItem() {
  if (!itemForm.value.title) {
    ElMessage.warning('请输入知识项标题')
    return
  }

  try {
    if (editingItem.value) {
      await request.put(`/knowledge/items/${editingItem.value.id}`, {
        ...itemForm.value,
        is_active: editingItem.value.is_active
      })
      ElMessage.success('知识项更新成功')
    } else {
      await request.post(`/knowledge/bases/${currentBase.value.id}/items`, itemForm.value)
      ElMessage.success('知识项创建成功')
    }
    itemDialogVisible.value = false
    fetchBaseItems(currentBase.value.id)
  } catch (error) {
    ElMessage.error('保存知识项失败')
    console.error(error)
  }
}

async function toggleItemStatus(item) {
  try {
    await request.put(`/knowledge/items/${item.id}`, {
      title: item.title,
      content: item.content,
      is_active: !item.is_active
    })
    item.is_active = !item.is_active
    ElMessage.success(item.is_active ? '知识项已启用' : '知识项已禁用')
  } catch (error) {
    ElMessage.error('操作失败')
    console.error(error)
  }
}

async function deleteItem(item) {
  try {
    await ElMessageBox.confirm(`确定要删除知识项"${item.title}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await request.delete(`/knowledge/items/${item.id}`)
    ElMessage.success('知识项删除成功')
    fetchBaseItems(currentBase.value.id)
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除知识项失败')
      console.error(error)
    }
  }
}

onMounted(() => {
  fetchKnowledgeBases()
})
</script>

<style scoped>
.knowledge-base {
  padding: 0;
}

.main-card {
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
}

.content-wrapper {
  min-height: 400px;
}

.bases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.base-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.3s;
}

.base-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  border-color: #3b82f6;
}

.base-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.base-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.base-info {
  flex: 1;
}

.base-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.base-type {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #64748b;
}

.base-description {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: #64748b;
  line-height: 1.6;
}

.base-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

.items-dialog :deep(.el-dialog__body) {
  padding: 0;
}

.items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e2e8f0;
}

.items-list {
  padding: 20px;
  max-height: 500px;
  overflow-y: auto;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.item-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s;
}

.item-card:hover {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  flex: 1;
}

.item-content {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-file {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #3b82f6;
}

.item-actions {
  display: flex;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

/* 对话框样式 */
.knowledge-dialog {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.knowledge-dialog :deep(.el-dialog__header) {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  color: white;
  padding: 20px 24px;
  border-radius: 16px 16px 0 0;
}

.knowledge-dialog :deep(.el-dialog__title) {
  font-size: 18px;
  font-weight: 600;
  color: white;
}

.knowledge-dialog :deep(.el-dialog__body) {
  padding: 24px;
  background: #f8fafc;
}

.knowledge-dialog :deep(.el-dialog__footer) {
  padding: 16px 24px;
  background: white;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 16px 16px;
}

.dialog-form {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.form-input,
.form-select {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}

.form-input:focus,
.form-select:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-textarea {
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  resize: vertical;
  transition: all 0.3s ease;
}

.form-textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.dialog-button {
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  transition: all 0.3s ease;
}

.primary-button {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  border: none;
  color: white;
  transition: all 0.3s ease;
}

.primary-button:hover {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}
</style>
