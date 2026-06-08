/**
 * 题目类型管理路由
 * 支持自定义题目类型的增删改查
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { cacheMiddleware } = require('../config/cache');
const { logger } = require('../config/logger');

// ================================================================
// 权限校验中间件
// ================================================================

// 管理员权限校验（admin 或 super_admin）
const requireAdmin = async (req, res, next) => {
  try {
    const admin_user_id = req.body.admin_user_id || req.query.admin_user_id;
    if (!admin_user_id) {
      return res.status(401).json({ success: false, error: '未提供管理员ID' });
    }
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT 1 FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ? AND r.name IN ('admin', 'super_admin')`,
        [admin_user_id]
      );
      connection.release();
      if (rows.length === 0) {
        return res.status(403).json({ success: false, error: '需要管理员权限' });
      }
      next();
    } catch (err) {
      connection.release();
      throw err;
    }
  } catch (error) {
    logger.error('管理员权限校验失败', { error: error.message });
    res.status(500).json({ success: false, error: '权限校验失败' });
  }
};

// 超级管理员权限校验
const requireSuperAdmin = async (req, res, next) => {
  try {
    const admin_user_id = req.body.admin_user_id || req.query.admin_user_id;
    if (!admin_user_id) {
      return res.status(401).json({ success: false, error: '未提供管理员ID' });
    }
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT 1 FROM user_roles ur
         JOIN roles r ON ur.role_id = r.id
         WHERE ur.user_id = ? AND r.name = 'super_admin'`,
        [admin_user_id]
      );
      connection.release();
      if (rows.length === 0) {
        return res.status(403).json({ success: false, error: '需要超级管理员权限' });
      }
      next();
    } catch (err) {
      connection.release();
      throw err;
    }
  } catch (error) {
    logger.error('超级管理员权限校验失败', { error: error.message });
    res.status(500).json({ success: false, error: '权限校验失败' });
  }
};

// ================================================================
// 获取所有题目类型（系统预设 + 用户自定义，缓存600秒）
// ================================================================
router.get('/question-types', cacheMiddleware(600, 'question-types'), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    try {
      const [rows] = await connection.query(`
        SELECT
          id,
          name,
          display_name,
          description,
          is_system,
          is_active,
          sort_order
        FROM question_types
        WHERE is_active = 1
        ORDER BY is_system DESC, sort_order ASC, id ASC
      `);

      connection.release();

      // 分组返回数据
      const systemTypes = rows.filter(t => t.is_system === 1);
      const customTypes = rows.filter(t => t.is_system === 0);

      res.json({
        success: true,
        data: {
          systemTypes,
          customTypes,
          all: rows
        }
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('获取题目类型错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '获取题目类型失败'
    });
  }
});

// ================================================================
// 创建自定义题目类型
// ================================================================
router.post('/question-types', requireAdmin, async (req, res) => {
  try {
    const { name, display_name, description = '' } = req.body;

    // 参数验证
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: '类型名称不能为空'
      });
    }

    if (!display_name || !display_name.trim()) {
      return res.status(400).json({
        success: false,
        error: '显示名称不能为空'
      });
    }

    // 规范化名称（转大写，替换空格为下划线）
    const normalizedName = name.trim().toUpperCase().replace(/\s+/g, '_');

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 检查是否已存在
      const [existing] = await connection.query(
        'SELECT id FROM question_types WHERE name = ?',
        [normalizedName]
      );

      if (existing.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({
          success: false,
          error: '该类型名称已存在'
        });
      }

      // 获取当前最大 sort_order
      const [maxOrder] = await connection.query(
        'SELECT MAX(sort_order) as max_order FROM question_types WHERE is_system = 0'
      );
      const nextOrder = (maxOrder[0].max_order || 0) + 1;

      // 插入新类型
      const [result] = await connection.query(
        `INSERT INTO question_types (name, display_name, description, is_system, sort_order)
         VALUES (?, ?, ?, 0, ?)`,
        [normalizedName, display_name.trim(), description.trim(), nextOrder]
      );

      await connection.commit();
      connection.release();

      logger.info('创建自定义题目类型', { typeId: result.insertId, name: normalizedName });

      res.json({
        success: true,
        data: {
          id: result.insertId,
          name: normalizedName,
          display_name: display_name.trim(),
          description: description.trim(),
          is_system: 0,
          sort_order: nextOrder
        }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('创建题目类型错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '创建题目类型失败'
    });
  }
});

// ================================================================
// 更新题目类型
// ================================================================
router.put('/question-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { display_name, description, is_active } = req.body;

    // 不允许修改系统预设类型的 name
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 检查类型是否存在
      const [existing] = await connection.query(
        'SELECT * FROM question_types WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          error: '题目类型不存在'
        });
      }

      // 系统预设类型不允许修改 name
      if (existing[0].is_system === 1 && req.body.name !== undefined) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({
          success: false,
          error: '不允许修改系统预设类型的名称'
        });
      }

      // 构建更新语句
      const updates = [];
      const params = [];

      if (display_name !== undefined) {
        updates.push('display_name = ?');
        params.push(display_name);
      }

      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }

      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active ? 1 : 0);
      }

      if (updates.length > 0) {
        params.push(id);
        await connection.query(
          `UPDATE question_types SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      await connection.commit();
      connection.release();

      logger.info('更新题目类型', { typeId: id });

      res.json({
        success: true,
        message: '更新成功'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('更新题目类型错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '更新题目类型失败'
    });
  }
});

// ================================================================
// 删除自定义题目类型（软删除，设为不活跃）
// ================================================================
router.delete('/question-types/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 检查类型是否存在
      const [existing] = await connection.query(
        'SELECT * FROM question_types WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          error: '题目类型不存在'
        });
      }

      // 检查是否有题目在使用该类型
      const [questionsCheck] = await connection.query(
        'SELECT COUNT(*) as count FROM questions WHERE category = ?',
        [existing[0].name]
      );

      if (questionsCheck[0].count > 0) {
        await connection.rollback();
        connection.release();
        return res.status(409).json({
          success: false,
          error: `该类型下还有 ${questionsCheck[0].count} 个题目，无法删除`,
          count: questionsCheck[0].count
        });
      }

      // 软删除：设为不活跃
      await connection.query(
        'UPDATE question_types SET is_active = 0 WHERE id = ?',
        [id]
      );

      await connection.commit();
      connection.release();

      logger.info('删除题目类型', { typeId: id, name: existing[0].name });

      res.json({
        success: true,
        message: '删除成功'
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('删除题目类型错误', { error: error.message });
    res.status(500).json({
      success: false,
      error: '删除题目类型失败'
    });
  }
});

module.exports = router;
