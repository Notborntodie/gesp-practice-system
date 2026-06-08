const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, getValidCategories } = require('../config/database');
const { logger } = require('../config/logger');
const { cacheUtils } = require('../config/cache');
const { submitExamInternal } = require('./submissions');
const { submitOjInternal } = require('./oj');

// PDF 上传配置
const reviewUploadDir = 'uploads/review/';
if (!fs.existsSync(reviewUploadDir)) {
  fs.mkdirSync(reviewUploadDir, { recursive: true });
}



const reviewStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, reviewUploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'review-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const reviewUpload = multer({
  storage: reviewStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: function (req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只支持 PDF 文件'), false);
    }
  }
});

function getUserId(req) {
  const id = req.body?.user_id ?? req.query?.user_id;
  if (id == null || id === '') return null;
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
}

function getOptionalInt(value) {
  if (value == null || value === '') return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

async function isAdminOrSuperAdmin(connection, user_id) {
  if (!user_id) return false;
  const [rows] = await connection.execute(
    `SELECT 1 FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ? AND r.name IN ('admin', 'super_admin')`,
    [user_id]
  );
  return rows.length > 0;
}

// 计划分配页轻量查询：返回指定计划已分配的学生ID
router.get('/learning-plans/:planId/student-ids', async (req, res) => {
  const planId = getOptionalInt(req.params.planId);
  const teacherId = getOptionalInt(req.query.teacher_id);

  if (!planId) {
    return res.status(400).json({ success: false, error: '无效的计划ID' });
  }

  const connection = await pool.getConnection();
  try {
    const [planRows] = await connection.execute(
      'SELECT id FROM learning_plans WHERE id = ?',
      [planId]
    );

    if (planRows.length === 0) {
      return res.status(404).json({ success: false, error: '学习计划不存在' });
    }

    let sql = `
      SELECT DISTINCT ulp.user_id
      FROM user_learning_plans ulp
      WHERE ulp.plan_id = ?
    `;
    const params = [planId];

    if (teacherId) {
      sql += `
        AND EXISTS (
          SELECT 1
          FROM teacher_students ts
          WHERE ts.teacher_id = ? AND ts.student_id = ulp.user_id
        )
      `;
      params.push(teacherId);
    }

    sql += ' ORDER BY ulp.user_id ASC';

    const [rows] = await connection.execute(sql, params);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json({
      success: true,
      data: rows.map(row => row.user_id)
    });
  } catch (error) {
    logger.error('获取计划已分配学生ID失败:', error);
    res.status(500).json({ success: false, error: '获取计划已分配学生ID失败' });
  } finally {
    connection.release();
  }
});

// ==================== 1. 获取我的学习计划列表 ====================
router.get('/learning-plans/my-plans', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    // 验证必需参数
    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 获取用户加入的学习计划及进度
      const [plans] = await connection.execute(`
        SELECT 
          lp.id,
          lp.name,
          lp.description,
          lp.level,
          lp.start_time,
          lp.end_time,
          ulp.status,
          ulp.joined_at,
          COUNT(DISTINCT lt.id) as total_tasks,
          COUNT(DISTINCT CASE WHEN utp.is_completed = 1 THEN utp.task_id END) as completed_tasks,
          CASE 
            WHEN COUNT(DISTINCT lt.id) > 0 
            THEN ROUND(COUNT(DISTINCT CASE WHEN utp.is_completed = 1 THEN utp.task_id END) * 100.0 / COUNT(DISTINCT lt.id), 0)
            ELSE 0 
          END as progress
        FROM user_learning_plans ulp
        JOIN learning_plans lp ON ulp.plan_id = lp.id
        LEFT JOIN learning_tasks lt ON lp.id = lt.plan_id
        LEFT JOIN user_task_progress utp ON lt.id = utp.task_id AND utp.user_id = ulp.user_id
        WHERE ulp.user_id = ? AND lp.is_active = 1
        GROUP BY lp.id, lp.name, lp.description, lp.level, lp.start_time, lp.end_time, ulp.status, ulp.joined_at
        ORDER BY ulp.joined_at DESC
      `, [user_id]);
      
      connection.release();
      
      res.json({
        success: true,
        data: plans
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取学习计划列表失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取学习计划列表失败',
      message: error.message 
    });
  }
});

// ==================== 2. 获取所有学习计划列表 ====================
router.get('/learning-plans/all', async (req, res) => {
  try {
    const { level, category, is_active } = req.query;

    const connection = await pool.getConnection();

    try {
      let query = `
        SELECT
          lp.id,
          lp.name,
          lp.description,
          lp.level,
          lp.category,
          lp.start_time,
          lp.end_time,
          lp.is_active,
          lp.created_at,
          lp.updated_at,
          lp.public_progress_token,
          lp.public_progress_enabled,
          COUNT(DISTINCT lt.id) as total_tasks,
          COUNT(DISTINCT te.exam_id) as total_exams,
          COUNT(DISTINCT top.problem_id) as total_oj_problems
        FROM learning_plans lp
        LEFT JOIN learning_tasks lt ON lp.id = lt.plan_id
        LEFT JOIN task_exams te ON lt.id = te.task_id
        LEFT JOIN task_oj_problems top ON lt.id = top.task_id
        WHERE 1=1
      `;

      const params = [];

      // 如果指定了题目来源，添加分类过滤
      if (category) {
        query += ' AND lp.category = ?';
        params.push(category);
      }

      // 如果指定了级别，添加级别过滤
      if (level) {
        query += ' AND lp.level = ?';
        params.push(level);
      }

      // 如果指定了状态，添加状态过滤
      if (is_active !== undefined) {
        query += ' AND lp.is_active = ?';
        params.push(is_active);
      }

      query += `
        GROUP BY lp.id, lp.name, lp.description, lp.level, lp.category, lp.start_time, lp.end_time,
                 lp.is_active, lp.created_at, lp.updated_at, lp.public_progress_token, lp.public_progress_enabled
        ORDER BY lp.created_at DESC
      `;
      
      const [plans] = await connection.execute(query, params);
      
      connection.release();
      
      res.json({
        success: true,
        data: plans
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取所有学习计划列表失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取所有学习计划列表失败',
      message: error.message 
    });
  }
});

// ==================== 2.1 教师按学生聚合查看计划完成概览 ====================
router.get('/learning-plans/teacher/:teacherId/student-plans-progress', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { level, is_active = '1' } = req.query;

    const connection = await pool.getConnection();

    try {
      const [students] = await connection.execute(`
        SELECT DISTINCT
          u.id,
          u.username,
          u.real_name,
          ts.class_no
        FROM users u
        JOIN teacher_students ts ON u.id = ts.student_id
        WHERE ts.teacher_id = ?
        ORDER BY COALESCE(ts.class_no, ''), COALESCE(u.real_name, u.username), u.username
      `, [teacherId]);

      if (students.length === 0) {
        connection.release();
        return res.json({
          success: true,
          data: {
            students: []
          }
        });
      }

      let planQuery = `
        SELECT
          u.id as student_id,
          lp.id as plan_id,
          lp.name,
          lp.description,
          lp.level,
          lp.start_time,
          lp.end_time,
          lp.is_active,
          ulp.status,
          ulp.joined_at,
          COALESCE(task_counts.total_tasks, 0) as total_tasks,
          COALESCE(upp.completed_tasks, completed_task_counts.completed_tasks, 0) as completed_tasks,
          COALESCE(upp.is_completed, 0) as is_completed,
          upp.completed_at
        FROM users u
        JOIN teacher_students ts ON u.id = ts.student_id
        JOIN user_learning_plans ulp ON ulp.user_id = u.id
        JOIN learning_plans lp ON lp.id = ulp.plan_id
        LEFT JOIN user_plan_progress upp ON upp.user_id = u.id AND upp.plan_id = lp.id
        LEFT JOIN (
          SELECT plan_id, COUNT(*) as total_tasks
          FROM learning_tasks
          GROUP BY plan_id
        ) task_counts ON task_counts.plan_id = lp.id
        LEFT JOIN (
          SELECT lt.plan_id, utp.user_id, COUNT(*) as completed_tasks
          FROM user_task_progress utp
          JOIN learning_tasks lt ON lt.id = utp.task_id
          WHERE utp.is_completed = 1
          GROUP BY lt.plan_id, utp.user_id
        ) completed_task_counts ON completed_task_counts.plan_id = lp.id AND completed_task_counts.user_id = u.id
        WHERE ts.teacher_id = ?
      `;
      const params = [teacherId];

      if (level) {
        planQuery += ' AND lp.level = ?';
        params.push(level);
      }

      if (is_active !== undefined && is_active !== '') {
        planQuery += ' AND lp.is_active = ?';
        params.push(is_active);
      }

      planQuery += ' ORDER BY COALESCE(u.real_name, u.username), lp.start_time DESC, lp.created_at DESC';

      const [planRows] = await connection.execute(planQuery, params);

      const plansByStudentId = new Map();
      for (const row of planRows) {
        const totalTasks = Number(row.total_tasks || 0);
        const completedTasks = Number(row.completed_tasks || 0);
        const progressRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        if (!plansByStudentId.has(row.student_id)) {
          plansByStudentId.set(row.student_id, []);
        }
        plansByStudentId.get(row.student_id).push({
          id: row.plan_id,
          name: row.name,
          description: row.description,
          level: row.level,
          start_time: row.start_time,
          end_time: row.end_time,
          is_active: row.is_active,
          status: row.status,
          joined_at: row.joined_at,
          plan_progress: {
            is_completed: row.is_completed === 1 || row.is_completed === true,
            completed_tasks: completedTasks,
            total_tasks: totalTasks,
            progress_rate: progressRate,
            completed_at: row.completed_at
          }
        });
      }

      const result = students.map(student => {
        const plans = plansByStudentId.get(student.id) || [];
        return {
          student_id: student.id,
          username: student.username,
          real_name: student.real_name,
          class_no: student.class_no,
          plan_count: plans.length,
          completed_plan_count: plans.filter(plan => plan.plan_progress.is_completed).length,
          plans
        };
      }).filter(student => !level || student.plan_count > 0);

      connection.release();

      res.json({
        success: true,
        data: {
          students: result
        }
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('教师按学生聚合查看计划完成概览失败:', error);
    res.status(500).json({
      success: false,
      error: '教师按学生聚合查看计划完成概览失败',
      message: error.message
    });
  }
});

// ==================== 3. 获取可加入的计划列表 ====================
router.get('/learning-plans/available', async (req, res) => {
  try {
    const { user_id, level } = req.query;
    
    // 验证必需参数
    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      let query = `
        SELECT 
          lp.id,
          lp.name,
          lp.description,
          lp.level,
          lp.start_time,
          lp.end_time,
          lp.created_at,
          COUNT(DISTINCT lt.id) as total_tasks
        FROM learning_plans lp
        LEFT JOIN learning_tasks lt ON lp.id = lt.plan_id
        LEFT JOIN user_learning_plans ulp ON lp.id = ulp.plan_id AND ulp.user_id = ?
        WHERE lp.is_active = 1 
          AND ulp.id IS NULL
      `;
      
      const params = [user_id];
      
      // 如果指定了级别，添加级别过滤
      if (level) {
        query += ' AND lp.level = ?';
        params.push(level);
      }
      
      query += `
        GROUP BY lp.id, lp.name, lp.description, lp.level, lp.start_time, lp.end_time, lp.created_at
        ORDER BY lp.start_time DESC
      `;
      
      const [plans] = await connection.execute(query, params);
      
      connection.release();
      
      res.json({
        success: true,
        data: plans
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取可加入计划列表失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取可加入计划列表失败',
      message: error.message 
    });
  }
});

// ==================== 4. 加入学习计划 ====================
router.post('/learning-plans/join', async (req, res) => {
  try {
    const { user_id, plan_id } = req.body;
    
    // 验证必需参数
    if (!user_id || !plan_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id, plan_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 检查计划是否存在且有效
      const [planRows] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ? AND is_active = 1',
        [plan_id]
      );
      
      if (planRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学习计划不存在或已停用' 
        });
      }
      
      // 检查用户是否已加入该计划
      const [existingRows] = await connection.execute(
        'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
        [user_id, plan_id]
      );
      
      if (existingRows.length > 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          success: false,
          error: '您已加入该学习计划' 
        });
      }
      
      // 加入学习计划
      await connection.execute(
        'INSERT INTO user_learning_plans (user_id, plan_id, status) VALUES (?, ?, ?)',
        [user_id, plan_id, 'active']
      );
      
      // 为该计划的所有任务创建进度记录
      await connection.execute(`
        INSERT INTO user_task_progress (user_id, task_id, is_completed)
        SELECT ?, id, FALSE
        FROM learning_tasks
        WHERE plan_id = ?
      `, [user_id, plan_id]);
      
      // 为该计划的所有客观题创建进度记录
      await connection.execute(`
        INSERT INTO user_exam_progress (user_id, exam_id, is_completed, best_score, attempt_count)
        SELECT ?, te.exam_id, FALSE, 0, 0
        FROM task_exams te
        JOIN learning_tasks lt ON te.task_id = lt.id
        WHERE lt.plan_id = ?
        ON DUPLICATE KEY UPDATE
          is_completed = FALSE,
          best_score = 0,
          attempt_count = 0,
          completed_at = NULL
      `, [user_id, plan_id]);
      
      // 为该计划的所有OJ题目创建进度记录
      await connection.execute(`
        INSERT INTO user_oj_progress (user_id, problem_id, is_completed, best_verdict, attempt_count)
        SELECT ?, top.problem_id, FALSE, NULL, 0
        FROM task_oj_problems top
        JOIN learning_tasks lt ON top.task_id = lt.id
        WHERE lt.plan_id = ?
        ON DUPLICATE KEY UPDATE
          is_completed = FALSE,
          best_verdict = NULL,
          attempt_count = 0,
          completed_at = NULL
      `, [user_id, plan_id]);
      
      await connection.commit();
      connection.release();
      
      res.json({
        success: true,
        message: '成功加入学习计划'
      });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('加入学习计划失败:', error);
    res.status(500).json({ 
      success: false,
      error: '加入学习计划失败',
      message: error.message 
    });
  }
});

