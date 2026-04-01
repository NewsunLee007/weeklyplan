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
                  <el-option v-for="w in 20" :key="w" :label="`第${w}周`" :value="w" />
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
            <el-button type="primary" :icon="Plus" @click="addItem" class="add-item-btn">
              添加一行
            </el-button>
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
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import request from '../../utils/request'
import { getWeekday, calcWeekRange, alignToWeekStart } from '../../utils/helper'
import { ElMessage } from 'element-plus'
import { Plus, Delete, ArrowLeft, Document, List, ChatDotRound, Check } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const formRef = ref()
const saving = ref(false)
const isEdit = computed(() => !!route.params.id)

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

async function loadConfig() {
  try {
    const configs = await request.get('/configs')
    const map = {}
    configs.forEach(c => { map[c.config_key] = c.config_value })

    if (map.current_week_start) weekStartDate = map.current_week_start
    if (map.week_first_day !== undefined) weekFirstDay = parseInt(map.week_first_day) || 0
    if (map.current_semester) form.semester = map.current_semester
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
    router.push('/plan/list')
  } finally {
    saving.value = false
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
    // 新建时：计算当前周次并自动选中
    const { calcWeekNumber } = await import('../../utils/helper')
    const currentWeek = calcWeekNumber(weekStartDate, weekFirstDay)
    form.week_number = currentWeek
    onWeekChange(currentWeek)
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
  border: 1px solid #E0F2FE;
  transition: all 0.3s var(--transition-base);
}

.date-picker:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 工作内容输入框 */
.content-input {
  border-radius: 8px;
  border: 1px solid #E0F2FE;
  transition: all 0.3s var(--transition-base);
}

.content-input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
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
