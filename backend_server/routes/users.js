const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { cacheMiddleware, cacheUtils } = require('../config/cache');
const { logger } = require('../config/logger');

// 获取用户列表（带角色信息）
router.get('/users', cacheMiddleware(300, 'users'), async (req, res) => {
  try {
    const { role_id, status } = req.query;
    const connection = await pool.getConnection();
    
    let sql = `
      SELECT u.id, u.username, u.email, u.real_name, u.created_at,
             GROUP_CONCAT(r.name ORDER BY r.name SEPARATOR ', ') as roles,
             GROUP_CONCAT(r.display_name ORDER BY r.display_name SEPARATOR ', ') as role_names,
             GROUP_CONCAT(r.id ORDER BY r.id SEPARATOR ', ') as role_ids
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE 1=1
    `;
    const params = [];
    
    if (role_id) {
      sql += ' AND r.id = ?';
      params.push(role_id);
    }
    
    sql += ' GROUP BY u.id, u.username, u.email, u.real_name, u.created_at ORDER BY u.created_at DESC';
    
    const [results] = await connection.execute(sql, params);
    connection.release();
    
    res.json(results);
  } catch (error) {
    logger.error('获取用户列表错误', { error: error.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取用户详情（包含权限信息）
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const connection = await pool.getConnection();
    
    // 获取用户基本信息
    const [userRows] = await connection.execute(
      'SELECT id, username, email, real_name, created_at FROM users WHERE id = ?',
      [userId]
    );
    
    if (userRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const user = userRows[0];
    
    // 获取用户角色
    const [roleRows] = await connection.execute(`
      SELECT r.id, r.name, r.display_name, r.description, ur.created_at as assigned_at
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `, [userId]);
    
    // 获取用户权限
    const [permissionRows] = await connection.execute(`
      SELECT DISTINCT p.id, p.name, p.display_name, p.resource, p.action
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY p.resource, p.action
    `, [userId]);
    
    connection.release();
    
    res.json({
      ...user,
      roles: roleRows,
      permissions: permissionRows
    });
    
  } catch (error) {
    logger.error('获取用户详情错误', { error: error.message, userId });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新用户角色
router.put('/users/:userId/roles', async (req, res) => {
  try {
    const { userId } = req.params;
    const { role_ids, admin_user_id } = req.body;
    
    if (!Array.isArray(role_ids)) {
      return res.status(400).json({ error: 'role_ids 必须是数组' });
    }
    
    // 验证必需参数：需要管理员用户ID
    if (!admin_user_id) {
      return res.status(400).json({ 
        error: '缺少必需参数',
        required: ['admin_user_id']
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 检查操作者是否为超级管理员（角色ID=4）
      const [superAdminCheck] = await connection.execute(`
        SELECT COUNT(*) as is_super_admin
        FROM user_roles
        WHERE user_id = ? AND role_id = 4
      `, [admin_user_id]);
      
      if (superAdminCheck[0].is_super_admin === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ error: '只有超级管理员才能修改用户权限' });
      }
      
      // 检查用户是否存在
      const [userExists] = await connection.execute(
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );
      
      if (userExists.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: '用户不存在' });
      }
      
      // 验证所有角色是否存在
      if (role_ids.length > 0) {
        const placeholders = role_ids.map(() => '?').join(',');
        const [roleExists] = await connection.execute(
          `SELECT id FROM roles WHERE id IN (${placeholders})`,
          role_ids
        );
        
        if (roleExists.length !== role_ids.length) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: '部分角色不存在' });
        }
      }
      
      // 删除用户现有角色
      await connection.execute(
        'DELETE FROM user_roles WHERE user_id = ?',
        [userId]
      );
      
      // 添加新角色
      if (role_ids.length > 0) {
        for (const roleId of role_ids) {
          await connection.execute(
            'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES (?, ?, NULL)',
            [userId, roleId]
          );
        }
      }
      
      await connection.commit();
      connection.release();
      
      // 清除相关缓存
      await cacheUtils.delPattern('users:*');
      
      res.json({ message: '用户角色更新成功' });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('更新用户角色错误', { error: error.message, userId });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新用户信息
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, email, real_name, admin_user_id } = req.body;
    
    // 验证必需参数：需要管理员用户ID
    if (!admin_user_id) {
      return res.status(400).json({ 
        error: '缺少必需参数',
        required: ['admin_user_id']
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 检查操作者是否为超级管理员（角色ID=4）
      const [superAdminCheck] = await connection.execute(`
        SELECT COUNT(*) as is_super_admin
        FROM user_roles
        WHERE user_id = ? AND role_id = 4
      `, [admin_user_id]);
      
      if (superAdminCheck[0].is_super_admin === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ error: '只有超级管理员才能修改用户信息' });
      }
      
      // 检查用户是否存在
      const [userExists] = await connection.execute(
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );
      
      if (userExists.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: '用户不存在' });
      }
      
      // 构建更新字段
      const updateFields = [];
      const updateValues = [];
      
      if (username !== undefined) {
        // 检查用户名是否已被其他用户使用
        const [existingUser] = await connection.execute(
          'SELECT id FROM users WHERE username = ? AND id != ?',
          [username, userId]
        );
        
        if (existingUser.length > 0) {
          await connection.rollback();
          connection.release();
          return res.status(400).json({ error: '用户名已被使用' });
        }
        
        updateFields.push('username = ?');
        updateValues.push(username);
      }
      
      if (email !== undefined) {
        // 检查邮箱是否已被其他用户使用
        if (email) {
          const [existingEmail] = await connection.execute(
            'SELECT id FROM users WHERE email = ? AND id != ?',
            [email, userId]
          );
          
          if (existingEmail.length > 0) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({ error: '邮箱已被使用' });
          }
        }
        
        updateFields.push('email = ?');
        updateValues.push(email || null);
      }
      
      if (real_name !== undefined) {
        updateFields.push('real_name = ?');
        updateValues.push(real_name || null);
      }
      
      if (updateFields.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: '没有需要更新的字段' });
      }
      
      updateValues.push(userId);
      
      // 执行更新
      await connection.execute(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );
      
      await connection.commit();
      connection.release();
      
      // 清除相关缓存
      await cacheUtils.delPattern('users:*');
      
      res.json({ message: '用户信息更新成功' });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('更新用户信息错误', { error: error.message, userId });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除用户
