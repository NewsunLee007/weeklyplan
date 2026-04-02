/**
 * 审核接口 /api/reviews
 */
const router = require('express').Router();
const { query, queryOne, execute } = require('../db/adapter');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success, fail, now } = require('../utils/helper');
const wechatService = require('../services/wechat');

const REVIEW_ROLES = ['DEPT_HEAD', 'OFFICE_HEAD', 'PRINCIPAL', 'ADMIN'];

// 状态流转
const STATUS_FLOW = {
  1: { from: 'SUBMITTED', to: 'DEPT_APPROVED' },
  2: { from: 'DEPT_APPROVED', to: 'OFFICE_APPROVED' },
  3: { from: 'OFFICE_APPROVED', to: 'PUBLISHED' }
};

// 角色对应审核步骤
const ROLE_STEP = {
  DEPT_HEAD: 1,
  OFFICE_HEAD: 2,
  PRINCIPAL: 3,
  ADMIN: null // ADMIN 可审核任意步骤
};

// GET /pending 待审核列表
router.get('/pending', authMiddleware, requireRole(...REVIEW_ROLES), async (req, res) => {
  const { role, departmentId } = req.user;
  let where = `WHERE p.is_deleted = false`;

  if (role === 'DEPT_HEAD') {
    where += ` AND p.status = 'SUBMITTED' AND p.department_id = ${departmentId}`;
  } else if (role === 'OFFICE_HEAD') {
    where += ` AND p.status = 'DEPT_APPROVED'`;
  } else if (role === 'PRINCIPAL') {
    where += ` AND p.status = 'OFFICE_APPROVED'`;
  } else if (role === 'ADMIN') {
    where += ` AND p.status IN ('SUBMITTED','DEPT_APPROVED','OFFICE_APPROVED')`;
  }

  const records = await query(
    `SELECT p.*, d.name as dept_name, u.real_name as creator_name
     FROM biz_week_plan p
     LEFT JOIN sys_department d ON p.department_id = d.id
     LEFT JOIN sys_user u ON p.creator_id = u.id
     ${where} ORDER BY p.update_time DESC`
  );
  return success(res, records);
});

// POST /:planId/approve 审核通过（支持编辑条目后审核）
router.post('/:planId/approve', authMiddleware, requireRole(...REVIEW_ROLES), async (req, res) => {
  const { planId } = req.params;
  const { comment = '', updatedItems } = req.body; // updatedItems: 编辑后的计划条目 [{id, content, responsible, plan_date, weekday}]
  const { role, userId, departmentId } = req.user;

  const plan = await queryOne(`SELECT * FROM biz_week_plan WHERE id = ? AND is_deleted = false`, [planId]);
  if (!plan) return fail(res, '计划不存在', 404);

  const step = plan.current_step;
  const flow = STATUS_FLOW[step];
  if (!flow) return fail(res, '审核流程异常');
  if (plan.status !== flow.from) return fail(res, `当前状态(${plan.status})不允许此操作`);

  // 验证审核人权限
  if (role === 'DEPT_HEAD') {
    if (step !== 1) return fail(res, '部门主任只能进行第一步审核');
    if (plan.department_id !== departmentId) return fail(res, '只能审核本部门计划');
  } else if (role === 'OFFICE_HEAD' && step !== 2) {
    return fail(res, '办公室主任只能进行第二步审核');
  } else if (role === 'PRINCIPAL' && step !== 3) {
    return fail(res, '校长只能进行最终审核');
  }

  const n = now();

  // 如果审核人编辑了条目，先保存编辑
  if (updatedItems && Array.isArray(updatedItems)) {
    for (const item of updatedItems) {
      if (item.id) {
        // 更新已有条目
        await execute(
          `UPDATE biz_plan_item SET content=?, responsible=?, plan_date=?, weekday=?, update_time=? WHERE id=?`,
          [item.content || '', item.responsible || '', item.plan_date || '', item.weekday || '', n, item.id]
        );
      } else if (item._isNew) {
        // 新增条目（虽然审核时很少新增，但支持）
        await execute(
          `INSERT INTO biz_plan_item (plan_id, plan_date, weekday, content, responsible, create_time, update_time) VALUES (?)`,
          [planId, item.plan_date || '', item.weekday || '', item.content || '', item.responsible || '', n, n]
        );
      }
    }
  }

  // 记录审核日志
  await execute(
    `INSERT INTO biz_review_record (plan_id, reviewer_id, step, result, comment, create_time) VALUES (?)`,
    [planId, userId, step, comment, n]
  );

  // 更新状态
  const nextStep = step + 1;
  const updates = [flow.to, n];
  let sql = `UPDATE biz_week_plan SET status=?, update_time=?, current_step=${nextStep}`;
  if (flow.to === 'PUBLISHED') {
    sql += `, published_at=?`;
    updates.push(n);
  }
  sql += ` WHERE id=?`;
  updates.push(planId);
  await execute(sql, updates);

  // 发布后推送企微
  if (flow.to === 'PUBLISHED') {
    const updatedPlan = await queryOne(`SELECT * FROM biz_week_plan WHERE id=?`, [planId]);
    wechatService.notifyPublished(updatedPlan).catch(e => console.error('企微推送失败', e));
  }

  return success(res, null, '审核通过');
});