// ==================== 5. 获取学习计划完整信息（管理员专用） ====================
router.get('/learning-plans/:id/admin', async (req, res) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.getConnection();
    
    try {
      // 1. 获取学习计划基本信息
      const [planRows] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [id]
      );
      
      if (planRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学习计划不存在' 
        });
      }
      
      const plan = planRows[0];
      
      // 2. 获取所有任务
      const [tasksRows] = await connection.execute(`
        SELECT 
          lt.*
        FROM learning_tasks lt
        WHERE lt.plan_id = ?
        ORDER BY lt.task_order, lt.start_time
      `, [id]);
      
      // 3. 为每个任务获取关联的客观题和 OJ 题目
      const tasks = [];
      for (const task of tasksRows) {
        // 获取客观题列表（包含详细信息）
        const [examsRows] = await connection.execute(`
          SELECT 
            e.id as exam_id,
            e.name as exam_name,
            e.description as exam_description,
            e.level as exam_level,
            e.type as exam_type,
            e.total_questions,
            te.exam_order
          FROM task_exams te
          JOIN exams e ON te.exam_id = e.id
          WHERE te.task_id = ?
          ORDER BY te.exam_order
        `, [task.id]);
        
        // 获取 OJ 题目列表（包含详细信息）
        const [ojProblemsRows] = await connection.execute(`
          SELECT 
            op.id as problem_id,
            op.title as problem_title,
            op.description as problem_description,
            op.level as problem_level,
            op.time_limit,
            op.memory_limit,
            top.problem_order
          FROM task_oj_problems top
          JOIN oj_problems op ON top.problem_id = op.id
          WHERE top.task_id = ?
          ORDER BY top.problem_order
        `, [task.id]);
        
        tasks.push({
          ...task,
          exams: examsRows,
          oj_problems: ojProblemsRows
        });
      }
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          ...plan,
          tasks: tasks
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取学习计划完整信息失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取学习计划完整信息失败',
      message: error.message 
    });
  }
});

// ==================== 5.1 开启学习计划公开成长进度（分享链接/二维码） ====================
router.post('/learning-plans/:id/enable-public-progress', async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const connection = await pool.getConnection();
    const allowed = await isAdminOrSuperAdmin(connection, user_id);
    if (!allowed) {
      connection.release();
      return res.status(403).json({ error: '无权操作' });
    }
    const [p] = await connection.execute(
      'SELECT id, public_progress_token, public_progress_enabled FROM learning_plans WHERE id = ?',
      [planId]
    );
    if (p.length === 0) {
      connection.release();
      return res.status(404).json({ error: '学习计划不存在' });
    }
    let token = p[0].public_progress_token;
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      await connection.execute(
        'UPDATE learning_plans SET public_progress_token = ?, public_progress_enabled = 1 WHERE id = ?',
        [token, planId]
      );
    } else {
      await connection.execute('UPDATE learning_plans SET public_progress_enabled = 1 WHERE id = ?', [planId]);
    }
    connection.release();
    res.json({ ok: true, public_progress_token: token });
  } catch (e) {
    logger.error('POST learning-plans enable-public-progress', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 5.2 公开成长进度：config ====================
router.get('/public-plans/:token/config', async (req, res) => {
  try {
    const token = req.params.token;
    const connection = await pool.getConnection();
    const [p] = await connection.execute(
      'SELECT id, name, description, public_progress_enabled FROM learning_plans WHERE public_progress_token = ?',
      [token]
    );
    connection.release();
    if (p.length === 0) return res.status(404).json({ error: 'INVALID_TOKEN' });
    const plan = p[0];
    if (!plan.public_progress_enabled) {
      return res.json({ allow_query: false, reason: 'NOT_ENABLED' });
    }
    return res.json({
      allow_query: true,
      plan_name: plan.name,
      description: plan.description || null
    });
  } catch (e) {
    logger.error('GET public-plans/:token/config', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 5.3 公开成长进度：query（按姓名查，重名时优先完成度更高的学员） ====================
router.post('/public-plans/:token/query', async (req, res) => {
  try {
    const token = req.params.token;
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: '请提供姓名', found: false });
    }
    const trimName = name.trim();
    const connection = await pool.getConnection();
    const [p] = await connection.execute(
      'SELECT id, name, public_progress_enabled FROM learning_plans WHERE public_progress_token = ?',
      [token]
    );
    if (p.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'INVALID_TOKEN' });
    }
    const plan = p[0];
    if (!plan.public_progress_enabled) {
      connection.release();
      return res.status(403).json({ allow_query: false });
    }
    const planId = plan.id;
    // 姓名同时按 real_name 与 username 匹配，多命中时按完成度优先再 real_name 优先
    const userSql = `
      SELECT u.id, u.username, u.real_name,
        (SELECT COUNT(DISTINCT CASE WHEN utp.is_completed = 1 THEN utp.task_id END)
         FROM user_learning_plans ulp
         JOIN learning_tasks lt ON lt.plan_id = ulp.plan_id
         LEFT JOIN user_task_progress utp ON utp.task_id = lt.id AND utp.user_id = ulp.user_id
         WHERE ulp.user_id = u.id AND ulp.plan_id = ?) as completed_tasks
      FROM users u
      WHERE (TRIM(u.real_name) = ? OR u.username = ?)
        AND EXISTS (SELECT 1 FROM user_learning_plans ulp2 WHERE ulp2.user_id = u.id AND ulp2.plan_id = ?)
    `;
    const userParams = [planId, trimName, trimName, planId];
    const [users] = await connection.execute(userSql, userParams);
    if (users.length === 0) {
      connection.release();
      return res.json({ found: false });
    }
    users.sort((a, b) => (Number(b.completed_tasks) || 0) - (Number(a.completed_tasks) || 0));
    const user = users[0];
    const [progressRows] = await connection.execute(
      `SELECT COUNT(DISTINCT lt.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN utp.is_completed = 1 THEN utp.task_id END) as completed_tasks
       FROM user_learning_plans ulp
       JOIN learning_tasks lt ON lt.plan_id = ulp.plan_id
       LEFT JOIN user_task_progress utp ON utp.task_id = lt.id AND utp.user_id = ulp.user_id
       WHERE ulp.user_id = ? AND ulp.plan_id = ?`,
      [user.id, planId]
    );
    const row = progressRows[0];
    const total_tasks = Number(row.total_tasks) || 0;
    const completed_tasks = Number(row.completed_tasks) || 0;
    const progress = total_tasks > 0 ? Math.round((completed_tasks * 100) / total_tasks) : 0;

    const [taskRows] = await connection.execute(`
      SELECT
        lt.id,
        lt.name,
        lt.description,
        lt.start_time,
        lt.end_time,
        lt.task_order,
        lt.is_exam_mode,
        COALESCE(utp.is_completed, 0) as is_completed,
        utp.completed_at
      FROM learning_tasks lt
      LEFT JOIN user_task_progress utp ON lt.id = utp.task_id AND utp.user_id = ?
      WHERE lt.plan_id = ?
      ORDER BY lt.task_order, lt.start_time, lt.id
    `, [user.id, planId]);

    const tasks = [];
    for (const task of taskRows) {
      const [examRows] = await connection.execute(`
        SELECT
          e.id,
          e.name,
          e.level,
          e.type,
          te.exam_order,
          COALESCE(uep.is_completed, 0) as is_completed,
          COALESCE(uep.best_score, 0) as best_score,
          COALESCE(uep.attempt_count, 0) as attempt_count,
          uep.completed_at
        FROM task_exams te
        JOIN exams e ON te.exam_id = e.id
        LEFT JOIN user_exam_progress uep ON e.id = uep.exam_id
          AND uep.user_id = ? AND uep.task_id = ?
        WHERE te.task_id = ?
        ORDER BY te.exam_order, e.id
      `, [user.id, task.id, task.id]);

      const [ojRows] = await connection.execute(`
        SELECT
          op.id,
          op.title,
          op.level,
          top.problem_order,
          COALESCE(uop.is_completed, 0) as is_completed,
          uop.best_verdict,
          COALESCE(uop.attempt_count, 0) as attempt_count,
          uop.completed_at,
          COALESCE((
            SELECT MAX(CASE WHEN os.total_tests > 0 THEN ROUND(os.passed_tests * 100.0 / os.total_tests, 0) ELSE 0 END)
            FROM oj_submissions os
            WHERE os.problem_id = op.id
              AND os.user_id = ?
              AND os.task_id = ?
              AND os.status = 'completed'
          ), 0) as best_pass_rate
        FROM task_oj_problems top
        JOIN oj_problems op ON top.problem_id = op.id
        LEFT JOIN user_oj_progress uop ON op.id = uop.problem_id
          AND uop.user_id = ? AND uop.task_id = ?
        WHERE top.task_id = ?
        ORDER BY top.problem_order, op.id
      `, [user.id, task.id, user.id, task.id, task.id]);

      const completedExams = examRows.filter(e => Number(e.is_completed) === 1 || e.is_completed === true).length;
      const completedOjs = ojRows.filter(o => Number(o.is_completed) === 1 || o.is_completed === true).length;

      tasks.push({
        id: task.id,
        name: task.name,
        description: task.description,
        start_time: task.start_time,
        end_time: task.end_time,
        task_order: task.task_order,
        is_exam_mode: !!task.is_exam_mode,
        is_completed: Number(task.is_completed) === 1 || task.is_completed === true,
        completed_at: task.completed_at,
        exam_progress: {
          total: examRows.length,
          completed: completedExams,
          progress_rate: examRows.length > 0 ? Math.round((completedExams * 100) / examRows.length) : 0,
          exams: examRows.map(exam => ({
            id: exam.id,
            name: exam.name,
            level: exam.level,
            type: exam.type,
            is_completed: Number(exam.is_completed) === 1 || exam.is_completed === true,
            best_score: Number(exam.best_score) || 0,
            attempt_count: Number(exam.attempt_count) || 0,
            completed_at: exam.completed_at
          }))
        },
        oj_progress: {
          total: ojRows.length,
          completed: completedOjs,
          progress_rate: ojRows.length > 0 ? Math.round((completedOjs * 100) / ojRows.length) : 0,
          problems: ojRows.map(problem => ({
            id: problem.id,
            title: problem.title,
            level: problem.level,
            is_completed: Number(problem.is_completed) === 1 || problem.is_completed === true,
            best_verdict: problem.best_verdict,
            best_pass_rate: Number(problem.best_pass_rate) || 0,
            score: Number(problem.best_pass_rate) || 0,
            attempt_count: Number(problem.attempt_count) || 0,
            completed_at: problem.completed_at
          }))
        }
      });
    }

    connection.release();
    res.json({
      found: true,
      name: user.real_name || user.username,
      plan_name: plan.name,
      completed_tasks,
      total_tasks,
      progress,
      tasks
    });
  } catch (e) {
    logger.error('POST public-plans/:token/query', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 6. 获取计划的任务列表 ====================
router.get('/learning-plans/:planId/tasks', async (req, res) => {
  try {
    const { planId } = req.params;
    const { user_id } = req.query;
    
    // 验证必需参数
    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 获取计划基本信息
      const [planRows] = await connection.execute(`
        SELECT 
          lp.id,
          lp.name,
          lp.description,
          lp.level,
          lp.start_time,
          lp.end_time,
          COUNT(DISTINCT lt.id) as total_tasks,
          COUNT(DISTINCT CASE WHEN utp.is_completed = 1 THEN utp.task_id END) as completed_tasks,
          CASE 
            WHEN COUNT(DISTINCT lt.id) > 0 
            THEN ROUND(COUNT(DISTINCT CASE WHEN utp.is_completed = 1 THEN utp.task_id END) * 100.0 / COUNT(DISTINCT lt.id), 0)
            ELSE 0 
          END as progress
        FROM learning_plans lp
        LEFT JOIN learning_tasks lt ON lp.id = lt.plan_id
        LEFT JOIN user_task_progress utp ON lt.id = utp.task_id AND utp.user_id = ?
        WHERE lp.id = ? AND lp.is_active = 1
        GROUP BY lp.id, lp.name, lp.description, lp.level, lp.start_time, lp.end_time
      `, [user_id, planId]);
      
      if (planRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学习计划不存在' 
        });
      }
      
      // 检查用户是否加入了该计划
      const [joinedRows] = await connection.execute(
        'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
        [user_id, planId]
      );
      
      if (joinedRows.length === 0) {
        connection.release();
        return res.status(403).json({ 
          success: false,
          error: '您尚未加入该学习计划' 
        });
      }
      
      // 获取任务列表及进度
      const [tasks] = await connection.execute(`
        SELECT 
          lt.id,
          lt.name,
          lt.description,
          lt.review_content,
          lt.review_video_url,
          lt.start_time,
          lt.end_time,
          lt.task_order,
          lt.is_exam_mode,
          COALESCE(utp.is_completed, 0) as is_completed,
          utp.completed_at,
          COUNT(DISTINCT te.exam_id) as exam_count,
          COUNT(DISTINCT top.problem_id) as oj_count
        FROM learning_tasks lt
        LEFT JOIN user_task_progress utp ON lt.id = utp.task_id AND utp.user_id = ?
        LEFT JOIN task_exams te ON lt.id = te.task_id
        LEFT JOIN task_oj_problems top ON lt.id = top.task_id
        WHERE lt.plan_id = ?
        GROUP BY lt.id, lt.name, lt.description, lt.review_content, lt.review_video_url, 
                 lt.start_time, lt.end_time, lt.task_order, lt.is_exam_mode, utp.is_completed, utp.completed_at
        ORDER BY lt.task_order, lt.start_time
      `, [user_id, planId]);
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          plan: planRows[0],
          tasks: tasks
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取任务列表失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取任务列表失败',
      message: error.message 
    });
  }
});

// ==================== 7. 获取任务的练习列表 ====================
router.get('/learning-tasks/:taskId/exercises', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id } = req.query;
    
    // 验证必需参数
    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 获取任务基本信息
      const [taskRows] = await connection.execute(`
        SELECT 
          lt.id,
          lt.plan_id,
          lt.name,
          lt.description,
          lt.review_content,
          lt.review_content_type,
          lt.review_video_url,
          lt.start_time,
          lt.end_time,
          lt.is_exam_mode
        FROM learning_tasks lt
        WHERE lt.id = ?
      `, [taskId]);
      
      if (taskRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '任务不存在' 
        });
      }
      
      const task = taskRows[0];
      
      // 检查用户是否加入了该计划
      const [joinedRows] = await connection.execute(
        'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
        [user_id, task.plan_id]
      );
      
      if (joinedRows.length === 0) {
        connection.release();
        return res.status(403).json({ 
          success: false,
          error: '您尚未加入该学习计划' 
        });
      }
      
      // 获取客观题练习列表（只返回完成状态）
      const [exams] = await connection.execute(`
        SELECT 
          e.id,
          e.name,
          CASE 
            WHEN uep.is_completed IS NULL THEN 0
            ELSE uep.is_completed 
          END as is_completed
        FROM task_exams te
        JOIN exams e ON te.exam_id = e.id
        LEFT JOIN user_exam_progress uep ON e.id = uep.exam_id AND uep.user_id = ?
        WHERE te.task_id = ?
        ORDER BY te.exam_order
      `, [user_id, taskId]);
      
      // 获取OJ题目列表（只返回完成状态）
      const [ojProblems] = await connection.execute(`
        SELECT 
          op.id,
          op.title,
          CASE 
            WHEN uop.is_completed IS NULL THEN 0
            ELSE uop.is_completed 
          END as is_completed
        FROM task_oj_problems top
        JOIN oj_problems op ON top.problem_id = op.id
        LEFT JOIN user_oj_progress uop ON op.id = uop.problem_id AND uop.user_id = ?
        WHERE top.task_id = ?
        ORDER BY top.problem_order
      `, [user_id, taskId]);
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          task: {
            id: task.id,
            name: task.name,
            description: task.description,
            review_content: task.review_content,
            review_content_type: task.review_content_type || 'text',
            review_video_url: task.review_video_url,
            is_exam_mode: task.is_exam_mode,
            start_time: task.start_time,
            end_time: task.end_time
          },
          exams: exams,
          oj_problems: ojProblems
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取练习列表失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取练习列表失败',
      message: error.message 
    });
  }
});

