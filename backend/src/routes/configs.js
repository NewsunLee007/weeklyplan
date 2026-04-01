/**
 * 系统配置 /api/configs
 */
const router = require('express').Router();
const { query, run, execute } = require('../db/adapter');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success, now } = require('../utils/helper');

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
    await execute(`UPDATE sys_config SET config_value=?, update_time=? WHERE config_key=?`,
      [cfg.config_value, n, cfg.config_key]);
  }
  return success(res, null, '配置已保存');
});

module.exports = router;