router.delete('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { admin_user_id } = req.body; // 可选：执行删除操作的管理员ID
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 检查用户是否存在
      const [userRows] = await connection.execute(
        'SELECT id, username FROM users WHERE id = ?',
        [userId]
      );
      
      if (userRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userRows[0];
      
      // 验证必需参数：需要管理员用户ID
      if (!admin_user_id) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          error: '缺少必需参数',
          required: ['admin_user_id']
        });
      }
      
      // 检查操作者是否为超级管理员（角色ID=4）
      const [superAdminCheck] = await connection.execute(`
        SELECT COUNT(*) as is_super_admin
        FROM user_roles
        WHERE user_id = ? AND role_id = 4
      `, [admin_user_id]);
      
      if (superAdminCheck[0].is_super_admin === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ error: '只有超级管理员才能删除用户' });
      }
      
      // 检查是否有答题记录，如果有则不允许删除
      const [submissionCount] = await connection.execute(
        'SELECT COUNT(*) as count FROM submissions WHERE user_id = ?',
        [userId]
      );
      
      if (submissionCount[0].count > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          error: '该用户有答题记录，无法删除。如需删除请联系系统管理员。' 
        });
      }
      
      // 删除用户（由于设置了CASCADE，会自动删除相关的user_roles记录）
      await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
      
      await connection.commit();
      connection.release();
      
      // 清除相关缓存
      await cacheUtils.delPattern('users:*');
      
      logger.info('用户删除成功', { 
        deletedUserId: userId, 
        username: user.username,
        adminUserId: admin_user_id 
      });
      
      res.json({ 
        message: '用户删除成功',
        deleted_user: {
          id: userId,
          username: user.username
        }
      });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('删除用户错误', { error: error.message, userId });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 修改用户密码