// ==================== 8. 标记任务完成 ====================
router.post('/learning-tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id } = req.body;
    
    // 验证必需参数
    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 检查任务是否存在
      const [taskRows] = await connection.execute(
        'SELECT * FROM learning_tasks WHERE id = ?',
        [taskId]
      );
      
      if (taskRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '任务不存在' 
        });
      }
      
      // 检查用户是否加入了该计划
      const [joinedRows] = await connection.execute(
        'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
        [user_id, taskRows[0].plan_id]
      );
      
      if (joinedRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ 
          success: false,
          error: '您尚未加入该学习计划' 
        });
      }
      
      // 更新任务完成状态
      await connection.execute(`
        INSERT INTO user_task_progress (user_id, task_id, is_completed, completed_at)
        VALUES (?, ?, TRUE, NOW())
        ON DUPLICATE KEY UPDATE 
          is_completed = TRUE,
          completed_at = NOW(),
          updated_at = NOW()
      `, [user_id, taskId]);
      
      const plan_id = taskRows[0].plan_id;
      
      // 异步更新计划完成状态并清除缓存
      await updatePlanCompletionStatus(connection, user_id, plan_id);
      
      await connection.commit();
      connection.release();
      
      res.json({
        success: true,
        message: '任务已标记为完成'
      });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('标记任务完成失败:', error);
    res.status(500).json({ 
      success: false,
      error: '标记任务完成失败',
      message: error.message 
    });
  }
});

// ==================== 9. 创建学习计划（整体含任务和练习） ====================
router.post('/learning-plans', async (req, res) => {
  try {
    const { name, description, level, category = 'GESP', start_time, end_time, tasks } = req.body;

    // 验证必需参数
    if (!name) {
      return res.status(400).json({
        success: false,
        error: '缺少必需参数: name'
      });
    }

    // 验证 category 参数（如果提供）
    if (category) {
      const validCategories = await getValidCategories();
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: `category 必须是以下值之一：${validCategories.join(', ')}`
        });
      }
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 创建学习计划
      const [planResult] = await connection.execute(`
        INSERT INTO learning_plans (name, description, level, category, start_time, end_time, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `, [
        name,
        description || null,
        level || null,
        category || 'GESP',
        start_time || null,
        end_time || null
      ]);
      
      const planId = planResult.insertId;
      
      // 2. 如果有任务列表，创建任务及关联的练习
      if (tasks && Array.isArray(tasks) && tasks.length > 0) {
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          
          // 创建任务
          const [taskResult] = await connection.execute(`
            INSERT INTO learning_tasks 
            (plan_id, name, description, review_content, review_content_type, review_video_url, start_time, end_time, task_order, is_exam_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            planId,
            task.name || `任务${i + 1}`,
            task.description || null,
            task.review_content || null,
            task.review_content_type || 'text',
            task.review_video_url || null,
            task.start_time || null,
            task.end_time || null,
            task.task_order !== undefined ? task.task_order : i + 1,
            task.is_exam_mode || 0
          ]);
          
          const taskId = taskResult.insertId;
          
          // 关联客观题（exams）
          if (task.exams && Array.isArray(task.exams) && task.exams.length > 0) {
            for (let j = 0; j < task.exams.length; j++) {
              const exam = task.exams[j];
              await connection.execute(`
                INSERT INTO task_exams (task_id, exam_id, exam_order)
                VALUES (?, ?, ?)
              `, [
                taskId,
                exam.exam_id,
                exam.exam_order !== undefined ? exam.exam_order : j + 1
              ]);
            }
          }
          
          // 关联OJ题目（oj_problems）
          if (task.oj_problems && Array.isArray(task.oj_problems) && task.oj_problems.length > 0) {
            for (let j = 0; j < task.oj_problems.length; j++) {
              const problem = task.oj_problems[j];
              await connection.execute(`
                INSERT INTO task_oj_problems (task_id, problem_id, problem_order)
                VALUES (?, ?, ?)
              `, [
                taskId,
                problem.problem_id,
                problem.problem_order !== undefined ? problem.problem_order : j + 1
              ]);
            }
          }
        }
      }
      
      // 获取完整的学习计划信息（包含任务）
      const [planData] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [planId]
      );
      
      const [tasksData] = await connection.execute(`
        SELECT 
          lt.*,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('exam_id', te.exam_id, 'exam_order', te.exam_order))
           FROM task_exams te WHERE te.task_id = lt.id) as exams,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('problem_id', top.problem_id, 'problem_order', top.problem_order))
           FROM task_oj_problems top WHERE top.task_id = lt.id) as oj_problems
        FROM learning_tasks lt
        WHERE lt.plan_id = ?
        ORDER BY lt.task_order, lt.start_time
      `, [planId]);
      
      await connection.commit();
      connection.release();
      
      res.json({
        success: true,
        message: '学习计划创建成功',
        data: {
          ...planData[0],
          tasks: tasksData
        }
      });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('创建学习计划失败:', error);
    res.status(500).json({ 
      success: false,
      error: '创建学习计划失败',
      message: error.message 
    });
  }
});

// ==================== 9.5 删除学习计划 ====================
router.delete('/learning-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 检查计划是否存在
      const [plans] = await connection.execute('SELECT id FROM learning_plans WHERE id = ?', [planId]);
      if (plans.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, error: '学习计划不存在' });
      }

      // 删除用户计划关联
      await connection.execute('DELETE FROM user_learning_plans WHERE plan_id = ?', [planId]);

      // 删除用户任务进度
      await connection.execute(
        'DELETE FROM user_task_progress WHERE task_id IN (SELECT id FROM learning_tasks WHERE plan_id = ?)',
        [planId]
      );

      // 删除用户考试进度
      await connection.execute(
        'DELETE FROM user_exam_progress WHERE task_id IN (SELECT id FROM learning_tasks WHERE plan_id = ?)',
        [planId]
      );

      // 删除用户OJ进度
      await connection.execute(
        'DELETE FROM user_oj_progress WHERE task_id IN (SELECT id FROM learning_tasks WHERE plan_id = ?)',
        [planId]
      );

      // 删除用户计划进度
      await connection.execute('DELETE FROM user_plan_progress WHERE plan_id = ?', [planId]);

      // 删除任务考试关联
      await connection.execute(
        'DELETE FROM task_exams WHERE task_id IN (SELECT id FROM learning_tasks WHERE plan_id = ?)',
        [planId]
      );

      // 删除任务OJ关联
      await connection.execute(
        'DELETE FROM task_oj_problems WHERE task_id IN (SELECT id FROM learning_tasks WHERE plan_id = ?)',
        [planId]
      );

      // 删除任务
      await connection.execute('DELETE FROM learning_tasks WHERE plan_id = ?', [planId]);

      // 删除计划
      await connection.execute('DELETE FROM learning_plans WHERE id = ?', [planId]);

      await connection.commit();
      connection.release();

      res.json({ success: true, message: '学习计划删除成功' });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('删除学习计划失败:', error);
    res.status(500).json({ success: false, error: '删除学习计划失败', message: error.message });
  }
});

// ==================== 10. 编辑学习计划（整体含任务和练习） ====================
router.put('/learning-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    const { name, description, level, category, start_time, end_time, is_active, tasks } = req.body;

    // 验证 category 参数（如果提供）
    if (category !== undefined) {
      const validCategories = await getValidCategories();
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          error: `category 必须是以下值之一：${validCategories.join(', ')}`
        });
      }
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. 检查学习计划是否存在
      const [existingPlan] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [planId]
      );

      if (existingPlan.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          success: false,
          error: '学习计划不存在'
        });
      }

      // 2. 更新学习计划基本信息
      const updates = [];
      const params = [];

      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (level !== undefined) {
        updates.push('level = ?');
        params.push(level);
      }
      if (category !== undefined) {
        updates.push('category = ?');
        params.push(category);
      }
      if (start_time !== undefined) {
        updates.push('start_time = ?');
        params.push(start_time);
      }
      if (end_time !== undefined) {
        updates.push('end_time = ?');
        params.push(end_time);
      }
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active);
      }

      if (updates.length > 0) {
        params.push(planId);
        await connection.execute(`
          UPDATE learning_plans
          SET ${updates.join(', ')}, updated_at = NOW()
          WHERE id = ?
        `, params);
      }
      
      // 3. 如果提供了任务列表，完全替换现有任务
      if (tasks !== undefined && Array.isArray(tasks)) {
        // 3.0 在删除任务之前，先备份用户的完成进度（按exam_id和problem_id保存）
        const [joinedUsers] = await connection.execute(
          'SELECT user_id FROM user_learning_plans WHERE plan_id = ?',
          [planId]
        );
        
        // 备份每个用户的客观题完成进度（按exam_id保存）
        const examProgressBackup = new Map(); // key: "user_id:exam_id", value: {is_completed, best_score, attempt_count, completed_at}
        // 备份每个用户的OJ题目完成进度（按problem_id保存）
        const ojProgressBackup = new Map(); // key: "user_id:problem_id", value: {is_completed, best_verdict, attempt_count, completed_at}
        // 备份每个用户的任务完成进度（按任务名称和顺序匹配）
        const taskProgressBackup = new Map(); // key: "user_id:task_order:task_name", value: {is_completed, completed_at}
        
        for (const user of joinedUsers) {
          // 备份客观题进度（只备份该计划内任务关联的）
          const [examProgress] = await connection.execute(`
            SELECT uep.exam_id, uep.is_completed, uep.best_score, uep.attempt_count, uep.completed_at
            FROM user_exam_progress uep
            JOIN task_exams te ON uep.exam_id = te.exam_id AND uep.task_id = te.task_id
            JOIN learning_tasks lt ON te.task_id = lt.id
            WHERE lt.plan_id = ? AND uep.user_id = ?
          `, [planId, user.user_id]);
          
          for (const progress of examProgress) {
            const key = `${user.user_id}:${progress.exam_id}`;
            examProgressBackup.set(key, {
              is_completed: progress.is_completed,
              best_score: progress.best_score,
              attempt_count: progress.attempt_count,
              completed_at: progress.completed_at
            });
          }
          
          // 备份OJ题目进度（只备份该计划内任务关联的）
          const [ojProgress] = await connection.execute(`
            SELECT uop.problem_id, uop.is_completed, uop.best_verdict, uop.attempt_count, uop.completed_at
            FROM user_oj_progress uop
            JOIN task_oj_problems top ON uop.problem_id = top.problem_id AND uop.task_id = top.task_id
            JOIN learning_tasks lt ON top.task_id = lt.id
            WHERE lt.plan_id = ? AND uop.user_id = ?
          `, [planId, user.user_id]);
          
          for (const progress of ojProgress) {
            const key = `${user.user_id}:${progress.problem_id}`;
            ojProgressBackup.set(key, {
              is_completed: progress.is_completed,
              best_verdict: progress.best_verdict,
              attempt_count: progress.attempt_count,
              completed_at: progress.completed_at
            });
          }
          
          // 备份任务进度
          const [taskProgress] = await connection.execute(`
            SELECT utp.task_id, utp.is_completed, utp.completed_at, lt.task_order, lt.name
            FROM user_task_progress utp
            JOIN learning_tasks lt ON utp.task_id = lt.id
            WHERE lt.plan_id = ? AND utp.user_id = ?
          `, [planId, user.user_id]);
          
          for (const progress of taskProgress) {
            const key = `${user.user_id}:${progress.task_order}:${progress.name}`;
            taskProgressBackup.set(key, {
              is_completed: progress.is_completed,
              completed_at: progress.completed_at
            });
          }
        }
        
        // 3.1 删除该计划的所有现有任务（级联删除会自动删除关联的练习和用户进度）
        await connection.execute(
          'DELETE FROM learning_tasks WHERE plan_id = ?',
          [planId]
        );
        
        // 3.2 创建新的任务列表
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          
          // 创建任务
          const [taskResult] = await connection.execute(`
            INSERT INTO learning_tasks 
            (plan_id, name, description, review_content, review_content_type, review_video_url, start_time, end_time, task_order, is_exam_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            planId,
            task.name || `任务${i + 1}`,
            task.description || null,
            task.review_content || null,
            task.review_content_type || 'text',
            task.review_video_url || null,
            task.start_time || null,
            task.end_time || null,
            task.task_order !== undefined ? task.task_order : i + 1,
            task.is_exam_mode || 0
          ]);
          
          const taskId = taskResult.insertId;
          
          // 关联客观题（exams）
          if (task.exams && Array.isArray(task.exams) && task.exams.length > 0) {
            for (let j = 0; j < task.exams.length; j++) {
              const exam = task.exams[j];
              await connection.execute(`
                INSERT INTO task_exams (task_id, exam_id, exam_order)
                VALUES (?, ?, ?)
              `, [
                taskId,
                exam.exam_id,
                exam.exam_order !== undefined ? exam.exam_order : j + 1
              ]);
            }
          }
          
          // 关联OJ题目（oj_problems）
          if (task.oj_problems && Array.isArray(task.oj_problems) && task.oj_problems.length > 0) {
            for (let j = 0; j < task.oj_problems.length; j++) {
              const problem = task.oj_problems[j];
              await connection.execute(`
                INSERT INTO task_oj_problems (task_id, problem_id, problem_order)
                VALUES (?, ?, ?)
              `, [
                taskId,
                problem.problem_id,
                problem.problem_order !== undefined ? problem.problem_order : j + 1
              ]);
            }
          }
        }
        
        // 3.3 为所有已加入该计划的用户重新创建任务进度和练习进度，并恢复之前的完成状态
        for (const user of joinedUsers) {
          // 重新创建任务进度，并尝试恢复之前的完成状态
          const [newTasks] = await connection.execute(
            'SELECT id, task_order, name FROM learning_tasks WHERE plan_id = ? ORDER BY task_order',
            [planId]
          );
          
          for (const newTask of newTasks) {
            const backupKey = `${user.user_id}:${newTask.task_order}:${newTask.name}`;
            const backup = taskProgressBackup.get(backupKey);
            
            await connection.execute(`
              INSERT INTO user_task_progress (user_id, task_id, is_completed, completed_at)
              VALUES (?, ?, ?, ?)
            `, [
              user.user_id,
              newTask.id,
              backup ? backup.is_completed : false,
              backup ? backup.completed_at : null
            ]);
          }
          
          // 重新创建客观题进度，并恢复之前的完成状态
          const [newTaskExams] = await connection.execute(`
            SELECT te.exam_id, te.task_id
            FROM task_exams te
            JOIN learning_tasks lt ON te.task_id = lt.id
            WHERE lt.plan_id = ?
          `, [planId]);
          
          for (const taskExam of newTaskExams) {
            const backupKey = `${user.user_id}:${taskExam.exam_id}`;
            const backup = examProgressBackup.get(backupKey);
            
            if (backup) {
              // 恢复之前的完成状态
              await connection.execute(`
                INSERT INTO user_exam_progress (user_id, exam_id, task_id, is_completed, best_score, attempt_count, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  is_completed = VALUES(is_completed),
                  best_score = GREATEST(COALESCE(best_score, 0), VALUES(best_score)),
                  attempt_count = GREATEST(COALESCE(attempt_count, 0), VALUES(attempt_count)),
                  completed_at = COALESCE(completed_at, VALUES(completed_at))
              `, [
                user.user_id,
                taskExam.exam_id,
                taskExam.task_id,
                backup.is_completed,
                backup.best_score,
                backup.attempt_count,
                backup.completed_at
              ]);
            } else {
              // 创建新的未完成进度
              await connection.execute(`
                INSERT INTO user_exam_progress (user_id, exam_id, task_id, is_completed, best_score, attempt_count)
                VALUES (?, ?, ?, FALSE, 0, 0)
                ON DUPLICATE KEY UPDATE task_id = VALUES(task_id)
              `, [user.user_id, taskExam.exam_id, taskExam.task_id]);
            }
          }
          
          // 重新创建OJ题目进度，并恢复之前的完成状态
          const [newTaskOjProblems] = await connection.execute(`
            SELECT top.problem_id, top.task_id
            FROM task_oj_problems top
            JOIN learning_tasks lt ON top.task_id = lt.id
            WHERE lt.plan_id = ?
          `, [planId]);
          
          for (const taskOjProblem of newTaskOjProblems) {
            const backupKey = `${user.user_id}:${taskOjProblem.problem_id}`;
            const backup = ojProgressBackup.get(backupKey);
            
            if (backup) {
              // 恢复之前的完成状态
              await connection.execute(`
                INSERT INTO user_oj_progress (user_id, problem_id, task_id, is_completed, best_verdict, attempt_count, completed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                  is_completed = VALUES(is_completed),
                  best_verdict = COALESCE(best_verdict, VALUES(best_verdict)),
                  attempt_count = GREATEST(COALESCE(attempt_count, 0), VALUES(attempt_count)),
                  completed_at = COALESCE(completed_at, VALUES(completed_at))
              `, [
                user.user_id,
                taskOjProblem.problem_id,
                taskOjProblem.task_id,
                backup.is_completed,
                backup.best_verdict,
                backup.attempt_count,
                backup.completed_at
              ]);
            } else {
              // 创建新的未完成进度
              await connection.execute(`
                INSERT INTO user_oj_progress (user_id, problem_id, task_id, is_completed, best_verdict, attempt_count)
                VALUES (?, ?, ?, FALSE, NULL, 0)
                ON DUPLICATE KEY UPDATE task_id = VALUES(task_id)
              `, [user.user_id, taskOjProblem.problem_id, taskOjProblem.task_id]);
            }
          }
        }
      }
      
      // 4. 获取更新后的完整学习计划信息
      const [planData] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [planId]
      );
      
      const [tasksData] = await connection.execute(`
        SELECT 
          lt.*,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('exam_id', te.exam_id, 'exam_order', te.exam_order))
           FROM task_exams te WHERE te.task_id = lt.id) as exams,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('problem_id', top.problem_id, 'problem_order', top.problem_order))
           FROM task_oj_problems top WHERE top.task_id = lt.id) as oj_problems
        FROM learning_tasks lt
        WHERE lt.plan_id = ?
        ORDER BY lt.task_order, lt.start_time
      `, [planId]);
      
      await connection.commit();
      connection.release();
      
      // 清除该计划的排名缓存（因为计划内容已更新）
      await clearPlanRankingCache(planId);
      
      res.json({
        success: true,
        message: '学习计划更新成功',
        data: {
          ...planData[0],
          tasks: tasksData
        }
      });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('更新学习计划失败:', error);
    res.status(500).json({ 
      success: false,
      error: '更新学习计划失败',
      message: error.message 
    });
  }
});

