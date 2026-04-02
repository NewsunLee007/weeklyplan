/**
 * Vercel Serverless Function - Express 应用
 */
const express = require('express');
const cors = require('cors');
const serverless = require('serverless-http');

const app = express();

console.log('🚀 API 服务正在启动...');

// CORS 配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 健康检查路由 - 立即响应，不依赖数据库
app.get('/health', (req, res) => {
  console.log('🏥 健康检查被调用');
  res.json({ 
    code: 200, 
    message: 'API 服务正常运行', 
    data: { 
      timestamp: new Date().toISOString(),
      dbInitialized: dbInitialized 
    } 
  });
});

// 缓存控制中间件
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  console.log(`📨 收到请求: ${req.method} ${req.url}`);
  next();
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('❌ 全局错误:', err);
  res.status(500).json({ code: 500, message: err.message || '服务器内部错误', data: null });
});

// 数据库初始化状态
let dbInitialized = false;
let initPromise = null;

// 初始化数据库
async function initializeDatabase() {
  if (!dbInitialized && !initPromise) {
    initPromise = (async () => {
      try {
        console.log('📦 开始初始化数据库...');
        const { initDatabase } = require('../backend/src/db/adapter');
        await initDatabase();
        console.log('✅ 数据库初始化完成');
        dbInitialized = true;
      } catch (error) {
        console.error('❌ 数据库初始化失败:', error);
        // 即使数据库初始化失败，我们也继续运行，让API返回默认值
        dbInitialized = false;
      } finally {
        initPromise = null;
      }
    })();
  }
  return initPromise;
}

// 路由注册（预先注册，不需要等待数据库初始化）
// 注意：由于 Vercel 重写已经处理了 /api 前缀，这里不需要再添加 /api 前缀
console.log('🔗 注册路由...');
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
console.log('✅ 路由注册完成');

// 404 处理
app.use((req, res) => {
  console.log('❌ 404 - 路由未找到:', req.method, req.url);
  res.status(404).json({ code: 404, message: 'API 路由未找到', data: null });
});

// 导出 Vercel Serverless Function
const handler = serverless(app);

// 启动数据库初始化（在模块加载时就开始）
initializeDatabase().catch(error => {
  console.error('❌ 数据库初始化失败（启动阶段）:', error);
});

module.exports = async (req, res) => {
  console.log('🎯 Serverless function 被调用:', req.method, req.url);
  try {
    // 直接处理请求，不等待数据库初始化
    // 数据库查询会在初始化完成前返回空数据，初始化完成后正常返回数据
    const result = await handler(req, res);
    console.log('✅ 请求处理完成');
    return result;
  } catch (error) {
    console.error('❌ Serverless function 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '服务器内部错误', data: null });
  }
};
