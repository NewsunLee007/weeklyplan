<template>
  <div class="page-container">
    <div class="page-header">
      <h2>系统配置</h2>
      <el-button type="primary" :loading="saving" @click="saveConfigs">保存配置</el-button>
    </div>

    <el-card shadow="never" v-loading="loading">
      <el-form :model="form" label-width="180px" style="max-width:600px">
        <el-form-item label="学校全称">
          <el-input v-model="form.school_name" />
        </el-form-item>
        <el-form-item label="学校子名称">
          <el-input v-model="form.school_sub_name" />
        </el-form-item>
        <el-form-item label="当前学期">
          <el-input v-model="form.current_semester" placeholder="如 2025-2" />
        </el-form-item>
        <el-form-item label="第1周起始日期">
          <el-date-picker
            v-model="form.current_week_start"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="每周第一天">
          <el-radio-group v-model="form.week_first_day">
            <el-radio value="0">周日（Sunday）</el-radio>
            <el-radio value="1">周一（Monday）</el-radio>
          </el-radio-group>
          <div style="color:#999;font-size:12px;margin-top:4px;">选择周日时，计划第1周起始日期应为某周日；选择周一时应为某周一。</div>
        </el-form-item>
        <el-form-item label="企业微信 Webhook URL">
          <el-input v-model="form.wechat_webhook_url" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import request from '../../utils/request'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const saving = ref(false)
const form = reactive({
  school_name: '',
  school_sub_name: '',
  current_semester: '',
  current_week_start: '',
  week_first_day: '0',
  wechat_webhook_url: ''
})

async function loadData() {
  loading.value = true
  try {
    const configs = await request.get('/configs')
    configs.forEach(c => {
      if (form.hasOwnProperty(c.config_key)) {
        form[c.config_key] = c.config_value
      }
    })
  } finally { loading.value = false }
}

async function saveConfigs() {
  saving.value = true
  try {
    const configs = Object.entries(form).map(([config_key, config_value]) => ({ config_key, config_value }))
    await request.put('/configs', { configs })
    ElMessage.success('配置已保存')
  } finally { saving.value = false }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { padding: 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 20px; color: #1e293b; }
</style>
