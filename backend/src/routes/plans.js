/**
 * 周计划管理 /api/plans
 */
const router = require('express').Router();
const { query, queryOne, execute } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { success, successPage, fail, now, getWeekday, calcWeekRange, calcWeekNumber } = require('../utils/helper');

// GET / 计划列表
router.get('/', authMiddleware, async (req, res) => {
  const { page = 1, pageSize = 10, department_id, week_number, status, semester } = req.query;
  let where = `WHERE p.is_deleted = false`;
  const params = [];

  // 非管理员只能看自己部门的计划（已发布计划可见全部）
  if (!['ADMIN', 'OFFICE_HEAD', 'PRINCIPAL', 'ACADEMIC_HEAD'].includes(req.user.role)) {
    const deptId = req.user.departmentId || null;
    if (deptId) {
      where += ` AND (p.department_id = ? OR p.status = 'PUBLISHED')`;
      params.push(deptId);
    } else {
      where += ` AND p.status = 'PUBLISHED'`;
    }
  }
  if (department_id) { where += ` AND p.department_id = ?`; params.push(department_id); }
  if (week_number) { where += ` AND p.week_number = ?`; params.push(week_number); }
  if (status) { where += ` AND p.status = ?`; params.push(status); }
  if (semester) { where += ` AND p.semester = ?`; params.push(semester); }

  const totalRes = await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan p ${where}`, params
  );
  const total = totalRes?.cnt ? parseInt(totalRes.cnt, 10) : 0;

  const offset = (Number(page) - 1) * Number(pageSize);
  const records = await query(
    `SELECT p.*, d.name as dept_name, u.real_name as creator_name
     FROM biz_week_plan p
     LEFT JOIN sys_department d ON p.department_id = d.id
     LEFT JOIN sys_user u ON p.creator_id = u.id
     ${where} ORDER BY p.semester DESC, p.week_number DESC, p.id DESC LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset]
  );

  // 为每个计划添加工作内容条目
  for (const plan of records) {
    const items = await query(
      `SELECT * FROM biz_plan_item WHERE plan_id = ? AND is_deleted = false ORDER BY plan_date, sort_order`,
      [plan.id]
    );
    // 将工作内容条目合并为一个字符串显示
    plan.workContent = items.map(item => item.content).join('；') || '无内容';
  }

  return successPage(res, records, total, page, pageSize);
});

// GET /:id 计划详情
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const plan = await queryOne(
    `SELECT p.*, d.name as dept_name, u.real_name as creator_name
     FROM biz_week_plan p
     LEFT JOIN sys_department d ON p.department_id = d.id
     LEFT JOIN sys_user u ON p.creator_id = u.id
     WHERE p.id = ? AND p.is_deleted = false`,
    [id]
  );
  if (!plan) return fail(res, '计划不存在', 404);

  plan.items = await query(
    `SELECT * FROM biz_plan_item WHERE plan_id = ? AND is_deleted = false ORDER BY plan_date, sort_order`,
    [id]
  );
  plan.reviews = await query(
    `SELECT r.*, u.real_name as reviewer_name
     FROM biz_review_record r LEFT JOIN sys_user u ON r.reviewer_id = u.id
     WHERE r.plan_id = ? ORDER BY r.id`,
    [id]
  );
  return success(res, plan);
});

// POST / 新建计划
router.post('/', authMiddleware, async (req, res) => {
  let { week_number, semester, start_date, end_date, title, remark, items = [] } = req.body;
  if (!start_date || !end_date || !title) {
    return fail(res, '必填字段不能为空');
  }

  // 获取系统配置中的学期起始日期
  let weekStartDate = '2026-02-25';
  try {
    const config = await queryOne("SELECT config_value FROM sys_config WHERE config_key = 'current_week_start'");
    if (config?.config_value) {
      weekStartDate = config.config_value;
    }
  } catch (error) {
    console.log('获取学期起始日期失败，使用默认值');
  }

  // 如果没有提供周次，自动根据start_date计算
  if (!week_number) {
    week_number = calcWeekNumber(weekStartDate, start_date);
  }

  // 如果没有提供学期，使用默认值
  if (!semester) {
    try {
      const config = await queryOne("SELECT config_value FROM sys_config WHERE config_key = 'current_semester'");
      if (config?.config_value) {
        semester = config.config_value;
      } else {
        semester = '2025-2';
      }
    } catch (error) {
      semester = '2025-2';
    }
  }

  const n = now();
  const deptId = req.user.departmentId || null;
  const result = await execute(
    `INSERT INTO biz_week_plan (department_id, creator_id, week_number, semester, start_date, end_date, title, status, current_step, remark, create_time, update_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [deptId, req.user.userId, week_number, semester, start_date, end_date, title, 'DRAFT', 'CREATE', remark || '', n, n]
  );
  const planId = result.lastInsertRowid;

  // 插入条目
  for (let [idx, item] of items.entries()) {
    const weekday = item.weekday || getWeekday(item.plan_date);
    await execute(
      `INSERT INTO biz_plan_item (plan_id, plan_date, weekday, content, responsible, sort_order, create_time, update_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [planId, item.plan_date, weekday, item.content, item.responsible || '', idx, n, n]
    );
  }

  return success(res, { id: planId }, '计划创建成功');
});

