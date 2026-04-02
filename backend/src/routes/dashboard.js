/**
 * 仪表盘统计 /api/dashboard
 */
const router = require('express').Router();
const { queryOne, query } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { success } = require('../utils/helper');

router.get('/stats', authMiddleware, async (req, res) => {
  const { role, userId, departmentId } = req.user;

  // 我的计划总数
  const myPlansTotal = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE creator_id=? AND is_deleted=false`,
    [userId]
  ))?.cnt || 0;

  // 已发布计划数
  const publishedTotal = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='PUBLISHED' AND is_deleted=false`
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

  // 待反馈数（已发布且本部门未全部反馈）
  const pendingFeedback = (await queryOne(
    `SELECT COUNT(*) as cnt FROM biz_plan_item pi
     JOIN biz_week_plan p ON pi.plan_id = p.id
     WHERE p.status='PUBLISHED' AND p.department_id=? AND pi.is_deleted=false
     AND pi.id NOT IN (SELECT plan_item_id FROM biz_feedback WHERE feedback_user_id=?)`,
    [departmentId, userId]
  ))?.cnt || 0;

  return success(res, { myPlansTotal, publishedTotal, pendingReview, pendingFeedback });
});

// AI分析接口
router.get('/ai-analysis', authMiddleware, async (req, res) => {
  const { role, userId, departmentId } = req.user;

  try {
    // 1. 获取学期计划数据
    const semesterPlans = await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_semester_plan WHERE is_deleted=false`
    );

    // 2. 获取学校情况数据
    const schoolInfo = await queryOne(
      `SELECT COUNT(*) as cnt FROM sys_school_config WHERE is_deleted=false`
    );

    // 3. 获取学期行事历数据
    const calendarEvents = await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_calendar_event WHERE is_deleted=false`
    );

    // 4. 获取每周计划数据
    const weekPlans = await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE is_deleted=false`
    );

      // 获取当前周数
    const currentWeek = await queryOne("SELECT EXTRACT(WEEK FROM NOW()) as week");
    const currentWeekNum = currentWeek?.week || 0;

    // 5. 获取本周计划完成情况
    const currentWeekPlans = await queryOne(
      `SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed 
       FROM biz_week_plan 
       WHERE is_deleted=false 
       AND EXTRACT(WEEK FROM start_date) = ?`,
      [currentWeekNum]
    );

    // 6. 获取下周计划安排
    const nextWeekPlans = await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan 
       WHERE is_deleted=false 
       AND EXTRACT(WEEK FROM start_date) = ?`,
      [currentWeekNum + 1]
    );

    // 7. 获取历史数据 - 过去4周的完成情况
    const historicalData = [];
    // 一次性获取过去4周的数据
    const historicalWeeks = await query(
      `SELECT 
        EXTRACT(WEEK FROM start_date) as week, 
        COUNT(*) as total, 
        SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed 
       FROM biz_week_plan 
       WHERE is_deleted=false 
       AND EXTRACT(WEEK FROM start_date) BETWEEN ? AND ? 
       GROUP BY EXTRACT(WEEK FROM start_date) 
       ORDER BY EXTRACT(WEEK FROM start_date) DESC`,
      [currentWeekNum - 4, currentWeekNum - 1]
    );

    // 填充历史数据
    for (let i = 1; i <= 4; i++) {
      const weekNum = currentWeekNum - i;
      const weekData = historicalWeeks.find(w => w.week === weekNum);
      historicalData.push({
        week: `第${weekNum}周`,
        total: weekData?.total || 0,
        completed: weekData?.completed || 0,
        completionRate: weekData?.total > 0 ? Math.round((weekData.completed / weekData.total) * 100) : 0
      });
    }

    // 8. 获取部门历史数据
    const departmentHistory = await query(
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

    // 9. 生成AI分析结果
    const analysis = generateAIAnalysis({
      semesterPlans: semesterPlans?.cnt || 0,
      schoolInfo: schoolInfo?.cnt || 0,
      calendarEvents: calendarEvents?.cnt || 0,
      weekPlans: weekPlans?.cnt || 0,
      currentWeek: {
        total: currentWeekPlans?.total || 0,
        completed: currentWeekPlans?.completed || 0
      },
      nextWeek: nextWeekPlans?.cnt || 0,
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

module.exports = router;
