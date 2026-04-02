/**
 * Vercel Serverless Function - 简化版 API 服务
 */
const express = require('express');
const cors = require('cors');

const app = express();

console.log('🚀 API 服务正在启动...');

// CORS 配置
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 通用成功响应
function success(res, data = {}) {
  return res.json({ code: 200, message: 'success', data });
}

// 健康检查路由
app.get('/api/health', (req, res) => {
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

// 认证路由
app.post('/api/auth/login', (req, res) => {
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
app.get('/api/users', (req, res) => {
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
    },
    {
      id: 2,
      username: 'test',
      real_name: '测试用户',
      role: 'USER',
      department_id: 2,
      phone: '13800138000',
      status: 1
    }
  ]);
});

// 部门路由
app.get('/api/departments', (req, res) => {
  console.log('🏢 获取部门列表');
  success(res, [
    { id: 1, name: '办公室', code: 'office', sort_order: 0 },
    { id: 2, name: '教务处', code: 'academic', sort_order: 1 },
    { id: 3, name: '政教处', code: 'student', sort_order: 2 },
    { id: 4, name: '后勤部', code: 'logistics', sort_order: 3 },
    { id: 5, name: '生活中心', code: 'life', sort_order: 4 },
    { id: 6, name: '七年级', code: 'grade7', sort_order: 5 },
    { id: 7, name: '八年级', code: 'grade8', sort_order: 6 },
    { id: 8, name: '九年级', code: 'grade9', sort_order: 7 }
  ]);
});

// 配置路由
app.get('/api/configs', (req, res) => {
  console.log('⚙️ 获取配置');
  success(res, [
    { config_key: 'school_name', config_value: '上海新纪元教育集团瑞安总校' },
    { config_key: 'school_sub_name', config_value: '初中部' },
    { config_key: 'current_semester', config_value: '2025-2026学年第二学期' },
    { config_key: 'current_week_start', config_value: '2026-02-25' },
    { config_key: 'week_first_day', config_value: '0' }
  ]);
});

// AI 配置路由
app.get('/api/ai/config', (req, res) => {
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
app.get('/api/dashboard/stats', (req, res) => {
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

app.get('/api/dashboard/chart-data', (req, res) => {
  console.log('📈 获取图表数据');
  success(res, {
    planStatus: [],
    departmentPlans: { names: [], counts: [] },
    planTrend: { weeks: [], total: [], completed: [], inProgress: [] },
    departmentEfficiency: { names: [], completionRates: [], avgDays: [] }
  });
});

app.get('/api/dashboard/quick-actions-stats', (req, res) => {
  console.log('⚡ 获取快捷操作统计');
  success(res, {
    myPlans: 0,
    publishedPlans: 0,
    pendingFeedback: 0,
    pendingReview: 0
  });
});

app.get('/api/dashboard/ai-analysis', (req, res) => {
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

app.get('/api/dashboard/recent-activities', (req, res) => {
  console.log('📋 获取最近活动');
  success(res, []);
});

// 知识库路由
app.get('/api/knowledge/bases', (req, res) => {
  console.log('📚 获取知识库');
  success(res, []);
});

// 404 处理
app.use((req, res) => {
  console.log('❌ 404 - 路由未找到:', req.method, req.url);
  res.status(404).json({ code: 404, message: 'API 路由未找到', data: null });
});

// 直接导出 Express 应用
module.exports = app;
