<template>
  <div class="page-container">
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-content">
        <h2 class="page-title">{{ isEdit ? '编辑计划' : '新建计划' }}</h2>
        <p class="page-description">{{ isEdit ? '修改现有工作计划' : '创建新的工作计划' }}</p>
      </div>
      <el-button @click="router.back()" class="back-btn">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
    </div>

    <!-- 表单卡片 -->
    <el-card class="form-card" shadow="never">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px" class="plan-form">
        <!-- 基本信息 -->
        <div class="form-section">
          <h3 class="section-title">
            <el-icon class="section-icon"><Document /></el-icon> 基本信息
          </h3>
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="学期" prop="semester">
                <el-input v-model="form.semester" placeholder="如 2025-2" class="form-input" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="周次" prop="week_number">
                <el-select v-model="form.week_number" placeholder="选择周次" @change="onWeekChange" class="form-select">
                  <el-option v-for="option in weekOptions" :key="option.value" :label="option.label" :value="option.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="起止日期">
                <el-input :value="`${form.start_date} ~ ${form.end_date}`" disabled class="form-input disabled-input" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="标题" prop="title">
                <el-input v-model="form.title" placeholder="自动生成或手动修改" class="form-input" />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- 计划条目表格 -->
        <div class="form-section">
          <div class="section-header">
            <h3 class="section-title">
              <el-icon class="section-icon"><List /></el-icon> 计划条目
            </h3>
            <div class="section-actions">
              <el-button :icon="MagicStick" @click="getAISuggestions" :loading="aiLoading" class="ai-suggest-btn">
                AI 智能建议
              </el-button>
              <el-button type="primary" :icon="Plus" @click="addItem" class="add-item-btn">
                添加一行
              </el-button>
            </div>
          </div>

          <!-- AI 建议区域 -->
          <div v-if="aiSuggestions" class="ai-suggestions-section">
            <div class="ai-suggestions-header">
              <el-icon class="ai-suggest-icon"><MagicStick /></el-icon>
              <span>AI 智能建议</span>
              <el-button link size="small" @click="aiSuggestions = null">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <div class="ai-suggestions-content">
              <div v-html="aiSuggestions" class="ai-suggestions-text"></div>
            </div>
          </div>

          <el-table :data="form.items" border class="items-table">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column label="日期" width="180">
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
            <el-table-column label="工作内容">
              <template #default="{row}">
                <el-input v-model="row.content" type="textarea" :rows="2" placeholder="请输入工作内容" size="small" class="content-input" />
              </template>
            </el-table-column>
            <el-table-column label="负责人/部门" width="160">
              <template #default="{row}">
                <el-input v-model="row.responsible" placeholder="负责人或部门" size="small" class="form-input" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center">
              <template #default="{$index}">
                <el-button link type="danger" :icon="Delete" @click="removeItem($index)" class="delete-btn" />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 备注信息 -->
        <div class="form-section">
          <h3 class="section-title">
            <el-icon class="section-icon"><ChatDotRound /></el-icon> 备注信息
          </h3>
          <el-form-item label="备注">
            <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="备注信息（可选）" class="form-textarea" />
          </el-form-item>
        </div>

        <!-- 操作按钮 -->
        <div class="form-actions">
          <el-button @click="save('DRAFT')" :loading="saving" class="action-btn draft-btn">
            <el-icon><Document /></el-icon> 保存草稿
          </el-button>
          <el-button type="primary" @click="save('SUBMIT')" :loading="saving" class="action-btn submit-btn">
            <el-icon><Check /></el-icon> 提交审核
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import request from '../../utils/request'
import { getWeekday, calcWeekRange, alignToWeekStart, calcWeekNumber } from '../../utils/helper'
import { ElMessage } from 'element-plus'
import { Plus, Delete, ArrowLeft, Document, List, ChatDotRound, Check, MagicStick, Close } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const formRef = ref()
const saving = ref(false)
const aiLoading = ref(false)
const aiSuggestions = ref(null)
const isEdit = computed(() => !!route.params.id)

const weekOptions = computed(() => {
  const options = []
  for (let w = 1; w <= semesterWeeks; w++) {
    options.push({ label: `第${w}周`, value: w })
  }
  return options
})

const form = reactive({
  semester: '2025-2',
  week_number: null,
  start_date: '',
  end_date: '',
  title: '',
  remark: '',
  items: []
})

const rules = {
  semester: [{ required: true, message: '请填写学期', trigger: 'blur' }],
  week_number: [{ required: true, message: '请选择周次', trigger: 'change' }],
  title: [{ required: true, message: '请填写标题', trigger: 'blur' }]
}

// 从后端读取的配置
let weekStartDate = '2026-02-25'
let weekFirstDay = 0  // 0=周日, 1=周一
let semesterWeeks = 20 // 学期周次总数

