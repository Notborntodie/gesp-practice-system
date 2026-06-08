const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool, getValidCategories } = require('../config/database');
const { cacheMiddleware, cacheUtils } = require('../config/cache');
const { logger } = require('../config/logger');

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制5MB
  },
  fileFilter: function (req, file, cb) {
    const allowedExt = /jpeg|jpg|png|gif|webp|bmp|svg/;
    const extname = allowedExt.test(path.extname(file.originalname).toLowerCase());
    const allowedMime = /^image\/(jpeg|png|gif|webp|bmp|svg\+xml)$/;
    const mimetype = allowedMime.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('不支持的图片格式，仅支持 JPEG/PNG/GIF/WebP/BMP/SVG'));
    }
  }
});

// 获取全部题目接口（带缓存）
router.get('/questions', cacheMiddleware(300, 'questions'), async (req, res) => {
  try {
    const connection = await pool.getConnection();

    const listMode = req.query.list === '1' || req.query.mode === 'list';
    const questionFields = listMode
      ? 'id, public_id, category, level, question_date, created_at, updated_at, exam_count, exam_summary'
      : '*';

    // 获取题目基本信息（列表模式只返回管理表格需要的轻量字段）
    const [questionRows] = await connection.execute(
      `SELECT ${questionFields} FROM questions ORDER BY id`
    );

    if (questionRows.length === 0) {
      connection.release();
      return res.json([]);
    }

    // 批量获取所有知识点关联（替代逐题 N+1 查询）
    const questionIds = questionRows.map(q => q.id);
    const [kpRows] = await connection.execute(`
      SELECT qkp.question_id, kp.id, kp.name, kp.category, kp.level
      FROM question_knowledge_points qkp
      JOIN knowledge_points kp ON kp.id = qkp.knowledge_point_id
      WHERE qkp.question_id IN (${questionIds.map(() => '?').join(',')})
    `, questionIds);

    // 按 question_id 分组
    const kpMap = {};
    for (const row of kpRows) {
      if (!kpMap[row.question_id]) kpMap[row.question_id] = [];
      kpMap[row.question_id].push({ id: row.id, name: row.name, category: row.category, level: row.level });
    }

    // 组装结果
    const result = questionRows.map(q => ({
      ...q,
      knowledge_points: kpMap[q.id] || []
    }));

    connection.release();
    res.json(result);
  } catch (err) {
    logger.error('获取题目列表错误', { error: err.message });
    res.status(500).json({ error: '数据库查询失败' });
  }
});

// 获取题目详情（包含知识点）
router.get('/questions/:questionId', cacheMiddleware(300, 'question'), async (req, res) => {
  try {
    const { questionId } = req.params;
    const connection = await pool.getConnection();
    
    // 获取题目基本信息
    const [questionRows] = await connection.execute(
      'SELECT * FROM questions WHERE id = ?',
      [questionId]
    );
    
    if (questionRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: '题目不存在' });
    }
    
    const question = questionRows[0];
    
    // 获取选项
    const [optionRows] = await connection.execute(
      'SELECT * FROM options WHERE question_id = ? ORDER BY option_label',
      [questionId]
    );
    
    // 将选项字段转换为前端期望的格式
    const formattedOptions = optionRows.map(option => ({
      id: option.id,
      question_id: option.question_id,
      label: option.option_label,
      value: option.option_value,
      text: option.option_text
    }));
    
    // 获取关联的知识点
    const [knowledgeRows] = await connection.execute(`
      SELECT kp.* FROM knowledge_points kp
      JOIN question_knowledge_points qkp ON kp.id = qkp.knowledge_point_id
      WHERE qkp.question_id = ?
    `, [questionId]);
    
    // 获取图片
    const [imageRows] = await connection.execute(
      'SELECT * FROM question_images WHERE question_id = ? ORDER BY display_order',
      [questionId]
    );
    
    connection.release();
    
    res.json({
      ...question,
      options: formattedOptions,
      knowledge_points: knowledgeRows,
      images: imageRows
    });
    
  } catch (error) {
    logger.error('获取题目详情错误', { error: error.message, questionId });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 上传题目图片
router.post('/upload-image', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.message && err.message.includes('不支持的图片格式')) {
        return res.status(400).json({ error: err.message });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: '图片大小不能超过5MB' });
      }
      return res.status(500).json({ error: '图片上传失败: ' + err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择图片文件' });
    }
    
    // 图片 URL：优先用 BASE_URL；在反向代理后从请求头推断（避免 IP 或错误端口导致 404/Mixed Content）
    let baseUrl = process.env.BASE_URL;
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    const host = req.get('x-forwarded-host') || req.get('host');
    if (!baseUrl || (host && /https?:\/\/\d+\.\d+\.\d+\.\d+/.test(baseUrl))) {
      baseUrl = host ? `${proto}://${host}` : `http://localhost:${process.env.PORT || 3000}`;
    }
    const imageUrl = `${baseUrl.replace(/\/$/, '')}/uploads/${req.file.filename}`;
    res.json({ 
      message: '图片上传成功',
      imageUrl: imageUrl,
      filename: req.file.filename
    });
  } catch (error) {
    logger.error('图片上传错误', { error: error.message });
    res.status(500).json({ error: '图片上传失败' });
  }
});

