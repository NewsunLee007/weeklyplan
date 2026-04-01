<template>
  <div class="page-container">
    <div class="page-header">
      <h2>{{ isEdit ? '编辑计划' : '新建计划' }}</h2>
      <el-button @click="router.back()">返回</el-button>
    </div>

    <el-card shadow="never">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
        <el-row :gutter="20">
          <el-col :span="6">
            <el-form-item label="学期" prop="semester">
              <el-input v-model="form.semester" placeholder="如 2025-2" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="周次" prop="week_number">
              <el-select v-model="form.week_number" placeholder="选择周次" @change="onWeekChange" style="width:100%">
                <el-option v-for="w in 20" :key="w" :label="`第${w}周`" :value="w" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="起止日期">
              <el-input :value="`${form.start_date} ~ ${form.end_date}`" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="标题" prop="title">
              <el-input v-model="form.title" placeholder="自动生成或手动修改" />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 计划条目表格 -->
        <div class="items-header">
          <span class="section-title">计划条目</span>
          <el-button type="primary" text :icon="Plus" @click="addItem">添加一行</el-button>
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
                style="width:100%"
                @change="(v) => { row.weekday = getWeekday(v) }"
              />
            </template>
          </el-table-column>
          <el-table-column label="星期" width="70" align="center">
            <template #default="{row}">{{ row.weekday || '-' }}</template>
          </el-table-column>
          <el-table-column label="工作内容">
            <template #default="{row}">
              <el-input v-model="row.content" type="textarea" :rows="2" placeholder="请输入工作内容" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="负责人/部门" width="160">
            <template #default="{row}">
              <el-input v-model="row.responsible" placeholder="负责人或部门" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" align="center">
            <template #default="{$index}">
              <el-button link type="danger" :icon="Delete" @click="removeItem($index)" />
            </template>
          </el-table-column>
        </el-table>

        <el-form-item label="备注" style="margin-top:16px">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="备注信息（可选）" />
        </el-form-item>

        <el-form-item>
          <el-button @click="save('DRAFT')" :loading="saving">保存草稿</el-button>
          <el-button type="primary" @click="save('SUBMIT')" :loading="saving">提交审核</el-button>
        </el-form-item>
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
import { Plus, Delete } from '@element-plus/icons-vue'

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
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: #1e293b; }
.items-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.section-title { font-size: 15px; font-weight: 600; color: #334155; }
.items-table { margin-bottom: 16px; }
</style>
