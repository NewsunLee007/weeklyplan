/**
 * AI 服务 /api/ai
 */
const router = require('express').Router();
const { query } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/helper');
const axios = require('axios');

async function getKnowledgeContext() {
  try {
    const items = await query(
      `SELECT ki.*, kb.name as knowledge_base_name 
       FROM biz_knowledge_item ki
       JOIN biz_knowledge_base kb ON ki.knowledge_base_id = kb.id
       WHERE ki.is_deleted = false AND kb.is_deleted = false AND ki.is_active = true AND kb.is_active = true
       ORDER BY kb.type, ki.created_at DESC`
    );

    if (items.length === 0) return '';

    let context = '【知识库信息】\n';
    items.forEach(item => {
      context += `\n【${item.knowledge_base_name}】- ${item.title}\n`;
      if (item.content) {
        context += `${item.content}\n`;
      }
    });
    return context;
  } catch (error) {
    console.error('获取知识库上下文失败:', error);
    return '';
  }
}

// 辅助函数：计算当前周次
function calcCurrentWeek(weekStartConfig, weekFirstDayConfig) {
  if (!weekStartConfig) return 1;
  const start = new Date(weekStartConfig);
  const now = new Date();
  const diffTime = now.getTime() - start.getTime();
  const diffDays = diffTime / (1000 * 3600 * 24);
  const weekNum = Math.floor(diffDays / 7) + 1;
  return Math.max(1, weekNum);
}

// 获取当前周次的计划上下文
async function getPlansContext(user) {
  try {
    // 1. 获取当前学期和周次配置
    const configs = await query(`SELECT config_key, config_value FROM sys_config WHERE config_key IN ('current_semester', 'current_week_start', 'week_first_day')`);
    const configMap = {};
    configs.forEach(c => { configMap[c.config_key] = c.config_value });
    
    const semester = configMap.current_semester;
    const currentWeek = calcCurrentWeek(configMap.current_week_start, configMap.week_first_day);
    
    if (!semester) return '';

    let context = `【本周（${semester} 第${currentWeek}周）工作计划行事历】\n`;

    // 2. 查询全校已发布的计划
    const publishedPlans = await query(
      `SELECT p.id, p.title, d.name as dept_name 
       FROM biz_week_plan p 
       LEFT JOIN sys_department d ON p.department_id = d.id 
       WHERE p.semester = $1 AND p.week_number = $2 AND p.status = 'PUBLISHED' AND p.is_deleted = false`,
      [semester, currentWeek]
    );

    if (publishedPlans.length > 0) {
      context += `\n--- 已发布的各部门工作安排 ---\n`;
      for (const plan of publishedPlans) {
        const items = await query(`SELECT weekday, content, responsible FROM biz_plan_item WHERE plan_id = $1 AND is_deleted = false ORDER BY plan_date`, [plan.id]);
        if (items.length > 0) {
          context += `[${plan.dept_name}] ${plan.title || ''}：\n`;
          items.forEach(item => {
            context += `  - ${item.weekday || '未知'}：${item.content} (负责: ${item.responsible || '未指定'})\n`;
          });
        }
      }
    } else {
      context += `\n--- 全校暂无已发布的工作安排 ---\n`;
    }

    // 3. 查询当前用户正在起草或待审核的计划
    const myPlans = await query(
      `SELECT p.id, p.title, p.status 
       FROM biz_week_plan p 
       WHERE p.semester = $1 AND p.week_number = $2 AND p.creator_id = $3 AND p.status != 'PUBLISHED' AND p.is_deleted = false`,
      [semester, currentWeek, user.id]
    );

    if (myPlans.length > 0) {
      context += `\n--- 您当前正在进行中的计划 ---\n`;
      for (const plan of myPlans) {
        const statusMap = { 'DRAFT': '草稿', 'SUBMITTED': '待审核', 'DEPT_APPROVED': '部门已审核', 'OFFICE_APPROVED': '办公室已审核', 'REJECTED': '已退回' };
        const statusText = statusMap[plan.status] || plan.status;
        const items = await query(`SELECT weekday, content, responsible FROM biz_plan_item WHERE plan_id = $1 AND is_deleted = false ORDER BY plan_date`, [plan.id]);
        
        context += `您的计划 [状态: ${statusText}] ${plan.title || ''}：\n`;
        if (items.length > 0) {
          items.forEach(item => {
            context += `  - ${item.weekday || '未知'}：${item.content} (负责: ${item.responsible || '未指定'})\n`;
          });
        } else {
          context += `  - 暂未填写具体工作条目\n`;
        }
      }
    }

    return context;
  } catch (error) {
    console.error('获取计划上下文失败:', error);
    return '';
  }
}

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
  const user = req.user;
  const { role, real_name, department_name } = user;
  
  const config = await getAIConfig();
  const knowledgeContext = await getKnowledgeContext();
  const plansContext = await getPlansContext(user);
  
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
    const roleName = { 'ADMIN': '系统管理员', 'PRINCIPAL': '校长', 'OFFICE_HEAD': '办公室主任', 'ACADEMIC_HEAD': '教务处主任', 'DEPT_HEAD': '部门主任', 'STAFF': '普通教师/职员' }[role] || '用户';
    const deptNameStr = department_name ? `【${department_name}】的` : '';
    
    let systemPrompt = `你是一个内置于系统中的专属智能教务助手。
当前与你对话的是${deptNameStr}【${real_name}】，系统职务为【${roleName}】。请根据他/她的职务和部门给出针对性的建议和回答。
你已经成功接入了学校的真实数据库。当用户询问工作安排、规章制度等学校相关问题时，请务必优先参考下方的【知识库信息】和【本周工作计划行事历】进行精准回答，切勿编造。
`;

    if (knowledgeContext) {
      systemPrompt += `\n\n${knowledgeContext}`;
    }
    if (plansContext) {
      systemPrompt += `\n\n${plansContext}`;
    }
    if (context) {
      systemPrompt += `\n\n额外上下文信息：\n${context}`;
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
    // 如果没有配置 API 密钥，返回默认的建议而不是失败
    const defaultSuggestions = `1. 建议合理安排时间，确保各项工作有序推进
2. 注意与各部门的沟通协调，确保信息畅通
3. 提前准备相关材料，提高工作效率
4. 关注重要节点，及时跟进工作进度
5. 定期回顾总结，不断优化工作方法`;
    return success(res, { suggestions: defaultSuggestions });
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
      timeout: 120000
    });

    const result = response.data;
    return success(res, {
      suggestions: result.choices[0].message.content
    });
  } catch (error) {
    console.error('获取AI建议失败:', error.response?.data || error.message);
    // 出错时返回默认建议而不是失败
    const defaultSuggestions = `1. 建议合理安排时间，确保各项工作有序推进
2. 注意与各部门的沟通协调，确保信息畅通
3. 提前准备相关材料，提高工作效率
4. 关注重要节点，及时跟进工作进度
5. 定期回顾总结，不断优化工作方法`;
    return success(res, { suggestions: defaultSuggestions });
  }
});

module.exports = router;