router.put('/users/:userId/password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { old_password, new_password } = req.body;
    
    // 验证必需参数
    if (!old_password || !new_password) {
      return res.status(400).json({ 
        error: '缺少必需参数',
        required: ['old_password', 'new_password']
      });
    }
    
    // 验证新密码长度
    if (new_password.length < 6) {
      return res.status(400).json({ 
        error: '新密码长度不能少于6位' 
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 检查用户是否存在并验证旧密码
      const [userRows] = await connection.execute(
        'SELECT id, username, password FROM users WHERE id = ?',
        [userId]
      );
      
      if (userRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userRows[0];
      
      // 验证旧密码
      if (user.password !== old_password) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ error: '旧密码错误' });
      }
      
      // 更新密码
      await connection.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [new_password, userId]
      );
      
      await connection.commit();
      connection.release();
      
      // 清除相关缓存
      await cacheUtils.delPattern('users:*');
      
      logger.info('用户密码修改成功', { 
        userId: userId, 
        username: user.username
      });
      
      res.json({ message: '密码修改成功' });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('修改密码错误', { error: error.message, userId });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 管理员重置用户密码
router.put('/users/:userId/reset-password', async (req, res) => {
  try {
    const { userId } = req.params;
    const { admin_user_id } = req.body;
    const resetPassword = '123456'; // 默认重置密码
    
    // 验证必需参数
    if (!admin_user_id) {
      return res.status(400).json({ 
        error: '缺少必需参数',
        required: ['admin_user_id']
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 检查用户是否存在
      const [userRows] = await connection.execute(
        'SELECT id, username FROM users WHERE id = ?',
        [userId]
      );
      
      if (userRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ error: '用户不存在' });
      }
      
      const user = userRows[0];
      
      // 检查操作者是否为超级管理员（角色ID=4）
      const [superAdminCheck] = await connection.execute(`
        SELECT COUNT(*) as is_super_admin
        FROM user_roles
        WHERE user_id = ? AND role_id = 4
      `, [admin_user_id]);
      
      const isSuperAdmin = superAdminCheck[0].is_super_admin > 0;
      
      if (!isSuperAdmin) {
        // 非超级管理员：仅允许教师重置其绑定学生的密码
        const [teacherStudentCheck] = await connection.execute(
          'SELECT id FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
          [admin_user_id, userId]
        );
        if (teacherStudentCheck.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(403).json({ error: '只有超级管理员或该学生的指导教师才能重置密码' });
        }
      }
      
      // 重置密码
      await connection.execute(
        'UPDATE users SET password = ? WHERE id = ?',
        [resetPassword, userId]
      );
      
      await connection.commit();
      connection.release();
      
      // 清除相关缓存
      await cacheUtils.delPattern('users:*');
      
      logger.info('管理员重置用户密码成功', { 
        targetUserId: userId, 
        targetUsername: user.username,
        adminUserId: admin_user_id 
      });
      
      res.json({ 
        message: '密码重置成功',
        new_password: resetPassword,
        user: {
          id: userId,
          username: user.username
        }
      });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('重置密码错误', { error: error.message, userId });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 根据姓名查询用户（供家长端小程序使用）
router.get('/users/by-name', async (req, res) => {
  try {
    const { name } = req.query;
    
    // 验证必需参数
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: name'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 搜索真实姓名或用户名包含关键词的用户
      const [users] = await connection.execute(`
        SELECT 
          id,
          username,
          email,
          real_name,
          created_at
        FROM users
        WHERE real_name LIKE ? OR username LIKE ?
        ORDER BY 
          CASE 
            WHEN real_name LIKE ? THEN 1
            WHEN username LIKE ? THEN 2
            ELSE 3
          END,
          created_at DESC
        LIMIT 20
      `, [`%${name.trim()}%`, `%${name.trim()}%`, `%${name}%`, `%${name}%`]);
      
      connection.release();
      
      res.json({
        success: true,
        data: users
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('根据姓名查询用户失败:', error);
    res.status(500).json({ 
      success: false,
      error: '查询失败',
      message: error.message 
    });
  }
});

module.exports = router;
