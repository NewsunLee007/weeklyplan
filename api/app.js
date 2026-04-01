/**
 * Vercel Serverless Function - Express 应用
 */
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('../backend/src/db/adapter');

const app = express();

// CORS 配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 路由注册标志
let routesInitialized = false;

// 路由注册
async function setupRoutes() {
  if (routesInitialized) return;
  
  await initDatabase();

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

  // 全局错误处理
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message || '服务器内部错误', data: null });
  });
  
  routesInitialized = true;
}

// 导出 Vercel Serverless Function
module.exports = async (req, res) => {
  try {
    // 确保路由已注册
    await setupRoutes();
    
    // 处理请求
    app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ code: 500, message: error.message || '服务器内部错误', data: null });
  }
};
