/**
 * 后端入口 app.js
 */
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./lib/db/adapter');

const app = express();

// CORS 配置
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:5173', 'https://localhost:5173'],
  credentials: true
}));

// 缓存控制中间件
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 路由注册（initDatabase 完成后注册）
async function bootstrap() {
  await initDatabase();

  app.use('/api/auth', require('./lib/routes/auth'));
  app.use('/api/users', require('./lib/routes/users'));
  app.use('/api/departments', require('./lib/routes/departments'));
  app.use('/api/plans', require('./lib/routes/plans'));
  app.use('/api/reviews', require('./lib/routes/reviews'));
  app.use('/api/published', require('./lib/routes/published'));
  app.use('/api/feedbacks', require('./lib/routes/feedbacks'));
  app.use('/api/configs', require('./lib/routes/configs'));
  app.use('/api/export', require('./lib/routes/export'));
  app.use('/api/dashboard', require('./lib/routes/dashboard'));
  app.use('/api/ai', require('./lib/routes/ai'));
  app.use('/api/knowledge', require('./lib/routes/knowledge'));

  // 全局错误处理
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message || '服务器内部错误', data: null });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 后端服务已启动：http://localhost:${PORT}`);
  });
}

bootstrap().catch(e => {
  console.error('启动失败', e);
  process.exit(1);
});
