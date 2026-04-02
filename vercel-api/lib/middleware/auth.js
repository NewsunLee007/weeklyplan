/**
 * JWT 认证中间件
 */
const jwt = require('jsonwebtoken');
const { fail } = require('../utils/helper');

const JWT_SECRET = process.env.JWT_SECRET || 'school-plan-secret-2025';
const JWT_EXPIRES = '8h';

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return fail(res, '未登录或 Token 已过期', 401);
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return fail(res, 'Token 无效或已过期', 401);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return fail(res, '未登录', 401);
    if (!roles.includes(req.user.role)) {
      return fail(res, '权限不足', 403);
    }
    next();
  };
}

module.exports = { generateToken, authMiddleware, requireRole };
