const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { logger } = require('../config/logger');

// ==================== 可复用的提交考试函数 ====================
/**
 * 提交考试答案（可复用函数）
 * @param {Object} connection - 数据库连接
 * @param {number} user_id - 用户ID
 * @param {number} exam_id - 考试ID
 * @param {Array} answers - 答案数组
 * @param {number|null} task_id - 任务ID（可选，用于任务内提交）
 * @param {number|null} practice_duration_seconds - 本次练习持续时间（秒，可选）
 * @param {number|null} test_attempt_id - Test 参与 ID（可选，用于 Test 内提交）
 * @returns {Promise<Object>} 提交结果
 */
async function submitExamInternal(connection, user_id, exam_id, answers, task_id = null, practice_duration_seconds = null, test_attempt_id = null) {
  // 获取考试信息
  const [examRows] = await connection.execute(
    'SELECT * FROM exams WHERE id = ?',
    [exam_id]
  );
  
  if (examRows.length === 0) {
    throw new Error('考试不存在');
  }
  
  // 获取用户信息
  const [userRows] = await connection.execute(
    'SELECT * FROM users WHERE id = ?',
    [user_id]
  );
  
  if (userRows.length === 0) {
    throw new Error('用户不存在');
  }
  
  // 获取考试题目
  const [questionRows] = await connection.execute(`
    SELECT q.*, eq.question_number
    FROM questions q
    JOIN exam_questions eq ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.question_number
  `, [exam_id]);
  
  if (questionRows.length === 0) {
    throw new Error('考试中没有题目');
  }
  
  // 计算尝试次数
  const [attemptRows] = await connection.execute(
    'SELECT MAX(attempt_number) as max_attempt FROM submissions WHERE user_id = ? AND exam_id = ?',
    [user_id, exam_id]
  );
  
  const attemptNumber = (attemptRows[0].max_attempt || 0) + 1;
  
  // 创建提交记录（task_id / test_attempt_id 可选；practice_duration_seconds 为本次练习持续时间）
  const [submissionResult] = await connection.execute(
    'INSERT INTO submissions (user_id, exam_id, task_id, test_attempt_id, attempt_number, score, practice_duration_seconds) VALUES (?, ?, ?, ?, ?, 0, ?)',
    [user_id, exam_id, task_id, test_attempt_id, attemptNumber, practice_duration_seconds]
  );
  
  const submissionId = submissionResult.insertId;
  let correctCount = 0;
  const submissionAnswers = [];
  
  // 处理每道题的答案
  for (const answer of answers) {
    const { question_id, user_answer } = answer;
    
    // 验证题目是否在此考试中
    const questionInExam = questionRows.find(q => q.id === question_id);
    if (!questionInExam) {
      throw new Error(`题目ID ${question_id} 不在此考试中`);
    }
    
    // 检查答案是否正确
    const isCorrect = user_answer === questionInExam.correct_answer;
    if (isCorrect) {
      correctCount++;
    }
    
    // 记录答题详情
    await connection.execute(
      'INSERT INTO submission_answers (submission_id, question_id, user_answer, is_correct) VALUES (?, ?, ?, ?)',
      [submissionId, question_id, user_answer, isCorrect ? 1 : 0]
    );
    
    submissionAnswers.push({
      question_id,
      user_answer,
      is_correct: isCorrect,
      correct_answer: questionInExam.correct_answer,
      question_text: questionInExam.question_text
    });
  }
  
  // 计算得分
  const score = Math.round((correctCount / questionRows.length) * 100);
  
  // 更新提交记录的得分和练习时长
  await connection.execute(
    'UPDATE submissions SET score = ?, practice_duration_seconds = ? WHERE id = ?',
    [score, practice_duration_seconds, submissionId]
  );
  
  // 如果提供了task_id，更新任务内的客观题进度（只有60分以上才标记为完成）
  if (task_id !== null) {
    const isCompleted = score >= 60; // 完成标准：60分以上
    const [existingProgress] = await connection.execute(
      'SELECT * FROM user_exam_progress WHERE user_id = ? AND exam_id = ? AND task_id = ?',
      [user_id, exam_id, task_id]
    );
    
    if (existingProgress.length > 0) {
      // 更新现有进度
      const currentBestScore = existingProgress[0].best_score || 0;
      const newBestScore = Math.max(currentBestScore, score);
      // 只有新分数>=60分才标记为完成，或者之前已完成则保持完成状态
      const newIsCompleted = newBestScore >= 60 || existingProgress[0].is_completed;
      
      await connection.execute(`
        UPDATE user_exam_progress 
        SET is_completed = ?,
            best_score = ?,
            attempt_count = attempt_count + 1,
            completed_at = CASE WHEN ? AND completed_at IS NULL THEN NOW() ELSE completed_at END,
            updated_at = NOW()
        WHERE user_id = ? AND exam_id = ? AND task_id = ?
      `, [newIsCompleted ? 1 : 0, newBestScore, newIsCompleted ? 1 : 0, user_id, exam_id, task_id]);
    } else {
      // 创建新进度记录（只有60分以上才标记为完成）
      await connection.execute(`
        INSERT INTO user_exam_progress 
        (user_id, exam_id, task_id, is_completed, best_score, attempt_count, completed_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `, [user_id, exam_id, task_id, isCompleted ? 1 : 0, score, isCompleted ? new Date() : null]);
    }
  }
  
  return {
    submission_id: submissionId,
    score: score,
    total_questions: questionRows.length,
    correct_count: correctCount,
    attempt_number: attemptNumber,
    answers: submissionAnswers
  };
}

