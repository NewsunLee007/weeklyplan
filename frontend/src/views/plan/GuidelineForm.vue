<template>
  <div class="page-container">
    <div class="page-header">
      <div class="header-content">
        <h2 class="page-title">编辑预发工作</h2>
        <p class="page-description">为全校发布本周的大致工作指导</p>
      </div>
      <el-button @click="router.back()" class="back-btn">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
    </div>

    <el-card class="form-card" shadow="never" v-loading="loading">
      <el-form :model="form" ref="formRef" label-width="100px" class="plan-form">
        <!-- 基本信息 -->
        <div class="form-section">
          <h3 class="section-title">
            <el-icon class="section-icon"><Document /></el-icon> 基本信息
          </h3>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="学期" prop="semester">
                <el-input v-model="form.semester" disabled class="form-input disabled-input" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="周次" prop="week_number">
                <el-input :value="`第 ${form.week_number} 周`" disabled class="form-input disabled-input" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 计划条目表格 -->
        <div class="form-section">
          <div class="section-header">
            <h3 class="section-title">
              <el-icon class="section-icon"><List /></el-icon> 工作指导条目
            </h3>
            <div class="section-actions">
              <el-button type="primary" :icon="Plus" @click="addItem" class="add-item-btn">
                添加一行
              </el-button>
            </div>
          </div>

          <el-table :data="form.items" border class="items-table">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column label="日期" width="220">
              <template #default="{row}">
                <el-date-picker
                  v-model="row.plan_date"
                  type="date"
                  value-format="YYYY-MM-DD"
                  placeholder="选择日期"
                  size="small"
                  class="date-picker"
                  @change="(v) => { row.weekday = getWeekday(v) }"
                />
              </template>
            </el-table-column>
            <el-table-column label="星期" width="70" align="center">
              <template #default="{row}">
                <div class="weekday-badge">{{ row.weekday || '-' }}</div>
              </template>
            </el-table-column>
            <el-table-column label="工作内容" min-width="300">
              <template #default="{row}">
                <el-input 
                  v-model="row.content" 
                  type="textarea" 
                  :autosize="{ minRows: 3, maxRows: 6 }" 
                  placeholder="工作内容" 
                  size="small" 
                  class="form-input" 
                  @blur="onContentBlur(row)"
                />
              </template>
            </el-table-column>
            <el-table-column label="负责人/部门" width="160">
              <template #default="{row}">
                <el-input 
                  v-model="row.responsible" 
                  type="textarea" 
                  :autosize="{ minRows: 3, maxRows: 6 }" 
                  placeholder="负责人或部门" 
                  size="small" 
                  class="form-input" 
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center">
              <template #default="{$index}">
                <el-button link type="danger" :icon="Delete" @click="removeItem($index)" class="delete-btn" />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 操作按钮 -->
        <div class="form-actions">
          <el-button type="primary" @click="save" :loading="saving" class="action-btn submit-btn">
            <el-icon><Check /></el-icon> 保存并发布
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import request from '../../utils/request'
import { getWeekday } from '../../utils/helper'
import { ElMessage } from 'element-plus'
import { Plus, Delete, ArrowLeft, Document, List, Check } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const formRef = ref()
const saving = ref(false)
const loading = ref(false)

const form = reactive({
  semester: route.query.semester || '',
  week_number: parseInt(route.query.week) || 1,
  items: []
})

async function loadGuideline() {
  if (!form.semester || !form.week_number) return
  loading.value = true
  try {
    const res = await request.get(`/guidelines/current?semester=${form.semester}&weekNumber=${form.week_number}`)
    if (res && res.content) {
      try {
        const parsedItems = JSON.parse(res.content)
        if (Array.isArray(parsedItems)) {
          form.items = parsedItems
        } else {
          // Fallback if it's not an array
          form.items.push({ plan_date: '', weekday: '', content: res.content, responsible: '' })
        }
      } catch (e) {
        // Fallback for plain text
        form.items.push({ plan_date: '', weekday: '', content: res.content, responsible: '' })
      }
    }
  } catch (error) {
    console.error('加载预发工作失败:', error)
  } finally {
    loading.value = false
    if (form.items.length === 0) {
      addItem()
    }
  }
}

