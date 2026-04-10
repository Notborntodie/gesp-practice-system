const express = require('express');
const router = express.Router();
const { pool, getValidCategories } = require('../config/database');
const { cacheMiddleware, cacheUtils } = require('../config/cache');
const { logger } = require('../config/logger');

// 获取考试信息（带缓存）
router.get('/exam/:examId', cacheMiddleware(600, 'exam'), async (req, res) => {
  try {
    const { examId } = req.params;
    
    // 使用缓存工具函数获取考试详情（包含数据层缓存）
    const examDetail = await cacheUtils.exam.getExamDetail(examId, pool);
    
    if (!examDetail) {
      return res.status(404).json({ error: '考试不存在' });
    }
    
    res.json(examDetail);
  } catch (error) {
    logger.error('获取考试信息错误', { error: error.message, examId });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取考试列表（带缓存和过滤）
router.get('/exams', cacheMiddleware(300, 'exams'), async (req, res) => {
  try {
    const { level, category, name, difficulty, type, include_all } = req.query;
    const connection = await pool.getConnection();
    const forBankOnly = !include_all; // 题库列表只显示 bank_visible=1；管理/选题传 include_all=1 可见全部

    let sql = `
      SELECT e.*, COUNT(eq.question_id) as question_count
      FROM exams e
      LEFT JOIN exam_questions eq ON e.id = eq.exam_id
      WHERE 1=1
    `;
    const params = [];

    if (forBankOnly) {
      sql += ' AND e.bank_visible = 1';
    }

    // 按等级过滤
    if (level) {
      sql += ' AND e.level = ?';
      params.push(level);
    }

    // 按 category 过滤
    if (category) {
      sql += ' AND e.category = ?';
      params.push(category);
    }

    // 按名称过滤（模糊搜索）
    if (name) {
      sql += ' AND e.name LIKE ?';
      params.push(`%${name}%`);
    }

    // 按难度过滤（如果有难度字段的话）
    if (difficulty) {
      sql += ' AND e.difficulty = ?';
      params.push(difficulty);
    }

    // 按类型过滤
    if (type) {
      sql += ' AND e.type = ?';
      params.push(type);
    }

    sql += ' GROUP BY e.id ORDER BY e.created_at DESC';

    const [examRows] = await connection.execute(sql, params);

    connection.release();
    res.json(examRows);
  } catch (error) {
    logger.error('获取考试列表错误', { error: error.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取单个考试详情（包含题目信息）
router.get('/exams/:examId', cacheMiddleware(300, 'exam'), async (req, res) => {
  try {
    const { examId } = req.params;
    
    // 使用缓存工具函数获取考试详情（包含数据层缓存）
    const examDetail = await cacheUtils.exam.getExamDetail(examId, pool);
    
    if (!examDetail) {
      return res.status(404).json({ error: '考试不存在' });
    }
    
    res.json(examDetail);
  } catch (error) {
    logger.error('获取考试详情错误', { error: error.message, examId });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建新考试
router.post('/exams', async (req, res) => {
  try {
    const {
      name,
      level,
      category = 'GESP', // 默认为 GESP
      description = '',
      type = '真题', // 默认为真题类型
      bank_visible = 1, // 题库可见，默认可见
      question_ids = [] // 题目ID数组，包含题目在考试中的编号信息
    } = req.body;

    // 验证必需参数
    if (!name) {
      return res.status(400).json({
        error: '缺少必需参数',
        required: ['name'],
        received: { name }
      });
    }

    // GESP 分类必须有 level
    if (category === 'GESP' && !level) {
      return res.status(400).json({
        error: 'GESP 分类必须指定 level',
        required: ['name', 'level'],
        received: { name, level }
      });
    }

    // 验证type参数
    if (type && !['真题', '模拟', '专项'].includes(type)) {
      return res.status(400).json({
        error: '无效的考试类型',
        valid_types: ['真题', '模拟', '专项'],
        received: type
      });
    }

    // 验证 category 参数
    const validCategories = await getValidCategories();
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({
        error: `category 必须是以下值之一：${validCategories.join(', ')}`,
        received: category
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 创建考试
      const [examResult] = await connection.execute(
        'INSERT INTO exams (name, level, category, description, type, total_questions, bank_visible) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, level || null, category, description, type, question_ids.length, bank_visible ? 1 : 0]
      );
      
      const examId = examResult.insertId;
      
      // 关联题目到考试
      if (question_ids && question_ids.length > 0) {
        for (let i = 0; i < question_ids.length; i++) {
          const questionData = question_ids[i];
          const questionId = typeof questionData === 'object' ? questionData.id : questionData;
          const questionNumber = typeof questionData === 'object' ? questionData.question_number : (i + 1);
          
          // 验证题目是否存在
          const [questionExists] = await connection.execute(
            'SELECT id FROM questions WHERE id = ?',
            [questionId]
          );
          
          if (questionExists.length === 0) {
            throw new Error(`题目ID ${questionId} 不存在`);
          }
          
          // 检查题目是否已经在此考试中
          const [existingQuestion] = await connection.execute(
            'SELECT id FROM exam_questions WHERE exam_id = ? AND question_id = ?',
            [examId, questionId]
          );
          
          if (existingQuestion.length > 0) {
            throw new Error(`题目ID ${questionId} 已经在此考试中`);
          }
          
          // 检查题号是否重复
          const [existingNumber] = await connection.execute(
            'SELECT id FROM exam_questions WHERE exam_id = ? AND question_number = ?',
            [examId, questionNumber]
          );
          
          if (existingNumber.length > 0) {
            throw new Error(`题号 ${questionNumber} 在此考试中已存在`);
          }
          
          // 插入考试-题目关联
          await connection.execute(
            'INSERT INTO exam_questions (exam_id, question_id, question_number) VALUES (?, ?, ?)',
            [examId, questionId, questionNumber]
          );
        }
      }
      
      await connection.commit();
      
      // 清除相关缓存
      await cacheUtils.exam.clearExamList();
      await cacheUtils.exam.clearExam(examId);
      
      res.json({ 
        message: '考试创建成功',
        examId: examId,
        questionCount: question_ids.length
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    logger.error('创建考试错误', { error: error.message });
    res.status(500).json({ 
      error: '考试创建失败',
      details: error.message 
    });
  }
});

// 更新考试信息
router.put('/exams/:examId', async (req, res) => {
  try {
    const { examId } = req.params;
    const {
      name,
      level,
      category,
      description,
      type,
      bank_visible,
      question_ids = [] // 题目ID数组，包含题目在考试中的编号信息
    } = req.body;

    // 验证type参数
    if (type && !['真题', '模拟', '专项'].includes(type)) {
      return res.status(400).json({
        error: '无效的考试类型',
        valid_types: ['真题', '模拟', '专项'],
        received: type
      });
    }

    // 验证 category 参数（如果提供）
    if (category !== undefined) {
      const validCategories = await getValidCategories();
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: `category 必须是以下值之一：${validCategories.join(', ')}`,
          received: category
        });
      }
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 检查考试是否存在
      const [examExists] = await connection.execute(
        'SELECT id FROM exams WHERE id = ?',
        [examId]
      );

      if (examExists.length === 0) {
        throw new Error('考试不存在');
      }

      // 更新考试基本信息
      if (name || level || category !== undefined || description !== undefined || type !== undefined || bank_visible !== undefined) {
        const updateFields = [];
        const updateValues = [];

        if (name) {
          updateFields.push('name = ?');
          updateValues.push(name);
        }
        if (level !== undefined) {
          updateFields.push('level = ?');
          updateValues.push(level || null);
        }
        if (category !== undefined) {
          updateFields.push('category = ?');
          updateValues.push(category);
        }
        if (description !== undefined) {
          updateFields.push('description = ?');
          updateValues.push(description);
        }
        if (type !== undefined) {
          updateFields.push('type = ?');
          updateValues.push(type);
        }
        if (bank_visible !== undefined) {
          updateFields.push('bank_visible = ?');
          updateValues.push(bank_visible ? 1 : 0);
        }

        updateValues.push(examId);
        
        await connection.execute(
          `UPDATE exams SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues
        );
      }
      
      // 更新题目关联
      if (Array.isArray(question_ids)) {
        // 删除现有的题目关联
        await connection.execute('DELETE FROM exam_questions WHERE exam_id = ?', [examId]);
        
        // 添加新的题目关联
        if (question_ids.length > 0) {
          for (let i = 0; i < question_ids.length; i++) {
            const questionData = question_ids[i];
            const questionId = typeof questionData === 'object' ? questionData.id : questionData;
            const questionNumber = typeof questionData === 'object' ? questionData.question_number : (i + 1);
            
            // 验证题目是否存在
            const [questionExists] = await connection.execute(
              'SELECT id FROM questions WHERE id = ?',
              [questionId]
            );
            
            if (questionExists.length === 0) {
              throw new Error(`题目ID ${questionId} 不存在`);
            }
            
            // 检查题号是否重复
            const [existingNumber] = await connection.execute(
              'SELECT id FROM exam_questions WHERE exam_id = ? AND question_number = ?',
              [examId, questionNumber]
            );
            
            if (existingNumber.length > 0) {
              throw new Error(`题号 ${questionNumber} 在此考试中已存在`);
            }
            
            // 插入考试-题目关联
            await connection.execute(
              'INSERT INTO exam_questions (exam_id, question_id, question_number) VALUES (?, ?, ?)',
              [examId, questionId, questionNumber]
            );
          }
        }
        
        // 更新考试的总题目数
        await connection.execute(
          'UPDATE exams SET total_questions = ? WHERE id = ?',
          [question_ids.length, examId]
        );
      }
      
      await connection.commit();
      
      // 清除相关缓存
      await cacheUtils.exam.clearExamList();
      await cacheUtils.exam.clearExam(examId);
      
      res.json({ message: '考试更新成功' });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    logger.error('更新考试错误', { error: error.message, examId });
    res.status(500).json({ 
      error: '考试更新失败',
      details: error.message 
    });
  }
});

// 删除考试
router.delete('/exams/:examId', async (req, res) => {
  try {
    const { examId } = req.params;
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();
      
      // 检查考试是否存在
      const [examExists] = await connection.execute(
        'SELECT id FROM exams WHERE id = ?',
        [examId]
      );
      
      if (examExists.length === 0) {
        throw new Error('考试不存在');
      }
      
      // 删除考试（会自动删除相关的exam_questions记录，因为设置了CASCADE）
      await connection.execute('DELETE FROM exams WHERE id = ?', [examId]);
      
      await connection.commit();
      
      // 清除相关缓存
      await cacheUtils.exam.clearExamList();
      await cacheUtils.exam.clearExam(examId);
      
      res.json({ message: '考试删除成功' });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    logger.error('删除考试错误', { error: error.message, examId });
    res.status(500).json({ 
      error: '考试删除失败',
      details: error.message 
    });
  }
});

// 获取可用题目列表（用于选择题目添加到考试）
router.get('/available-questions', cacheMiddleware(300, 'available-questions'), async (req, res) => {
  try {
    const { level, difficulty, category, exam_id } = req.query;
    const connection = await pool.getConnection();
    
    let sql = `
      SELECT q.*, 
             GROUP_CONCAT(DISTINCT kp.name ORDER BY kp.name SEPARATOR ', ') as knowledge_points
      FROM questions q
      LEFT JOIN question_knowledge_points qkp ON q.id = qkp.question_id
      LEFT JOIN knowledge_points kp ON qkp.knowledge_point_id = kp.id
      WHERE 1=1
    `;
    const params = [];
    
    if (level) {
      sql += ' AND q.level = ?';
      params.push(level);
    }
    
    if (difficulty) {
      sql += ' AND q.difficulty = ?';
      params.push(difficulty);
    }
    
    if (category) {
      sql += ' AND kp.category = ?';
      params.push(category);
    }
    
    // 如果指定了exam_id，排除已经在此考试中的题目
    if (exam_id) {
      sql += ' AND q.id NOT IN (SELECT question_id FROM exam_questions WHERE exam_id = ?)';
      params.push(exam_id);
    }
    
    sql += ' GROUP BY q.id ORDER BY q.created_at DESC';
    
    const [results] = await connection.execute(sql, params);
    connection.release();
    
    res.json(results);
  } catch (error) {
    logger.error('获取可用题目错误', { error: error.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
