/**
 * Vercel Serverless Function - Express 应用
 */
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();

// CORS 配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 全局错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 500, message: err.message || '服务器内部错误', data: null });
});

// 路由注册（预先注册，不需要等待数据库初始化）
// 注意：由于 Vercel 重写已经处理了 /api 前缀，这里不需要再添加 /api 前缀
app.use('/auth', require('../backend/src/routes/auth'));
app.use('/users', require('../backend/src/routes/users'));
app.use('/departments', require('../backend/src/routes/departments'));
app.use('/plans', require('../backend/src/routes/plans'));
app.use('/reviews', require('../backend/src/routes/reviews'));
app.use('/published', require('../backend/src/routes/published'));
app.use('/feedbacks', require('../backend/src/routes/feedbacks'));
app.use('/configs', require('../backend/src/routes/configs'));
app.use('/export', require('../backend/src/routes/export'));
app.use('/dashboard', require('../backend/src/routes/dashboard'));
app.use('/ai', require('../backend/src/routes/ai'));
app.use('/knowledge', require('../backend/src/routes/knowledge'));

// 数据库初始化状态
let dbInitialized = false;
let initPromise = null;

// 初始化数据库
async function initializeDatabase() {
  if (!dbInitialized && !initPromise) {
    initPromise = (async () => {
      try {
        const { initDatabase } = require('../backend/src/db/adapter');
        console.log('开始初始化数据库...');
        await initDatabase();
        console.log('数据库初始化完成');
        dbInitialized = true;
      } catch (error) {
        console.error('数据库初始化失败:', error);
        throw error;
      } finally {
        initPromise = null;
      }
    })();
  }
  return initPromise;
}

// 导出 Vercel Serverless Function
const handler = serverless(app);

// 启动数据库初始化（在模块加载时就开始）
initializeDatabase().catch(error => {
  console.error('数据库初始化失败:', error);
});

module.exports = async (req, res) => {
  try {
    // 直接处理请求，不等待数据库初始化
    // 数据库查询会在初始化完成前返回空数据，初始化完成后正常返回数据
    return await handler(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ code: 500, message: error.message || '服务器内部错误', data: null });
  }
};
