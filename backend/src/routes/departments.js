/**
 * 部门管理 /api/departments
 */
const router = require('express').Router();
const { query, queryOne, execute, run, getDatabaseType } = require('../db/adapter');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { success, fail, now } = require('../utils/helper');

function getBooleanValue(value) {
  const dbType = getDatabaseType();
  if (dbType === 'postgres') {
    return value ? true : false;
  }
  return value ? 1 : 0;
}

const IS_DELETED_FALSE = getBooleanValue(false);
const IS_DELETED_TRUE = getBooleanValue(true);

// GET / 获取所有部门
router.get('/', authMiddleware, async (req, res) => {
  const depts = await query(`SELECT * FROM sys_department WHERE is_deleted = ? ORDER BY sort_order`, [IS_DELETED_FALSE]);
  return success(res, depts);
});

// POST / 新增部门
router.post('/', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { name, code, sort_order = 0, description } = req.body;
  if (!name || !code) return fail(res, '部门名称和编码不能为空');

  const exists = await queryOne(`SELECT id FROM sys_department WHERE code = ? AND is_deleted = ?`, [code, IS_DELETED_FALSE]);
  if (exists) return fail(res, '部门编码已存在');

  const n = now();
  const result = await execute(
    `INSERT INTO sys_department (name, code, sort_order, description, status, create_time, update_time) VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [name, code, sort_order, description || '', n, n]
  );
  return success(res, { id: result.lastInsertRowid }, '部门创建成功');
});

// PUT /:id 修改部门
router.put('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { name, code, sort_order, description, status } = req.body;
  const dept = await queryOne(`SELECT id FROM sys_department WHERE id = ? AND is_deleted = ?`, [id, IS_DELETED_FALSE]);
  if (!dept) return fail(res, '部门不存在', 404);

  await execute(
    `UPDATE sys_department SET name=?, code=?, sort_order=?, description=?, status=?, update_time=? WHERE id=?`,
    [name, code, sort_order ?? 0, description || '', status ?? 1, now(), id]
  );
  return success(res, null, '更新成功');
});

// DELETE /:id 删除部门
router.delete('/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  await execute(`UPDATE sys_department SET is_deleted=?, update_time=? WHERE id=?`, [IS_DELETED_TRUE, now(), id]);
  return success(res, null, '删除成功');
});

// GET /export 导出部门
router.get('/export', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const departments = await query(
      `SELECT name, code, sort_order, description, status
       FROM sys_department WHERE is_deleted = ? ORDER BY sort_order`,
      [IS_DELETED_FALSE]
    );

    const data = departments.map(dept => ({
      部门名称: dept.name,
      编码: dept.code,
      排序: dept.sort_order,
      描述: dept.description || '',
      状态: dept.status === 1 ? '启用' : '禁用'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '部门数据');
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=departments_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.send(excelBuffer);
  } catch (error) {
    console.error('导出部门失败:', error);
    return fail(res, '导出失败');
  }
});

// POST /import 导入部门
router.post('/import', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const XLSX = require('xlsx');
    const multer = require('multer');
    const upload = multer({ storage: multer.memoryStorage() }).single('file');

    upload(req, res, async (err) => {
      if (err) return fail(res, '文件上传失败');
      if (!req.file) return fail(res, '请选择文件');

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      let successCount = 0, failCount = 0;
      const statusMap = { '启用': 1, '禁用': 0 };

      for (const row of data) {
        try {
          const name = row['部门名称']?.toString().trim();
          const code = row['编码']?.toString().trim();
          const sortOrder = parseInt(row['排序']) || 0;
          const description = row['描述']?.toString().trim();
          const statusText = row['状态']?.toString().trim();

          if (!name || !code) {
            failCount++;
            continue;
          }

          // 检查部门是否存在
          const existing = await queryOne(`SELECT id FROM sys_department WHERE code = ? AND is_deleted = ?`, [code, IS_DELETED_FALSE]);
          if (existing) {
            // 更新部门
            await execute(
              `UPDATE sys_department SET name=?, sort_order=?, description=?, status=?, update_time=? WHERE id=?`,
              [name, sortOrder, description, statusMap[statusText] || 1, now(), existing.id]
            );
          } else {
            // 新增部门
            const n = now();
            await execute(
              `INSERT INTO sys_department (name, code, sort_order, description, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [name, code, sortOrder, description, statusMap[statusText] || 1, n, n]
            );
          }
          successCount++;
        } catch (e) {
          console.error('导入部门失败:', e);
          failCount++;
        }
      }

      return success(res, { success: successCount, fail: failCount }, '导入完成');
    });
  } catch (error) {
    console.error('导入部门失败:', error);
    return fail(res, '导入失败');
  }
});

module.exports = router;