async function loadConfig() {
  try {
    const configs = await request.get('/configs')
    const map = {}
    configs.forEach(c => { map[c.config_key] = c.config_value })

    if (map.current_week_start) weekStartDate = map.current_week_start
    if (map.week_first_day !== undefined) weekFirstDay = parseInt(map.week_first_day) || 0
    if (map.current_semester) form.semester = map.current_semester
    if (map.semester_weeks) semesterWeeks = parseInt(map.semester_weeks) || 20
  } catch (e) {
    console.warn('读取系统配置失败，使用默认值', e)
  }
}

function onWeekChange(w) {
  if (!w) return
  const { start_date, end_date } = calcWeekRange(weekStartDate, w, weekFirstDay)
  form.start_date = start_date
  form.end_date = end_date
  const sd = new Date(start_date)
  const ed = new Date(end_date)
  form.title = `第${w}周工作行事历（${sd.getMonth()+1}.${sd.getDate()}-${ed.getMonth()+1}.${ed.getDate()}）`
}

function addItem() {
  form.items.push({ plan_date: '', weekday: '', content: '', responsible: '' })
}

function removeItem(index) {
  form.items.splice(index, 1)
}

async function save(mode) {
  await formRef.value.validate()
  if (form.items.length === 0) return ElMessage.warning('请至少添加一条计划条目')
  const hasEmpty = form.items.some(i => !i.plan_date || !i.content)
  if (hasEmpty) return ElMessage.warning('请填写完整的日期和工作内容')

  saving.value = true
  try {
    let planId
    if (isEdit.value) {
      await request.put(`/plans/${route.params.id}`, { title: form.title, remark: form.remark, items: form.items })
      planId = route.params.id
      ElMessage.success('保存成功')
    } else {
      const res = await request.post('/plans', { ...form })
      planId = res.id
      ElMessage.success('计划已创建')
    }
    
    if (mode === 'SUBMIT') {
      await request.post(`/plans/${planId}/submit`)
      ElMessage.success('已提交审核')
    }
    
    // 先设置 saving 为 false，等待 DOM 更新后再跳转
    saving.value = false
    await nextTick()
    router.push('/plan/list')
  } catch (error) {
    saving.value = false
    console.error('保存失败:', error)
  }
}

async function getAISuggestions() {
  aiLoading.value = true
  try {
    const response = await request.post('/ai/suggestions', {
      type: 'plan_create',
      data: {
        semester: form.semester,
        week_number: form.week_number,
        title: form.title,
        items: form.items
      }
    })
    aiSuggestions.value = response.suggestions
    ElMessage.success('已获取AI建议')
  } catch (error) {
    console.error('获取AI建议失败:', error)
    ElMessage.error(error.message || '获取AI建议失败，请检查AI配置')
  } finally {
    aiLoading.value = false
  }
}

async function loadPlan() {
  const data = await request.get(`/plans/${route.params.id}`)
  Object.assign(form, {
    semester: data.semester,
    week_number: data.week_number,
    start_date: data.start_date,
    end_date: data.end_date,
    title: data.title,
    remark: data.remark || '',
    items: data.items || []
  })
}

onMounted(async () => {
  // 先加载配置，再初始化表单
  await loadConfig()
  if (isEdit.value) {
    await loadPlan()
  } else {
    // 新建时：计算当前周次并自动选中下一周，确保不超过学期总周数
    const currentWeek = calcWeekNumber(weekStartDate, weekFirstDay)
    const nextWeek = Math.min(currentWeek + 1, semesterWeeks)
    // 确保最小是1
    const finalWeek = Math.max(1, nextWeek)
    form.week_number = finalWeek
    onWeekChange(finalWeek)
  }
})
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

.back-btn {
  height: 40px;
  padding: 0 24px;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: #FFFFFF;
  border: 1px solid #E0F2FE;
  color: #64748B;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.back-btn:hover {
  background: #F8FAFC;
  border-color: #BAE6FD;
  color: #3B82F6;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}

/* 表单卡片 */
.form-card {
  background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%);
  border: 1px solid #E0F2FE;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.form-card:hover {
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.1);
  border-color: #BAE6FD;
  transform: translateY(-2px);
}

.plan-form {
  padding: 32px;
  transition: all 0.3s var(--transition-base);
}

/* 表单部分 */
.form-section {
  margin-bottom: 32px;
  transition: all 0.3s var(--transition-base);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  transition: all 0.3s var(--transition-base);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #164E63;
  margin: 0 0 16px 0;
  transition: all 0.3s var(--transition-base);
  padding-bottom: 8px;
  border-bottom: 2px solid #E0F2FE;
}

.section-icon {
  color: #3B82F6;
  transition: all 0.3s var(--transition-base);
}

