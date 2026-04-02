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
app.use('/api/auth', require('../backend/src/routes/auth'));
app.use('/api/users', require('../backend/src/routes/users'));
app.use('/api/departments', require('../backend/src/routes/departments'));
app.use('/api/plans', require('../backend/src/routes/plans'));
app.use('/api/reviews', require('../backend/src/routes/reviews'));
app.use('/api/published', require('../backend/src/routes/published'));
app.use('/api/feedbacks', require('../backend/src/routes/feedbacks'));
app.use('/api/configs', require('../backend/src/routes/configs'));
app.use('/api/export', require('../backend/src/routes/export'));
app.use('/api/dashboard', require('../backend/src/routes/dashboard'));
app.use('/api/ai', require('../backend/src/routes/ai'));
app.use('/api/knowledge', require('../backend/src/routes/knowledge'));

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

module.exports = async (req, res) => {
  try {
    // 并行处理：启动数据库初始化但不等待，让请求继续处理
    // 这样可以快速响应第一个请求，同时在后台初始化数据库
    const initDb = initializeDatabase();
    
    // 处理请求（如果数据库还没初始化，路由会在首次查询时自动处理）
    return await handler(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ code: 500, message: error.message || '服务器内部错误', data: null });
  }
};