function addItem() {
  form.items.push({ plan_date: '', weekday: '', content: '', responsible: '' })
}

function removeItem(index) {
  form.items.splice(index, 1)
}

function onContentBlur(row) {
  if (!row.content) return
  const lines = row.content.split('\n').filter(line => line.trim() !== '')
  if (lines.length > 1) {
    // 智能格式化工作内容
    const formattedLines = lines.map((line, index) => {
      const trimmed = line.trim()
      if (/^\d+[.、\s]/.test(trimmed)) {
        return trimmed
      }
      return `${index + 1}. ${trimmed}`
    })
    row.content = formattedLines.join('\n')

    // 智能填充负责人
    let respLines = (row.responsible || '').split('\n').filter(line => line.trim() !== '')
    const formattedResp = formattedLines.map((_, index) => {
      const existing = respLines[index] ? respLines[index].trim() : ''
      if (existing) {
        if (/^\d+[.、\s]/.test(existing)) {
          return existing
        }
        return `${index + 1}. ${existing}`
      }
      return `${index + 1}. `
    })
    row.responsible = formattedResp.join('\n')
  }
}

async function save() {
  // 清理空行
  const validItems = form.items.filter(i => i.plan_date || i.content || i.responsible)
  
  saving.value = true
  try {
    await request.post('/guidelines/save', {
      semester: form.semester,
      weekNumber: form.week_number,
      content: JSON.stringify(validItems)
    })
    ElMessage.success('保存预发工作成功')
    router.back()
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadGuideline()
})
</script>

<style scoped>
/* 此处样式与 PlanForm.vue 基本一致，保持页面风格统一 */
.page-container {
  padding: 24px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.header-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary, #164E63);
  margin: 0;
  letter-spacing: -0.5px;
}

.page-description {
  font-size: 14px;
  color: var(--color-text-secondary, #64748B);
  margin: 0;
}

.back-btn {
  height: 40px;
  padding: 0 24px;
  border-radius: 8px;
  background: var(--color-bg-primary, #FFFFFF);
  border: 1px solid var(--color-border-light, #E0F2FE);
  color: var(--color-text-secondary, #64748B);
}

.back-btn:hover {
  background: var(--color-bg-secondary, #F8FAFC);
  border-color: var(--color-border-medium, #BAE6FD);
  color: var(--color-primary, #3B82F6);
}

.form-card {
  background: linear-gradient(135deg, var(--color-bg-primary, #FFFFFF) 0%, var(--color-bg-secondary, #F8FAFC) 100%);
  border: 1px solid var(--color-border-light, #E0F2FE);
  border-radius: 16px;
  overflow: hidden;
}

.plan-form {
  padding: 32px;
}

.form-section {
  margin-bottom: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #164E63);
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--color-border-light, #E0F2FE);
}

.section-icon {
  color: var(--color-primary, #3B82F6);
}

.form-input {
  border-radius: 8px;
  border: 1px solid #E0F2FE;
}

.form-input:focus-within {
  border-color: var(--color-primary, #3B82F6);
}

.disabled-input {
  background: var(--color-bg-secondary, #F8FAFC);
  color: var(--color-text-secondary, #64748B);
}

.date-picker {
  width: 100%;
  border-radius: 8px;
}

.weekday-badge {
  background: var(--color-primary-bg-subtle, rgba(59, 130, 246, 0.1));
  color: var(--color-primary, #3B82F6);
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.items-table {
  margin-bottom: 16px;
  border-radius: 12px;
  background: var(--color-bg-primary, #ffffff);
}

:deep(.el-table) {
  --el-table-border-color: var(--color-border-light, #E0F2FE);
  --el-table-header-bg-color: var(--color-bg-secondary, #F8FAFC);
  --el-table-header-text-color: var(--color-text-primary, #164E63);
  background-color: var(--color-bg-primary, #ffffff);
  color: var(--color-text-primary, #334155);
}

.add-item-btn {
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 500;
}

.form-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border-light, #E0F2FE);
}

.submit-btn {
  background: var(--color-primary, #0891B2);
  border: none;
  height: 48px;
  padding: 0 32px;
  font-size: 16px;
  border-radius: 12px;
}
</style>