// 提交考试答案
router.post('/submit-exam', async (req, res) => {
  try {
    const { user_id, exam_id, answers, practice_duration_seconds } = req.body;
    
    // 验证必需参数
    if (!user_id || !exam_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ 
        error: '缺少必需参数',
        required: 'user_id, exam_id, answers array'
      });
    }
    
    const connection = await pool.getConnection();
    
    // 开始事务
    await connection.beginTransaction();
    
    try {
      const result = await submitExamInternal(connection, user_id, exam_id, answers, null, practice_duration_seconds ?? null);
      
      await connection.commit();
      connection.release();
      
      res.json({
        message: '考试提交成功',
        ...result
      });
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    logger.error('提交考试错误', { error: error.message });
    res.status(500).json({ error: '提交考试失败', details: error.message });
  }
});

// 获取用户的提交记录
router.get('/submissions', async (req, res) => {
  try {
    const { user_id, exam_id } = req.query;
    const connection = await pool.getConnection();
    
    let sql = `
      SELECT s.*, e.name as exam_name, e.level as exam_level
      FROM submissions s
      JOIN exams e ON s.exam_id = e.id
      WHERE 1=1
    `;
    const params = [];
    
    if (user_id) {
      sql += ' AND s.user_id = ?';
      params.push(user_id);
    }
    
    if (exam_id) {
      sql += ' AND s.exam_id = ?';
      params.push(exam_id);
    }
    
    sql += ' ORDER BY s.submit_time DESC';
    
    const [results] = await connection.execute(sql, params);
    connection.release();
    
    res.json(results);
  } catch (error) {
    logger.error('获取提交记录错误', { error: error.message });
    res.status(500).json({ error: '获取提交记录失败' });
  }
});

