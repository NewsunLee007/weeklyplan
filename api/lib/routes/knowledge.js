const express = require('express');
const router = express.Router();
const { query, queryOne, execute, getLastInsertId } = require('../db/adapter');
const { success, fail } = require('../utils/helper');
const { authMiddleware, requireRole } = require('../middleware/auth');

router.get('/bases', authMiddleware, async (req, res) => {
  try {
    const bases = await query(
      'SELECT * FROM biz_knowledge_base WHERE is_deleted = FALSE ORDER BY created_at DESC'
    );
    return success(res, bases);
  } catch (error) {
    console.error('获取知识库列表失败:', error);
    return fail(res, '获取知识库列表失败', 500);
  }
});

router.post('/bases', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, description, type } = req.body;
    const creatorId = req.user?.id || 1;

    await execute(
      'INSERT INTO biz_knowledge_base (name, description, type, creator_id) VALUES ($1, $2, $3, $4)',
      [name, description, type, creatorId]
    );

    const id = await getLastInsertId();
    const newBase = await queryOne('SELECT * FROM biz_knowledge_base WHERE id = $1', [id]);

    return success(res, newBase, '知识库创建成功');
  } catch (error) {
    console.error('创建知识库失败:', error);
    return fail(res, '创建知识库失败', 500);
  }
});

router.put('/bases/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, is_active } = req.body;

    await execute(
      'UPDATE biz_knowledge_base SET name = $1, description = $2, type = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
      [name, description, type, is_active, id]
    );

    const updatedBase = await queryOne('SELECT * FROM biz_knowledge_base WHERE id = $1', [id]);
    return success(res, updatedBase, '知识库更新成功');
  } catch (error) {
    console.error('更新知识库失败:', error);
    return fail(res, '更新知识库失败', 500);
  }
});

router.delete('/bases/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    await execute('UPDATE biz_knowledge_base SET is_deleted = TRUE WHERE id = $1', [id]);
    return success(res, null, '知识库删除成功');
  } catch (error) {
    console.error('删除知识库失败:', error);
    return fail(res, '删除知识库失败', 500);
  }
});

router.get('/bases/:baseId/items', authMiddleware, async (req, res) => {
  try {
    const { baseId } = req.params;
    const items = await query(
      'SELECT * FROM biz_knowledge_item WHERE knowledge_base_id = $1 AND is_deleted = FALSE ORDER BY created_at DESC',
      [baseId]
    );
    return success(res, items);
  } catch (error) {
    console.error('获取知识项列表失败:', error);
    return fail(res, '获取知识项列表失败', 500);
  }
});

router.post('/bases/:baseId/items', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { baseId } = req.params;
    const { title, content, file_url, file_name, file_size } = req.body;
    const creatorId = req.user?.id || 1;

    await execute(
      'INSERT INTO biz_knowledge_item (knowledge_base_id, title, content, file_url, file_name, file_size, creator_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [baseId, title, content, file_url, file_name, file_size, creatorId]
    );

    const id = await getLastInsertId();
    const newItem = await queryOne('SELECT * FROM biz_knowledge_item WHERE id = $1', [id]);

    return success(res, newItem, '知识项创建成功');
  } catch (error) {
    console.error('创建知识项失败:', error);
    return fail(res, '创建知识项失败', 500);
  }
});

router.put('/items/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, is_active } = req.body;

    await execute(
      'UPDATE biz_knowledge_item SET title = $1, content = $2, is_active = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
      [title, content, is_active, id]
    );

    const updatedItem = await queryOne('SELECT * FROM biz_knowledge_item WHERE id = $1', [id]);
    return success(res, updatedItem, '知识项更新成功');
  } catch (error) {
    console.error('更新知识项失败:', error);
    return fail(res, '更新知识项失败', 500);
  }
});

router.delete('/items/:id', authMiddleware, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    await execute('UPDATE biz_knowledge_item SET is_deleted = TRUE WHERE id = $1', [id]);
    return success(res, null, '知识项删除成功');
  } catch (error) {
    console.error('删除知识项失败:', error);
    return fail(res, '删除知识项失败', 500);
  }
});

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return success(res, []);
    }

    const items = await query(
      `SELECT ki.*, kb.name as knowledge_base_name 
       FROM biz_knowledge_item ki
       JOIN biz_knowledge_base kb ON ki.knowledge_base_id = kb.id
       WHERE ki.is_deleted = FALSE AND kb.is_deleted = FALSE AND ki.is_active = TRUE AND kb.is_active = TRUE
       AND (ki.title ILIKE $1 OR ki.content ILIKE $1)
       ORDER BY ki.created_at DESC`,
      [`%${q}%`]
    );

    return success(res, items);
  } catch (error) {
    console.error('搜索知识库失败:', error);
    return fail(res, '搜索知识库失败', 500);
  }
});

router.get('/context', authMiddleware, async (req, res) => {
  try {
    const items = await query(
      `SELECT ki.*, kb.name as knowledge_base_name 
       FROM biz_knowledge_item ki
       JOIN biz_knowledge_base kb ON ki.knowledge_base_id = kb.id
       WHERE ki.is_deleted = FALSE AND kb.is_deleted = FALSE AND ki.is_active = TRUE AND kb.is_active = TRUE
       ORDER BY kb.type, ki.created_at DESC`
    );

    const context = items.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      knowledge_base: item.knowledge_base_name,
      knowledge_base_id: item.knowledge_base_id
    }));

    return success(res, context);
  } catch (error) {
    console.error('获取知识库上下文失败:', error);
    return fail(res, '获取知识库上下文失败', 500);
  }
});

module.exports = router;
