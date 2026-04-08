/**
 * 反馈接口 /api/feedbacks
 */
const router = require('express').Router();
const { query, queryOne, execute, run } = require('../db/adapter');
const { authMiddleware } = require('../middleware/auth');
const { success, fail, now } = require('../utils/helper');

// GET / 反馈列表
router.get('/', authMiddleware, async (req, res) => {
  const { plan_id } = req.query;
  let where = `WHERE 1=1`;
  const params = [];
  if (plan_id) { where += ` AND f.plan_id = ?`; params.push(plan_id); }

  const records = await query(
    `SELECT f.*, pi.content as item_content, pi.plan_date, pi.weekday, u.real_name as user_name
     FROM biz_feedback f
     LEFT JOIN biz_plan_item pi ON f.plan_item_id = pi.id
     LEFT JOIN sys_user u ON f.feedback_user_id = u.id
     ${where} ORDER BY f.plan_id, pi.plan_date, pi.sort_order`,
    params
  );
  return success(res, records);
});

// POST / 提交或更新反馈（UPSERT）
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { plan_item_id, plan_id, status, content } = req.body;
    if (!plan_item_id || !plan_id || !status) return fail(res, '必填字段不能为空');

    const n = now();
    const userId = req.user.userId;

    const existing = await queryOne(
      `SELECT id FROM biz_feedback WHERE plan_item_id = $1 AND feedback_user_id = $2`,
      [plan_item_id, userId]
    );

    if (existing) {
      await run(`UPDATE biz_feedback SET status=$1, content=$2, update_time=$3 WHERE id=$4`,
        [status, content || '', n, existing.id]);
    } else {
      await run(
        `INSERT INTO biz_feedback (plan_item_id, plan_id, feedback_user_id, status, content, create_time, update_time) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [plan_item_id, plan_id, userId, status, content || '', n, n]
      );
    }
    return success(res, null, '反馈已保存');
  } catch (error) {
    console.error('❌ 保存反馈时出错:', error);
    return fail(res, '保存失败，系统异常，请稍后重试');
  }
});

// GET /plan/:planId 某计划的所有反馈汇总
router.get('/plan/:planId', authMiddleware, async (req, res) => {
  const { planId } = req.params;
  const records = await query(
    `SELECT f.*, pi.content as item_content, pi.plan_date, pi.weekday, u.real_name as user_name
     FROM biz_feedback f
     LEFT JOIN biz_plan_item pi ON f.plan_item_id = pi.id
     LEFT JOIN sys_user u ON f.feedback_user_id = u.id
     WHERE f.plan_id = ? ORDER BY pi.plan_date, pi.sort_order`,
    [planId]
  );
  return success(res, records);
});

// GET /export/excel 导出周反馈汇总
router.get('/export/excel', authMiddleware, async (req, res) => {
  const { semester, weekNumber } = req.query;
  if (!semester || !weekNumber) return fail(res, '缺少学期或周次参数');

  try {
    const ExcelJS = require('exceljs');
    
    // 1. 获取本周所有部门发布的计划
    const plans = await query(
      `SELECT p.id, d.name as dept_name
       FROM biz_week_plan p
       LEFT JOIN sys_department d ON p.department_id = d.id
       WHERE p.semester = ? AND p.week_number = ? AND p.status = 'PUBLISHED' AND p.is_deleted = false
       ORDER BY d.sort_order`,
      [semester, weekNumber]
    );

    // 2. 获取每个计划的条目及反馈
    const dataRows = [];
    let index = 1;
    for (const plan of plans) {
      const items = await query(
        `SELECT id, plan_date, weekday, content, responsible FROM biz_plan_item WHERE plan_id = ? AND is_deleted = false ORDER BY plan_date, sort_order`,
        [plan.id]
      );
      const feedbacks = await query(
        `SELECT plan_item_id, status, content FROM biz_feedback WHERE plan_id = ?`,
        [plan.id]
      );
      const fbMap = {};
      feedbacks.forEach(fb => fbMap[fb.plan_item_id] = fb);

      items.forEach(item => {
        const fb = fbMap[item.id] || {};
        const statusMap = { 'COMPLETED': '已完成', 'PARTIALLY': '部分完成', 'NOT_COMPLETED': '未完成', 'PENDING': '待反馈' };
        dataRows.push([
          index++,
          item.plan_date ? new Date(item.plan_date).toISOString().slice(0, 10) : '',
          item.weekday || '',
          plan.dept_name || '学校工作指导',
          item.content || '',
          item.responsible || '',
          statusMap[fb.status] || '待反馈',
          fb.content || ''
        ]);
      });
    }

    // 3. 构建 Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('反馈汇总', {
      pageSetup: {
        paperSize: 9, // A4
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: '1:2',
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
      },
      headerFooter: {
        oddFooter: '&C第 &P 页，共 &N 页'
      }
    });

    // 标题
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${semester} 第${weekNumber}周 工作计划反馈汇总`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    // 表头
    const headers = ['序号', '日期', '星期', '部门', '工作内容', '负责人', '完成状态', '反馈说明'];
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(2);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    });

    // 列宽
    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 12;
    worksheet.getColumn(3).width = 8;
    worksheet.getColumn(4).width = 15;
    worksheet.getColumn(5).width = 40;
    worksheet.getColumn(6).width = 15;
    worksheet.getColumn(7).width = 12;
    worksheet.getColumn(8).width = 30;

    // 数据
    dataRows.forEach(row => {
      const r = worksheet.addRow(row);
      r.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
      // 居中的列
      r.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell(2).alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' };
      r.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=feedbacks_${semester}_week${weekNumber}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('导出 Excel 失败:', error);
    return fail(res, '导出失败');
  }
});

module.exports = router;