// ==================== 11. 任务内提交客观题 ====================
router.post('/learning-tasks/:taskId/submit-exam', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id, exam_id, answers, practice_duration_seconds } = req.body;
    
    // 验证必需参数
    if (!user_id || !exam_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id, exam_id, answers'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. 验证任务是否存在
      const [taskRows] = await connection.execute(
        'SELECT * FROM learning_tasks WHERE id = ?',
        [taskId]
      );
      
      if (taskRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '任务不存在' 
        });
      }
      
      const task = taskRows[0];
      
      // 2. 验证用户是否加入了该计划
      const [joinedRows] = await connection.execute(
        'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
        [user_id, task.plan_id]
      );
      
      if (joinedRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ 
          success: false,
          error: '您尚未加入该学习计划' 
        });
      }
      
      // 3. 验证该客观题是否属于该任务
      const [taskExamRows] = await connection.execute(
        'SELECT * FROM task_exams WHERE task_id = ? AND exam_id = ?',
        [taskId, exam_id]
      );
      
      if (taskExamRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          success: false,
          error: '该客观题不属于此任务' 
        });
      }
      
      // 4. 检查今天的提交次数（一天只能提交3次）
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const [todaySubmissions] = await connection.execute(
        `SELECT COUNT(*) as count FROM submissions 
         WHERE user_id = ? AND exam_id = ? AND task_id = ? 
         AND submit_time >= ? AND submit_time < ?`,
        [user_id, exam_id, taskId, today, tomorrow]
      );
      
      const todayCount = todaySubmissions[0]?.count || 0;
      if (todayCount >= 3) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          success: false,
          error: '今天已提交3次，请明天再试' 
        });
      }
      
      // 5. 调用可复用的提交函数（传入task_id以更新任务进度，practice_duration_seconds 为本次练习持续时间）
      const result = await submitExamInternal(connection, user_id, exam_id, answers, taskId, practice_duration_seconds ?? null);
      
      await connection.commit();
      connection.release();
      
      // 5. 先返回结果给前端
      res.json({
        success: true,
        message: '任务内客观题提交成功',
        ...result
      });
      
      // 6. 异步更新任务和计划完成状态（不影响前端响应）
      // 使用 setTimeout 确保主事务已提交后再执行
      setTimeout(async () => {
        const asyncConnection = await pool.getConnection();
        try {
          await asyncConnection.beginTransaction();
          
          // 检查并更新任务完成状态（只有60分以上才算完成）
          await updateTaskCompletionStatus(asyncConnection, user_id, taskId);
          
          // 检查并更新计划完成状态
          await updatePlanCompletionStatus(asyncConnection, user_id, task.plan_id);
          
          await asyncConnection.commit();
          logger.info('异步更新任务完成状态成功', { user_id, taskId, plan_id: task.plan_id });
        } catch (error) {
          await asyncConnection.rollback();
          logger.error('异步更新任务完成状态失败:', {
            error: error.message,
            stack: error.stack,
            user_id,
            taskId,
            plan_id: task.plan_id
          });
        } finally {
          asyncConnection.release();
        }
      }, 200); // 延迟200ms确保主事务已提交（增加延迟时间）
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('任务内提交客观题失败:', error);
    res.status(500).json({ 
      success: false,
      error: '任务内提交客观题失败',
      message: error.message 
    });
  }
});

// ==================== 11.5. 获取今天客观题提交次数 ====================
router.get('/learning-tasks/:taskId/exam-submission-count', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id, exam_id } = req.query;
    
    if (!user_id || !exam_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id, exam_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 计算今天的日期范围
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const [todaySubmissions] = await connection.execute(
        `SELECT COUNT(*) as count FROM submissions 
         WHERE user_id = ? AND exam_id = ? AND task_id = ? 
         AND submit_time >= ? AND submit_time < ?`,
        [user_id, exam_id, taskId, today, tomorrow]
      );
      
      const todayCount = todaySubmissions[0]?.count || 0;
      const remaining = Math.max(0, 3 - todayCount);
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          today_count: todayCount,
          remaining: remaining,
          limit: 3
        }
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('获取今天提交次数失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取今天提交次数失败',
      message: error.message 
    });
  }
});

// ==================== 12. 任务内提交OJ ====================
router.post('/learning-tasks/:taskId/submit-oj', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id, problem_id, code, language, practice_duration_seconds } = req.body;
    
    // 验证必需参数
    if (!user_id || !problem_id || !code || !language) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id, problem_id, code, language'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. 验证任务是否存在
      const [taskRows] = await connection.execute(
        'SELECT * FROM learning_tasks WHERE id = ?',
        [taskId]
      );
      
      if (taskRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '任务不存在' 
        });
      }
      
      const task = taskRows[0];
      
      // 2. 验证用户是否加入了该计划
      const [joinedRows] = await connection.execute(
        'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
        [user_id, task.plan_id]
      );
      
      if (joinedRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(403).json({ 
          success: false,
          error: '您尚未加入该学习计划' 
        });
      }
      
      // 3. 验证该OJ题是否属于该任务
      const [taskOjRows] = await connection.execute(
        'SELECT * FROM task_oj_problems WHERE task_id = ? AND problem_id = ?',
        [taskId, problem_id]
      );
      
      if (taskOjRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ 
          success: false,
          error: '该OJ题不属于此任务' 
        });
      }
      
      // 4. 调用可复用的提交函数（传入task_id以更新任务进度，practice_duration_seconds 为本次练习持续时间）
      const result = await submitOjInternal(connection, user_id, problem_id, code, language, taskId, practice_duration_seconds ?? null);
      
      await connection.commit();
      connection.release();
      
      // 5. 先返回结果给前端
      res.json({
        success: true,
        message: '任务内OJ提交成功',
        ...result
      });
      
      // 6. 异步更新任务和计划完成状态（不影响前端响应）
      // 使用 setTimeout 确保主事务已提交后再执行
      setTimeout(async () => {
        const asyncConnection = await pool.getConnection();
        try {
          await asyncConnection.beginTransaction();
          
          // 检查并更新任务完成状态（只有Accepted才算完成）
          await updateTaskCompletionStatus(asyncConnection, user_id, taskId);
          
          // 检查并更新计划完成状态
          await updatePlanCompletionStatus(asyncConnection, user_id, task.plan_id);
          
          await asyncConnection.commit();
          logger.info('异步更新任务完成状态成功', { user_id, taskId, plan_id: task.plan_id });
        } catch (error) {
          await asyncConnection.rollback();
          logger.error('异步更新任务完成状态失败:', {
            error: error.message,
            stack: error.stack,
            user_id,
            taskId,
            plan_id: task.plan_id
          });
        } finally {
          asyncConnection.release();
        }
      }, 200); // 延迟200ms确保主事务已提交（增加延迟时间）
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('任务内提交OJ失败:', error);
    res.status(500).json({ 
      success: false,
      error: '任务内提交OJ失败',
      message: error.message 
    });
  }
});

// ==================== 辅助函数：更新任务完成状态 ====================
async function updateTaskCompletionStatus(connection, user_id, task_id) {
  // 1. 获取任务内的所有客观题
  const [taskExams] = await connection.execute(
    'SELECT exam_id FROM task_exams WHERE task_id = ?',
    [task_id]
  );
  
  // 2. 获取任务内的所有OJ题
  const [taskOjs] = await connection.execute(
    'SELECT problem_id FROM task_oj_problems WHERE task_id = ?',
    [task_id]
  );
  
  // 3. 检查所有客观题是否都完成
  let allExamsCompleted = true;
  if (taskExams.length > 0) {
    const examIds = taskExams.map(te => te.exam_id);
    const placeholders = examIds.map(() => '?').join(',');
    const [examProgress] = await connection.execute(
      `SELECT COUNT(*) as completed_count 
       FROM user_exam_progress 
       WHERE user_id = ? AND exam_id IN (${placeholders}) AND task_id = ? AND is_completed = 1`,
      [user_id, ...examIds, task_id]
    );
    const completedCount = Number(examProgress[0].completed_count) || 0;
    allExamsCompleted = completedCount === examIds.length;
    logger.info(`任务完成状态检查 - 客观题: ${completedCount}/${examIds.length}`, {
      user_id,
      task_id,
      examIds,
      completedCount,
      allExamsCompleted
    });
  } else {
    logger.info(`任务完成状态检查 - 无客观题`, { user_id, task_id });
  }
  
  // 4. 检查所有OJ题是否都完成
  let allOjsCompleted = true;
  if (taskOjs.length > 0) {
    const problemIds = taskOjs.map(to => to.problem_id);
    const placeholders = problemIds.map(() => '?').join(',');
    const [ojProgress] = await connection.execute(
      `SELECT COUNT(*) as completed_count 
       FROM user_oj_progress 
       WHERE user_id = ? AND problem_id IN (${placeholders}) AND task_id = ? AND is_completed = 1`,
      [user_id, ...problemIds, task_id]
    );
    const completedCount = Number(ojProgress[0].completed_count) || 0;
    allOjsCompleted = completedCount === problemIds.length;
    logger.info(`任务完成状态检查 - OJ题: ${completedCount}/${problemIds.length}`, {
      user_id,
      task_id,
      problemIds,
      completedCount,
      allOjsCompleted
    });
  } else {
    logger.info(`任务完成状态检查 - 无OJ题`, { user_id, task_id });
  }
  
  // 5. 如果任务内没有客观题和OJ题，任务不应该被标记为已完成
  const hasExams = taskExams.length > 0;
  const hasOjs = taskOjs.length > 0;
  
  // 只有当任务至少有一种题目类型，且所有题目都完成时，任务才算完成
  const isTaskCompleted = (hasExams || hasOjs) && allExamsCompleted && allOjsCompleted;
  
  if (isTaskCompleted) {
    await connection.execute(`
      INSERT INTO user_task_progress (user_id, task_id, is_completed, completed_at)
      VALUES (?, ?, TRUE, NOW())
      ON DUPLICATE KEY UPDATE 
        is_completed = TRUE,
        completed_at = CASE WHEN completed_at IS NULL THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    `, [user_id, task_id]);
    logger.info(`任务完成状态已更新 - 任务已完成`, { user_id, task_id });
  } else {
    logger.info(`任务完成状态检查 - 任务未完成`, {
      user_id,
      task_id,
      allExamsCompleted,
      allOjsCompleted
    });
  }
}

