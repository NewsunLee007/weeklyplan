/**
 * 部门管理 /api/departments
 */
const router = require('express').Router();
const { query, queryOne, execute, run } = require('../db/adapter');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success, fail, now } = require('../utils/helper');

// GET / 获取所有部门
router.get('/', authMiddleware, async (req, res) => {
  const depts = await query(`SELECT * FROM sys_department WHERE is_deleted = 0 ORDER BY sort_order`);
  return success(res, depts);
});

// POST / 新增部门
router.post('/', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { name, code, sort_order = 0, description } = req.body;
  if (!name || !code) return fail(res, '部门名称和编码不能为空');

  const exists = await queryOne(`SELECT id FROM sys_department WHERE code = ? AND is_deleted = 0`, [code]);
  if (exists) return fail(res, '部门编码已存在');

  const n = now();
  const result = await execute(
    `INSERT INTO sys_department (name, code, sort_order, description, status, create_time, update_time) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [name, code, sort_order, description || '', n, n]
  );
  return success(res, { id: result.lastInsertRowid }, '部门创建成功');
});

// PUT /:id 修改部门
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { name, code, sort_order, description, status } = req.body;
  const dept = await queryOne(`SELECT id FROM sys_department WHERE id = ? AND is_deleted = 0`, [id]);
  if (!dept) return fail(res, '部门不存在', 404);

  await execute(
    `UPDATE sys_department SET name=?, code=?, sort_order=?, description=?, status=?, update_time=? WHERE id=?`,
    [name, code, sort_order ?? 0, description || '', status ?? 1, now(), id]
  );
  return success(res, null, '更新成功');
});

// DELETE /:id 删除部门
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  await execute(`UPDATE sys_department SET is_deleted=1, update_time=? WHERE id=?`, [now(), id]);
  return success(res, null, '删除成功');
});

module.exports = router;