/* 表单输入框 */
.form-input,
.form-select,
.form-textarea {
  border-radius: 8px;
  border: 1px solid #E0F2FE;
  transition: all 0.3s var(--transition-base);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.disabled-input {
  background: #F8FAFC;
  border-color: #E0F2FE;
  color: #64748B;
}

/* 日期选择器 */
.date-picker {
  width: 100%;
  border-radius: 8px;
  transition: all 0.3s var(--transition-base);
  min-width: 120px;
}

.date-picker :deep(.el-input) {
  width: 100%;
}

.date-picker :deep(.el-input__wrapper) {
  border-radius: 8px;
  border: 1px solid #E0F2FE !important;
  padding: 6px 12px;
  box-shadow: none !important;
  min-width: 120px;
}

.date-picker :deep(.el-input__inner) {
  height: 20px;
  line-height: 20px;
  min-width: 100px;
}

.date-picker:focus-within :deep(.el-input__wrapper) {
  border-color: #3B82F6 !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
}

/* 星期徽章 - 确保不遮挡日期选择器 */
.weekday-badge {
  background: rgba(59, 130, 246, 0.1);
  color: #3B82F6;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s var(--transition-base);
  z-index: 1;
  position: relative;
}

/* 工作内容输入框 */
.content-input {
  border-radius: 8px;
  border: 1px solid #E0F2FE;
  transition: all 0.3s var(--transition-base);
  min-height: 64px;
}

.content-input .el-textarea__inner {
  border-radius: 8px;
  border: 1px solid #E0F2FE;
  min-height: 64px;
}

.content-input:focus-within .el-textarea__inner {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 表单输入框 */
.form-input {
  border-radius: 8px;
  border: 1px solid #E0F2FE;
  transition: all 0.3s var(--transition-base);
  height: 32px;
}

.form-input .el-input__wrapper {
  border-radius: 8px;
  border: 1px solid #E0F2FE !important;
  height: 100%;
}

.form-input .el-input__inner {
  height: 100%;
  line-height: 32px;
}

.form-input:focus-within .el-input__wrapper {
  border-color: #3B82F6 !important;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
}

/* 星期徽章 */
.weekday-badge {
  background: rgba(59, 130, 246, 0.1);
  color: #3B82F6;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  transition: all 0.3s var(--transition-base);
}

/* 表格 */
.items-table {
  margin-bottom: 16px;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s var(--transition-base);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.items-table th {
  background: linear-gradient(90deg, #F8FAFC 0%, #FFFFFF 100%);
  color: #164E63;
  font-weight: 600;
  padding: 12px;
  border-bottom: 1px solid #E0F2FE;
}

.items-table .el-table__row:hover td {
  background: rgba(59, 130, 246, 0.05);
}

.items-table .el-table__row {
  transition: all 0.2s var(--transition-base);
}

.items-table .el-table__row:hover {
  transform: translateX(4px);
}

/* 添加按钮 */
.add-item-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 500;
}

.add-item-btn:hover {
  color: #3B82F6;
  background: rgba(59, 130, 246, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.15);
}

/* 删除按钮 */
.delete-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 6px;
  padding: 4px;
}

.delete-btn:hover {
  color: #EF4444;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(239, 68, 68, 0.15);
}

/* 操作按钮 */
.form-actions {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #E0F2FE;
  transition: all 0.3s var(--transition-base);
}

.action-btn {
  height: 48px;
  padding: 0 32px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.draft-btn {
  background: #FFFFFF;
  border: 1px solid #E0F2FE;
  color: #64748B;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.draft-btn:hover {
  background: #F8FAFC;
  border-color: #BAE6FD;
  color: #3B82F6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.submit-btn {
  background: linear-gradient(135deg, #0891B2 0%, #06B6D4 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(8, 145, 178, 0.3);
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(8, 145, 178, 0.4);
}

.submit-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.submit-btn:hover::before {
  left: 100%;
}

/* AI 建议相关样式 */
.section-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.ai-suggest-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  padding: 6px 12px;
  font-weight: 500;
  background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
  color: white;
  border: none;
}

.ai-suggest-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.ai-suggestions-section {
  margin-bottom: 16px;
  background: linear-gradient(135deg, #F0F9FF 0%, #F5F3FF 100%);
  border: 1px solid #BAE6FD;
  border-radius: 12px;
  overflow: hidden;
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.ai-suggestions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%);
  color: white;
}

.ai-suggest-icon {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.ai-suggestions-content {
  padding: 16px;
}

.ai-suggestions-text {
  color: #1E293B;
  line-height: 1.8;
  white-space: pre-wrap;
}

.apply-suggest-btn {
  margin-top: 12px;
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

  .plan-form {
    padding: 24px;
  }

  .form-section {
    margin-bottom: 24px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .form-actions {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }

  .items-table {
    font-size: 13px;
  }

  .items-table th {
    padding: 8px;
  }

  .items-table td {
    padding: 8px;
  }
}

@media (min-width: 769px) and (max-width: 1024px) {
  .page-container {
    padding: 24px;
  }

  .plan-form {
    padding: 24px;
  }

  .form-section {
    margin-bottom: 28px;
  }
}
</style>