// ==================== 辅助函数：清除计划排名缓存 ====================
async function clearPlanRankingCache(plan_id) {
  try {
    const cacheKey = `cache:learning-plan:global-ranking:${plan_id}`;
    const classRankingCacheKey = `cache:learning-plan:class-ranking:${plan_id}`;
    await cacheUtils.del(cacheKey);
    await cacheUtils.del(classRankingCacheKey);
    logger.info(`已清除计划排名缓存: planId=${plan_id}`);
  } catch (error) {
    logger.error('清除计划排名缓存失败:', error.message);
    // 缓存清除失败不影响主流程
  }
}

// ==================== 辅助函数：更新计划完成状态 ====================
async function updatePlanCompletionStatus(connection, user_id, plan_id) {
  // 1. 获取计划的所有任务
  const [tasks] = await connection.execute(
    'SELECT id FROM learning_tasks WHERE plan_id = ?',
    [plan_id]
  );
  
  if (tasks.length === 0) {
    return;
  }
  
  // 2. 统计已完成任务数
  const taskIds = tasks.map(t => t.id);
  const placeholders = taskIds.map(() => '?').join(',');
  const [completedTasks] = await connection.execute(
    `SELECT COUNT(*) as completed_count 
     FROM user_task_progress 
     WHERE user_id = ? AND task_id IN (${placeholders}) AND is_completed = 1`,
    [user_id, ...taskIds]
  );
  
  const completedCount = completedTasks[0].completed_count;
  const totalCount = tasks.length;
  const isPlanCompleted = completedCount === totalCount;
  
  // 3. 更新或创建计划完成进度
  await connection.execute(`
    INSERT INTO user_plan_progress (user_id, plan_id, is_completed, completed_tasks, total_tasks, completed_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE 
      is_completed = ?,
      completed_tasks = ?,
      total_tasks = ?,
      completed_at = CASE WHEN ? AND completed_at IS NULL THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  `, [
    user_id, plan_id, 
    isPlanCompleted ? 1 : 0, completedCount, totalCount,
    isPlanCompleted ? new Date() : null,
    isPlanCompleted ? 1 : 0, completedCount, totalCount,
    isPlanCompleted ? 1 : 0
  ]);
  
  // 4. 清除排名缓存（因为排名数据已更新）
  await clearPlanRankingCache(plan_id);
}

// ==================== 13. 获取计划完成情况 ====================
router.get('/learning-plans/:planId/progress', async (req, res) => {
  try {
    const { planId } = req.params;
    const { user_id } = req.query;
    
    // 验证必需参数
    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 1. 获取计划基本信息
      const [planRows] = await connection.execute(`
        SELECT 
          lp.*
        FROM learning_plans lp
        WHERE lp.id = ? AND lp.is_active = 1
      `, [planId]);
      
      if (planRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学习计划不存在' 
        });
      }
      
      const plan = planRows[0];
      
      // 2. 检查用户是否加入了该计划
      const [joinedRows] = await connection.execute(
        'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
        [user_id, planId]
      );
      
      if (joinedRows.length === 0) {
        connection.release();
        return res.status(403).json({ 
          success: false,
          error: '您未加入该学习计划' 
        });
      }
      
      // 3. 获取计划完成状态
      const [planProgressRows] = await connection.execute(
        'SELECT * FROM user_plan_progress WHERE user_id = ? AND plan_id = ?',
        [user_id, planId]
      );
      
      const planProgress = planProgressRows[0] || {
        is_completed: false,
        completed_tasks: 0,
        total_tasks: 0,
        completed_at: null
      };
      
      // 4. 获取计划内的所有任务
      const [tasks] = await connection.execute(
        'SELECT * FROM learning_tasks WHERE plan_id = ? ORDER BY task_order',
        [planId]
      );
      
      // 5. 获取每个任务的完成情况
      const taskDetails = [];
      for (const task of tasks) {
        // 获取任务完成状态
        const [taskProgressRows] = await connection.execute(
          'SELECT * FROM user_task_progress WHERE user_id = ? AND task_id = ?',
          [user_id, task.id]
        );
        
        // 获取任务内的客观题完成情况
        const [examProgress] = await connection.execute(`
          SELECT 
            e.id,
            e.name,
            e.level,
            e.type,
            te.exam_order,
            COALESCE(uep.is_completed, 0) as is_completed,
            uep.best_score,
            COALESCE(uep.attempt_count, 0) as attempt_count,
            uep.completed_at
          FROM task_exams te
          JOIN exams e ON te.exam_id = e.id
          LEFT JOIN user_exam_progress uep ON e.id = uep.exam_id 
            AND uep.user_id = ? AND uep.task_id = ?
          WHERE te.task_id = ?
          ORDER BY te.exam_order
        `, [user_id, task.id, task.id]);
        
        // 获取任务内的OJ题完成情况
        const [ojProgress] = await connection.execute(`
          SELECT 
            op.id,
            op.title,
            op.level,
            top.problem_order,
            COALESCE(uop.is_completed, 0) as is_completed,
            uop.best_verdict,
            COALESCE(uop.attempt_count, 0) as attempt_count,
            uop.completed_at,
            (SELECT MAX(CASE WHEN os.total_tests > 0 THEN ROUND(os.passed_tests * 100.0 / os.total_tests, 0) ELSE 0 END)
             FROM oj_submissions os 
             WHERE os.problem_id = op.id AND os.user_id = ? AND os.task_id = ? AND os.status = 'completed'
            ) as best_pass_rate
          FROM task_oj_problems top
          JOIN oj_problems op ON top.problem_id = op.id
          LEFT JOIN user_oj_progress uop ON op.id = uop.problem_id 
            AND uop.user_id = ? AND uop.task_id = ?
          WHERE top.task_id = ?
          ORDER BY top.problem_order
        `, [user_id, task.id, user_id, task.id, task.id]);
        
        taskDetails.push({
          ...task,
          task_progress: {
            is_completed: taskProgressRows.length > 0 && taskProgressRows[0].is_completed === 1,
            completed_at: taskProgressRows.length > 0 ? taskProgressRows[0].completed_at : null
          },
          exam_progress: {
            total: examProgress.length,
            // 确保 is_completed 是数字或布尔值，而不是字符串
            completed: examProgress.filter(e => Number(e.is_completed) === 1 || e.is_completed === true).length,
            exams: examProgress
          },
          oj_progress: {
            total: ojProgress.length,
            // 确保 is_completed 是数字或布尔值，而不是字符串
            completed: ojProgress.filter(o => Number(o.is_completed) === 1 || o.is_completed === true).length,
            problems: ojProgress
          }
        });
      }
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          plan: plan,
          plan_progress: {
            is_completed: planProgress.is_completed === 1 || planProgress.is_completed === true,
            completed_tasks: Math.min(planProgress.completed_tasks || 0, tasks.length),
            total_tasks: tasks.length,
            progress_rate: tasks.length > 0 
              ? Math.round((Math.min(planProgress.completed_tasks || 0, tasks.length) / tasks.length) * 100) 
              : 0,
            completed_at: planProgress.completed_at
          },
          tasks: taskDetails
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取计划完成情况失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取计划完成情况失败',
      message: error.message 
    });
  }
});

// ==================== 14. 获取任务完成情况 ====================
router.get('/learning-tasks/:taskId/progress', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { user_id } = req.query;
    
    // 验证必需参数
    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 1. 获取任务基本信息
      const [taskRows] = await connection.execute(`
        SELECT 
          lt.*,
          lp.name as plan_name,
          lp.level as plan_level
        FROM learning_tasks lt
        JOIN learning_plans lp ON lt.plan_id = lp.id
        WHERE lt.id = ?
      `, [taskId]);
      
      if (taskRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '任务不存在' 
        });
      }
      
      const task = taskRows[0];
      
      // 2. 获取任务完成状态
      const [taskProgressRows] = await connection.execute(
        'SELECT * FROM user_task_progress WHERE user_id = ? AND task_id = ?',
        [user_id, taskId]
      );
      
      const taskProgress = taskProgressRows[0] || {
        is_completed: false,
        completed_at: null
      };
      
      // 3. 获取任务内的客观题完成情况
      const [examProgress] = await connection.execute(`
        SELECT 
          e.id,
          e.name,
          e.level,
          e.type,
          e.total_questions,
          te.exam_order,
          COALESCE(uep.is_completed, 0) as is_completed,
          COALESCE(uep.best_score, 0) as best_score,
          COALESCE(uep.attempt_count, 0) as attempt_count,
          uep.completed_at
        FROM task_exams te
        JOIN exams e ON te.exam_id = e.id
        LEFT JOIN user_exam_progress uep ON e.id = uep.exam_id 
          AND uep.user_id = ? AND uep.task_id = ?
        WHERE te.task_id = ?
        ORDER BY te.exam_order
      `, [user_id, taskId, taskId]);
      
      // 4. 获取任务内的OJ题完成情况
      const [ojProgress] = await connection.execute(`
        SELECT 
          op.id,
          op.title,
          op.level,
          top.problem_order,
          COALESCE(uop.is_completed, 0) as is_completed,
          uop.best_verdict,
          COALESCE(uop.attempt_count, 0) as attempt_count,
          uop.completed_at,
          (SELECT MAX(CASE WHEN os.total_tests > 0 THEN ROUND(os.passed_tests * 100.0 / os.total_tests, 0) ELSE 0 END)
           FROM oj_submissions os 
           WHERE os.problem_id = op.id AND os.user_id = ? AND os.task_id = ? AND os.status = 'completed'
          ) as best_pass_rate
        FROM task_oj_problems top
        JOIN oj_problems op ON top.problem_id = op.id
        LEFT JOIN user_oj_progress uop ON op.id = uop.problem_id 
          AND uop.user_id = ? AND uop.task_id = ?
        WHERE top.task_id = ?
        ORDER BY top.problem_order
      `, [user_id, taskId, user_id, taskId, taskId]);
      
      // 5. 统计完成情况
      const totalExams = examProgress.length;
      // 确保 is_completed 是数字或布尔值，而不是字符串
      const completedExams = examProgress.filter(e => Number(e.is_completed) === 1 || e.is_completed === true).length;
      const totalOjs = ojProgress.length;
      const completedOjs = ojProgress.filter(o => Number(o.is_completed) === 1 || o.is_completed === true).length;
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          task: {
            id: task.id,
            name: task.name,
            description: task.description,
            plan_name: task.plan_name,
            plan_level: task.plan_level
          },
          task_progress: {
            is_completed: taskProgress.is_completed === 1 || taskProgress.is_completed === true,
            completed_at: taskProgress.completed_at
          },
          exam_progress: {
            total: totalExams,
            completed: completedExams,
            progress_rate: totalExams > 0 ? Math.round((completedExams / totalExams) * 100) : 0,
            exams: examProgress
          },
          oj_progress: {
            total: totalOjs,
            completed: completedOjs,
            progress_rate: totalOjs > 0 ? Math.round((completedOjs / totalOjs) * 100) : 0,
            problems: ojProgress
          }
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取任务完成情况失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取任务完成情况失败',
      message: error.message 
    });
  }
});

// ==================== 14. 教师查看学生在计划内的完成情况 ====================
router.get('/learning-plans/:planId/students-progress', async (req, res) => {
  try {
    const { planId } = req.params;
    const { teacher_id } = req.query;
    
    // 验证必需参数
    if (!teacher_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: teacher_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 1. 验证计划是否存在
      const [planRows] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [planId]
      );
      
      if (planRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学习计划不存在' 
        });
      }
      
      // 2. 获取该教师的所有学生
      const [students] = await connection.execute(`
        SELECT DISTINCT u.id, u.username, u.real_name
        FROM users u
        JOIN teacher_students ts ON u.id = ts.student_id
        WHERE ts.teacher_id = ?
      `, [teacher_id]);
      
      if (students.length === 0) {
        connection.release();
        return res.json({
          success: true,
          data: {
            plan: planRows[0],
            students: []
          }
        });
      }
      
      // 3. 获取计划的所有任务
      const [tasks] = await connection.execute(
        'SELECT id, name, task_order FROM learning_tasks WHERE plan_id = ? ORDER BY task_order',
        [planId]
      );
      
      // 4. 为每个学生获取完成情况
      const studentsProgress = [];
      for (const student of students) {
        // 检查学生是否加入了该计划
        const [joined] = await connection.execute(
          'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
          [student.id, planId]
        );
        
        if (joined.length === 0) {
          continue; // 学生未加入该计划，跳过
        }
        
        // 获取计划完成进度
        const [planProgressRows] = await connection.execute(
          'SELECT * FROM user_plan_progress WHERE user_id = ? AND plan_id = ?',
          [student.id, planId]
        );
        
        const planProgress = planProgressRows[0] || {
          is_completed: false,
          completed_tasks: 0,
          total_tasks: tasks.length
        };
        
        // 获取每个任务的完成情况
        const taskProgressList = [];
        for (const task of tasks) {
          const [taskProgressRows] = await connection.execute(
            'SELECT * FROM user_task_progress WHERE user_id = ? AND task_id = ?',
            [student.id, task.id]
          );
          
          // 统计任务内的客观题和OJ题完成情况
          const [examStats] = await connection.execute(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN uep.is_completed = 1 THEN 1 ELSE 0 END) as completed
            FROM task_exams te
            LEFT JOIN user_exam_progress uep ON te.exam_id = uep.exam_id 
              AND uep.user_id = ? AND uep.task_id = ?
            WHERE te.task_id = ?
          `, [student.id, task.id, task.id]);
          
          const [ojStats] = await connection.execute(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN uop.is_completed = 1 THEN 1 ELSE 0 END) as completed
            FROM task_oj_problems top
            LEFT JOIN user_oj_progress uop ON top.problem_id = uop.problem_id 
              AND uop.user_id = ? AND uop.task_id = ?
            WHERE top.task_id = ?
          `, [student.id, task.id, task.id]);
          
          taskProgressList.push({
            task_id: task.id,
            task_name: task.name,
            task_order: task.task_order,
            is_completed: taskProgressRows.length > 0 && taskProgressRows[0].is_completed === 1,
            completed_at: taskProgressRows.length > 0 ? taskProgressRows[0].completed_at : null,
            exam_completed: examStats[0].completed || 0,
            exam_total: examStats[0].total || 0,
            oj_completed: ojStats[0].completed || 0,
            oj_total: ojStats[0].total || 0
          });
        }
        
        studentsProgress.push({
          student_id: student.id,
          username: student.username,
          real_name: student.real_name,
          plan_progress: {
            is_completed: planProgress.is_completed === 1 || planProgress.is_completed === true,
            completed_tasks: Math.min(planProgress.completed_tasks || 0, tasks.length),
            total_tasks: tasks.length,
            progress_rate: tasks.length > 0 
              ? Math.round((Math.min(planProgress.completed_tasks || 0, tasks.length) / tasks.length) * 100) 
              : 0
          },
          tasks: taskProgressList
        });
      }
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          plan: planRows[0],
          students: studentsProgress
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取学生完成情况失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取学生完成情况失败',
      message: error.message 
    });
  }
});

