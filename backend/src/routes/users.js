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
    [username, hashedPwd, real_name, department_id, role, phone || '', 1, n, n]
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

// GET /export 导出用户
router.get('/export', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const users = await query(
      `SELECT u.username, u.real_name, u.role, u.phone, d.name as dept_name, u.status
       FROM sys_user u LEFT JOIN sys_department d ON u.department_id = d.id
       WHERE u.is_deleted = false ORDER BY u.id`
    );

    const data = users.map(user => ({
      用户名: user.username,
      姓名: user.real_name,
      部门: user.dept_name || '',
      角色: user.role === 'ADMIN' ? '管理员' : '普通用户',
      手机号: user.phone || '',
      状态: user.status === 1 ? '正常' : '禁用'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '用户数据');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=users_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('导出用户失败:', error);
    return fail(res, '导出失败');
  }
});

// POST /import 导入用户
router.post('/import', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage() }).single('file');

    upload(req, res, async (err) => {
      if (err) return fail(res, '文件上传失败');
      if (!req.file) return fail(res, '请选择文件');

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0, failCount = 0;
      const roleMap = { '管理员': 'ADMIN', '普通用户': 'STAFF' };
      const statusMap = { '正常': 1, '禁用': 0 };

      for (const row of data) {
        try {
          const username = row['用户名']?.toString().trim();
          const realName = row['姓名']?.toString().trim();
          const deptName = row['部门']?.toString().trim();
          const roleText = row['角色']?.toString().trim();
          const phone = row['手机号']?.toString().trim();
          const statusText = row['状态']?.toString().trim();

          if (!username || !realName) {
            failCount++;
            continue;
          }

          // 查找部门ID
          let deptId = null;
          if (deptName) {
            const dept = await queryOne(`SELECT id FROM sys_department WHERE name = ? AND is_deleted = false`, [deptName]);
            if (dept) deptId = dept.id;
          }

          // 检查用户是否存在
          const existing = await queryOne(`SELECT id FROM sys_user WHERE username = ? AND is_deleted = false`, [username]);
          if (existing) {
            // 更新用户
            await execute(
              `UPDATE sys_user SET real_name=?, department_id=?, role=?, phone=?, status=?, update_time=? WHERE id=?`,
              [realName, deptId, roleMap[roleText] || 'STAFF', phone, statusMap[statusText] || 1, now(), existing.id]
            );
          } else {
            // 新增用户
            const hashedPwd = bcrypt.hashSync('123456', 10);
            const n = now();
            await execute(
              `INSERT INTO sys_user (username, password, real_name, department_id, role, phone, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [username, hashedPwd, realName, deptId, roleMap[roleText] || 'STAFF', phone, statusMap[statusText] || 1, n, n]
            );
          }
          successCount++;
        } catch (e) {
          console.error('导入用户失败:', e);
          failCount++;
        }
      }

      return success(res, { success: successCount, fail: failCount }, '导入完成');
    });
  } catch (error) {
    console.error('导入用户失败:', error);
    return fail(res, '导入失败');
  }
});

module.exports = router;
