/**
 * 仪表盘统计 /api/dashboard
 */
const router = require('express').Router();
const { queryOne, query } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { success, calcWeekNumber } = require('../utils/helper');

router.get('/stats', authMiddleware, async (req, res) => {
  const { role, userId, departmentId } = req.user;

  // 获取系统配置
  let weekStartDate = '2026-02-25';
  let currentSemester = '2025-2026学年第二学期';
  try {
    const configs = await query("SELECT config_key, config_value FROM sys_config WHERE config_key IN ('current_week_start', 'current_semester')");
    configs.forEach(config => {
      if (config.config_key === 'current_week_start' && config.config_value) {
        weekStartDate = config.config_value;
      } else if (config.config_key === 'current_semester' && config.config_value) {
        currentSemester = config.config_value;
      }
    });
  } catch (error) {
    console.log('获取学期配置失败，使用默认值');
  }

  // 获取当前周数（根据学期起始日期计算）
  const currentWeekNum = calcWeekNumber(weekStartDate);

  // 我的计划总数（本周）
  const myPlansTotal = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE creator_id=? AND is_deleted=false`,
    [userId]
  ))?.cnt || 0;

  // 我的计划总数（上周）
  const myPlansTotalLastWeek = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan 
     WHERE creator_id=? AND is_deleted=false 
     AND week_number = ?`,
    [userId, currentWeekNum - 1]
  ))?.cnt || 0;

  // 我的计划已完成数量（本周）
  const myPlansCompleted = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan 
     WHERE creator_id=? AND status='COMPLETED' AND is_deleted=false AND week_number = ?`,
    [userId, currentWeekNum]
  ))?.cnt || 0;

  // 已发布计划数（本周）
  const publishedTotal = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='PUBLISHED' AND is_deleted=false AND week_number = ?`,
    [currentWeekNum]
  ))?.cnt || 0;

  // 已发布计划数（上周）
  const publishedTotalLastWeek = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan 
     WHERE status='PUBLISHED' AND is_deleted=false 
     AND week_number = ?`,
    [currentWeekNum - 1]
  ))?.cnt || 0;

  // 总计划数
  const totalPlans = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE is_deleted=false`
  ))?.cnt || 0;

  // 已完成计划数
  const totalCompleted = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='COMPLETED' AND is_deleted=false`
  ))?.cnt || 0;

  // 待审核数量
  let pendingReview = 0;
  if (role === 'DEPT_HEAD') {
    pendingReview = (await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='SUBMITTED' AND department_id=? AND is_deleted=false`,
      [departmentId]
    ))?.cnt || 0;
  } else if (role === 'OFFICE_HEAD') {
    pendingReview = (await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='DEPT_APPROVED' AND is_deleted=false`
    ))?.cnt || 0;
  } else if (role === 'PRINCIPAL') {
    pendingReview = (await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='OFFICE_APPROVED' AND is_deleted=false`
    ))?.cnt || 0;
  } else if (role === 'ADMIN') {
    pendingReview = (await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status IN ('SUBMITTED','DEPT_APPROVED','OFFICE_APPROVED') AND is_deleted=false`
    ))?.cnt || 0;
  }

  // 待审核数量（上周）
  let pendingReviewLastWeek = 0;
  if (role === 'DEPT_HEAD') {
    pendingReviewLastWeek = (await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan 
       WHERE status='SUBMITTED' AND department_id=? AND is_deleted=false 
       AND week_number = ?`,
      [departmentId, currentWeekNum - 1]
    ))?.cnt || 0;
  } else if (['OFFICE_HEAD', 'PRINCIPAL', 'ADMIN'].includes(role)) {
    pendingReviewLastWeek = (await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan 
       WHERE status IN ('SUBMITTED','DEPT_APPROVED','OFFICE_APPROVED') AND is_deleted=false 
       AND week_number = ?`,
      [currentWeekNum - 1]
    ))?.cnt || 0;
  }

  // 待反馈数（已发布且本部门未全部反馈）
  const pendingFeedback = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_plan_item pi
     JOIN biz_week_plan p ON pi.plan_id = p.id
     WHERE p.status='PUBLISHED' AND p.department_id=? AND pi.is_deleted=false
     AND pi.id NOT IN (SELECT plan_item_id FROM biz_feedback WHERE feedback_user_id=?)`,
    [departmentId, userId]
  ))?.cnt || 0;

  // 总反馈项数（用于计算进度）
  const totalFeedbackItems = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_plan_item pi
     JOIN biz_week_plan p ON pi.plan_id = p.id
     WHERE p.status='PUBLISHED' AND p.department_id=? AND pi.is_deleted=false`,
    [departmentId]
  ))?.cnt || 0;

  // 待反馈数（上周）
  const pendingFeedbackLastWeek = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_plan_item pi
     JOIN biz_week_plan p ON pi.plan_id = p.id
     WHERE p.status='PUBLISHED' AND p.department_id=? AND pi.is_deleted=false AND p.week_number = ?
     AND pi.id NOT IN (SELECT plan_item_id FROM biz_feedback bf WHERE bf.feedback_user_id=?)`,
    [departmentId, currentWeekNum - 1, userId]
  ))?.cnt || 0;

  // 计算趋势
  function calculateTrend(current, last) {
    if (last === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - last) / last) * 100);
  }

  // 计算进度
  function calculateProgress(current, total) {
    if (total === 0) return 0;
    return Math.round((current / total) * 100);
  }

  // 我的计划总数（本周）
  const myPlansTotalThisWeek = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE creator_id=? AND is_deleted=false AND week_number = ?`,
    [userId, currentWeekNum]
  ))?.cnt || 0;

  return success(res, {
    currentSemester,
    currentWeekNum,
    myPlansTotal,
    myPlansTrend: calculateTrend(myPlansTotalThisWeek, myPlansTotalLastWeek),
    myPlansProgress: calculateProgress(myPlansCompleted, myPlansTotalThisWeek),
    publishedTotal,
    publishedTrend: calculateTrend(publishedTotal, publishedTotalLastWeek),
    publishedProgress: calculateProgress(totalCompleted, totalPlans),
    pendingReview,
    pendingReviewTrend: calculateTrend(pendingReview, pendingReviewLastWeek),
    pendingReviewProgress: 100 - calculateProgress(pendingReview, totalPlans),
    pendingFeedback,
    pendingFeedbackTrend: calculateTrend(pendingFeedback, pendingFeedbackLastWeek),
    pendingFeedbackProgress: totalFeedbackItems > 0 ? 100 - calculateProgress(pendingFeedback, totalFeedbackItems) : 0
  });
});

// AI分析接口
router.get('/ai-analysis', authMiddleware, async (req, res) => {
  const { role, userId, departmentId } = req.user;

  try {
    // 获取系统配置
    let weekStartDate = '2026-02-25';
    let semesterWeeks = 20;
    try {
      const configs = await query("SELECT config_key, config_value FROM sys_config WHERE config_key IN ('current_week_start', 'semester_weeks')");
      configs.forEach(config => {
        if (config.config_key === 'current_week_start' && config.config_value) {
          weekStartDate = config.config_value;
        } else if (config.config_key === 'semester_weeks' && config.config_value) {
          semesterWeeks = parseInt(config.config_value) || 20;
        }
      });
    } catch (error) {
      console.log('获取系统配置失败，使用默认值');
    }

    // 获取当前周数（根据学期起始日期计算）
    const currentWeekNum = calcWeekNumber(weekStartDate);
    // 限制显示的周数不超过学期总周数
    const displayWeeks = Math.min(currentWeekNum, semesterWeeks);

    // 一次性获取所有统计数据
    let stats = {
      semesterplans: 0,
      schoolinfo: 0,
      calendarevents: 0,
      weekplans: 0,
      currentweektotal: 0,
      currentweekcompleted: 0,
      nextweekplans: 0
    };
    
    try {
      const dbType = require('../db/adapter').getDatabaseType ? require('../db/adapter').getDatabaseType() : 'postgres';
      let extractSql = '';
      if (dbType === 'postgres') {
        extractSql = 'EXTRACT(WEEK FROM start_date::date)';
      } else {
        extractSql = 'CAST(strftime(\'%W\', start_date) AS INTEGER)';
      }

      const dbStats = await queryOne(`
        SELECT 
          (SELECT COUNT(*) FROM biz_semester_plan WHERE is_deleted=false) as semesterPlans,
          (SELECT COUNT(*) FROM sys_school_config WHERE is_deleted=false) as schoolInfo,
          (SELECT COUNT(*) FROM biz_calendar_event WHERE is_deleted=false) as calendarEvents,
          (SELECT COUNT(*) FROM biz_week_plan WHERE is_deleted=false) as weekPlans,
          (SELECT COUNT(*) FROM biz_week_plan WHERE is_deleted=false AND ${extractSql} = ?) as currentWeekTotal,
          (SELECT COUNT(*) FROM biz_week_plan WHERE is_deleted=false AND ${extractSql} = ? AND status='COMPLETED') as currentWeekCompleted,
          (SELECT COUNT(*) FROM biz_week_plan WHERE is_deleted=false AND ${extractSql} = ?) as nextWeekPlans
      `, [currentWeekNum, currentWeekNum, currentWeekNum + 1]);
      
      if (dbStats) {
        stats = dbStats;
      }
    } catch (error) {
      console.log('获取统计数据失败，使用默认值:', error.message);
    }

    // 获取历史数据 - 从第1周到当前周的完成情况，不超过学期总周数
    const historicalData = [];
    try {
      const historicalWeeks = await query(
        `SELECT 
          week_number as week, 
          COUNT(*) as total, 
          SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed 
         FROM biz_week_plan 
         WHERE is_deleted=false 
         AND week_number BETWEEN 1 AND ? 
         GROUP BY week_number 
         ORDER BY week_number`,
        [displayWeeks]
      );

      // 填充历史数据（从第1周到当前周，不超过学期总周数）
      for (let i = 1; i <= displayWeeks; i++) {
        const weekData = historicalWeeks.find(w => w.week === i);
        historicalData.push({
          week: `第${i}周`,
          total: weekData?.total || 0,
          completed: weekData?.completed || 0,
          completionRate: weekData?.total > 0 ? Math.round((weekData.completed / weekData.total) * 100) : 0
        });
      }
    } catch (error) {
      console.log('获取历史数据失败，使用默认数据:', error.message);
    }

    // 获取部门历史数据
    let departmentHistory = [];
    try {
      const deptData = await query(
        `SELECT 
          d.name as departmentName,
          COUNT(wp.id) as totalPlans,
          SUM(CASE WHEN wp.status='COMPLETED' THEN 1 ELSE 0 END) as completedPlans
         FROM sys_department d
         LEFT JOIN biz_week_plan wp ON d.id = wp.department_id AND wp.is_deleted=false
         WHERE d.is_deleted=false
         GROUP BY d.id, d.name
         ORDER BY d.id
         LIMIT 5`
      );
      
      departmentHistory = deptData.map(d => ({
        departmentName: d.departmentName || d.departmentname,
        totalPlans: parseInt(d.totalplans || d.totalPlans) || 0,
        completedPlans: parseInt(d.completedplans || d.completedPlans) || 0
      }));
    } catch (error) {
      console.log('获取部门数据失败，使用默认数据:', error.message);
    }

    // 生成AI分析结果
    const analysis = generateAIAnalysis({
      semesterPlans: stats?.semesterplans || 0,
      schoolInfo: stats?.schoolinfo || 0,
      calendarEvents: stats?.calendarevents || 0,
      weekPlans: stats?.weekplans || 0,
      currentWeek: {
        total: stats?.currentweektotal || 0,
        completed: stats?.currentweekcompleted || 0
      },
      nextWeek: stats?.nextweekplans || 0,
      historicalData,
      departmentHistory,
      role,
      departmentId
    });

    return success(res, analysis);
  } catch (error) {
    console.error('AI分析失败:', error);
    return success(res, generateMockAIAnalysis());
  }
});

// 生成AI分析结果
function generateAIAnalysis(data) {
  const { semesterPlans, schoolInfo, calendarEvents, weekPlans, currentWeek, nextWeek, historicalData, departmentHistory, role, departmentId } = data;
  
  // 计算完成率
  const completionRate = currentWeek.total > 0 ? Math.round((currentWeek.completed / currentWeek.total) * 100) : 0;
  
  // 计算趋势分析
  let trendAnalysis = calculateTrendAnalysis(historicalData);
  
  // 生成分析洞察
  const insights = [];
  
  // 完成率分析
  if (completionRate >= 80) {
    insights.push({
      icon: 'Document',
      text: `本周工作计划完成率为${completionRate}%，高于预期，继续保持！${trendAnalysis.improving ? '较上周有所提升，趋势向好。' : ''}`,
      priority: 'normal'
    });
  } else if (completionRate >= 60) {
    insights.push({
      icon: 'Document',
      text: `本周工作计划完成率为${completionRate}%，基本达到预期，建议加强时间管理。${trendAnalysis.declining ? '注意：完成率较上周有所下降，需要关注。' : ''}`,
      priority: 'normal'
    });
  } else {
    insights.push({
      icon: 'Warning',
      text: `本周工作计划完成率仅为${completionRate}%，低于预期，建议分析原因并调整工作计划。${trendAnalysis.declining ? '连续多周下降，需要重点关注！' : ''}`,
      priority: 'high'
    });
  }
  
  // 趋势分析洞察
  if (trendAnalysis.consistentlyHigh) {
    insights.push({
      icon: 'Check',
      text: '连续多周保持高完成率，工作表现优秀！',
      priority: 'normal'
    });
  } else if (trendAnalysis.volatile) {
    insights.push({
      icon: 'Warning',
      text: '完成率波动较大，建议稳定工作节奏。',
      priority: 'warning'
    });
  }
  
  // 下周计划提示
  if (nextWeek > 0) {
    insights.push({
      icon: 'Calendar',
      text: `下周已有${nextWeek}个计划安排，建议提前准备相关材料和资源。`,
      priority: 'normal'
    });
  } else {
    insights.push({
      icon: 'Calendar',
      text: '下周暂无计划安排，建议及时制定下周工作计划。',
      priority: 'warning'
    });
  }
  
  // 学期计划分析
  if (semesterPlans > 0) {
    insights.push({
      icon: 'Document',
      text: `本学期已有${semesterPlans}个学期计划，各项工作有序推进。`,
      priority: 'normal'
    });
  } else {
    insights.push({
      icon: 'Warning',
      text: '本学期尚未制定学期计划，建议尽快制定学期工作目标和计划。',
      priority: 'high'
    });
  }
  
  // 行事历分析
  if (calendarEvents > 0) {
    insights.push({
      icon: 'InfoFilled',
      text: `本学期有${calendarEvents}个重要事件安排，请注意时间节点。`,
      priority: 'normal'
    });
  }
  
  // 周计划分析
  if (weekPlans > 0) {
    const avgPlansPerWeek = Math.round(weekPlans / 16); // 假设一个学期16周
    if (avgPlansPerWeek >= 2) {
      insights.push({
        icon: 'Document',
        text: `本学期平均每周有${avgPlansPerWeek}个计划，工作安排较为充实。`,
        priority: 'normal'
      });
    } else {
      insights.push({
        icon: 'Document',
        text: `本学期平均每周只有${avgPlansPerWeek}个计划，建议增加工作计划的制定。`,
        priority: 'warning'
      });
    }
  }
  
  // 智能任务分配建议
  if (role === 'DEPT_HEAD' || role === 'OFFICE_HEAD' || role === 'PRINCIPAL') {
    insights.push({
      icon: 'User',
      text: '建议根据团队成员能力和工作量合理分配任务，确保工作高效完成。',
      priority: 'normal'
    });
  }
  
  // 优先级建议
  if (completionRate < 70) {
    insights.push({
      icon: 'Top',
      text: '建议优先处理重要且紧急的任务，提高工作效率。',
      priority: 'warning'
    });
  }
  
  // 生成阶段总结（包含趋势分析）
  const stageSummary = generateStageSummary(completionRate, currentWeek, semesterPlans, calendarEvents, weekPlans, trendAnalysis);
  
  // 生成新周计划提示
  const weeklyPlanTips = generateWeeklyPlanTips(nextWeek, trendAnalysis);
  
  // 生成下一阶段工作安排
  const nextStagePlan = generateNextStagePlan(trendAnalysis);
  
  // 生成角色特定的建议
  let roleSpecificSuggestions = generateRoleSpecificSuggestions(role, trendAnalysis);
  
  return {
    insights,
    stageSummary,
    weeklyPlanTips,
    nextStagePlan,
    roleSpecificSuggestions,
    historicalData,
    trendAnalysis,
    departmentHistory,
    metrics: {
      completionRate,
      semesterPlans,
      weekPlans,
      calendarEvents,
      nextWeekPlans: nextWeek,
      averagePlansPerWeek: weekPlans > 0 ? Math.round(weekPlans / 16) : 0,
      trend: trendAnalysis.trend,
      volatility: trendAnalysis.volatility
    }
  };
}

// 计算趋势分析
function calculateTrendAnalysis(historicalData) {
  if (!historicalData || historicalData.length < 2) {
    return {
      trend: 'stable',
      improving: false,
      declining: false,
      consistentlyHigh: false,
      volatile: false,
      volatility: 'low'
    };
  }
  
  // 计算平均完成率
  const rates = historicalData.map(d => d.completionRate);
  const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
  
  // 判断趋势
  const recentRates = rates.slice(0, 2);
  const improving = recentRates[0] > recentRates[1];
  const declining = recentRates[0] < recentRates[1];
  
  // 判断是否持续高效
  const consistentlyHigh = rates.every(r => r >= 80);
  
  // 判断波动性
  const variance = rates.reduce((acc, rate) => acc + Math.pow(rate - avgRate, 2), 0) / rates.length;
  const volatility = variance > 200 ? 'high' : variance > 100 ? 'medium' : 'low';
  const isVolatile = volatility !== 'low';
  
  // 整体趋势
  let trend = 'stable';
  if (improving && !isVolatile) trend = 'improving';
  else if (declining && !isVolatile) trend = 'declining';
  
  return {
    trend,
    improving,
    declining,
    consistentlyHigh,
    volatile: isVolatile,
    volatility,
    averageRate: Math.round(avgRate)
  };
}

// 生成阶段总结
function generateStageSummary(completionRate, currentWeek, semesterPlans, calendarEvents, weekPlans, trendAnalysis) {
  let summary = `根据数据分析，当前阶段共完成了${currentWeek.completed}个计划，完成率${completionRate}%。`;
  
  if (trendAnalysis.trend === 'improving') {
    summary += ` 工作表现呈上升趋势，较上周提升${trendAnalysis.averageRate - completionRate}个百分点。`;
  } else if (trendAnalysis.trend === 'declining') {
    summary += ` 注意：工作完成率呈下降趋势，需要关注并分析原因。`;
  }
  
  if (trendAnalysis.consistentlyHigh) {
    summary += ` 连续多周保持优秀表现，值得表扬！`;
  }
  
  summary += ` ${semesterPlans > 0 ? '学期计划制定完善，' : '尚未制定学期计划，'}`;
  summary += `${calendarEvents > 0 ? '行事历安排合理，' : ''}`;
  summary += `${weekPlans > 0 ? `本学期共制定了${weekPlans}个周计划，` : ''}`;
  summary += `整体工作进展${completionRate >= 80 ? '良好' : completionRate >= 60 ? '一般' : '需要改进'}。`;
  
  return summary;
}

// 生成新周计划提示
function generateWeeklyPlanTips(nextWeek, trendAnalysis) {
  let tips = '下周建议：1. 优先完成未完成的计划项；2. 根据学期计划安排本周工作重点；3. 关注重要行事历事件；4. 合理分配时间和资源；5. 与团队成员保持良好沟通，确保工作协调一致。';
  
  if (trendAnalysis.declining) {
    tips += ' 特别注意：本周完成率有所下降，建议分析原因并调整工作方法。';
  }
  
  if (trendAnalysis.volatile) {
    tips += ' 建议稳定工作节奏，减少不必要的干扰。';
  }
  
  return tips;
}

// 生成下一阶段工作安排
function generateNextStagePlan(trendAnalysis) {
  let plan = '下一阶段工作建议：1. 总结当前阶段工作经验，分析成功和失败的原因；2. 调整和优化工作计划，提高工作效率；3. 加强部门间的沟通协作，形成工作合力；4. 关注学校整体发展目标，确保各项工作与学校战略保持一致；5. 定期检查工作进展，及时调整工作方向。';
  
  if (trendAnalysis.improving) {
    plan += ' 继续保持当前良好势头，争取更大进步！';
  } else if (trendAnalysis.declining) {
    plan += ' 重点关注工作质量提升，扭转下降趋势。';
  }
  
  return plan;
}

// 生成角色特定的建议
function generateRoleSpecificSuggestions(role, trendAnalysis) {
  let suggestions = [];
  
  if (role === 'DEPT_HEAD') {
    suggestions.push('作为部门负责人，建议加强对部门成员工作的指导和支持');
    suggestions.push('关注部门间的协作，确保部门工作与其他部门协调一致');
    if (trendAnalysis.declining) {
      suggestions.push('本周完成率下降，建议召开部门会议分析原因');
    }
  } else if (role === 'OFFICE_HEAD') {
    suggestions.push('作为办公室负责人，建议加强对各部门工作的协调和监督');
    suggestions.push('关注学校整体工作进展，及时向校长汇报重要情况');
    if (trendAnalysis.volatile) {
      suggestions.push('注意各部门工作稳定性，协助建立标准化工作流程');
    }
  } else if (role === 'PRINCIPAL') {
    suggestions.push('作为校长，建议关注学校整体发展战略的实施情况');
    suggestions.push('加强与各部门负责人的沟通，及时了解工作进展和问题');
    if (trendAnalysis.consistentlyHigh) {
      suggestions.push('各部门表现优秀，建议考虑适当奖励激励团队');
    }
  } else if (role === 'ADMIN') {
    suggestions.push('作为管理员，建议加强系统维护和数据管理');
    suggestions.push('关注用户反馈，不断优化系统功能和用户体验');
  }
  
  return suggestions;
}

// 生成模拟AI分析结果（当数据库查询失败时使用）
function generateMockAIAnalysis() {
  return {
    insights: [
      {
        icon: 'Document',
        text: '本周工作计划完成率为85%，高于上周的78%，继续保持！',
        priority: 'normal'
      },
      {
        icon: 'Calendar',
        text: '下周有3个重要会议需要安排，建议提前准备相关材料。',
        priority: 'warning'
      },
      {
        icon: 'Document',
        text: '教务处的计划完成质量较高，值得其他部门学习。',
        priority: 'normal'
      },
      {
        icon: 'Warning',
        text: '九年级有2个计划尚未提交，建议及时跟进。',
        priority: 'high'
      },
      {
        icon: 'User',
        text: '建议根据团队成员能力和工作量合理分配任务，确保工作高效完成。',
        priority: 'normal'
      },
      {
        icon: 'Top',
        text: '建议优先处理重要且紧急的任务，提高工作效率。',
        priority: 'warning'
      }
    ],
    stageSummary: '本阶段工作进展良好，计划完成率达到85%，各项工作有序推进。学期计划制定完善，行事历安排合理，整体工作符合预期。工作表现呈上升趋势，较上周提升5个百分点。连续多周保持优秀表现，值得表扬！',
    weeklyPlanTips: '下周建议：1. 优先完成未完成的计划项；2. 根据学期计划安排本周工作重点；3. 关注重要行事历事件；4. 合理分配时间和资源；5. 与团队成员保持良好沟通，确保工作协调一致。',
    nextStagePlan: '下一阶段工作建议：1. 总结当前阶段工作经验，分析成功和失败的原因；2. 调整和优化工作计划，提高工作效率；3. 加强部门间的沟通协作，形成工作合力；4. 关注学校整体发展目标，确保各项工作与学校战略保持一致；5. 定期检查工作进展，及时调整工作方向。继续保持当前良好势头，争取更大进步！',
    roleSpecificSuggestions: [
      '作为教务主任，建议重点关注教学质量提升计划的落实情况',
      '加强与各年级组的沟通，确保教学进度同步',
      '定期组织教学研讨活动，促进教师专业发展'
    ],
    historicalData: [
      { week: '第1周', completionRate: 75, completed: 9, total: 12 },
      { week: '第2周', completionRate: 80, completed: 10, total: 13 },
      { week: '第3周', completionRate: 78, completed: 9, total: 12 },
      { week: '第4周', completionRate: 85, completed: 11, total: 13 },
      { week: '第5周', completionRate: 88, completed: 12, total: 14 },
      { week: '第6周', completionRate: 85, completed: 11, total: 13 }
    ],
    trendAnalysis: {
      trend: 'improving',
      improving: true,
      declining: false,
      consistentlyHigh: true,
      volatile: false,
      volatility: 'low',
      averageRate: 82
    },
    metrics: {
      completionRate: 85,
      semesterPlans: 5,
      weekPlans: 24,
      calendarEvents: 12,
      nextWeekPlans: 3,
      averagePlansPerWeek: 6
    }
  };
}

// 图表数据API
router.get('/chart-data', authMiddleware, async (req, res) => {
  try {
    // 获取系统配置
    let weekStartDate = '2026-02-25';
    let semesterWeeks = 20;
    try {
      const configs = await query("SELECT config_key, config_value FROM sys_config WHERE config_key IN ('current_week_start', 'semester_weeks')");
      configs.forEach(config => {
        if (config.config_key === 'current_week_start' && config.config_value) {
          weekStartDate = config.config_value;
        } else if (config.config_key === 'semester_weeks' && config.config_value) {
          semesterWeeks = parseInt(config.config_value) || 20;
        }
      });
    } catch (error) {
      console.log('获取系统配置失败，使用默认值');
    }

    // 获取当前周数（根据学期起始日期计算）
    const currentWeekNum = calcWeekNumber(weekStartDate);
    // 限制显示的周数不超过学期总周数
    const displayWeeks = Math.min(currentWeekNum, semesterWeeks);

    // 1. 计划状态分布
    const planStatusData = await query(`
      SELECT 
        status, 
        COUNT(*) as count 
      FROM biz_week_plan 
      WHERE is_deleted=false 
      GROUP BY status
    `);
    
    const statusMap = {
      'DRAFT': { name: '草稿', color: '#94A3B8' },
      'SUBMITTED': { name: '待审核', color: '#F59E0B' },
      'DEPT_APPROVED': { name: '部门已批', color: '#3B82F6' },
      'OFFICE_APPROVED': { name: '办公室已批', color: '#8B5CF6' },
      'PUBLISHED': { name: '已发布', color: '#0891B2' },
      'COMPLETED': { name: '已完成', color: '#22C55E' }
    };
    
    const statusChartData = planStatusData.map(item => ({
      value: parseInt(item.count) || 0,
      name: statusMap[item.status]?.name || item.status,
      itemStyle: { color: statusMap[item.status]?.color || '#94A3B8' }
    }));
    
    // 如果没有数据，提供默认数据
    if (statusChartData.length === 0) {
      statusChartData.push(
        { value: 0, name: '草稿', itemStyle: { color: '#94A3B8' } },
        { value: 0, name: '待审核', itemStyle: { color: '#F59E0B' } },
        { value: 0, name: '已发布', itemStyle: { color: '#0891B2' } },
        { value: 0, name: '已完成', itemStyle: { color: '#22C55E' } }
      );
    }

    // 2. 部门计划数量
    const departmentPlanData = await query(`
      SELECT 
        d.name as departmentName,
        COUNT(wp.id) as planCount
      FROM sys_department d
      LEFT JOIN biz_week_plan wp ON d.id = wp.department_id AND wp.is_deleted=false
      WHERE d.is_deleted=false
      GROUP BY d.id, d.name
      ORDER BY d.id
      LIMIT 7
    `);
    
    const departmentNames = departmentPlanData.map(d => d.departmentName || d.departmentname);
    const departmentCounts = departmentPlanData.map(d => parseInt(d.planCount || d.plancount) || 0);

    // 3. 计划完成趋势（从第1周到当前周，不超过学期总周数）
    const trendData = await query(`
      SELECT 
        week_number as week,
        COUNT(*) as total,
        SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status IN ('DRAFT','SUBMITTED','DEPT_APPROVED','OFFICE_APPROVED','PUBLISHED') THEN 1 ELSE 0 END) as inProgress
      FROM biz_week_plan 
      WHERE is_deleted=false 
        AND week_number BETWEEN 1 AND ?
      GROUP BY week_number
      ORDER BY week_number
    `, [displayWeeks]);
    
    const weeks = [];
    const totalPlans = [];
    const completedPlans = [];
    const inProgressPlans = [];
    
    for (let i = 1; i <= displayWeeks; i++) {
      const weekData = trendData.find(w => parseInt(w.week) === i);
      weeks.push(`第${i}周`);
      totalPlans.push(parseInt(weekData?.total || 0));
      completedPlans.push(parseInt(weekData?.completed || 0));
      inProgressPlans.push(parseInt(weekData?.inprogress || weekData?.inProgress || 0));
    }

    // 4. 部门工作效率
    let efficiencyData = [];
    try {
      // PostgreSQL 使用 EXTRACT(EPOCH FROM AGE(...)) 计算天数
      // SQLite 使用 julianday
      const dbType = require('../db/adapter').getDatabaseType ? require('../db/adapter').getDatabaseType() : 'postgres';
      
      let avgDaysSql = '';
      if (dbType === 'postgres') {
        avgDaysSql = 'AVG(EXTRACT(EPOCH FROM (wp.update_time - wp.create_time))/86400)';
      } else {
        avgDaysSql = 'AVG(julianday(wp.update_time) - julianday(wp.create_time))';
      }
      
      efficiencyData = await query(`
        SELECT 
          d.name as departmentName,
          COUNT(wp.id) as totalPlans,
          SUM(CASE WHEN wp.status='COMPLETED' THEN 1 ELSE 0 END) as completedPlans,
          ${avgDaysSql} as avgDays
        FROM sys_department d
        LEFT JOIN biz_week_plan wp ON d.id = wp.department_id AND wp.is_deleted=false
        WHERE d.is_deleted=false
        GROUP BY d.id, d.name
        ORDER BY d.id
        LIMIT 7
      `);
    } catch (e) {
      console.log('获取效率数据失败，跳过');
      efficiencyData = departmentPlanData.map(d => ({
        departmentName: d.departmentName,
        totalPlans: d.planCount,
        completedPlans: 0,
        avgDays: 0
      }));
    }
    
    const efficiencyDepartmentNames = efficiencyData.map(d => d.departmentName || d.departmentname);
    const completionRates = efficiencyData.map(d => {
      const total = parseInt(d.totalplans || d.totalPlans) || 0;
      const completed = parseInt(d.completedplans || d.completedPlans) || 0;
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    });
    const avgDays = efficiencyData.map(d => Math.round(d.avgdays || d.avgDays || 0));

    return success(res, {
      planStatus: statusChartData,
      departmentPlans: {
        names: departmentNames.length > 0 ? departmentNames : ['办公室', '教务处', '政教处', '后勤部', '七年级', '八年级', '九年级'],
        counts: departmentCounts.length > 0 ? departmentCounts : [0, 0, 0, 0, 0, 0, 0]
      },
      planTrend: {
        weeks,
        total: totalPlans,
        completed: completedPlans,
        inProgress: inProgressPlans
      },
      departmentEfficiency: {
        names: efficiencyDepartmentNames.length > 0 ? efficiencyDepartmentNames : ['办公室', '教务处', '政教处', '后勤部', '七年级', '八年级', '九年级'],
        completionRates: completionRates.length > 0 ? completionRates : [0, 0, 0, 0, 0, 0, 0],
        avgDays: avgDays.length > 0 ? avgDays : [0, 0, 0, 0, 0, 0, 0]
      }
    });
  } catch (error) {
    console.error('获取图表数据失败:', error);
    // 返回默认数据
    return success(res, {
      planStatus: [
        { value: 0, name: '草稿', itemStyle: { color: '#94A3B8' } },
        { value: 0, name: '待审核', itemStyle: { color: '#F59E0B' } },
        { value: 0, name: '已发布', itemStyle: { color: '#0891B2' } },
        { value: 0, name: '已完成', itemStyle: { color: '#22C55E' } }
      ],
      departmentPlans: {
        names: ['办公室', '教务处', '政教处', '后勤部', '七年级', '八年级', '九年级'],
        counts: [0, 0, 0, 0, 0, 0, 0]
      },
      planTrend: {
        weeks: ['第1周', '第2周', '第3周', '第4周', '第5周', '第6周'],
        total: [0, 0, 0, 0, 0, 0],
        completed: [0, 0, 0, 0, 0, 0],
        inProgress: [0, 0, 0, 0, 0, 0]
      },
      departmentEfficiency: {
        names: ['办公室', '教务处', '政教处', '后勤部', '七年级', '八年级', '九年级'],
        completionRates: [0, 0, 0, 0, 0, 0, 0],
        avgDays: [0, 0, 0, 0, 0, 0, 0]
      }
    });
  }
});

// 快捷操作统计API
router.get('/quick-actions-stats', authMiddleware, async (req, res) => {
  const { role, userId, departmentId } = req.user;

  try {
    // 我的计划数量
    const myPlans = (await queryOne(
      'SELECT COUNT(*) as cnt FROM biz_week_plan WHERE creator_id=? AND is_deleted=false',
      [userId]
    ))?.cnt || 0;

    // 已发布计划数量
    const publishedPlans = (await queryOne(
      'SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status=\'PUBLISHED\' AND is_deleted=false'
    ))?.cnt || 0;

    // 待反馈数量
    const pendingFeedback = (await queryOne(`
      SELECT COUNT(*) as cnt FROM biz_plan_item pi
      JOIN biz_week_plan p ON pi.plan_id = p.id
      WHERE p.status='PUBLISHED' AND p.department_id=? AND pi.is_deleted=false
      AND pi.id NOT IN (SELECT plan_item_id FROM biz_feedback WHERE feedback_user_id=?)
    `, [departmentId, userId]))?.cnt || 0;

    // 待审核数量
    let pendingReview = 0;
    if (role === 'DEPT_HEAD') {
      pendingReview = (await queryOne(
        'SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status=\'SUBMITTED\' AND department_id=? AND is_deleted=false',
        [departmentId]
      ))?.cnt || 0;
    } else if (role === 'OFFICE_HEAD') {
      pendingReview = (await queryOne(
        'SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status=\'DEPT_APPROVED\' AND is_deleted=false'
      ))?.cnt || 0;
    } else if (role === 'PRINCIPAL') {
      pendingReview = (await queryOne(
        'SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status=\'OFFICE_APPROVED\' AND is_deleted=false'
      ))?.cnt || 0;
    } else if (role === 'ADMIN') {
      pendingReview = (await queryOne(
        'SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status IN (\'SUBMITTED\',\'DEPT_APPROVED\',\'OFFICE_APPROVED\') AND is_deleted=false'
      ))?.cnt || 0;
    }

    return success(res, {
      myPlans,
      publishedPlans,
      pendingFeedback,
      pendingReview
    });
  } catch (error) {
    console.error('获取快捷操作统计失败:', error);
    return success(res, {
      myPlans: 0,
      publishedPlans: 0,
      pendingFeedback: 0,
      pendingReview: 0
    });
  }
});

// 最新活动API
router.get('/recent-activities', authMiddleware, async (req, res) => {
  const { role, userId, departmentId } = req.user;

  try {
    const activities = [];

    // 1. 获取最近创建的计划
    const recentPlans = await query(`
      SELECT 
        wp.id,
        wp.title,
        wp.create_time as time,
        'create' as type,
        u.real_name as user_name
      FROM biz_week_plan wp
      LEFT JOIN sys_user u ON wp.creator_id = u.id
      WHERE wp.is_deleted=false
      ORDER BY wp.create_time DESC
      LIMIT 5
    `);

    // 2. 获取最近发布的计划
    const publishedPlans = await query(`
      SELECT 
        wp.id,
        wp.title,
        wp.update_time as time,
        'publish' as type,
        u.real_name as user_name
      FROM biz_week_plan wp
      LEFT JOIN sys_user u ON wp.submitter_id = u.id
      WHERE wp.status='PUBLISHED' AND wp.is_deleted=false
      ORDER BY wp.update_time DESC
      LIMIT 5
    `);

    // 3. 获取最近的审核活动（如果有审核权限）
    let reviewActivities = [];
    if (['DEPT_HEAD', 'OFFICE_HEAD', 'PRINCIPAL', 'ADMIN'].includes(role)) {
      reviewActivities = await query(`
        SELECT 
          wp.id,
          wp.title,
          wp.update_time as time,
          'review' as type,
          u.real_name as user_name
        FROM biz_week_plan wp
        LEFT JOIN sys_user u ON wp.reviewer_id = u.id
        WHERE wp.reviewer_id IS NOT NULL AND wp.is_deleted=false
        ORDER BY wp.update_time DESC
        LIMIT 5
      `);
    }

    // 4. 获取最近的反馈
    const feedbackActivities = await query(`
      SELECT 
        bf.id,
        pi.content as title,
        bf.created_at as time,
        'feedback' as type,
        u.real_name as user_name
      FROM biz_feedback bf
      LEFT JOIN biz_plan_item pi ON bf.plan_item_id = pi.id
      LEFT JOIN sys_user u ON bf.feedback_user_id = u.id
      WHERE bf.is_deleted=false
      ORDER BY bf.created_at DESC
      LIMIT 5
    `);

    // 合并所有活动
    const allActivities = [
      ...recentPlans.map(p => ({
        ...p,
        icon: 'Document',
        description: p.user_name ? `${p.user_name} 创建了计划` : '创建了计划',
        status: 'success',
        statusText: '已创建',
        color: '#0891B2'
      })),
      ...publishedPlans.map(p => ({
        ...p,
        icon: 'DocumentChecked',
        description: p.user_name ? `${p.user_name} 发布了计划` : '发布了计划',
        status: 'success',
        statusText: '已发布',
        color: '#22C55E'
      })),
      ...reviewActivities.map(p => ({
        ...p,
        icon: 'EditPen',
        description: p.user_name ? `${p.user_name} 审核了计划` : '审核了计划',
        status: 'warning',
        statusText: '已审核',
        color: '#F59E0B'
      })),
      ...feedbackActivities.map(f => ({
        ...f,
        icon: 'ChatDotRound',
        description: f.user_name ? `${f.user_name} 提交了反馈` : '提交了反馈',
        status: 'info',
        statusText: '已反馈',
        color: '#3B82F6'
      }))
    ];

    // 按时间排序，取最近的10条
    allActivities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const recent10 = allActivities.slice(0, 10);

    // 格式化时间显示
    const now = new Date();
    const formattedActivities = recent10.map(activity => {
      const activityTime = new Date(activity.time);
      const diffMs = now - activityTime;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeText;
      if (diffMins < 60) {
        timeText = `${diffMins}分钟前`;
      } else if (diffHours < 24) {
        timeText = `${diffHours}小时前`;
      } else if (diffDays < 7) {
        timeText = `${diffDays}天前`;
      } else {
        timeText = activityTime.toLocaleDateString('zh-CN');
      }

      return {
        ...activity,
        time: timeText
      };
    });

    return success(res, formattedActivities);
  } catch (error) {
    console.error('获取最新活动失败:', error);
    return success(res, []);
  }
});

module.exports = router;