// ==================== 15. 复制学习计划 ====================
router.post('/learning-plans/:planId/copy', async (req, res) => {
  try {
    const { planId } = req.params;
    const { name } = req.body; // 可选的新名称
    
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 1. 获取原学习计划信息
      const [planRows] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [planId]
      );
      
      if (planRows.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学习计划不存在' 
        });
      }
      
      const originalPlan = planRows[0];
      
      // 2. 创建新的学习计划
      const newName = name || `${originalPlan.name} (副本)`;
      const [newPlanResult] = await connection.execute(`
        INSERT INTO learning_plans (name, description, level, start_time, end_time, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        newName,
        originalPlan.description,
        originalPlan.level,
        originalPlan.start_time,
        originalPlan.end_time,
        originalPlan.is_active
      ]);
      
      const newPlanId = newPlanResult.insertId;
      
      // 3. 获取原计划的所有任务
      const [tasks] = await connection.execute(
        'SELECT * FROM learning_tasks WHERE plan_id = ? ORDER BY task_order',
        [planId]
      );
      
      // 4. 复制每个任务及其关联的客观题和OJ题
      for (const task of tasks) {
        // 创建新任务
        const [newTaskResult] = await connection.execute(`
          INSERT INTO learning_tasks 
          (plan_id, name, description, review_content, review_content_type, review_video_url, start_time, end_time, task_order, is_exam_mode)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newPlanId,
          task.name,
          task.description,
          task.review_content,
          task.review_content_type || 'text',
          task.review_video_url,
          task.start_time,
          task.end_time,
          task.task_order,
          task.is_exam_mode
        ]);
        
        const newTaskId = newTaskResult.insertId;
        
        // 复制任务关联的客观题
        const [taskExams] = await connection.execute(
          'SELECT * FROM task_exams WHERE task_id = ? ORDER BY exam_order',
          [task.id]
        );
        
        for (const exam of taskExams) {
          await connection.execute(`
            INSERT INTO task_exams (task_id, exam_id, exam_order)
            VALUES (?, ?, ?)
          `, [newTaskId, exam.exam_id, exam.exam_order]);
        }
        
        // 复制任务关联的OJ题
        const [taskOjProblems] = await connection.execute(
          'SELECT * FROM task_oj_problems WHERE task_id = ? ORDER BY problem_order',
          [task.id]
        );
        
        for (const problem of taskOjProblems) {
          await connection.execute(`
            INSERT INTO task_oj_problems (task_id, problem_id, problem_order)
            VALUES (?, ?, ?)
          `, [newTaskId, problem.problem_id, problem.problem_order]);
        }
      }
      
      // 5. 获取新创建的完整学习计划信息
      const [newPlanData] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [newPlanId]
      );
      
      const [newTasksData] = await connection.execute(`
        SELECT 
          lt.*,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('exam_id', te.exam_id, 'exam_order', te.exam_order))
           FROM task_exams te WHERE te.task_id = lt.id) as exams,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('problem_id', top.problem_id, 'problem_order', top.problem_order))
           FROM task_oj_problems top WHERE top.task_id = lt.id) as oj_problems
        FROM learning_tasks lt
        WHERE lt.plan_id = ?
        ORDER BY lt.task_order, lt.start_time
      `, [newPlanId]);
      
      await connection.commit();
      connection.release();
      
      res.json({
        success: true,
        message: '学习计划复制成功',
        data: {
          ...newPlanData[0],
          tasks: newTasksData
        }
      });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('复制学习计划失败:', error);
    res.status(500).json({ 
      success: false,
      error: '复制学习计划失败',
      message: error.message 
    });
  }
});

// ==================== 16. 教师查看单个学生的详细完成情况 ====================
router.get('/learning-plans/:planId/students/:studentId/progress', async (req, res) => {
  try {
    const { planId, studentId } = req.params;
    const { teacher_id } = req.query;
    
    // 验证必需参数
    if (!teacher_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: teacher_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 1. 验证教师-学生关系
      const [relationRows] = await connection.execute(
        'SELECT * FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
        [teacher_id, studentId]
      );
      
      if (relationRows.length === 0) {
        connection.release();
        return res.status(403).json({ 
          success: false,
          error: '您无权查看该学生的信息' 
        });
      }
      
      // 2. 验证计划是否存在
      const [planRows] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [planId]
      );
      
      if (planRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学习计划不存在' 
        });
      }
      
      // 3. 获取学生信息
      const [studentRows] = await connection.execute(
        'SELECT id, username, real_name FROM users WHERE id = ?',
        [studentId]
      );
      
      if (studentRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学生不存在' 
        });
      }
      
      // 4. 检查学生是否加入了该计划
      const [joined] = await connection.execute(
        'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
        [studentId, planId]
      );
      
      if (joined.length === 0) {
        connection.release();
        return res.json({
          success: true,
          data: {
            student: studentRows[0],
            plan: planRows[0],
            message: '该学生尚未加入此学习计划',
            plan_progress: null,
            tasks: []
          }
        });
      }
      
      // 5. 获取计划完成进度
      const [planProgressRows] = await connection.execute(
        'SELECT * FROM user_plan_progress WHERE user_id = ? AND plan_id = ?',
        [studentId, planId]
      );
      
      const planProgress = planProgressRows[0] || {
        is_completed: false,
        completed_tasks: 0,
        total_tasks: 0
      };
      
      // 6. 获取计划的所有任务及详细完成情况
      const [tasks] = await connection.execute(
        'SELECT * FROM learning_tasks WHERE plan_id = ? ORDER BY task_order',
        [planId]
      );
      
      const taskDetails = [];
      for (const task of tasks) {
        // 获取任务完成状态
        const [taskProgressRows] = await connection.execute(
          'SELECT * FROM user_task_progress WHERE user_id = ? AND task_id = ?',
          [studentId, task.id]
        );
        
        // 获取任务内的客观题完成情况
        const [examProgress] = await connection.execute(`
          SELECT 
            e.id,
            e.name,
            e.level,
            e.type,
            te.exam_order,
            COALESCE(uep.is_completed, 0) as is_completed,
            COALESCE(uep.best_score, 0) as best_score,
            COALESCE(uep.attempt_count, 0) as attempt_count,
            uep.completed_at
          FROM task_exams te
          JOIN exams e ON te.exam_id = e.id
          LEFT JOIN user_exam_progress uep ON e.id = uep.exam_id 
            AND uep.user_id = ? AND uep.task_id = ?
          WHERE te.task_id = ?
          ORDER BY te.exam_order
        `, [studentId, task.id, task.id]);
        
        // 获取任务内的OJ题完成情况
        const [ojProgress] = await connection.execute(`
          SELECT 
            op.id,
            op.title,
            op.level,
            top.problem_order,
            COALESCE(uop.is_completed, 0) as is_completed,
            uop.best_verdict,
            COALESCE(uop.attempt_count, 0) as attempt_count,
            uop.completed_at
          FROM task_oj_problems top
          JOIN oj_problems op ON top.problem_id = op.id
          LEFT JOIN user_oj_progress uop ON op.id = uop.problem_id 
            AND uop.user_id = ? AND uop.task_id = ?
          WHERE top.task_id = ?
          ORDER BY top.problem_order
        `, [studentId, task.id, task.id]);
        
        taskDetails.push({
          ...task,
          task_progress: {
            is_completed: taskProgressRows.length > 0 && taskProgressRows[0].is_completed === 1,
            completed_at: taskProgressRows.length > 0 ? taskProgressRows[0].completed_at : null
          },
          exam_progress: {
            total: examProgress.length,
            // 确保 is_completed 是数字或布尔值，而不是字符串
            completed: examProgress.filter(e => Number(e.is_completed) === 1 || e.is_completed === true).length,
            exams: examProgress
          },
          oj_progress: {
            total: ojProgress.length,
            // 确保 is_completed 是数字或布尔值，而不是字符串
            completed: ojProgress.filter(o => Number(o.is_completed) === 1 || o.is_completed === true).length,
            problems: ojProgress
          }
        });
      }
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          student: studentRows[0],
          plan: planRows[0],
          plan_progress: {
            is_completed: planProgress.is_completed === 1 || planProgress.is_completed === true,
            completed_tasks: Math.min(planProgress.completed_tasks || 0, tasks.length),
            total_tasks: tasks.length,
            progress_rate: tasks.length > 0 
              ? Math.round((Math.min(planProgress.completed_tasks || 0, tasks.length) / tasks.length) * 100) 
              : 0
          },
          tasks: taskDetails
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取学生详细完成情况失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取学生详细完成情况失败',
      message: error.message 
    });
  }
});

// ==================== 18. 学生查看班级排名 ====================
router.get('/learning-plans/:planId/class-ranking', async (req, res) => {
  try {
    const { planId } = req.params;
    const { user_id } = req.query;
    
    // 验证必需参数
    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 1. 验证计划是否存在
      const [planRows] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [planId]
      );
      
      if (planRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学习计划不存在' 
        });
      }
      
      // 2. 验证学生是否存在
      const [studentRows] = await connection.execute(
        'SELECT id, username, real_name FROM users WHERE id = ?',
        [user_id]
      );
      
      if (studentRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学生不存在' 
        });
      }
      
      const currentStudent = studentRows[0];
      
      // 3. 找到该学生的老师
      const [teacherRows] = await connection.execute(`
        SELECT DISTINCT ts.teacher_id, u.username, u.real_name
        FROM teacher_students ts
        JOIN users u ON ts.teacher_id = u.id
        WHERE ts.student_id = ?
      `, [user_id]);
      
      if (teacherRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '该学生未绑定任何老师' 
        });
      }
      
      // 如果学生有多个老师，取第一个（或者可以返回多个老师的数据，这里先取第一个）
      const teacher = teacherRows[0];
      const teacherId = teacher.teacher_id;
      
      // 4. 获取该老师的所有学生（包括当前学生）
      const [allStudents] = await connection.execute(`
        SELECT DISTINCT u.id, u.username, u.real_name
        FROM users u
        JOIN teacher_students ts ON u.id = ts.student_id
        WHERE ts.teacher_id = ?
      `, [teacherId]);
      
      if (allStudents.length === 0) {
        connection.release();
        return res.json({
          success: true,
          data: {
            plan: planRows[0],
            teacher: {
              teacher_id: teacherId,
              username: teacher.username,
              real_name: teacher.real_name
            },
            students: [],
            current_student_rank: null
          }
        });
      }
      
      // 5. 获取计划的所有任务
      const [tasks] = await connection.execute(
        'SELECT id, name, task_order FROM learning_tasks WHERE plan_id = ? ORDER BY task_order',
        [planId]
      );
      
      const totalTasks = tasks.length;
      
      // 6. 为每个学生获取完成情况并计算排名
      const studentsProgress = [];
      
      for (const student of allStudents) {
        // 检查学生是否加入了该计划
        const [joined] = await connection.execute(
          'SELECT * FROM user_learning_plans WHERE user_id = ? AND plan_id = ?',
          [student.id, planId]
        );
        
        if (joined.length === 0) {
          // 学生未加入该计划，跳过（或者可以标记为未加入）
          continue;
        }
        
        // 获取计划完成进度
        const [planProgressRows] = await connection.execute(
          'SELECT * FROM user_plan_progress WHERE user_id = ? AND plan_id = ?',
          [student.id, planId]
        );
        
        const planProgress = planProgressRows[0] || {
          is_completed: false,
          completed_tasks: 0,
          total_tasks: totalTasks
        };
        
        // 计算完成的任务数
        let completedTasksCount = planProgress.completed_tasks || 0;
        
        // 如果进度表中没有数据，从任务进度表中统计
        if (completedTasksCount === 0 && totalTasks > 0) {
          const taskIds = tasks.map(t => t.id);
          const placeholders = taskIds.map(() => '?').join(',');
          const [completedTasksRows] = await connection.execute(
            `SELECT COUNT(*) as count FROM user_task_progress 
             WHERE user_id = ? AND task_id IN (${placeholders}) AND is_completed = 1`,
            [student.id, ...taskIds]
          );
          completedTasksCount = completedTasksRows[0]?.count || 0;
        }
        
        // 计算进度百分比
        const progressRate = totalTasks > 0 
          ? Math.round((completedTasksCount / totalTasks) * 100) 
          : 0;
        
        // 获取计划完成时间（如果已完成）
        const completedAt = planProgress.is_completed 
          ? (planProgress.completed_at || null)
          : null;
        
        studentsProgress.push({
          student_id: student.id,
          username: student.username,
          real_name: student.real_name,
          plan_progress: {
            is_completed: planProgress.is_completed === 1 || planProgress.is_completed === true,
            completed_tasks: completedTasksCount,
            total_tasks: totalTasks,
            progress_rate: progressRate,
            completed_at: completedAt
          }
        });
      }
      
      // 7. 按完成情况排序
      // 排序规则：1. 已完成优先 2. 完成的任务数多的优先 3. 完成时间早的优先（如果都完成了）
      studentsProgress.sort((a, b) => {
        // 已完成优先
        if (a.plan_progress.is_completed && !b.plan_progress.is_completed) return -1;
        if (!a.plan_progress.is_completed && b.plan_progress.is_completed) return 1;
        
        // 如果都已完成，按完成时间排序（早完成的排名靠前）
        if (a.plan_progress.is_completed && b.plan_progress.is_completed) {
          const timeA = a.plan_progress.completed_at ? new Date(a.plan_progress.completed_at).getTime() : 0;
          const timeB = b.plan_progress.completed_at ? new Date(b.plan_progress.completed_at).getTime() : 0;
          return timeA - timeB;
        }
        
        // 都未完成，按完成的任务数和进度百分比排序
        if (a.plan_progress.completed_tasks !== b.plan_progress.completed_tasks) {
          return b.plan_progress.completed_tasks - a.plan_progress.completed_tasks;
        }
        
        return b.plan_progress.progress_rate - a.plan_progress.progress_rate;
      });
      
      // 8. 添加排名并找到当前学生的排名
      let currentStudentRank = null;
      studentsProgress.forEach((student, index) => {
        student.rank = index + 1;
        if (student.student_id === parseInt(user_id)) {
          currentStudentRank = index + 1;
        }
      });
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          plan: planRows[0],
          teacher: {
            teacher_id: teacherId,
            username: teacher.username,
            real_name: teacher.real_name
          },
          current_student: {
            student_id: currentStudent.id,
            username: currentStudent.username,
            real_name: currentStudent.real_name,
            rank: currentStudentRank,
            total_students: studentsProgress.length
          },
          students: studentsProgress
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取班级排名失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取班级排名失败',
      message: error.message 
    });
  }
});

