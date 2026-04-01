/**
 * 用户管理 /api/users
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query, queryOne, execute } = require('../db/adapter');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success, successPage, fail, now } = require('../utils/helper');

// GET / 用户列表（分页）
router.get('/', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { page = 1, pageSize = 10, department_id, role, keyword } = req.query;
  let where = `WHERE u.is_deleted = false`;
  const params = [];
  if (department_id) { where += ` AND u.department_id = ?`; params.push(department_id); }
  if (role) { where += ` AND u.role = ?`; params.push(role); }
  if (keyword) { where += ` AND (u.username LIKE ? OR u.real_name LIKE ?)`; params.push(`%${keyword}%`, `%${keyword}%`); }

  const total = await queryOne(
    `SELECT COUNT(*) as cnt FROM sys_user u LEFT JOIN sys_department d ON u.department_id = d.id ${where}`,
    params
  )?.cnt || 0;

  const offset = (Number(page) - 1) * Number(pageSize);
  const records = await query(
    `SELECT u.id, u.username, u.real_name, u.role, u.department_id, u.phone, u.status, u.create_time,
            d.name as dept_name
     FROM sys_user u LEFT JOIN sys_department d ON u.department_id = d.id
     ${where} ORDER BY u.id LIMIT ? OFFSET ?`,
    [...params, Number(pageSize), offset]
  );

  return successPage(res, records, total, page, pageSize);
});

// POST / 新增用户
router.post('/', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { username, password, real_name, department_id, role, phone } = req.body;
  if (!username || !real_name || !department_id || !role) return fail(res, '必填字段不能为空');

  const exists = await queryOne(`SELECT id FROM sys_user WHERE username = ? AND is_deleted = false`, [username]);
  if (exists) return fail(res, '用户名已存在');

  const hashedPwd = bcrypt.hashSync(password || '123456', 10);
  const n = now();
  const result = await execute(
    `INSERT INTO sys_user (username, password, real_name, department_id, role, phone, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, hashedPwd, real_name, department_id, role, phone || '', n, n, n]
  );
  return success(res, { id: result.lastInsertRowid }, '用户创建成功');
});

// PUT /:id 修改用户
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { real_name, department_id, role, phone, status } = req.body;
  const user = await queryOne(`SELECT id FROM sys_user WHERE id = ? AND is_deleted = false`, [id]);
  if (!user) return fail(res, '用户不存在', 404);

  await execute(
    `UPDATE sys_user SET real_name=?, department_id=?, role=?, phone=?, status=?, update_time=? WHERE id=?`,
    [real_name, department_id, role, phone || '', status ?? 1, now(), id]
  );
  return success(res, null, '更新成功');
});

// DELETE /:id 删除用户
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  if (Number(id) === 1) return fail(res, '不能删除超级管理员');
  await execute(`UPDATE sys_user SET is_deleted=true, update_time=? WHERE id=?`, [now(), id]);
  return success(res, null, '删除成功');
});

// PUT /:id/reset-password 重置密码
router.put('/:id/reset-password', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const hashedPwd = bcrypt.hashSync('123456', 10);
  await execute(`UPDATE sys_user SET password=?, update_time=? WHERE id=?`, [hashedPwd, now(), id]);
  return success(res, null, '密码已重置为 123456');
});

module.exports = router;
