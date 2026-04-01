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
  let where = `WHERE p.status = 'PUBLISHED' AND p.is_deleted = 0`;
  const params = [];
  if (semester) { where += ` AND p.semester = ?`; params.push(semester); }
  if (week_number) { where += ` AND p.week_number = ?`; params.push(week_number); }

  const records = await query(
    `SELECT p.*, d.name as dept_name
     FROM biz_week_plan p LEFT JOIN sys_department d ON p.department_id = d.id
     ${where} ORDER BY p.semester DESC, p.week_number DESC, d.sort_order`,
    params
  );
  return success(res, records);
});

// GET /:weekNumber 指定周次汇总（按部门）
router.get('/:weekNumber', authMiddleware, async (req, res) => {
  const { weekNumber } = req.params;
  const { semester } = req.query;
  let where = `WHERE p.status = 'PUBLISHED' AND p.is_deleted = 0 AND p.week_number = ?`;
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
      `SELECT * FROM biz_plan_item WHERE plan_id = ? AND is_deleted = 0 ORDER BY plan_date, sort_order`,
      [plan.id]
    );
  }

  return success(res, plans);
});

module.exports = router;
