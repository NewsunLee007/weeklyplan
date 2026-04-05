/**
 * 工具函数
 */
import dayjs from 'dayjs'

export const ROLES = {
  ADMIN: '系统管理员',
  STAFF: '普通教师/职员',
  DEPT_HEAD: '部门主任',
  ACADEMIC_HEAD: '教务处主任',
  OFFICE_HEAD: '办公室主任',
  PRINCIPAL: '校长'
}

export const STATUS_MAP = {
  DRAFT: { label: '草稿', type: 'info' },
  SUBMITTED: { label: '待审核', type: 'warning' },
  DEPT_APPROVED: { label: '部门已审核', type: '' },
  OFFICE_APPROVED: { label: '办公室已审核', type: 'primary' },
  PUBLISHED: { label: '已发布', type: 'success' },
  REJECTED: { label: '已退回', type: 'danger' }
}

export function getWeekday(dateStr) {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const d = new Date(dateStr)
  return days[d.getDay()]
}

/**
 * 计算当前是第几周
 * @param {string} weekStart  - 第1周起始日期（YYYY-MM-DD），应已对齐到 weekFirstDay
 * @param {number} weekFirstDay - 0=周日, 1=周一
 */
export function calcWeekNumber(weekStart, weekFirstDay = 0) {
  const start = dayjs(weekStart)
  const now = dayjs()
  const diff = now.diff(start, 'day')
  return Math.max(1, Math.floor(diff / 7) + 1)
}

/**
 * 根据第1周起始日期和周次计算该周起止日期（7天）
 * @param {string} weekStart  - 第1周起始日期（YYYY-MM-DD）
 * @param {number} weekNumber - 周次（从1开始）
 * @param {number} weekFirstDay - 0=周日, 1=周一（用于确保 weekStart 已对齐，当前仅做提示用途）
 */
export function calcWeekRange(weekStart, weekNumber, weekFirstDay = 0) {
  const start = dayjs(weekStart).add((weekNumber - 1) * 7, 'day')
  const end = start.add(6, 'day')
  return {
    start_date: start.format('YYYY-MM-DD'),
    end_date: end.format('YYYY-MM-DD')
  }
}

/**
 * 将任意日期对齐到最近的周起始日（向前找）
 * @param {string} dateStr - YYYY-MM-DD
 * @param {number} weekFirstDay - 0=周日, 1=周一
 * @returns {string} 对齐后的 YYYY-MM-DD
 */
export function alignToWeekStart(dateStr, weekFirstDay = 0) {
  const d = dayjs(dateStr)
  const dow = d.day() // 0=周日, 1=周一...6=周六
  // 计算需要往前回溯几天
  const diff = (dow - weekFirstDay + 7) % 7
  return d.subtract(diff, 'day').format('YYYY-MM-DD')
}

export function formatDate(d) {
  if (!d) return ''
  return dayjs(d).format('YYYY-MM-DD')
}

export function formatDateTime(d) {
  if (!d) return ''
  return dayjs(d).format('YYYY-MM-DD HH:mm')
}
