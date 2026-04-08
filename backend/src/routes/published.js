/**
 * 已发布计划 /api/published
 */
const router = require('express').Router();
const { query, queryOne } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { success, fail } = require('../utils/helper');

// GET / 已发布计划列表
router.get('/', authMiddleware, async (req, res) => {
  const { semester, week_number } = req.query;
  let where = `WHERE p.status = 'PUBLISHED' AND p.is_deleted = false`;
  const params = [];
  if (semester) { where += ` AND p.semester = ?`; params.push(semester); }
  if (week_number) { where += ` AND p.week_number = ?`; params.push(week_number); }

  // 如果不是管理员/校长/办公室主任，只能看到自己部门的反馈计划
  if (req.user && !['ADMIN', 'PRINCIPAL', 'OFFICE_HEAD'].includes(req.user.role) && req.user.departmentId) {
    where += " AND p.department_id = $1";
    params.push(req.user.departmentId);
  }

  const records = await query(
    `SELECT p.*, d.name as dept_name
     FROM biz_week_plan p LEFT JOIN sys_department d ON p.department_id = d.id
     ${where} ORDER BY p.semester DESC, p.week_number DESC, d.sort_order`,
    params
  );
  
  // 为每个计划添加工作内容条目拼接以及检查是否已反馈
  for (const plan of records) {
    const items = await query(
      `SELECT content FROM biz_plan_item WHERE plan_id = ? AND is_deleted = false ORDER BY plan_date, sort_order`,
      [plan.id]
    );
    plan.title = items.map(i => i.content).join('；') || '无内容';
    
    // 检查当前用户是否已对该计划提交过反馈
    const feedbackCount = await queryOne(
      `SELECT COUNT(*) as count FROM biz_feedback WHERE plan_id = $1 AND feedback_user_id = $2`,
      [plan.id, req.user.userId]
    );
    plan.has_feedback = feedbackCount && parseInt(feedbackCount.count) > 0;
  }

  return success(res, records);
});

// GET /:weekNumber 指定周次汇总（按部门）
router.get('/:weekNumber', authMiddleware, async (req, res) => {
  const { weekNumber } = req.params;
  const { semester } = req.query;
  let where = `WHERE p.status = 'PUBLISHED' AND p.is_deleted = false AND p.week_number = ?`;
  const params = [weekNumber];
  if (semester) { where += ` AND p.semester = ?`; params.push(semester); }

  const plans = await query(
    `SELECT p.*, d.name as dept_name
     FROM biz_week_plan p LEFT JOIN sys_department d ON p.department_id = d.id
     ${where} ORDER BY d.sort_order`,
    params
  );

  // 附带条目
  for (const plan of plans) {
    plan.items = await query(
      `SELECT * FROM biz_plan_item WHERE plan_id = ? AND is_deleted = false ORDER BY plan_date, sort_order`,
      [plan.id]
    );
  }

  return success(res, plans);
});

module.exports = router;