// ==================== 19. 学生查看全局排名 ====================
router.get('/learning-plans/:planId/global-ranking', async (req, res) => {
  try {
    const { planId } = req.params;
    const { user_id } = req.query;
    
    // 验证必需参数
    if (!user_id) {
      return res.status(400).json({ 
        success: false,
        error: '缺少必需参数: user_id'
      });
    }
    
    // Redis 缓存键：基于计划ID（排名列表对所有用户都一样，只需要基于planId）
    const cacheKey = `cache:learning-plan:global-ranking:${planId}`;
    const cacheDuration = 600; // 缓存600秒（10分钟，减少数据库查询压力）
    
    // 尝试从缓存获取排名列表
    try {
      const cached = await cacheUtils.get(cacheKey);
      if (cached && cached.students && cached.plan) {
        logger.info(`全局排名缓存命中: planId=${planId}`);
        
        // 从缓存中找到当前学生的排名信息和教师信息
        let currentStudentRank = null;
        let currentStudentTeachers = [];
        const studentsProgress = cached.students || [];
        
        studentsProgress.forEach((student, index) => {
          if (student.student_id === parseInt(user_id)) {
            currentStudentRank = index + 1;
            currentStudentTeachers = student.teachers || [];
          }
        });
        
        // 获取当前学生的基本信息
        const connection = await pool.getConnection();
        let currentStudent = null;
        try {
          const [studentRows] = await connection.execute(
            'SELECT id, username, real_name FROM users WHERE id = ?',
            [user_id]
          );
          if (studentRows.length > 0) {
            currentStudent = studentRows[0];
          }
        } catch (error) {
          logger.error('查询当前学生信息失败:', error);
        } finally {
          connection.release();
        }
        
        // 如果当前学生不在列表中，需要单独查询其教师信息（这种情况较少）
        if (currentStudentRank === null && currentStudent) {
          const connection2 = await pool.getConnection();
          try {
            const [teacherRows] = await connection2.execute(`
              SELECT DISTINCT u.id as teacher_id, u.username, u.real_name
              FROM users u
              JOIN teacher_students ts ON u.id = ts.teacher_id
              WHERE ts.student_id = ?
            `, [user_id]);
            currentStudentTeachers = teacherRows.map(teacher => ({
              teacher_id: teacher.teacher_id,
              username: teacher.username,
              real_name: teacher.real_name
            }));
          } catch (error) {
            logger.error('查询当前学生教师信息失败:', error);
          } finally {
            connection2.release();
          }
        }
        
        if (!currentStudent) {
          return res.status(404).json({ 
            success: false,
            error: '学生不存在' 
          });
        }
        
        return res.json({
          success: true,
          data: {
            plan: cached.plan,
            current_student: {
              student_id: currentStudent.id,
              username: currentStudent.username,
              real_name: currentStudent.real_name,
              rank: currentStudentRank,
              total_students: studentsProgress.length,
              teachers: currentStudentTeachers
            },
            students: studentsProgress
          }
        });
      }
    } catch (cacheError) {
      logger.warn('读取缓存失败，继续查询数据库:', cacheError.message);
      // 缓存读取失败时继续执行数据库查询
    }
    
    const connection = await pool.getConnection();
    
    try {
      // 1. 验证计划是否存在
      const [planRows] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [planId]
      );
      
      if (planRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学习计划不存在' 
        });
      }
      
      // 2. 验证学生是否存在
      const [studentRows] = await connection.execute(
        'SELECT id, username, real_name FROM users WHERE id = ?',
        [user_id]
      );
      
      if (studentRows.length === 0) {
        connection.release();
        return res.status(404).json({ 
          success: false,
          error: '学生不存在' 
        });
      }
      
      const currentStudent = studentRows[0];
      
      // 3. 获取该计划内所有加入的学生
      const [allStudents] = await connection.execute(`
        SELECT DISTINCT u.id, u.username, u.real_name
        FROM users u
        JOIN user_learning_plans ulp ON u.id = ulp.user_id
        WHERE ulp.plan_id = ?
      `, [planId]);
      
      if (allStudents.length === 0) {
        // 获取当前学生的教师信息
        const [teacherRows] = await connection.execute(`
          SELECT DISTINCT u.id as teacher_id, u.username, u.real_name
          FROM users u
          JOIN teacher_students ts ON u.id = ts.teacher_id
          WHERE ts.student_id = ?
        `, [user_id]);
        const currentStudentTeachers = teacherRows.map(teacher => ({
          teacher_id: teacher.teacher_id,
          username: teacher.username,
          real_name: teacher.real_name
        }));
        
        connection.release();
        return res.json({
          success: true,
          data: {
            plan: planRows[0],
            current_student: {
              student_id: currentStudent.id,
              username: currentStudent.username,
              real_name: currentStudent.real_name,
              rank: null,
              total_students: 0,
              teachers: currentStudentTeachers
            },
            students: []
          }
        });
      }
      
      // 4. 获取计划的所有任务
      const [tasks] = await connection.execute(
        'SELECT id, name, task_order FROM learning_tasks WHERE plan_id = ? ORDER BY task_order',
        [planId]
      );
      
      const totalTasks = tasks.length;
      
      // 5. 为每个学生获取完成情况并计算排名
      const studentsProgress = [];
      
      for (const student of allStudents) {
        // 获取计划完成进度
        const [planProgressRows] = await connection.execute(
          'SELECT * FROM user_plan_progress WHERE user_id = ? AND plan_id = ?',
          [student.id, planId]
        );
        
        const planProgress = planProgressRows[0] || {
          is_completed: false,
          completed_tasks: 0,
          total_tasks: totalTasks
        };
        
        // 计算完成的任务数（整数，用于兼容性）
        let completedTasksCount = planProgress.completed_tasks || 0;
        
        // 如果进度表中没有数据，从任务进度表中统计
        if (completedTasksCount === 0 && totalTasks > 0) {
          const taskIds = tasks.map(t => t.id);
          const placeholders = taskIds.map(() => '?').join(',');
          const [completedTasksRows] = await connection.execute(
            `SELECT COUNT(*) as count FROM user_task_progress 
             WHERE user_id = ? AND task_id IN (${placeholders}) AND is_completed = 1`,
            [student.id, ...taskIds]
          );
          completedTasksCount = completedTasksRows[0]?.count || 0;
        }
        
        // 统计计划内所有任务的客观题和OJ题完成情况，并计算精确的任务完成数
        let totalExams = 0;
        let completedExams = 0;
        let totalOjs = 0;
        let completedOjs = 0;
        let completedTasksPrecise = 0; // 精确的任务完成数（可以是小数）
        
        if (tasks.length > 0) {
          const taskIds = tasks.map(t => t.id);
          const placeholders = taskIds.map(() => '?').join(',');
          
          // 统计客观题总数和完成数
          const [examStats] = await connection.execute(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN uep.is_completed = 1 THEN 1 ELSE 0 END) as completed
            FROM task_exams te
            LEFT JOIN user_exam_progress uep ON te.exam_id = uep.exam_id 
              AND uep.user_id = ? AND uep.task_id = te.task_id
            WHERE te.task_id IN (${placeholders})
          `, [student.id, ...taskIds]);
          
          totalExams = Number(examStats[0]?.total || 0);
          completedExams = Number(examStats[0]?.completed || 0);
          
          // 统计OJ题总数和完成数
          const [ojStats] = await connection.execute(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN uop.is_completed = 1 THEN 1 ELSE 0 END) as completed
            FROM task_oj_problems top
            LEFT JOIN user_oj_progress uop ON top.problem_id = uop.problem_id 
              AND uop.user_id = ? AND uop.task_id = top.task_id
            WHERE top.task_id IN (${placeholders})
          `, [student.id, ...taskIds]);
          
          totalOjs = Number(ojStats[0]?.total || 0);
          completedOjs = Number(ojStats[0]?.completed || 0);
          
          // 计算每个任务的完成比例，累加得到精确的任务完成数
          // 优化：使用批量查询减少数据库查询次数
          if (taskIds.length > 0) {
            // 批量获取所有任务的客观题和OJ题总数
            const [taskExamTotals] = await connection.execute(`
              SELECT task_id, COUNT(*) as count 
              FROM task_exams 
              WHERE task_id IN (${placeholders})
              GROUP BY task_id
            `, [...taskIds]);
            
            const [taskOjTotals] = await connection.execute(`
              SELECT task_id, COUNT(*) as count 
              FROM task_oj_problems 
              WHERE task_id IN (${placeholders})
              GROUP BY task_id
            `, [...taskIds]);
            
            // 批量获取该学生所有任务的完成情况
            const [taskExamCompleted] = await connection.execute(`
              SELECT te.task_id, COUNT(*) as count 
              FROM task_exams te
              JOIN user_exam_progress uep ON te.exam_id = uep.exam_id 
                AND uep.user_id = ? AND uep.task_id = te.task_id AND uep.is_completed = 1
              WHERE te.task_id IN (${placeholders})
              GROUP BY te.task_id
            `, [student.id, ...taskIds]);
            
            const [taskOjCompleted] = await connection.execute(`
              SELECT top.task_id, COUNT(*) as count 
              FROM task_oj_problems top
              JOIN user_oj_progress uop ON top.problem_id = uop.problem_id 
                AND uop.user_id = ? AND uop.task_id = top.task_id AND uop.is_completed = 1
              WHERE top.task_id IN (${placeholders})
              GROUP BY top.task_id
            `, [student.id, ...taskIds]);
            
            // 转换为Map以便快速查找
            const examTotalMap = new Map();
            taskExamTotals.forEach(row => {
              examTotalMap.set(row.task_id, Number(row.count || 0));
            });
            
            const ojTotalMap = new Map();
            taskOjTotals.forEach(row => {
              ojTotalMap.set(row.task_id, Number(row.count || 0));
            });
            
            const examCompletedMap = new Map();
            taskExamCompleted.forEach(row => {
              examCompletedMap.set(row.task_id, Number(row.count || 0));
            });
            
            const ojCompletedMap = new Map();
            taskOjCompleted.forEach(row => {
              ojCompletedMap.set(row.task_id, Number(row.count || 0));
            });
            
            // 遍历所有任务，计算完成比例
            for (const task of tasks) {
              const taskExamTotal = examTotalMap.get(task.id) || 0;
              const taskOjTotal = ojTotalMap.get(task.id) || 0;
              const taskTotalQuestions = taskExamTotal + taskOjTotal;
              
              // 如果任务没有题目，跳过（不计算进度）
              if (taskTotalQuestions === 0) {
                continue;
              }
              
              const taskCompletedExams = examCompletedMap.get(task.id) || 0;
              const taskCompletedOjs = ojCompletedMap.get(task.id) || 0;
              const taskCompletedQuestions = taskCompletedExams + taskCompletedOjs;
              
              // 计算该任务的完成比例（0-1之间）
              const taskProgressRatio = taskCompletedQuestions / taskTotalQuestions;
              
              // 累加到精确的任务完成数
              completedTasksPrecise += taskProgressRatio;
            }
          }
          
          // 保留2位小数
          completedTasksPrecise = Math.round(completedTasksPrecise * 100) / 100;
        }
        
        // 计算进度百分比（基于精确的任务完成数）
        const progressRate = totalTasks > 0 
          ? Math.round((completedTasksPrecise / totalTasks) * 100) 
          : 0;
        
        // 获取计划完成时间（如果已完成）
        const completedAt = planProgress.is_completed 
          ? (planProgress.completed_at || null)
          : null;
        
        // 获取学生绑定的教师信息
        const [teacherRows] = await connection.execute(`
          SELECT DISTINCT u.id as teacher_id, u.username, u.real_name
          FROM users u
          JOIN teacher_students ts ON u.id = ts.teacher_id
          WHERE ts.student_id = ?
        `, [student.id]);
        
        const teachers = teacherRows.map(teacher => ({
          teacher_id: teacher.teacher_id,
          username: teacher.username,
          real_name: teacher.real_name
        }));
        
        studentsProgress.push({
          student_id: student.id,
          username: student.username,
          real_name: student.real_name,
          teachers: teachers,
          plan_progress: {
            is_completed: planProgress.is_completed === 1 || planProgress.is_completed === true,
            completed_tasks: completedTasksCount,
            completed_tasks_precise: completedTasksPrecise, // 精确的任务完成数（可以是小数，如2.33）
            total_tasks: totalTasks,
            progress_rate: progressRate,
            completed_at: completedAt,
            // 添加客观题统计
            completed_exams: completedExams,
            total_exams: totalExams,
            // 添加OJ题统计
            completed_ojs: completedOjs,
            total_ojs: totalOjs
          }
        });
      }
      
      // 6. 按完成情况排序
      // 排序规则：1. 已完成优先 2. 按精确的任务完成数（completed_tasks_precise）排序，多的优先 3. 完成时间早的优先（如果都完成了）
      studentsProgress.sort((a, b) => {
        // 已完成优先
        if (a.plan_progress.is_completed && !b.plan_progress.is_completed) return -1;
        if (!a.plan_progress.is_completed && b.plan_progress.is_completed) return 1;
        
        // 如果都已完成，按完成时间排序（早完成的排名靠前）
        if (a.plan_progress.is_completed && b.plan_progress.is_completed) {
          const timeA = a.plan_progress.completed_at ? new Date(a.plan_progress.completed_at).getTime() : 0;
          const timeB = b.plan_progress.completed_at ? new Date(b.plan_progress.completed_at).getTime() : 0;
          return timeA - timeB;
        }
        
        // 都未完成，按精确的任务完成数排序（支持小数，如2.33）
        const preciseA = a.plan_progress.completed_tasks_precise || 0;
        const preciseB = b.plan_progress.completed_tasks_precise || 0;
        if (preciseA !== preciseB) {
          return preciseB - preciseA; // 降序排列，完成数多的在前
        }
        
        // 如果精确任务完成数相同，按进度百分比排序
        return b.plan_progress.progress_rate - a.plan_progress.progress_rate;
      });
      
      // 7. 添加排名并找到当前学生的排名，同时获取当前学生的教师信息
      let currentStudentRank = null;
      let currentStudentTeachers = [];
      
      studentsProgress.forEach((student, index) => {
        student.rank = index + 1;
        if (student.student_id === parseInt(user_id)) {
          currentStudentRank = index + 1;
          currentStudentTeachers = student.teachers; // 获取当前学生的教师信息
        }
      });
      
      // 如果当前学生不在排名列表中，单独获取其教师信息
      if (currentStudentRank === null) {
        const [teacherRows] = await connection.execute(`
          SELECT DISTINCT u.id as teacher_id, u.username, u.real_name
          FROM users u
          JOIN teacher_students ts ON u.id = ts.teacher_id
          WHERE ts.student_id = ?
        `, [user_id]);
        currentStudentTeachers = teacherRows.map(teacher => ({
          teacher_id: teacher.teacher_id,
          username: teacher.username,
          real_name: teacher.real_name
        }));
      }
      
      connection.release();
      
      // 将排名列表和计划信息存入缓存（异步，不阻塞响应）
      // 缓存内容不包括当前学生的特定信息，因为不同用户请求时当前学生不同
      const cacheData = {
        plan: planRows[0],
        students: studentsProgress
      };
      
      cacheUtils.set(cacheKey, cacheData, cacheDuration)
        .then(() => {
          logger.info(`全局排名缓存已写入: planId=${planId}, 缓存时间=${cacheDuration}秒`);
        })
        .catch(error => {
          logger.error('写入缓存失败:', error.message);
          // 缓存失败不影响响应
        });
      
      res.json({
        success: true,
        data: {
          plan: planRows[0],
          current_student: {
            student_id: currentStudent.id,
            username: currentStudent.username,
            real_name: currentStudent.real_name,
            rank: currentStudentRank,
            total_students: studentsProgress.length,
            teachers: currentStudentTeachers // 添加当前学生的教师信息
          },
          students: studentsProgress
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取全局排名失败:', error);
    res.status(500).json({ 
      success: false,
      error: '获取全局排名失败',
      message: error.message 
    });
  }
});

