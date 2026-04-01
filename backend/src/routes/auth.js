/**
 * 认证接口 /api/auth
 */
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../db/adapter');
const { generateToken } = require('../middleware/auth');
const { success, fail } = require('../utils/helper');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return fail(res, '用户名和密码不能为空');

  const user = await queryOne(
    `SELECT u.*, d.name as dept_name FROM sys_user u
     LEFT JOIN sys_department d ON u.department_id = d.id
     WHERE u.username = ? AND u.is_deleted = false`,
    [username]
  );

  if (!user) return fail(res, '用户名或密码错误');
  if (user.status === 0) return fail(res, '账号已被禁用');

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return fail(res, '用户名或密码错误');

  const token = generateToken({
    userId: user.id,
    username: user.username,
    realName: user.real_name,
    role: user.role,
    departmentId: user.department_id,
    deptName: user.dept_name
  });

  return success(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      realName: user.real_name,
      role: user.role,
      departmentId: user.department_id,
      deptName: user.dept_name
    }
  });
});

// GET /api/auth/info
router.get('/info', require('../middleware/auth').authMiddleware, async (req, res) => {
  const user = await queryOne(
    `SELECT u.id, u.username, u.real_name, u.role, u.department_id, u.phone, u.avatar, d.name as dept_name
     FROM sys_user u LEFT JOIN sys_department d ON u.department_id = d.id
     WHERE u.id = ? AND u.is_deleted = false`,
    [req.user.userId]
  );
  if (!user) return fail(res, '用户不存在', 404);
  return success(res, user);
});

module.exports = router;
