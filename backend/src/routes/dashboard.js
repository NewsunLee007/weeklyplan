/**
 * 仪表盘统计 /api/dashboard
 */
const router = require('express').Router();
const { queryOne } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { success } = require('../utils/helper');

router.get('/stats', authMiddleware, (req, res) => {
  const { role, userId, departmentId } = req.user;

  // 我的计划总数
  const myPlansTotal = queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE creator_id=? AND is_deleted=0`,
    [userId]
  )?.cnt || 0;

  // 已发布计划数
  const publishedTotal = queryOne(
    `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='PUBLISHED' AND is_deleted=0`
  )?.cnt || 0;

  // 待审核数量
  let pendingReview = 0;
  if (role === 'DEPT_HEAD') {
    pendingReview = queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='SUBMITTED' AND department_id=? AND is_deleted=0`,
      [departmentId]
    )?.cnt || 0;
  } else if (role === 'OFFICE_HEAD') {
    pendingReview = queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='DEPT_APPROVED' AND is_deleted=0`
    )?.cnt || 0;
  } else if (role === 'PRINCIPAL') {
    pendingReview = queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status='OFFICE_APPROVED' AND is_deleted=0`
    )?.cnt || 0;
  } else if (role === 'ADMIN') {
    pendingReview = queryOne(
      `SELECT COUNT(*) as cnt FROM biz_week_plan WHERE status IN ('SUBMITTED','DEPT_APPROVED','OFFICE_APPROVED') AND is_deleted=0`
    )?.cnt || 0;
  }

  // 待反馈数（已发布且本部门未全部反馈）
  const pendingFeedback = queryOne(
    `SELECT COUNT(*) as cnt FROM biz_plan_item pi
     JOIN biz_week_plan p ON pi.plan_id = p.id
     WHERE p.status='PUBLISHED' AND p.department_id=? AND pi.is_deleted=0
     AND pi.id NOT IN (SELECT plan_item_id FROM biz_feedback WHERE feedback_user_id=?)`,
    [departmentId, userId]
  )?.cnt || 0;

  return success(res, { myPlansTotal, publishedTotal, pendingReview, pendingFeedback });
});

module.exports = router;
