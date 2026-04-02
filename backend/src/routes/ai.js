/**
 * AI 服务 /api/ai
 */
const router = require('express').Router();
const { query } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/helper');
const axios = require('axios');

async function getAIConfig() {
  const configs = await query('SELECT config_key, config_value FROM sys_config WHERE config_key LIKE $1', ['ai_%']);
  const config = {
    ai_provider: 'openai',
    ai_api_url: 'https://api.openai.com/v1',
    ai_api_key: '',
    ai_model: 'gpt-4o',
    ai_temperature: '0.7',
    ai_analysis_enabled: 'true',
    ai_chat_enabled: 'true',
    ai_suggestions_enabled: 'true'
  };
  configs.forEach(c => {
    config[c.config_key] = c.config_value;
  });
  return config;
}

// 获取AI配置（所有用户可读）
router.get('/config', authMiddleware, async (req, res) => {
  const config = await getAIConfig();
  return success(res, {
    chatEnabled: config.ai_chat_enabled === 'true' || config.ai_chat_enabled === true || true,
    analysisEnabled: config.ai_analysis_enabled === 'true' || config.ai_analysis_enabled === true || true,
    suggestionsEnabled: config.ai_suggestions_enabled === 'true' || config.ai_suggestions_enabled === true || true
  });
});

// AI 聊天接口
router.post('/chat', authMiddleware, async (req, res) => {
  const { messages, context } = req.body;
  const config = await getAIConfig();
  
  if (config.ai_chat_enabled !== 'true' && config.ai_chat_enabled !== true) {
    return fail(res, 'AI对话功能未启用', 400);
  }
  
  if (!config.ai_api_key) {
    return fail(res, '请先配置AI API密钥', 400);
  }

  try {
    let baseUrl = config.ai_api_url;
    if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/v1/')) {
      baseUrl = baseUrl + '/v1';
    }

    // 构建系统提示
    let systemPrompt = '你是一个智能助手，帮助用户进行工作计划管理、分析和建议。';
    if (context) {
      systemPrompt += `\n\n上下文信息：\n${context}`;
    }

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    console.log('正在调用AI API:', baseUrl, config.ai_model);
    
    const response = await axios.post(`${baseUrl}/chat/completions`, {
      model: config.ai_model || 'gpt-4o',
      messages: allMessages,
      temperature: parseFloat(config.ai_temperature) || 0.7,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai_api_key}`
      },
      timeout: 30000
    });

    const result = response.data;
    console.log('AI API调用成功');
    return success(res, {
      message: result.choices[0].message.content,
      usage: result.usage
    });
  } catch (error) {
    console.error('AI聊天失败:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error?.message || error.message || '未知错误';
    return fail(res, errorMsg, 500);
  }
});

// 获取AI建议
router.post('/suggestions', authMiddleware, async (req, res) => {
  const { type, data } = req.body;
  const config = await getAIConfig();
  
  if (config.ai_suggestions_enabled !== 'true' && config.ai_suggestions_enabled !== true) {
    return fail(res, 'AI建议功能未启用', 400);
  }
  
  if (!config.ai_api_key) {
    return fail(res, '请先配置AI API密钥', 400);
  }

  try {
    let baseUrl = config.ai_api_url;
    if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/v1/')) {
      baseUrl = baseUrl + '/v1';
    }

    let prompt = '';
    switch (type) {
      case 'plan_create':
        prompt = `请为以下工作计划提供优化建议：\n${JSON.stringify(data, null, 2)}\n\n请提供3-5条具体、可操作的建议。`;
        break;
      case 'plan_review':
        prompt = `请评审以下计划并提供建议：\n${JSON.stringify(data, null, 2)}\n\n请指出优点、需要改进的地方和具体建议。`;
        break;
      case 'content_enhance':
        prompt = `请帮助优化以下工作内容描述：\n${data}\n\n请提供更清晰、更专业的表述，保持原意不变。`;
        break;
      default:
        prompt = `请根据以下信息提供智能建议：\n${JSON.stringify(data, null, 2)}`;
    }

    const response = await axios.post(`${baseUrl}/chat/completions`, {
      model: config.ai_model || 'gpt-4o',
      messages: [
        { role: 'system', content: '你是一个专业的工作计划管理助手，提供实用、具体的建议。' },
        { role: 'user', content: prompt }
      ],
      temperature: parseFloat(config.ai_temperature) || 0.7
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ai_api_key}`
      },
      timeout: 30000
    });

    const result = response.data;
    return success(res, {
      suggestions: result.choices[0].message.content
    });
  } catch (error) {
    console.error('获取AI建议失败:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error?.message || error.message || '未知错误';
    return fail(res, errorMsg, 500);
  }
});

module.exports = router;