// 上传题目
router.post('/upload-question', async (req, res) => {
  try {
    const {
      question_text,
      question_type = 'text',
      question_code = null,
      correct_answer,
      explanation = '',
      level = null,
      category = 'GESP', // 默认为 GESP
      difficulty = 'medium',
      image_url = null,
      question_date = null,
      knowledge_point_ids = [],
      options = []
    } = req.body;

    if (!question_text || question_text.trim() === '') {
      return res.status(400).json({
        error: '缺少必需参数',
        required: ['question_text'],
        received: { question_text }
      });
    }

    // 验证 category 参数（如果提供）
    if (category) {
      const validCategories = await getValidCategories();
      if (!validCategories.includes(category)) {
        return res.status(400).json({
          error: `category 必须是以下值之一：${validCategories.join(', ')}`,
          received: category
        });
      }
    }

    // GESP 分类必须有 level
    if (category === 'GESP' && !level) {
      return res.status(400).json({
        error: 'GESP 分类必须指定 level',
        received: { category, level }
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 插入题目
      const [questionResult] = await connection.execute(
        `INSERT INTO questions (question_text, question_type,
         question_code, correct_answer, explanation, level, category, difficulty, image_url, question_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [question_text, question_type || 'text', question_code || null, correct_answer,
         explanation || '', level || null, category || 'GESP', difficulty || 'medium', image_url || null, question_date]
      );
      
      const questionId = questionResult.insertId;
      
      // 插入选项
      if (options && options.length > 0) {
        for (const option of options) {
          if (option.label && option.value && option.text) {
            await connection.execute(
              'INSERT INTO options (question_id, option_label, option_value, option_text) VALUES (?, ?, ?, ?)',
              [questionId, option.label, option.value, option.text]
            );
          }
        }
      }
      
      // 关联知识点（先检查是否存在，与批量上传保持一致）
      if (knowledge_point_ids && knowledge_point_ids.length > 0) {
        for (const knowledgePointId of knowledge_point_ids) {
          if (knowledgePointId) {
            const [knowledgePointExists] = await connection.execute(
              'SELECT id FROM knowledge_points WHERE id = ?',
              [knowledgePointId]
            );
            
            if (knowledgePointExists.length > 0) {
              await connection.execute(
                'INSERT INTO question_knowledge_points (question_id, knowledge_point_id) VALUES (?, ?)',
                [questionId, knowledgePointId]
              );
            } else {
              console.warn(`知识点ID ${knowledgePointId} 不存在，跳过关联`);
            }
          }
        }
      }
      
      // 记录上传历史
      await connection.execute(
        'INSERT INTO question_uploads (user_id, question_id, upload_type, upload_status) VALUES (?, ?, ?, ?)',
        [1, questionId, 'manual', 'approved']
      );
      
      await connection.commit();
      
      // 清除相关缓存
      await cacheUtils.delPattern('questions:*');
      await cacheUtils.delPattern('exam:*');
      
      res.json({ 
        message: '题目上传成功',
        questionId: questionId
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    logger.error('上传题目错误', { error: error.message });
    res.status(500).json({ 
      error: '题目上传失败',
      details: error.message 
    });
  }
});

// 批量上传题目
router.post('/upload-questions-batch', async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ 
        error: '缺少题目数据或格式错误',
        required: 'questions array with at least one question'
      });
    }
    
    const connection = await pool.getConnection();
    const results = [];
    
    try {
      await connection.beginTransaction();
      
      for (let i = 0; i < questions.length; i++) {
        const questionData = questions[i];
        const {
          question_text,
          question_type = 'text',
          question_code = null,
          correct_answer,
          explanation = '',
          level = null,
          category = 'GESP', // 默认为 GESP
          difficulty = 'medium',
          image_url = null,
          question_date = null,
          knowledge_point_ids = [],
          options = []
        } = questionData;

        if (!question_text || question_text.trim() === '') {
          throw new Error(`第${i + 1}题缺少必需参数: question_text=${question_text}`);
        }

        // 验证 category 参数（如果提供）
        if (category) {
          const validCategories = await getValidCategories();
          if (!validCategories.includes(category)) {
            throw new Error(`第${i + 1}题的category参数无效: ${category}`);
          }
        }

        // GESP 分类必须有 level
        if (category === 'GESP' && !level) {
          throw new Error(`第${i + 1}题为GESP分类，必须指定level`);
        }

        const [questionResult] = await connection.execute(
          `INSERT INTO questions (question_text, question_type, question_code,
           correct_answer, explanation, level, category, difficulty, image_url, question_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [question_text, question_type, question_code, correct_answer,
           explanation, level || null, category, difficulty, image_url, question_date]
        );
        const questionId = questionResult.insertId;
        
        if (options && options.length > 0) {
          for (const option of options) {
            if (option.label && option.value && option.text) {
              await connection.execute(
                'INSERT INTO options (question_id, option_label, option_value, option_text) VALUES (?, ?, ?, ?)',
                [questionId, option.label, option.value, option.text]
              );
            }
          }
        }
        
        if (knowledge_point_ids && knowledge_point_ids.length > 0) {
          for (const knowledgePointId of knowledge_point_ids) {
            if (knowledgePointId) {
              const [knowledgePointExists] = await connection.execute(
                'SELECT id FROM knowledge_points WHERE id = ?',
                [knowledgePointId]
              );
              
              if (knowledgePointExists.length > 0) {
                await connection.execute(
                  'INSERT INTO question_knowledge_points (question_id, knowledge_point_id) VALUES (?, ?)',
                  [questionId, knowledgePointId]
                );
              } else {
                console.warn(`知识点ID ${knowledgePointId} 不存在，跳过关联`);
              }
            }
          }
        }
        
        results.push({
          questionId: questionId,
          status: 'success',
          index: i + 1
        });
      }
      
      await connection.commit();
      
      // 清除相关缓存
      await cacheUtils.delPattern('questions:*');
      await cacheUtils.delPattern('exam:*'); // 清除考试缓存，因为考试中包含题目信息
      
      res.json({ 
        message: `批量上传成功，共上传 ${results.length} 道题目`,
        results: results
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('[批量上传] 错误详情:', error.message, error.stack);
    logger.error('批量上传题目错误', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      error: '批量上传失败',
      details: error.message 
    });
  }
});

// 更新题目
router.put('/questions/:questionId', async (req, res) => {
  const { questionId } = req.params;
  try {
    const {
      question_text,
      question_type,
      question_code,
      correct_answer,
      explanation,
      level,
      category,
      difficulty,
      image_url,
      question_date,
      knowledge_point_ids = [],
      options = []
    } = req.body;

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

      // 确保所有参数都有有效值，避免undefined
      const safeParams = [
        question_text || '',
        question_type || 'text',
        question_code || null,
        correct_answer || '',
        explanation || '',
        level !== undefined ? level : null,
        category || 'GESP',
        difficulty || 'medium',
        image_url || null,
        question_date || null,
        questionId
      ];

      // 更新题目基本信息
      await connection.execute(
        `UPDATE questions SET question_text = ?, question_type = ?, question_code = ?, correct_answer = ?,
         explanation = ?, level = ?, category = ?, difficulty = ?, image_url = ?, question_date = ? WHERE id = ?`,
        safeParams
      );
      
      // 删除旧的选项
      await connection.execute('DELETE FROM options WHERE question_id = ?', [questionId]);
      
      // 插入新的选项
      if (options && options.length > 0) {
        for (const option of options) {
          if (option.label && option.value && option.text) {
            await connection.execute(
              'INSERT INTO options (question_id, option_label, option_value, option_text) VALUES (?, ?, ?, ?)',
              [questionId, option.label, option.value, option.text]
            );
          }
        }
      }
      
      // 删除旧的知识点关联
      await connection.execute('DELETE FROM question_knowledge_points WHERE question_id = ?', [questionId]);
      
      // 插入新的知识点关联
      if (knowledge_point_ids && knowledge_point_ids.length > 0) {
        for (const knowledgePointId of knowledge_point_ids) {
          if (knowledgePointId) {
            await connection.execute(
              'INSERT INTO question_knowledge_points (question_id, knowledge_point_id) VALUES (?, ?)',
              [questionId, knowledgePointId]
            );
          }
        }
      }
      
      await connection.commit();
      
      // 清除相关缓存
      await cacheUtils.delPattern('question:*');
      await cacheUtils.delPattern('questions:*');
      await cacheUtils.delPattern('exam:*'); // 清除考试缓存，因为考试中包含题目信息
      
      res.json({ message: '题目更新成功' });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    logger.error('更新题目错误', { error: error.message, questionId });
    res.status(500).json({ error: '题目更新失败' });
  }
});

// 批量更新题目---有问题的
router.put('/questions/batch', async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ 
        error: '缺少题目数据或格式错误',
        required: 'questions array with at least one question'
      });
    }
    
    const results = [];
    const errors = [];
    
    // 循环调用单个更新API
    for (let i = 0; i < questions.length; i++) {
      const questionData = questions[i];
      const { id: questionId } = questionData;
      
      if (!questionId) {
        errors.push({
          questionId: null,
          status: 'error',
          index: i + 1,
          error: '缺少必需参数: id'
        });
        continue;
      }
      
      try {
        // 模拟单个更新请求
        const updateReq = {
          body: questionData
        };
        
        // 调用单个更新逻辑
        const connection = await pool.getConnection();
        
        try {
          await connection.beginTransaction();
          
          const {
            question_text,
            question_type,
            question_code,
            correct_answer,
            explanation,
            level,
            difficulty,
            image_url,
            question_date,
            knowledge_point_ids = [],
            options = []
          } = questionData;
          
          // 确保所有参数都有有效值，避免undefined
          const safeParams = [
            question_text || '',
            question_type || 'text',
            question_code || null,
            correct_answer || '',
            explanation || '',
            level !== undefined ? level : null,
            difficulty || 'medium',
            image_url || null,
            question_date || null,
            questionId
          ];
          
          // 更新题目基本信息
          await connection.execute(
            `UPDATE questions SET question_text = ?, question_type = ?, question_code = ?, correct_answer = ?, 
             explanation = ?, level = ?, difficulty = ?, image_url = ?, question_date = ? WHERE id = ?`,
            safeParams
          );
          
          // 删除旧的选项
          await connection.execute('DELETE FROM options WHERE question_id = ?', [questionId]);
          
          // 插入新的选项
          if (options && options.length > 0) {
            for (const option of options) {
              if (option.label && option.value && option.text) {
                await connection.execute(
                  'INSERT INTO options (question_id, option_label, option_value, option_text) VALUES (?, ?, ?, ?)',
                  [questionId, option.label, option.value, option.text]
                );
              }
            }
          }
          
          // 删除旧的知识点关联
          await connection.execute('DELETE FROM question_knowledge_points WHERE question_id = ?', [questionId]);
          
          // 插入新的知识点关联
          if (knowledge_point_ids && knowledge_point_ids.length > 0) {
            for (const knowledgePointId of knowledge_point_ids) {
              if (knowledgePointId) {
                await connection.execute(
                  'INSERT INTO question_knowledge_points (question_id, knowledge_point_id) VALUES (?, ?)',
                  [questionId, knowledgePointId]
                );
              }
            }
          }
          
          await connection.commit();
          
          // 清除相关缓存
          await cacheUtils.delPattern('cache:question:*');
          await cacheUtils.delPattern('cache:questions:*');
          await cacheUtils.delPattern('cache:exam:*');
          
          results.push({
            questionId: questionId,
            status: 'success',
            index: i + 1
          });
          
        } catch (error) {
          await connection.rollback();
          throw error;
        } finally {
          connection.release();
        }
        
      } catch (error) {
        console.error(`第${i + 1}题更新失败:`, error);
        errors.push({
          questionId: questionId,
          status: 'error',
          index: i + 1,
          error: error.message
        });
      }
    }
    
    // 返回结果
    if (errors.length > 0) {
      res.json({
        message: `批量更新完成，成功 ${results.length} 道，失败 ${errors.length} 道`,
        results: results,
        errors: errors
      });
    } else {
      res.json({
        message: `批量更新成功，共更新 ${results.length} 道题目`,
        results: results
      });
    }
    
  } catch (error) {
    logger.error('批量更新题目错误', { error: error.message });
    res.status(500).json({ 
      error: '批量更新失败',
      details: error.message 
    });
  }
});

