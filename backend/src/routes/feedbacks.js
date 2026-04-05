/**
 * 反馈接口 /api/feedbacks
 */
const router = require('express').Router();
const { query, queryOne, execute, run } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { success, fail, now } = require('../utils/helper');

// GET / 反馈列表
router.get('/', authMiddleware, async (req, res) => {
  const { plan_id } = req.query;
  let where = `WHERE 1=1`;
  const params = [];
  if (plan_id) { where += ` AND f.plan_id = ?`; params.push(plan_id); }

  const records = await query(
    `SELECT f.*, pi.content as item_content, pi.plan_date, pi.weekday, u.real_name as user_name
     FROM biz_feedback f
     LEFT JOIN biz_plan_item pi ON f.plan_item_id = pi.id
     LEFT JOIN sys_user u ON f.feedback_user_id = u.id
     ${where} ORDER BY f.plan_id, pi.plan_date, pi.sort_order`,
    params
  );
  return success(res, records);
});

// POST / 提交或更新反馈（UPSERT）
router.post('/', authMiddleware, async (req, res) => {
  const { plan_item_id, plan_id, status, content } = req.body;
  if (!plan_item_id || !plan_id || !status) return fail(res, '必填字段不能为空');

  const n = now();
  const userId = req.user.userId;

  const existing = await queryOne(
    `SELECT id FROM biz_feedback WHERE plan_item_id = ? AND feedback_user_id = $2`,
    [plan_item_id, userId]
  );

  if (existing) {
    await run(`UPDATE biz_feedback SET status=?, content=$2, update_time=$3 WHERE id=$4`,
      [status, content || '', n, existing.id]);
  } else {
    await run(
      `INSERT INTO biz_feedback (plan_item_id, plan_id, feedback_user_id, status, content, create_time, update_time) VALUES (?, $2, $3, $4, $5, $6, $7)`,
      [plan_item_id, plan_id, userId, status, content || '', n, n]
    );
  }
  return success(res, null, '反馈已保存');
});

// GET /plan/:planId 某计划的所有反馈汇总
router.get('/plan/:planId', authMiddleware, async (req, res) => {
  const { planId } = req.params;
  const records = await query(
    `SELECT f.*, pi.content as item_content, pi.plan_date, pi.weekday, u.real_name as user_name
     FROM biz_feedback f
     LEFT JOIN biz_plan_item pi ON f.plan_item_id = pi.id
     LEFT JOIN sys_user u ON f.feedback_user_id = u.id
     WHERE f.plan_id = ? ORDER BY pi.plan_date, pi.sort_order`,
    [planId]
  );
  return success(res, records);
});

module.exports = router;
