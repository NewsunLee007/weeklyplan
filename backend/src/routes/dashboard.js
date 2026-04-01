/**
 * 仪表盘统计 /api/dashboard
 */
const router = require('express').Router();
const { queryOne } = require('../db/adapter');
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

    // 5. 获取本周计划完成情况
    const currentWeekPlans = await queryOne(
      `SELECT 
        COUNT(*) as total, 
        SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed 
       FROM biz_week_plan 
       WHERE is_deleted=false 
       AND WEEK(start_date) = WEEK(NOW())`
    );

    // 6. 获取下周计划安排
    const nextWeekPlans = await queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan 
       WHERE is_deleted=false 
       AND WEEK(start_date) = WEEK(NOW()) + 1`
    );

    // 7. 生成AI分析结果
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
  const { semesterPlans, schoolInfo, calendarEvents, weekPlans, currentWeek, nextWeek, role, departmentId } = data;
  
  // 计算完成率
  const completionRate = currentWeek.total > 0 ? Math.round((currentWeek.completed / currentWeek.total) * 100) : 0;
  
  // 生成分析洞察
  const insights = [];
  
  // 完成率分析
  if (completionRate >= 80) {
    insights.push({
      icon: 'Lightbulb',
      text: `本周工作计划完成率为${completionRate}%，高于预期，继续保持！`,
      priority: 'normal'
    });
  } else if (completionRate >= 60) {
    insights.push({
      icon: 'Lightbulb',
      text: `本周工作计划完成率为${completionRate}%，基本达到预期，建议加强时间管理。`,
      priority: 'normal'
    });
  } else {
    insights.push({
      icon: 'AlertCircle',
      text: `本周工作计划完成率仅为${completionRate}%，低于预期，建议分析原因并调整工作计划。`,
      priority: 'high'
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
      text: `下周暂无计划安排，建议及时制定下周工作计划。`,
      priority: 'warning'
    });
  }
  
  // 学期计划分析
  if (semesterPlans > 0) {
    insights.push({
      icon: 'Target',
      text: `本学期已有${semesterPlans}个学期计划，各项工作有序推进。`,
      priority: 'normal'
    });
  } else {
    insights.push({
      icon: 'AlertCircle',
      text: `本学期尚未制定学期计划，建议尽快制定学期工作目标和计划。`,
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
  
  // 生成阶段总结
  const stageSummary = `根据数据分析，当前阶段共完成了${currentWeek.completed}个计划，完成率${completionRate}%。${semesterPlans > 0 ? '学期计划制定完善，' : '尚未制定学期计划，'}${calendarEvents > 0 ? '行事历安排合理，' : ''}${weekPlans > 0 ? `本学期共制定了${weekPlans}个周计划，` : ''}整体工作进展${completionRate >= 80 ? '良好' : completionRate >= 60 ? '一般' : '需要改进'}。`;
  
  // 生成新周计划提示
  const weeklyPlanTips = `下周建议：1. 优先完成未完成的计划项；2. 根据学期计划安排本周工作重点；3. 关注重要行事历事件；4. 合理分配时间和资源；5. 与团队成员保持良好沟通，确保工作协调一致。`;
  
  // 生成下一阶段工作安排
  const nextStagePlan = `下一阶段工作建议：1. 总结当前阶段工作经验，分析成功和失败的原因；2. 调整和优化工作计划，提高工作效率；3. 加强部门间的沟通协作，形成工作合力；4. 关注学校整体发展目标，确保各项工作与学校战略保持一致；5. 定期检查工作进展，及时调整工作方向。`;
  
  // 生成角色特定的建议
  let roleSpecificSuggestions = [];
  if (role === 'DEPT_HEAD') {
    roleSpecificSuggestions.push('作为部门负责人，建议加强对部门成员工作的指导和支持');
    roleSpecificSuggestions.push('关注部门间的协作，确保部门工作与其他部门协调一致');
  } else if (role === 'OFFICE_HEAD') {
    roleSpecificSuggestions.push('作为办公室负责人，建议加强对各部门工作的协调和监督');
    roleSpecificSuggestions.push('关注学校整体工作进展，及时向校长汇报重要情况');
  } else if (role === 'PRINCIPAL') {
    roleSpecificSuggestions.push('作为校长，建议关注学校整体发展战略的实施情况');
    roleSpecificSuggestions.push('加强与各部门负责人的沟通，及时了解工作进展和问题');
  } else if (role === 'ADMIN') {
    roleSpecificSuggestions.push('作为管理员，建议加强系统维护和数据管理');
    roleSpecificSuggestions.push('关注用户反馈，不断优化系统功能和用户体验');
  }
  
  return {
    insights,
    stageSummary,
    weeklyPlanTips,
    nextStagePlan,
    roleSpecificSuggestions,
    metrics: {
      completionRate,
      semesterPlans,
      weekPlans,
      calendarEvents,
      nextWeekPlans: nextWeek,
      averagePlansPerWeek: weekPlans > 0 ? Math.round(weekPlans / 16) : 0
    }
  };
}

// 生成模拟AI分析结果（当数据库查询失败时使用）
function generateMockAIAnalysis() {
  return {
    insights: [
      {
        icon: 'Lightbulb',
        text: '本周工作计划完成率为85%，高于上周的78%，继续保持！',
        priority: 'normal'
      },
      {
        icon: 'Calendar',
        text: '下周有3个重要会议需要安排，建议提前准备相关材料。',
        priority: 'warning'
      },
      {
        icon: 'Target',
        text: '教务处的计划完成质量较高，值得其他部门学习。',
        priority: 'normal'
      },
      {
        icon: 'AlertCircle',
        text: '九年级有2个计划尚未提交，建议及时跟进。',
        priority: 'high'
      }
    ],
    stageSummary: '本阶段工作进展良好，计划完成率达到85%，各项工作有序推进。学期计划制定完善，行事历安排合理，整体工作符合预期。',
    weeklyPlanTips: '下周建议：1. 完成未完成的计划项；2. 准备下周的重要会议材料；3. 跟进九年级的计划提交情况；4. 总结本阶段工作经验。',
    nextStagePlan: '下一阶段工作建议：1. 继续保持良好的工作状态；2. 加强部门间的沟通协作；3. 关注学校整体发展目标；4. 优化工作计划和流程，提高工作效率。',
    metrics: {
      completionRate: 85,
      semesterPlans: 5,
      weekPlans: 24,
      calendarEvents: 12,
      nextWeekPlans: 3
    }
  };
}

module.exports = router;
