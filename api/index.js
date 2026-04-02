/**
 * 最简单的 Vercel Serverless Function
 */

// 通用成功响应
function success(res, data = {}) {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ code: 200, message: 'success', data }));
}

// 获取路径部分（忽略查询参数）
function getPath(url) {
  return url.split('?')[0];
}

module.exports = (req, res) => {
  const path = getPath(req.url);
  console.log('🎯 请求到达:', req.method, req.url, '-> 路径:', path);
  
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  // 健康检查
  if (path === '/api/health' && req.method === 'GET') {
    console.log('🏥 健康检查响应');
    success(res, {
      timestamp: new Date().toISOString(),
      status: 'healthy'
    });
    return;
  }
  
  // 登录
  if (path === '/api/auth/login' && req.method === 'POST') {
    console.log('🔐 登录响应');
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
    return;
  }
  
  // 用户列表
  if (path === '/api/users' && req.method === 'GET') {
    console.log('👥 用户列表响应');
    success(res, [
      { id: 1, username: 'admin', real_name: '超级管理员', role: 'ADMIN', department_id: 1, phone: '', status: 1 },
      { id: 2, username: 'test', real_name: '测试用户', role: 'USER', department_id: 2, phone: '13800138000', status: 1 },
      { id: 3, username: 'teacher1', real_name: '张老师', role: 'USER', department_id: 2, phone: '13900139000', status: 1 },
      { id: 4, username: 'teacher2', real_name: '李老师', role: 'USER', department_id: 3, phone: '13700137000', status: 1 }
    ]);
    return;
  }
  
  // 部门列表
  if (path === '/api/departments' && req.method === 'GET') {
    console.log('🏢 部门列表响应');
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
    return;
  }
  
  // 配置
  if (path === '/api/configs' && req.method === 'GET') {
    console.log('⚙️ 配置响应');
    success(res, [
      { config_key: 'school_name', config_value: '上海新纪元教育集团瑞安总校' },
      { config_key: 'school_sub_name', config_value: '初中部' },
      { config_key: 'current_semester', config_value: '2025-2026学年第二学期' },
      { config_key: 'current_week_start', config_value: '2026-02-25' },
      { config_key: 'week_first_day', config_value: '0' }
    ]);
    return;
  }
  
  // AI 配置
  if (path === '/api/ai/config' && req.method === 'GET') {
    console.log('🤖 AI配置响应');
    success(res, {
      provider: 'openai',
      api_url: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      temperature: 0.7,
      analysis_enabled: true,
      chat_enabled: true,
      suggestions_enabled: true
    });
    return;
  }
  
  // 仪表盘统计
  if (path === '/api/dashboard/stats' && req.method === 'GET') {
    console.log('📊 仪表盘统计响应');
    success(res, {
      myPlansTotal: 0, myPlansTrend: 0, myPlansProgress: 0,
      publishedTotal: 0, publishedTrend: 0, publishedProgress: 0,
      pendingReview: 0, pendingReviewTrend: 0, pendingReviewProgress: 0,
      pendingFeedback: 0, pendingFeedbackTrend: 0, pendingFeedbackProgress: 0
    });
    return;
  }
  
  // 图表数据
  if (path === '/api/dashboard/chart-data' && req.method === 'GET') {
    console.log('📈 图表数据响应');
    success(res, {
      planStatus: [],
      departmentPlans: { names: [], counts: [] },
      planTrend: { weeks: [], total: [], completed: [], inProgress: [] },
      departmentEfficiency: { names: [], completionRates: [], avgDays: [] }
    });
    return;
  }
  
  // 快捷操作统计
  if (path === '/api/dashboard/quick-actions-stats' && req.method === 'GET') {
    console.log('⚡ 快捷操作统计响应');
    success(res, { myPlans: 0, publishedPlans: 0, pendingFeedback: 0, pendingReview: 0 });
    return;
  }
  
  // AI分析
  if (path === '/api/dashboard/ai-analysis' && req.method === 'GET') {
    console.log('🧠 AI分析响应');
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
    return;
  }
  
  // 最近活动
  if (path === '/api/dashboard/recent-activities' && req.method === 'GET') {
    console.log('📋 最近活动响应');
    success(res, []);
    return;
  }
  
  // 知识库
  if (path === '/api/knowledge/bases' && req.method === 'GET') {
    console.log('📚 知识库响应');
    success(res, []);
    return;
  }
  
  // 404
  console.log('❌ 404:', req.method, req.url);
  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ code: 404, message: 'API 路由未找到', data: null }));
};