// POST /:planId/reject 审核退回
router.post('/:planId/reject', authMiddleware, requireRole(...REVIEW_ROLES), async (req, res) => {
  const { planId } = req.params;
  const { comment } = req.body;
  if (!comment || !comment.trim()) return fail(res, '退回意见不能为空');

  const { role, userId, departmentId } = req.user;
  const plan = await queryOne(`SELECT * FROM biz_week_plan WHERE id = ? AND is_deleted = false`, [planId]);
  if (!plan) return fail(res, '计划不存在', 404);

  const step = plan.current_step;
  if (role === 'DEPT_HEAD' && (step !== 1 || plan.department_id !== departmentId)) {
    return fail(res, '无权操作');
  }

  const n = now();
  await execute(
    `INSERT INTO biz_review_record (plan_id, reviewer_id, step, result, comment, create_time) VALUES (?)`,
    [planId, userId, step, comment, n]
  );
  await execute(`UPDATE biz_week_plan SET status='REJECTED', update_time=? WHERE id=?`, [n, planId]);

  return success(res, null, '已退回');
});

// GET /consolidated/:weekNumber/:semester 整合视图（按日期汇总待审核条目）
router.get('/consolidated/:weekNumber/:semester', authMiddleware, requireRole(...REVIEW_ROLES), async (req, res) => {
  const { weekNumber, semester } = req.params;
  const { role, departmentId, userId } = req.user;

  let where = `WHERE p.is_deleted = false AND p.week_number = ${weekNumber} AND p.semester = '${semester}'`;

  // 根据角色筛选待审核的计划
  if (role === 'DEPT_HEAD') {
    where += ` AND p.status = 'SUBMITTED' AND p.department_id = ${departmentId}`;
  } else if (role === 'OFFICE_HEAD') {
    where += ` AND p.status = 'DEPT_APPROVED'`;
  } else if (role === 'PRINCIPAL') {
    where += ` AND p.status = 'OFFICE_APPROVED'`;
  } else if (role === 'ADMIN') {
    where += ` AND p.status IN ('SUBMITTED','DEPT_APPROVED','OFFICE_APPROVED')`;
  }

  // 获取符合条件的计划ID
  const plans = await query(`SELECT p.id, p.title, p.week_number, p.semester, p.department_id, d.name as dept_name, u.real_name as creator_name FROM biz_week_plan p LEFT JOIN sys_department d ON p.department_id = d.id LEFT JOIN sys_user u ON p.creator_id = u.id ${where}`);

  if (!plans || !plans.length) return success(res, { weekNumber, semester, plans: [], items: [] });

  const planIds = plans.map(p => p.id).join(',');

  // 获取所有条目，按日期排序
  const items = await query(
    `SELECT i.*, p.department_id, d.name as dept_name, p.title as plan_title, p.id as plan_id, p.week_number, p.semester, u.real_name as creator_name
     FROM biz_plan_item i
     LEFT JOIN biz_week_plan p ON i.plan_id = p.id
     LEFT JOIN sys_department d ON p.department_id = d.id
     LEFT JOIN sys_user u ON p.creator_id = u.id
     WHERE i.is_deleted = false AND i.plan_id IN (${planIds})
     ORDER BY i.plan_date, i.sort_order`
  );

  return success(res, {
    weekNumber,
    semester,
    plans: plans || [],
    items: items || []
  });
});

