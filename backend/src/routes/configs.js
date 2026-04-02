/**
 * 系统配置 /api/configs
 */
const router = require('express').Router();
const { query, execute } = require('../db/adapter');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success, now } = require('../utils/helper');
const axios = require('axios');

// GET / 获取所有配置（所有登录用户可读，但只有 ADMIN 可修改）
router.get('/', authMiddleware, async (req, res) => {
  const configs = await query(`SELECT * FROM sys_config ORDER BY id`);
  return success(res, configs);
});

// PUT / 批量修改配置
router.put('/', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { configs } = req.body; // [{ config_key, config_value }]
  const n = now();
  for (const cfg of configs) {
    await execute(`UPDATE sys_config SET config_value=$1, update_time=$2 WHERE config_key=$3`,
      [cfg.config_value, n, cfg.config_key]);
  }
  return success(res, null, '配置已保存');
});

// POST /test-ai 测试AI连接
router.post('/test-ai', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { provider, apiUrl, apiKey, model } = req.body;
  
  try {
    let baseUrl = apiUrl;
    if (!baseUrl.endsWith('/v1') && !baseUrl.includes('/v1/')) {
      baseUrl = baseUrl + '/v1';
    }
    
    const response = await axios.post(`${baseUrl}/chat/completions`, {
      model: model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    const result = response.data;
    return success(res, { success: true, model: result.model });
  } catch (error) {
    console.error('AI连接测试失败:', error);
    const errorMsg = error.response?.data?.error?.message || error.message || '连接失败';
    return res.status(400).json({ success: false, error: errorMsg });
  }
});

module.exports = router;