// PUT /:id 修改计划
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const plan = await queryOne(`SELECT * FROM biz_week_plan WHERE id = ? AND is_deleted = false`, [id]);
  if (!plan) return fail(res, '计划不存在', 404);
  if (!['DRAFT', 'REJECTED'].includes(plan.status)) return fail(res, '当前状态不允许修改');
  if (plan.creator_id !== req.user.userId && req.user.role !== 'ADMIN') {
    return fail(res, '无权修改', 403);
  }

  const { title, remark, items = [] } = req.body;
  const n = now();
  await execute(`UPDATE biz_week_plan SET title=?, remark=?, update_time=? WHERE id=?`, [title, remark || '', n, id]);

  // 删除旧条目，重新插入
  await execute(`UPDATE biz_plan_item SET is_deleted=true WHERE plan_id=?`, [id]);
  for (let [idx, item] of items.entries()) {
    const weekday = item.weekday || getWeekday(item.plan_date);
    await execute(
      `INSERT INTO biz_plan_item (plan_id, plan_date, weekday, content, responsible, sort_order, create_time, update_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, item.plan_date, weekday, item.content, item.responsible || '', idx, n, n]
    );
  }

  return success(res, null, '更新成功');
});

// DELETE /:id 删除计划（仅 DRAFT）
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const plan = await queryOne(`SELECT * FROM biz_week_plan WHERE id = ? AND is_deleted = false`, [id]);
  if (!plan) return fail(res, '计划不存在', 404);
  if (plan.status !== 'DRAFT') return fail(res, '仅草稿状态的计划可以删除');
  if (plan.creator_id !== req.user.userId && req.user.role !== 'ADMIN') {
    return fail(res, '无权删除', 403);
  }
  await execute(`UPDATE biz_week_plan SET is_deleted=true, update_time=? WHERE id=?`, [now(), id]);
  return success(res, null, '删除成功');
});

// POST /:id/withdraw 撤回审核
router.post('/:id/withdraw', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const plan = await queryOne(`SELECT * FROM biz_week_plan WHERE id = ? AND is_deleted = false`, [id]);
  if (!plan) return fail(res, '计划不存在', 404);
  if (['PUBLISHED'].includes(plan.status)) return fail(res, '已发布计划不允许撤回');
  if (plan.creator_id !== req.user.userId && req.user.role !== 'ADMIN') {
    return fail(res, '无权操作', 403);
  }
  
  await execute(`UPDATE biz_week_plan SET status='DRAFT', current_step=1, update_time=? WHERE id=?`, [now(), id]);
  return success(res, null, '已撤回');
});

// POST /:id/submit 提交审核
router.post('/:id/submit', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const plan = await queryOne(`SELECT * FROM biz_week_plan WHERE id = ? AND is_deleted = false`, [id]);
  if (!plan) return fail(res, '计划不存在', 404);
  if (!['DRAFT', 'REJECTED'].includes(plan.status)) return fail(res, '当前状态不允许提交');
  if (plan.creator_id !== req.user.userId && req.user.role !== 'ADMIN') {
    return fail(res, '无权操作', 403);
  }
  // 根据角色设置提交状态，部门主任和教务主任免第一步审核
  let targetStatus = 'SUBMITTED';
  let targetStep = 1;
  if (req.user.role === 'DEPT_HEAD' || req.user.role === 'ACADEMIC_HEAD') {
    targetStatus = 'DEPT_APPROVED';
    targetStep = 2;
  }
  await execute(`UPDATE biz_week_plan SET status=?, current_step=?, update_time=? WHERE id=?`, [targetStatus, targetStep, now(), id]);
  return success(res, null, '已提交审核');
});

// PUT /:id/published-items 修改已发布计划的条目
router.put('/:id/published-items', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { updatedItems = [] } = req.body;
  if (!['OFFICE_HEAD', 'ADMIN'].includes(req.user.role)) {
    return fail(res, '无权修改已发布计划', 403);
  }

  const plan = await queryOne(`SELECT * FROM biz_week_plan WHERE id = ? AND is_deleted = false`, [id]);
  if (!plan) return fail(res, '计划不存在', 404);
  if (plan.status !== 'PUBLISHED') return fail(res, '计划不是已发布状态');

  const n = now();
  const currentItems = await query(`SELECT id FROM biz_plan_item WHERE plan_id = ? AND is_deleted = false`, [id]);
  const currentIds = currentItems.map(i => i.id);
  const updatedIds = updatedItems.map(i => i.id).filter(Boolean);
  
  // 删除被移除的条目
  const toDelete = currentIds.filter(itemId => !updatedIds.includes(itemId));
  if (toDelete.length > 0) {
    await execute(`UPDATE biz_plan_item SET is_deleted = true, update_time = ? WHERE id IN (${toDelete.join(',')})`, [n]);
  }

  // 更新或插入条目
  for (const item of updatedItems) {
    if (item.id) {
      await execute(
        `UPDATE biz_plan_item SET content=?, responsible=?, plan_date=?, weekday=?, update_time=? WHERE id=?`,
        [item.content || '', item.responsible || '', item.plan_date || '', item.weekday || '', n, item.id]
      );
    } else if (item._isNew) {
      await execute(
        `INSERT INTO biz_plan_item (plan_id, plan_date, weekday, content, responsible, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, item.plan_date || '', item.weekday || '', item.content || '', item.responsible || '', n, n]
      );
    }
  }

  return success(res, null, '二次修改保存成功');
});

module.exports = router;
