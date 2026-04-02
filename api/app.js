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

// 健康检查路由 - 立即响应，不依赖任何初始化
app.get('/health', (req, res) => {
  console.log('🏥 健康检查被调用');
  res.json({ 
    code: 200, 
    message: 'API 服务正常运行', 
    data: { 
      timestamp: new Date().toISOString(),
      status: 'healthy'
    } 
  });
});

// 简化的 API 响应 - 不依赖数据库
function createSimpleRouter() {
  const router = express.Router();
  
  // 通用成功响应
  function success(res, data = {}) {
    return res.json({ code: 200, message: 'success', data });
  }
  
  // 认证路由
  router.post('/auth/login', (req, res) => {
    console.log('🔐 登录请求');
    success(res, {
      token: 'mock-token',
      user: {
        id: 1,
        username: 'admin',
        real_name: '超级管理员',
        role: 'ADMIN',
        department_id: 1
      }
    });
  });
  
  // 用户路由
  router.get('/users', (req, res) => {
    console.log('👥 获取用户列表');
    success(res, [
      {
        id: 1,
        username: 'admin',
        real_name: '超级管理员',
        role: 'ADMIN',
        department_id: 1,
        phone: '',
        status: 1
      }
    ]);
  });
  
  // 部门路由
  router.get('/departments', (req, res) => {
    console.log('🏢 获取部门列表');
    success(res, [
      { id: 1, name: '办公室', code: 'office', sort_order: 0 },
      { id: 2, name: '教务处', code: 'academic', sort_order: 1 },
      { id: 3, name: '政教处', code: 'student', sort_order: 2 },
      { id: 4, name: '后勤部', code: 'logistics', sort_order: 3 },
      { id: 5, name: '生活中心', code: 'life', sort_order: 4 }
    ]);
  });
  
  // 配置路由
  router.get('/configs', (req, res) => {
    console.log('⚙️ 获取配置');
    success(res, [
      { config_key: 'school_name', config_value: '上海新纪元教育集团瑞安总校' },
      { config_key: 'school_sub_name', config_value: '初中部' },
      { config_key: 'current_semester', config_value: '2025-2026学年第二学期' }
    ]);
  });
  
  // AI 配置路由
  router.get('/ai/config', (req, res) => {
    console.log('🤖 获取AI配置');
    success(res, {
      provider: 'openai',
      api_url: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      temperature: 0.7,
      analysis_enabled: true,
      chat_enabled: true,
      suggestions_enabled: true
    });
  });
  
  // 仪表盘路由
  router.get('/dashboard/stats', (req, res) => {
    console.log('📊 获取仪表盘统计');
    success(res, {
      myPlansTotal: 0,
      myPlansTrend: 0,
      myPlansProgress: 0,
      publishedTotal: 0,
      publishedTrend: 0,
      publishedProgress: 0,
      pendingReview: 0,
      pendingReviewTrend: 0,
      pendingReviewProgress: 0,
      pendingFeedback: 0,
      pendingFeedbackTrend: 0,
      pendingFeedbackProgress: 0
    });
  });
  
  router.get('/dashboard/chart-data', (req, res) => {
    console.log('📈 获取图表数据');
    success(res, {
      planStatus: [],
      departmentPlans: { names: [], counts: [] },
      planTrend: { weeks: [], total: [], completed: [], inProgress: [] },
      departmentEfficiency: { names: [], completionRates: [], avgDays: [] }
    });
  });
  
  router.get('/dashboard/quick-actions-stats', (req, res) => {
    console.log('⚡ 获取快捷操作统计');
    success(res, {
      myPlans: 0,
      publishedPlans: 0,
      pendingFeedback: 0,
      pendingReview: 0
    });
  });
  
  router.get('/dashboard/ai-analysis', (req, res) => {
    console.log('🧠 获取AI分析');
    success(res, {
      insights: [],
      stageSummary: '系统初始化中，数据统计暂不可用',
      weeklyPlanTips: '请稍后再试',
      nextStagePlan: '系统正在准备中',
      roleSpecificSuggestions: [],
      historicalData: [],
      trendAnalysis: {},
      metrics: {}
    });
  });
  
  router.get('/dashboard/recent-activities', (req, res) => {
    console.log('📋 获取最近活动');
    success(res, []);
  });
  
  // 知识库路由
  router.get('/knowledge/bases', (req, res) => {
    console.log('📚 获取知识库');
    success(res, []);
  });
  
  return router;
}

// 使用简化路由
const simpleRouter = createSimpleRouter();
app.use('/', simpleRouter);

// 404 处理
app.use((req, res) => {
  console.log('❌ 404 - 路由未找到:', req.method, req.url);
  res.status(404).json({ code: 404, message: 'API 路由未找到', data: null });
});

// 导出 Vercel Serverless Function
const handler = serverless(app);

module.exports = async (req, res) => {
  console.log('🎯 Serverless function 被调用:', req.method, req.url);
  try {
    const result = await handler(req, res);
    console.log('✅ 请求处理完成');
    return result;
  } catch (error) {
    console.error('❌ Serverless function 错误:', error);
    res.status(500).json({ code: 500, message: error.message || '服务器内部错误', data: null });
  }
};