// 删除题目
router.delete('/questions/:questionId', async (req, res) => {
  try {
    const { questionId } = req.params;
    const connection = await pool.getConnection();
    
    await connection.execute('DELETE FROM questions WHERE id = ?', [questionId]);
    connection.release();
    
    // 清除相关缓存
    await cacheUtils.delPattern('question:*');
    await cacheUtils.delPattern('questions:*');
    await cacheUtils.delPattern('exam:*'); // 清除考试缓存，因为考试中包含题目信息
  
    res.json({ message: '题目删除成功' });
  } catch (error) {
    logger.error('删除题目错误', { error: error.message, questionId });
    res.status(500).json({ error: '题目删除失败' });
  }
});

// 获取题目上传历史
router.get('/question-uploads', async (req, res) => {
  try {
    const { status, user_id } = req.query;
    const connection = await pool.getConnection();
    
    let sql = `
      SELECT qu.*, q.question_text, q.question_code, u.username 
      FROM question_uploads qu
      JOIN questions q ON qu.question_id = q.id
      JOIN users u ON qu.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND qu.upload_status = ?';
      params.push(status);
    }
    
    if (user_id) {
      sql += ' AND qu.user_id = ?';
      params.push(user_id);
    }
    
    sql += ' ORDER BY qu.created_at DESC';
    
    const [results] = await connection.execute(sql, params);
    connection.release();
    
    res.json(results);
  } catch (error) {
    logger.error('获取上传历史错误', { error: error.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// 审核题目上传
router.put('/question-uploads/:uploadId/review', async (req, res) => {
  try {
    const { uploadId } = req.params;
    const { status, review_notes } = req.body;
    
    const connection = await pool.getConnection();
    
    await connection.execute(
      'UPDATE question_uploads SET upload_status = ?, review_notes = ? WHERE id = ?',
      [status, review_notes, uploadId]
    );
    
    connection.release();
    
    res.json({ message: '审核完成' });
  } catch (error) {
    logger.error('审核题目错误', { error: error.message, uploadId });
    res.status(500).json({ error: '审核失败' });
  }
});

module.exports = router;
