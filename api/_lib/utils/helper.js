/**
 * 统一响应格式
 */
function success(res, data = null, message = '操作成功') {
  return res.json({ code: 200, message, data });
}

function successPage(res, records, total, page, pageSize) {
  return res.json({
    code: 200,
    message: '操作成功',
    data: { records, total, page: Number(page), pageSize: Number(pageSize) }
  });
}

function fail(res, message = '操作失败', code = 400) {
  return res.status(code).json({ code, message, data: null });
}

function now() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * 计算当前周次
 * @param {string} weekStart - 第1周起始日期 (YYYY-MM-DD)
 * @param {string} targetDate - 目标日期，默认今天
 */
function calcWeekNumber(weekStart, targetDate = null) {
  const start = new Date(weekStart);
  const target = targetDate ? new Date(targetDate) : new Date();
  const diff = Math.floor((target - start) / (7 * 24 * 3600 * 1000));
  return Math.max(1, diff + 1);
}

/**
 * 根据周次计算起止日期
 * @param {string} weekStart - 第1周起始日期
 * @param {number} weekNumber - 周次
 */
function calcWeekRange(weekStart, weekNumber) {
  const start = new Date(weekStart);
  const startOfWeek = new Date(start.getTime() + (weekNumber - 1) * 7 * 24 * 3600 * 1000);
  const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 3600 * 1000);
  return {
    start_date: startOfWeek.toISOString().substring(0, 10),
    end_date: endOfWeek.toISOString().substring(0, 10)
  };
}

/**
 * 根据日期获取星期
 */
function getWeekday(dateStr) {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(dateStr);
  return days[d.getDay()];
}

module.exports = { success, successPage, fail, now, calcWeekNumber, calcWeekRange, getWeekday };
