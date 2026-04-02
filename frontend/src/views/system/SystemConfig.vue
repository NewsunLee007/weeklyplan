<template>
  <div class="page-container">
    <div class="page-header">
      <h2>系统配置</h2>
      <el-button type="primary" :loading="saving" @click="saveConfigs">保存配置</el-button>
    </div>

    <el-card shadow="never" v-loading="loading">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本配置" name="basic">
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
            <el-form-item label="学期周次总数">
              <el-input-number v-model="form.semester_weeks" :min="1" :max="52" style="width:100%" />
              <div style="color:#999;font-size:12px;margin-top:4px;">设置学期的总周数，用于限制历史数据显示和周次选择范围</div>
            </el-form-item>
            <el-form-item label="企业微信 Webhook URL">
              <el-input v-model="form.wechat_webhook_url" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="AI 模型配置" name="ai">
          <el-form :model="form" label-width="180px" style="max-width:800px">
            <el-divider content-position="left">大模型配置</el-divider>
            
            <el-form-item label="AI 服务商">
              <el-select v-model="form.ai_provider" placeholder="选择AI服务商" style="width:100%" @change="onProviderChange">
                <el-option label="OpenAI" value="openai" />
                <el-option label="DeepSeek" value="deepseek" />
                <el-option label="通义千问" value="qwen" />
                <el-option label="自定义" value="custom" />
              </el-select>
            </el-form-item>

            <el-form-item label="API 地址">
              <el-input v-model="form.ai_api_url" placeholder="https://api.openai.com/v1" />
            </el-form-item>

            <el-form-item label="API 密钥">
              <el-input v-model="form.ai_api_key" type="password" placeholder="请输入API密钥" show-password />
            </el-form-item>

            <el-form-item label="模型名称">
              <el-input v-model="form.ai_model" placeholder="gpt-4o, deepseek-chat, qwen-max等" />
            </el-form-item>

            <el-form-item label="温度参数">
              <el-slider v-model="form.ai_temperature" :min="0" :max="2" :step="0.1" show-input style="width:300px" />
            </el-form-item>

            <el-divider content-position="left">测试连接</el-divider>

            <el-form-item>
              <el-button @click="testAIConnection" :loading="testing">
                测试 AI 连接
              </el-button>
              <el-tag v-if="testResult === 'success'" type="success" style="margin-left:12px;">
                连接成功
              </el-tag>
              <el-tag v-if="testResult === 'error'" type="danger" style="margin-left:12px;">
                连接失败
              </el-tag>
            </el-form-item>

            <el-divider content-position="left">功能开关</el-divider>

            <el-form-item label="启用 AI 分析">
              <el-switch v-model="form.ai_analysis_enabled" />
            </el-form-item>

            <el-form-item label="启用 AI 对话">
              <el-switch v-model="form.ai_chat_enabled" />
            </el-form-item>

            <el-form-item label="启用 AI 建议">
              <el-switch v-model="form.ai_suggestions_enabled" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import request from '../../utils/request'
import { ElMessage } from 'element-plus'

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const activeTab = ref('basic')
const testResult = ref(null)

const form = reactive({
  school_name: '',
  school_sub_name: '',
  current_semester: '',
  current_week_start: '',
  week_first_day: '0',
  semester_weeks: 20,
  wechat_webhook_url: '',
  ai_provider: 'openai',
  ai_api_url: 'https://api.openai.com/v1',
  ai_api_key: '',
  ai_model: 'gpt-4o',
  ai_temperature: 0.7,
  ai_analysis_enabled: true,
  ai_chat_enabled: true,
  ai_suggestions_enabled: true
})

const providerConfig = {
  openai: { url: 'https://api.openai.com/v1', model: 'gpt-4o' },
  deepseek: { url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  qwen: { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-max' },
  custom: { url: '', model: '' }
}

function onProviderChange(provider) {
  if (providerConfig[provider]) {
    form.ai_api_url = providerConfig[provider].url
    form.ai_model = providerConfig[provider].model
  }
}

async function testAIConnection() {
  testing.value = true
  testResult.value = null
  try {
    await request.post('/configs/test-ai', {
      provider: form.ai_provider,
      apiUrl: form.ai_api_url,
      apiKey: form.ai_api_key,
      model: form.ai_model
    })
    testResult.value = 'success'
    ElMessage.success('AI 连接测试成功！')
  } catch (error) {
    testResult.value = 'error'
    ElMessage.error('AI 连接测试失败: ' + (error.message || '未知错误'))
  } finally {
    testing.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const configs = await request.get('/configs')
    configs.forEach(c => {
      if (form.hasOwnProperty(c.config_key)) {
        if (c.config_key === 'ai_temperature') {
          form[c.config_key] = parseFloat(c.config_value) || 0.7
        } else if (c.config_key.startsWith('ai_') && c.config_key.endsWith('_enabled')) {
          form[c.config_key] = c.config_value === 'true' || c.config_value === true
        } else {
          form[c.config_key] = c.config_value
        }
      }
    })
  } finally { loading.value = false }
}

async function saveConfigs() {
  saving.value = true
  try {
    const configs = Object.entries(form).map(([config_key, config_value]) => ({ 
      config_key, 
      config_value: typeof config_value === 'boolean' ? String(config_value) : String(config_value)
    }))
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
