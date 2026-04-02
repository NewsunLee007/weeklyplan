/**
 * Vercel Serverless Function - Express 应用
 */
const express = require('express');
const cors = require('cors');

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

// 延迟加载数据库初始化和路由注册
let routesInitialized = false;

// 导出 Vercel Serverless Function
module.exports = async (req, res) => {
  try {
    // 确保路由已注册
    if (!routesInitialized) {
      const { initDatabase } = require('../backend/src/db/adapter');
      await initDatabase();
      
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
      
      routesInitialized = true;
    }
    
    // 处理请求
    app(req, res);
  } catch (error) {
    console.error('Serverless function error:', error);
    res.status(500).json({ code: 500, message: error.message || '服务器内部错误', data: null });
  }
};