// POST /consolidated/:weekNumber/:semester/approve 整合审核（整体通过）
router.post('/consolidated/:weekNumber/:semester/approve', authMiddleware, requireRole(...REVIEW_ROLES), async (req, res) => {
  const { weekNumber, semester } = req.params;
  const { comment = '', updatedItems } = req.body; // updatedItems: 编辑后的所有条目 [{id, content, responsible, plan_date, weekday}]
  const { role, userId, departmentId } = req.user;

  let where = `WHERE is_deleted = false AND week_number = ${weekNumber} AND semester = '${semester}'`;

  // 筛选待审核的计划
  if (role === 'DEPT_HEAD') {
    where += ` AND status = 'SUBMITTED' AND department_id = ${departmentId}`;
  } else if (role === 'OFFICE_HEAD') {
    where += ` AND status = 'DEPT_APPROVED'`;
  } else if (role === 'PRINCIPAL') {
    where += ` AND status = 'OFFICE_APPROVED'`;
  } else if (role === 'ADMIN') {
    where += ` AND status IN ('SUBMITTED','DEPT_APPROVED','OFFICE_APPROVED')`;
  }

  const plans = await query(`SELECT * FROM biz_week_plan ${where}`);
  if (!plans.length) return fail(res, '没有待审核的计划');

  const n = now();

  // 如果审核人编辑了条目，先保存编辑
  if (updatedItems && Array.isArray(updatedItems)) {
    for (const item of updatedItems) {
      if (item.id) {
        await execute(
          `UPDATE biz_plan_item SET content=?, responsible=?, plan_date=?, weekday=?, update_time=? WHERE id=?`,
          [item.content || '', item.responsible || '', item.plan_date || '', item.weekday || '', n, item.id]
        );
      }
    }
  }

  // 批量审核通过所有符合条件的计划
  for (const plan of plans) {
    const step = plan.current_step;
    const flow = STATUS_FLOW[step];
    if (!flow) continue;
    if (plan.status !== flow.from) continue;

    // 记录审核日志
    await execute(
      `INSERT INTO biz_review_record (plan_id, reviewer_id, step, result, comment, create_time) VALUES (?)`,
      [plan.id, userId, step, comment, n]
    );

    // 更新状态
    const nextStep = step + 1;
    const updates = [flow.to, n];
    let sql = `UPDATE biz_week_plan SET status=?, update_time=?, current_step=${nextStep}`;
    if (flow.to === 'PUBLISHED') {
      sql += `, published_at=?`;
      updates.push(n);
    }
    sql += ` WHERE id=?`;
    updates.push(plan.id);
    await execute(sql, updates);

    // 发布后推送企微
    if (flow.to === 'PUBLISHED') {
      wechatService.notifyPublished(plan).catch(e => console.error('企微推送失败', e));
    }
  }

  return success(res, null, `已审核通过 ${plans.length} 个计划`);
});

// GET /records/:planId 查看审核记录
router.get('/records/:planId', authMiddleware, async (req, res) => {
  const { planId } = req.params;
  const records = await query(
    `SELECT r.*, u.real_name as reviewer_name
     FROM biz_review_record r LEFT JOIN sys_user u ON r.reviewer_id = u.id
     WHERE r.plan_id = ? ORDER BY r.id`,
    [planId]
  );
  return success(res, records);
});

module.exports = router;
