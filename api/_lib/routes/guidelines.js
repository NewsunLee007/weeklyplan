/**
 * 每周工作指导接口 /api/guidelines
 */
const router = require('express').Router();
const { queryOne, execute } = require('../db/adapter');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success, fail, now } = require('../utils/helper');

// GET /api/guidelines/current?semester=xxx&weekNumber=xxx
router.get('/current', authMiddleware, async (req, res) => {
  const { semester, weekNumber } = req.query;
  if (!semester || !weekNumber) {
    return fail(res, '缺少参数', 400);
  }

  try {
    const guideline = await queryOne(
      `SELECT * FROM biz_weekly_guideline WHERE semester = ? AND week_number = ?`,
      [semester, weekNumber]
    );
    return success(res, guideline || null);
  } catch (error) {
    console.error(error);
    return fail(res, '获取失败');
  }
});

// POST /api/guidelines/save
router.post('/save', authMiddleware, requireRole('OFFICE_HEAD', 'ADMIN'), async (req, res) => {
  const { semester, weekNumber, content } = req.body;
  const { userId } = req.user;

  if (!semester || !weekNumber || content === undefined) {
    return fail(res, '缺少参数', 400);
  }

  const n = now();

  try {
    const existing = await queryOne(
      `SELECT id FROM biz_weekly_guideline WHERE semester = ? AND week_number = ?`,
      [semester, weekNumber]
    );

    if (existing) {
      await execute(
        `UPDATE biz_weekly_guideline SET content = ?, update_time = ? WHERE id = ?`,
        [content, n, existing.id]
      );
    } else {
      await execute(
        `INSERT INTO biz_weekly_guideline (semester, week_number, content, create_time, update_time, create_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [semester, weekNumber, content, n, n, userId]
      );
    }
    return success(res, null, '保存成功');
  } catch (error) {
    console.error(error);
    return fail(res, '保存失败');
  }
});

module.exports = router;