// ==================== 17. 上传复习内容 PDF ====================
router.post('/learning-tasks/upload-review-pdf', reviewUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传 PDF 文件'
      });
    }

    const filePath = '/' + req.file.path.replace(/\\/g, '/');
    
    res.json({
      success: true,
      message: 'PDF 上传成功',
      data: {
        file_path: filePath,
        file_name: req.file.originalname,
        file_size: req.file.size
      }
    });
  } catch (error) {
    logger.error('上传复习内容 PDF 失败:', error);
    res.status(500).json({
      success: false,
      error: '上传失败',
      message: error.message
    });
  }
});

// ==================== 获取单个学习计划详情 ====================
router.get('/learning-plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params;
    
    const connection = await pool.getConnection();
    
    try {
      // 获取计划基本信息
      const [planRows] = await connection.execute(
        'SELECT * FROM learning_plans WHERE id = ?',
        [planId]
      );
      
      if (planRows.length === 0) {
        connection.release();
        return res.status(404).json({
          success: false,
          error: '学习计划不存在'
        });
      }
      
      const plan = planRows[0];
      
      // 获取计划的任务统计
      const [taskStats] = await connection.execute(`
        SELECT 
          COUNT(DISTINCT lt.id) as total_tasks,
          COUNT(DISTINCT te.exam_id) as total_exams,
          COUNT(DISTINCT top.problem_id) as total_oj_problems
        FROM learning_plans lp
        LEFT JOIN learning_tasks lt ON lp.id = lt.plan_id
        LEFT JOIN task_exams te ON lt.id = te.task_id
        LEFT JOIN task_oj_problems top ON lt.id = top.task_id
        WHERE lp.id = ?
      `, [planId]);
      
      connection.release();
      
      res.json({
        success: true,
        data: {
          ...plan,
          ...taskStats[0]
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('获取学习计划详情失败:', error);
    res.status(500).json({
      success: false,
      error: '获取学习计划详情失败',
      message: error.message
    });
  }
});

// ==================== 17. 计划模板管理 ====================

// 17.1 获取所有模板列表
router.get('/plan-templates', async (req, res) => {
  try {
    const { category, level } = req.query;
    const connection = await pool.getConnection();

    try {
      let sql = 'SELECT pt.*, (SELECT COUNT(*) FROM template_tasks WHERE template_id = pt.id) as task_count FROM plan_templates pt WHERE 1=1';
      const params = [];

      if (category) {
        sql += ' AND pt.category = ?';
        params.push(category);
      }
      if (level) {
        sql += ' AND pt.level = ?';
        params.push(parseInt(level));
      }

      sql += ' ORDER BY pt.updated_at DESC';

      const [templates] = await connection.execute(sql, params);
      connection.release();

      res.json({ success: true, data: templates });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('获取模板列表失败:', error);
    res.status(500).json({ success: false, error: '获取模板列表失败', message: error.message });
  }
});

// 17.2 获取模板详情（含任务和选题）
router.get('/plan-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [templates] = await connection.execute('SELECT * FROM plan_templates WHERE id = ?', [id]);
      if (templates.length === 0) {
        connection.release();
        return res.status(404).json({ success: false, error: '模板不存在' });
      }

      const template = templates[0];

      const [tasks] = await connection.execute(`
        SELECT
          tt.*,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('exam_id', tte.exam_id, 'exam_order', tte.exam_order))
           FROM template_task_exams tte WHERE tte.template_task_id = tt.id) as exams,
          (SELECT JSON_ARRAYAGG(JSON_OBJECT('problem_id', ttop.problem_id, 'problem_order', ttop.problem_order))
           FROM template_task_oj_problems ttop WHERE ttop.template_task_id = tt.id) as oj_problems
        FROM template_tasks tt
        WHERE tt.template_id = ?
        ORDER BY tt.task_order
      `, [id]);

      connection.release();

      res.json({
        success: true,
        data: { ...template, tasks }
      });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('获取模板详情失败:', error);
    res.status(500).json({ success: false, error: '获取模板详情失败', message: error.message });
  }
});

// 17.3 创建模板（从现有计划保存）
router.post('/plan-templates', async (req, res) => {
  try {
    const { name, description, category, level, plan_id } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '缺少必需参数: name' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      let templateCategory = category;
      let templateLevel = level ? parseInt(level) : null;
      let tasks = null;

      // 如果提供了 plan_id，从计划复制完整结构
      if (plan_id) {
        const [planRows] = await connection.execute('SELECT * FROM learning_plans WHERE id = ?', [plan_id]);
        if (planRows.length === 0) {
          await connection.rollback();
          connection.release();
          return res.status(404).json({ success: false, error: '学习计划不存在' });
        }
        const plan = planRows[0];
        templateCategory = templateCategory || plan.category;
        templateLevel = templateLevel !== null ? templateLevel : plan.level;

        // 获取计划的所有任务
        const [planTasks] = await connection.execute(
          'SELECT * FROM learning_tasks WHERE plan_id = ? ORDER BY task_order',
          [plan_id]
        );
        tasks = planTasks;
      }

      // 创建模板
      const [templateResult] = await connection.execute(`
        INSERT INTO plan_templates (name, description, category, level)
        VALUES (?, ?, ?, ?)
      `, [name, description || null, templateCategory || 'GESP', templateLevel]);

      const templateId = templateResult.insertId;

      // 如果有任务，复制任务结构
      if (tasks && tasks.length > 0) {
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const [taskResult] = await connection.execute(`
            INSERT INTO template_tasks (template_id, name, description, review_content, review_content_type, review_video_url, task_order, start_time, end_time, is_exam_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            templateId,
            task.name || `任务${i + 1}`,
            task.description || null,
            task.review_content || null,
            task.review_content_type || 'text',
            task.review_video_url || null,
            task.task_order !== undefined ? task.task_order : i + 1,
            task.start_time || null,
            task.end_time || null,
            task.is_exam_mode || 0
          ]);

          const templateTaskId = taskResult.insertId;

          // 复制客观题关联
          const [taskExams] = await connection.execute(
            'SELECT * FROM task_exams WHERE task_id = ? ORDER BY exam_order',
            [task.id]
          );
          for (const exam of taskExams) {
            await connection.execute(
              'INSERT INTO template_task_exams (template_task_id, exam_id, exam_order) VALUES (?, ?, ?)',
              [templateTaskId, exam.exam_id, exam.exam_order]
            );
          }

          // 复制OJ编程题关联
          const [taskOjProblems] = await connection.execute(
            'SELECT * FROM task_oj_problems WHERE task_id = ? ORDER BY problem_order',
            [task.id]
          );
          for (const problem of taskOjProblems) {
            await connection.execute(
              'INSERT INTO template_task_oj_problems (template_task_id, problem_id, problem_order) VALUES (?, ?, ?)',
              [templateTaskId, problem.problem_id, problem.problem_order]
            );
          }
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: '模板创建成功',
        data: { id: templateId, name }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('创建模板失败:', error);
    res.status(500).json({ success: false, error: '创建模板失败', message: error.message });
  }
});

// 17.4 更新模板
router.put('/plan-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, category, level } = req.body;

    const connection = await pool.getConnection();
    await connection.execute(
      'UPDATE plan_templates SET name = ?, description = ?, category = ?, level = ? WHERE id = ?',
      [name, description || null, category || 'GESP', level ? parseInt(level) : null, id]
    );
    connection.release();

    res.json({ success: true, message: '模板更新成功' });
  } catch (error) {
    logger.error('更新模板失败:', error);
    res.status(500).json({ success: false, error: '更新模板失败', message: error.message });
  }
});

// 17.5 删除模板
router.delete('/plan-templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();
    await connection.execute('DELETE FROM plan_templates WHERE id = ?', [id]);
    connection.release();

    res.json({ success: true, message: '模板删除成功' });
  } catch (error) {
    logger.error('删除模板失败:', error);
    res.status(500).json({ success: false, error: '删除模板失败', message: error.message });
  }
});

// 17.6 从模板创建学习计划
router.post('/plan-templates/:id/create-plan', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start_time, end_time, description } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: '缺少必需参数: name' });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 获取模板详情
      const [templates] = await connection.execute('SELECT * FROM plan_templates WHERE id = ?', [id]);
      if (templates.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, error: '模板不存在' });
      }

      const template = templates[0];

      // 获取模板任务
      const [templateTasks] = await connection.execute(
        'SELECT * FROM template_tasks WHERE template_id = ? ORDER BY task_order',
        [id]
      );

      if (templateTasks.length === 0) {
        await connection.rollback();
        connection.release();
        return res.status(400).json({ success: false, error: '模板没有任务' });
      }

      // 创建学习计划
      const [planResult] = await connection.execute(`
        INSERT INTO learning_plans (name, description, level, category, start_time, end_time, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `, [
        name,
        description || template.description || null,
        template.level,
        template.category,
        start_time || null,
        end_time || null
      ]);

      const planId = planResult.insertId;

      // 按模板创建任务（时间按比例缩放）
      const templateStart = templateTasks[0].start_time ? new Date(templateTasks[0].start_time).getTime() : null;
      const templateEnd = templateTasks[templateTasks.length - 1].end_time ? new Date(templateTasks[templateTasks.length - 1].end_time).getTime() : null;

      const planStart = start_time ? new Date(start_time).getTime() : null;
      const planEnd = end_time ? new Date(end_time).getTime() : null;

      for (let i = 0; i < templateTasks.length; i++) {
        const tTask = templateTasks[i];
        let taskStartTime = null;
        let taskEndTime = null;

        // 如果模板和计划都有时间，按比例缩放
        if (templateStart && templateEnd && planStart && planEnd) {
          const tStart = new Date(tTask.start_time).getTime();
          const tEnd = new Date(tTask.end_time).getTime();
          const tTotal = templateEnd - templateStart;
          const pTotal = planEnd - planStart;
          if (tTotal > 0 && pTotal > 0) {
            const ratio = pTotal / tTotal;
            taskStartTime = new Date(planStart + (tStart - templateStart) * ratio).toISOString().slice(0, 19).replace('T', ' ');
            taskEndTime = new Date(planStart + (tEnd - templateStart) * ratio).toISOString().slice(0, 19).replace('T', ' ');
          }
        }

        const [taskResult] = await connection.execute(`
          INSERT INTO learning_tasks (plan_id, name, description, review_content, review_content_type, review_video_url, start_time, end_time, task_order, is_exam_mode)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          planId,
          tTask.name,
          tTask.description || null,
          tTask.review_content || null,
          tTask.review_content_type || 'text',
          tTask.review_video_url || null,
          taskStartTime,
          taskEndTime,
          tTask.task_order !== undefined ? tTask.task_order : i + 1,
          tTask.is_exam_mode || 0
        ]);

        const newTaskId = taskResult.insertId;

        // 复制客观题关联
        const [taskExams] = await connection.execute(
          'SELECT * FROM template_task_exams WHERE template_task_id = ? ORDER BY exam_order',
          [tTask.id]
        );
        for (const exam of taskExams) {
          await connection.execute(
            'INSERT INTO task_exams (task_id, exam_id, exam_order) VALUES (?, ?, ?)',
            [newTaskId, exam.exam_id, exam.exam_order]
          );
        }

        // 复制OJ编程题关联
        const [taskOjProblems] = await connection.execute(
          'SELECT * FROM template_task_oj_problems WHERE template_task_id = ? ORDER BY problem_order',
          [tTask.id]
        );
        for (const problem of taskOjProblems) {
          await connection.execute(
            'INSERT INTO task_oj_problems (task_id, problem_id, problem_order) VALUES (?, ?, ?)',
            [newTaskId, problem.problem_id, problem.problem_order]
          );
        }
      }

      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: '从模板创建计划成功',
        data: { id: planId, name }
      });
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('从模板创建计划失败:', error);
    res.status(500).json({ success: false, error: '从模板创建计划失败', message: error.message });
  }
});

module.exports = router;
module.exports.updateTaskCompletionStatus = updateTaskCompletionStatus;
module.exports.updatePlanCompletionStatus = updatePlanCompletionStatus;