// 获取单次提交的详细答案
router.get('/submissions/:submissionId', async (req, res) => {
  try {
    const { submissionId } = req.params;
    const connection = await pool.getConnection();
    
    // 获取提交基本信息
    const [submissionRows] = await connection.execute(`
      SELECT s.*, e.name as exam_name, e.level as exam_level, u.username
      FROM submissions s
      JOIN exams e ON s.exam_id = e.id
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [submissionId]);
    
    if (submissionRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: '提交记录不存在' });
    }
    
    const submission = submissionRows[0];
    
    // 获取详细答题信息（含题目代码、图片等完整内容）
    const [answerRows] = await connection.execute(`
      SELECT sa.*, q.question_text, q.question_type, q.question_code, 
             q.correct_answer, q.explanation, q.level, q.difficulty,
             q.image_url,
             eq.question_number
      FROM submission_answers sa
      JOIN questions q ON sa.question_id = q.id
      JOIN exam_questions eq ON q.id = eq.question_id AND eq.exam_id = ?
      WHERE sa.submission_id = ?
      ORDER BY eq.question_number
    `, [submission.exam_id, submissionId]);
    
    // 获取选项信息
    const questionIds = answerRows.map(row => row.question_id);
    let options = [];
    if (questionIds.length > 0) {
      const [optionRows] = await connection.execute(`
        SELECT o.* FROM options o 
        WHERE o.question_id IN (${questionIds.map(() => '?').join(',')})
        ORDER BY o.question_id, o.option_label
      `, questionIds);
      options = optionRows;
    }
    
    // 整理答案数据
    const answers = answerRows.map(answer => {
      const questionOptions = options.filter(opt => opt.question_id === answer.question_id);
      // 将选项字段转换为前端期望的格式
      const formattedOptions = questionOptions.map(option => ({
        id: option.id,
        question_id: option.question_id,
        label: option.option_label,
        value: option.option_value,
        text: option.option_text
      }));
      return {
        ...answer,
        options: formattedOptions
      };
    });
    
    connection.release();
    
    res.json({
      submission: submission,
      answers: answers
    });
    
  } catch (error) {
    logger.error('获取提交详情错误', { error: error.message, submissionId });
    res.status(500).json({ error: '获取提交详情失败' });
  }
});

// 获取用户的所有错题
router.get('/wrong-questions', async (req, res) => {
  try {
    const { user_id, level, difficulty, limit = 50 } = req.query;
    const connection = await pool.getConnection();
    
    // 如果没有user_id，返回空数组
    if (!user_id) {
      connection.release();
      return res.json([]);
    }
    
    let sql = `
      SELECT DISTINCT q.*, sa.user_answer, sa.is_correct, sa.created_at as answered_at,
             e.name as exam_name, e.level as exam_level
      FROM questions q
      JOIN submission_answers sa ON q.id = sa.question_id
      JOIN submissions s ON sa.submission_id = s.id
      JOIN exams e ON s.exam_id = e.id
      WHERE sa.is_correct = 0 AND s.user_id = ${user_id}
    `;
    
    if (level) {
      sql += ` AND q.level = ${level}`;
    }
    
    if (difficulty) {
      sql += ` AND q.difficulty = '${difficulty}'`;
    }
    
    sql += ` ORDER BY sa.created_at DESC LIMIT ${Number(limit) || 50}`;
    
    const [results] = await connection.execute(sql);
    
    // 为每道题获取选项
    const questionIds = results.map(row => row.id);
    let options = [];
    if (questionIds.length > 0) {
      const [optionRows] = await connection.execute(`
        SELECT o.* FROM options o 
        WHERE o.question_id IN (${questionIds.join(',')})
        ORDER BY o.question_id, o.option_label
      `);
      options = optionRows;
    }
    
    // 整理数据
    const wrongQuestions = results.map(question => {
      const questionOptions = options.filter(opt => opt.question_id === question.id);
      // 将选项字段转换为前端期望的格式
      const formattedOptions = questionOptions.map(option => ({
        id: option.id,
        question_id: option.question_id,
        label: option.option_label,
        value: option.option_value,
        text: option.option_text
      }));
      return {
        ...question,
        options: formattedOptions
      };
    });
    
    connection.release();
    
    res.json(wrongQuestions);
    
  } catch (error) {
    logger.error('获取错题错误', { error: error.message });
    res.status(500).json({ error: '获取错题失败' });
  }
});

// 获取用户的答题统计
router.get('/user-stats', async (req, res) => {
  try {
    const { user_id } = req.query;
    const connection = await pool.getConnection();
    
    if (!user_id) {
      return res.status(400).json({ error: '缺少user_id参数' });
    }
    
    // 获取基本统计
    const [statsRows] = await connection.execute(`
      SELECT 
        COUNT(DISTINCT s.id) as total_submissions,
        COUNT(DISTINCT s.exam_id) as total_exams,
        AVG(s.score) as average_score,
        MAX(s.score) as best_score,
        MIN(s.score) as worst_score
      FROM submissions s
      WHERE s.user_id = ?
    `, [user_id]);
    
    // 获取答题详情统计
    const [answerStatsRows] = await connection.execute(`
      SELECT 
        COUNT(*) as total_answers,
        SUM(sa.is_correct) as correct_answers,
        COUNT(*) - SUM(sa.is_correct) as wrong_answers,
        ROUND(SUM(sa.is_correct) * 100.0 / COUNT(*), 2) as correct_rate
      FROM submission_answers sa
      JOIN submissions s ON sa.submission_id = s.id
      WHERE s.user_id = ?
    `, [user_id]);
    
    // 获取按等级统计
    const [levelStatsRows] = await connection.execute(`
      SELECT 
        q.level,
        COUNT(*) as question_count,
        SUM(sa.is_correct) as correct_count,
        ROUND(SUM(sa.is_correct) * 100.0 / COUNT(*), 2) as correct_rate
      FROM submission_answers sa
      JOIN submissions s ON sa.submission_id = s.id
      JOIN questions q ON sa.question_id = q.id
      WHERE s.user_id = ?
      GROUP BY q.level
      ORDER BY q.level
    `, [user_id]);
    
    connection.release();
    
    res.json({
      basic_stats: statsRows[0],
      answer_stats: answerStatsRows[0],
      level_stats: levelStatsRows
    });
    
  } catch (error) {
    logger.error('获取用户统计错误', { error: error.message });
    res.status(500).json({ error: '获取用户统计失败' });
  }
});

// 获取考试排行榜
router.get('/exam-leaderboard', async (req, res) => {
  try {
    const { exam_id, limit = 20 } = req.query;
    const connection = await pool.getConnection();
    
    if (!exam_id) {
      return res.status(400).json({ error: '缺少exam_id参数' });
    }
    
    const [results] = await connection.execute(`
      SELECT 
        s.score,
        s.submit_time,
        s.attempt_number,
        u.username,
        e.name as exam_name
      FROM submissions s
      JOIN users u ON s.user_id = u.id
      JOIN exams e ON s.exam_id = e.id
      WHERE s.exam_id = ${exam_id}
      ORDER BY s.score DESC, s.submit_time ASC
      LIMIT ${Number(limit) || 20}
    `);
    
    connection.release();
    
    res.json(results);
    
  } catch (error) {
    logger.error('获取排行榜错误', { error: error.message });
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

// 导出可复用函数
module.exports = router;
module.exports.submitExamInternal = submitExamInternal;
