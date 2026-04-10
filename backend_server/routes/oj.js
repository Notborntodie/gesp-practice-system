const express = require('express');
const router = express.Router();
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { logger } = require('../config/logger');
const { pool, getValidCategories } = require('../config/database');
const { cacheUtils } = require('../config/cache');
const { getQueueStatus } = require('../services/judgeQueue');
const { judgeCode } = require('../services/isolateJudge');  // 使用 isolate 轻量级判题

const execFileAsync = promisify(execFile);

/** admin / super_admin 可查看全站 OJ 提交 */
async function userIsOjAdmin(userId) {
  const uid = parseInt(userId, 10);
  if (!uid || Number.isNaN(uid)) return false;
  const [rows] = await pool.execute(
    `SELECT 1 FROM user_roles ur
     INNER JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ? AND r.name IN ('admin', 'super_admin')`,
    [uid]
  );
  return rows.length > 0;
}

// ==================== 可复用的OJ提交函数（同步版本，用于任务内提交） ====================
/**
 * 提交OJ代码（同步版本，用于任务内提交）
 * @param {Object} connection - 数据库连接
 * @param {number} user_id - 用户ID
 * @param {number} problem_id - 题目ID
 * @param {string} code - 代码
 * @param {string} language - 语言
 * @param {number|null} task_id - 任务ID（可选，用于任务内提交）
 * @param {number|null} practice_duration_seconds - 本次练习持续时间（秒，可选）
 * @param {number|null} test_attempt_id - Test 参与 ID（可选，用于 Test 内提交）
 * @returns {Promise<Object>} 提交结果
 */
async function submitOjInternal(connection, user_id, problem_id, code, language, task_id = null, practice_duration_seconds = null, test_attempt_id = null) {
  // 验证题目是否存在
  const [problemRows] = await connection.execute(
    'SELECT * FROM oj_problems WHERE id = ?',
    [problem_id]
  );
  
  if (problemRows.length === 0) {
    throw new Error('题目不存在');
  }
  
  const problem = problemRows[0];
  
  // 获取题目的测试样例
  const [samplesRows] = await connection.execute(
    'SELECT * FROM oj_samples WHERE problem_id = ? ORDER BY sort_order',
    [problem_id]
  );
  
  if (samplesRows.length === 0) {
    throw new Error('题目缺少测试样例，无法判题');
  }
  
  const samples = samplesRows.map(sample => ({
    input: sample.input || '',
    output: sample.output || '',
    is_hidden: sample.is_hidden || false
  }));
  
  // 判题
  let status = 'completed';
  let verdict = 'Accepted';
  let totalTests = 0;
  let passedTests = 0;
  let serializedResults = null;
  let errorMessage = null;
  let judgeDuration = 0;
  const judgeStart = Date.now();
  
  try {
    const judgeResult = await judgeCode(code, samples, {
      timeLimit: problem.time_limit,
      memoryLimit: problem.memory_limit
    });
    judgeDuration = Date.now() - judgeStart;
    
    verdict = judgeResult.verdict;
    totalTests = judgeResult.totalTests;
    passedTests = judgeResult.passedTests;
    serializedResults = judgeResult.results ? JSON.stringify(judgeResult.results) : null;
  } catch (judgeError) {
    status = 'error';
    verdict = 'Judge Error';
    errorMessage = judgeError.message || '判题失败';
    judgeDuration = Date.now() - judgeStart;
    totalTests = samples.length;
    passedTests = 0;
    
    logger.error('判题失败', {
      problemId: problem_id,
      error: judgeError.message
    });
  }
  
  // 创建提交记录（task_id / test_attempt_id 可选；practice_duration_seconds 为本次练习持续时间）
  const [insertResult] = await connection.execute(
    `INSERT INTO oj_submissions (
      problem_id,
      task_id,
      test_attempt_id,
      code,
      language,
      status,
      verdict,
      total_tests,
      passed_tests,
      results,
      error_message,
      submit_time,
      practice_duration_seconds,
      judge_start_time,
      judge_end_time,
      judge_duration,
      user_id,
      ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW(), ?, ?, NULL)`,
    [
      problem_id,
      task_id,
      test_attempt_id,
      code,
      language,
      status,
      verdict,
      totalTests,
      passedTests,
      serializedResults,
      errorMessage,
      practice_duration_seconds,
      judgeDuration,
      user_id
    ]
  );
  
  const submissionId = insertResult.insertId;
  const isAccepted = verdict === 'Accepted';
  
  // 更新题目统计
  if (status === 'completed') {
    const accepted = isAccepted ? 1 : 0;
    await connection.execute(
      `UPDATE oj_problems 
       SET total_submissions = total_submissions + 1,
           accepted_submissions = accepted_submissions + ?
       WHERE id = ?`,
      [accepted, problem_id]
    );
  }
  
  // 如果提供了task_id，更新任务内的OJ进度（只有Accepted才标记为完成）
  if (task_id !== null) {
    const [existingProgress] = await connection.execute(
      'SELECT * FROM user_oj_progress WHERE user_id = ? AND problem_id = ? AND task_id = ?',
      [user_id, problem_id, task_id]
    );
    
    if (existingProgress.length > 0) {
      // 更新现有进度
      const currentBestVerdict = existingProgress[0].best_verdict;
      const newBestVerdict = isAccepted ? 'Accepted' : (currentBestVerdict === 'Accepted' ? 'Accepted' : verdict);
      // 只有Accepted才标记为完成，或者之前已完成
      const newIsCompleted = isAccepted || existingProgress[0].is_completed;
      
      await connection.execute(`
        UPDATE user_oj_progress 
        SET is_completed = ?,
            best_verdict = ?,
            attempt_count = attempt_count + 1,
            completed_at = CASE WHEN ? AND completed_at IS NULL THEN NOW() ELSE completed_at END,
            updated_at = NOW()
        WHERE user_id = ? AND problem_id = ? AND task_id = ?
      `, [newIsCompleted ? 1 : 0, newBestVerdict, newIsCompleted ? 1 : 0, user_id, problem_id, task_id]);
    } else {
      // 创建新进度记录（只有Accepted才标记为完成）
      await connection.execute(`
        INSERT INTO user_oj_progress 
        (user_id, problem_id, task_id, is_completed, best_verdict, attempt_count, completed_at)
        VALUES (?, ?, ?, ?, ?, 1, ?)
      `, [user_id, problem_id, task_id, isAccepted ? 1 : 0, verdict, isAccepted ? new Date() : null]);
    }
  }
  
  return {
    submission_id: submissionId,
    status,
    verdict,
    total_tests: totalTests,
    passed_tests: passedTests,
    results: serializedResults ? JSON.parse(serializedResults) : [],
    duration: judgeDuration,
    error: errorMessage
  };
}

/**
 * 在线代码运行接口
 * POST /api/oj/run
 * 
 * 请求体:
 * {
 *   "code": "用户编写的C++代码",
 *   "language": "cpp",
 *   "input": "3\n2 3 4",
 *   "output": "7"
 * }
 * 
 * 响应:
 * {
 *   "success": true,
 *   "input": "3\n2 3 4",
 *   "expected": "7",
 *   "actual": "7",
 *   "error": null
 * }
 */
router.post('/oj/run', async (req, res) => {
  try {
    const { code, language, input, output: expected } = req.body;
    
    // 参数验证
    if (!code || !language) {
      return res.status(400).json({
        success: false,
        input: input || '',
        expected: expected || '',
        actual: '',
        error: '缺少必要参数：code 和 language'
      });
    }
    
    // 验证语言支持（仅支持 C++）
    const supportedLanguages = ['cpp'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        input: input || '',
        expected: expected || '',
        actual: '',
        error: `不支持的语言: ${language}。当前仅支持: ${supportedLanguages.join(', ')}`
      });
    }
    
    // 代码长度限制（防止恶意代码）
    if (code.length > 50000) {
      return res.status(400).json({
        success: false,
        input: input || '',
        expected: expected || '',
        actual: '',
        error: '代码长度超过限制（最大 50000 字符）'
      });
    }
    
    logger.info('收到代码运行请求', {
      language,
      codeLength: code.length,
      inputLength: input ? input.length : 0
    });
    
    // 【优化】使用 isolate 轻量级沙箱运行代码（快10-20倍）
    const sample = {
      input: input || '',
      output: expected || '',
      is_hidden: false
    };
    
    // 在线运行使用默认限制（5秒，256MB）
    const judgeResult = await judgeCode(code, [sample], {
      timeLimit: 5000,
      memoryLimit: 256
    });
    
    // 获取运行结果
    const testResult = judgeResult.results[0];
    const actual = testResult.actual || '';
    const success = testResult.passed;
    
    // 返回结果
    res.json({
      success,
      input: input || '',
      expected: expected || '',
      actual,
      error: testResult.error || null,
      duration: testResult.duration  // 额外返回执行时间
    });
    
  } catch (error) {
    logger.error('代码运行失败', { error: error.message, stack: error.stack });
    
    res.status(500).json({
      success: false,
      input: req.body.input || '',
      expected: req.body.output || '',
      actual: '',
      error: error.message || '代码运行失败'
    });
  }
});


// ================================================================
// 旧的 Docker 判题方案代码已移除
// 现在统一使用 isolate 轻量级沙箱（速度快10-20倍）
// ================================================================

// ================================================================
// OJ题目管理API
// ================================================================

/**
 * 获取题目列表
 * GET /api/oj/problems
 * 
 * 查询参数:
 * - level: GESP级别（1-8）
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认20）
 */
router.get('/oj/problems', async (req, res) => {
  try {
    const { level, page = 1, pageSize = 20, include_all } = req.query;
    const offset = (page - 1) * pageSize;
    const forBankOnly = !include_all; // 题库列表只显示 bank_visible=1；管理/选题传 include_all=1 可见全部

    let query = 'SELECT * FROM oj_problems';
    let countQuery = 'SELECT COUNT(*) as total FROM oj_problems';
    const params = [];
    const conditions = [];
    if (level) {
      conditions.push('level = ?');
      params.push(level);
    }
    if (forBankOnly) {
      conditions.push('bank_visible = 1');
    }
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY publish_date DESC, id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    const [problems] = await pool.query(query, params);
    const countParams = params.slice(0, -2);
    const [countResult] = await pool.query(countQuery, countParams.length ? countParams : []);
    
    res.json({
      success: true,
      data: problems,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: countResult[0].total
      }
    });
  } catch (error) {
    logger.error('获取题目列表失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取题目详情（只包含展示样例）
 * GET /api/oj/problems/:id
 */
router.get('/oj/problems/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取题目信息
    const [problems] = await pool.query(
      'SELECT * FROM oj_problems WHERE id = ?',
      [id]
    );
    
    if (problems.length === 0) {
      return res.status(404).json({ success: false, error: '题目不存在' });
    }
    
    const problem = problems[0];
    
    // 获取展示样例（is_displayed=true 的样例，用于查看题目时展示）
    const [samples] = await pool.query(
      'SELECT input, output, explanation FROM oj_samples WHERE problem_id = ? AND is_displayed = TRUE ORDER BY sort_order',
      [id]
    );
    
    problem.samples = samples;
    
    res.json({
      success: true,
      data: problem
    });
  } catch (error) {
    logger.error('获取题目详情失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取题目解析视频URL
 * GET /api/oj/problems/:id/video
 */
router.get('/oj/problems/:id/video', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [problems] = await pool.query(
      'SELECT id, title, video_url FROM oj_problems WHERE id = ?',
      [id]
    );
    
    if (problems.length === 0) {
      return res.status(404).json({ success: false, error: '题目不存在' });
    }
    
    res.json({
      success: true,
      data: {
        id: problems[0].id,
        title: problems[0].title,
        video_url: problems[0].video_url
      }
    });
  } catch (error) {
    logger.error('获取题目视频URL失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取题目详情（包含全部样例，包括隐藏测试点和不展示的样例）
 * GET /api/oj/problems/:id/all
 */
router.get('/oj/problems/:id/all', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取题目信息
    const [problems] = await pool.query(
      'SELECT * FROM oj_problems WHERE id = ?',
      [id]
    );
    
    if (problems.length === 0) {
      return res.status(404).json({ success: false, error: '题目不存在' });
    }
    
    const problem = problems[0];
    
    // 获取全部样例（包括隐藏测试点和不展示的样例）
    const [samples] = await pool.query(
      'SELECT input, output, explanation, is_hidden, is_displayed FROM oj_samples WHERE problem_id = ? ORDER BY sort_order',
      [id]
    );
    
    problem.samples = samples;
    
    res.json({
      success: true,
      data: problem
    });
  } catch (error) {
    logger.error('获取题目全部详情失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 上传题目（含测试样例）
 * POST /api/oj/upload
 * 
 * 请求体:
 * {
 *   "title": "题目标题",
 *   "description": "题目描述",
 *   "input_format": "输入格式",
 *   "output_format": "输出格式",
 *   "data_range": "数据范围",
 *   "time_limit": 1000,
 *   "memory_limit": 256,
 *   "level": 4,
 *   "publish_date": "2024-10-15",
 *   "samples": [
 *     {
 *       "input": "3\n2 3 4",
 *       "output": "7",
 *       "explanation": "样例说明",
 *       "is_hidden": false,         // 提交后是否隐藏详细信息
 *       "is_displayed": true,        // 查看题目时是否展示
 *       "sort_order": 1
 *     }
 *   ]
 * }
 */
router.post('/oj/upload', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const {
      title,
      description,
      input_format,
      output_format,
      data_range,
      time_limit = 1000,
      memory_limit = 256,
      level,
      publish_date,
      video_url,
      bank_visible = 1,
      samples = []
    } = req.body;
    
    // 参数验证
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：title, description'
      });
    }

    // 验证 category（如果提供）
    const category = req.body.category || 'GESP';
    const validCategories = await getValidCategories();
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `category 必须是以下值之一：${validCategories.join(', ')}`
      });
    }

    // GESP 分类必须有 level
    if (category === 'GESP' && !level) {
      return res.status(400).json({
        success: false,
        error: 'GESP 分类必须指定 level'
      });
    }

    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({
        success: false,
        error: '必须至少提供一个测试样例'
      });
    }
    
    // 验证每个样例
    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i];
      if (!sample.input || !sample.output) {
        return res.status(400).json({
          success: false,
          error: `样例${i + 1}缺少input或output字段`
        });
      }
    }
    
    await connection.beginTransaction();

    // 插入题目
    const [result] = await connection.query(
      `INSERT INTO oj_problems (
        title, description, input_format, output_format, data_range, video_url,
        time_limit, memory_limit, level, category, publish_date, bank_visible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, input_format, output_format, data_range, video_url,
       time_limit, memory_limit, level || null, category, publish_date, bank_visible ? 1 : 0]
    );

    const problemId = result.insertId;

    // 批量插入测试样例
    const sampleIds = [];
    for (const sample of samples) {
      const { input, output, explanation, is_hidden = false, is_displayed = true, sort_order = 0 } = sample;
      
      const [sampleResult] = await connection.query(
        `INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, is_displayed, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [problemId, input, output, explanation, is_hidden, is_displayed, sort_order]
      );
      
      sampleIds.push(sampleResult.insertId);
    }
    
    await connection.commit();
    
    // 清除相关缓存
    await cacheUtils.oj.clearProblemList();
    
    logger.info('上传题目成功', {
      problemId,
      title,
      sampleCount: sampleIds.length
    });
    
    res.json({
      success: true,
      data: {
        problem_id: problemId,
        sample_ids: sampleIds,
        sample_count: sampleIds.length
      }
    });
    
  } catch (error) {
    await connection.rollback();
    logger.error('上传题目失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * 创建题目
 * POST /api/oj/problems
 * 
 * 请求体:
 * {
 *   "title": "题目标题",
 *   "description": "题目描述",
 *   "input_format": "输入格式",
 *   "output_format": "输出格式",
 *   "data_range": "数据范围",
 *   "time_limit": 1000,
 *   "memory_limit": 256,
 *   "level": 4,
 *   "publish_date": "2024-10-15"
 * }
 */
router.post('/oj/problems', async (req, res) => {
  try {
    const {
      title,
      description,
      input_format,
      output_format,
      data_range,
      time_limit = 1000,
      memory_limit = 256,
      level,
      publish_date,
      video_url,
      bank_visible = 1
    } = req.body;

    // 参数验证
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：title, description'
      });
    }

    // 验证 category（如果提供）
    const category = req.body.category || 'GESP';
    const validCategories = await getValidCategories();
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `category 必须是以下值之一：${validCategories.join(', ')}`
      });
    }

    // GESP 分类必须有 level
    if (category === 'GESP' && !level) {
      return res.status(400).json({
        success: false,
        error: 'GESP 分类必须指定 level'
      });
    }

    const [result] = await pool.query(
      `INSERT INTO oj_problems (
        title, description, input_format, output_format, data_range, video_url,
        time_limit, memory_limit, level, category, publish_date, bank_visible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, input_format, output_format, data_range, video_url,
       time_limit, memory_limit, level || null, category, publish_date, bank_visible ? 1 : 0]
    );
    
    logger.info('创建题目成功', { problemId: result.insertId, title });
    
    res.json({
      success: true,
      data: { id: result.insertId }
    });
  } catch (error) {
    logger.error('创建题目失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新题目
 * PUT /api/oj/problems/:id
 * 
 * 请求体:
 * {
 *   "title": "题目标题",
 *   "description": "题目描述",
 *   "input_format": "输入格式",
 *   "output_format": "输出格式",
 *   "data_range": "数据范围",
 *   "time_limit": 1000,
 *   "memory_limit": 256,
 *   "level": 4,
 *   "publish_date": "2024-10-15",
 *   "samples": [  // 可选，如果提供则替换所有测试样例
 *     {
 *       "input": "输入数据",
 *       "output": "输出数据",
 *       "explanation": "样例说明",
 *       "is_hidden": false,         // 提交后是否隐藏详细信息
 *       "is_displayed": true,        // 查看题目时是否展示
 *       "sort_order": 1
 *     }
 *   ]
 * }
 */
router.put('/oj/problems/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    const { id } = req.params;
    const {
      title,
      description,
      input_format,
      output_format,
      data_range,
      analysis,
      video_url,
      time_limit,
      memory_limit,
      level,
      publish_date,
      bank_visible,
      samples
    } = req.body;

    // 检查题目是否存在
    const [existing] = await connection.query('SELECT id FROM oj_problems WHERE id = ?', [id]);
    if (existing.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: '题目不存在' });
    }
    
    // 构建更新语句
    const updates = [];
    const params = [];
    
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (input_format !== undefined) { updates.push('input_format = ?'); params.push(input_format); }
    if (output_format !== undefined) { updates.push('output_format = ?'); params.push(output_format); }
    if (data_range !== undefined) { updates.push('data_range = ?'); params.push(data_range); }
    if (analysis !== undefined) { updates.push('analysis = ?'); params.push(analysis); }
    if (time_limit !== undefined) { updates.push('time_limit = ?'); params.push(time_limit); }
    if (memory_limit !== undefined) { updates.push('memory_limit = ?'); params.push(memory_limit); }
    if (level !== undefined) {
      updates.push('level = ?');
      params.push(level);
    }
    // 验证 category（如果提供）
    if (category !== undefined) {
      const validCategories = await getValidCategories();
      if (!validCategories.includes(category)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: `category 必须是以下值之一：${validCategories.join(', ')}`
        });
      }
      updates.push('category = ?');
      params.push(category);
    }
    if (publish_date !== undefined) { updates.push('publish_date = ?'); params.push(publish_date); }
    if (video_url !== undefined) { updates.push('video_url = ?'); params.push(video_url); }
    if (bank_visible !== undefined) { updates.push('bank_visible = ?'); params.push(bank_visible ? 1 : 0); }

    // 更新题目基本信息
    if (updates.length > 0) {
      params.push(id);
      await connection.query(
        `UPDATE oj_problems SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    }
    
    // 更新测试样例（如果提供了samples）
    let sampleCount = 0;
    if (samples !== undefined) {
      if (!Array.isArray(samples)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: 'samples必须是数组'
        });
      }
      
      // 删除旧的测试样例
      await connection.query('DELETE FROM oj_samples WHERE problem_id = ?', [id]);
      
      // 插入新的测试样例
      for (const sample of samples) {
        const { input, output, explanation, is_hidden = false, is_displayed = true, sort_order = 0 } = sample;
        
        if (!input || !output) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            error: '每个测试样例都必须包含input和output'
          });
        }
        
        await connection.query(
          `INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, is_displayed, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, input, output, explanation, is_hidden, is_displayed, sort_order]
        );
        sampleCount++;
      }
    }
    
    // 检查是否至少有一项更新
    if (updates.length === 0 && samples === undefined) {
      await connection.rollback();
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }
    
    await connection.commit();
    
    // 清除相关缓存
    await cacheUtils.oj.clearProblem(id);
    await cacheUtils.oj.clearProblemList();
    
    logger.info('更新题目成功', { 
      problemId: id,
      updatedFields: updates.length,
      updatedSamples: samples !== undefined ? sampleCount : '未更新'
    });
    
    res.json({ 
      success: true,
      data: {
        updated_fields: updates.length,
        updated_samples: samples !== undefined ? sampleCount : null
      }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('更新题目失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * 删除题目
 * DELETE /api/oj/problems/:id
 */
router.delete('/oj/problems/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.query('DELETE FROM oj_problems WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '题目不存在' });
    }
    
    // 清除相关缓存
    await cacheUtils.oj.clearProblem(id);
    await cacheUtils.oj.clearProblemList();
    
    logger.info('删除题目成功', { problemId: id });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('删除题目失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ================================================================
// 测试样例管理API
// ================================================================

/**
 * 获取题目的所有测试样例
 * GET /api/oj/problems/:problemId/samples
 * 
 * 查询参数:
 * - includeHidden: 是否包括隐藏测试点（默认false）
 * - includeNotDisplayed: 是否包括不展示的样例（默认false）
 */
router.get('/oj/problems/:problemId/samples', async (req, res) => {
  try {
    const { problemId } = req.params;
    const { includeHidden = 'false', includeNotDisplayed = 'false' } = req.query;
    
    let query = 'SELECT * FROM oj_samples WHERE problem_id = ?';
    const params = [problemId];
    
    if (includeHidden !== 'true') {
      query += ' AND is_hidden = FALSE';
    }
    
    if (includeNotDisplayed !== 'true') {
      query += ' AND is_displayed = TRUE';
    }
    
    query += ' ORDER BY sort_order';
    
    const [samples] = await pool.query(query, params);
    
    res.json({
      success: true,
      data: samples
    });
  } catch (error) {
    logger.error('获取测试样例失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 创建测试样例
 * POST /api/oj/problems/:problemId/samples
 * 
 * 请求体:
 * {
 *   "input": "3\n2 3 4",
 *   "output": "7",
 *   "explanation": "样例说明",
 *   "is_hidden": false,         // 提交后是否隐藏详细信息
 *   "is_displayed": true,        // 查看题目时是否展示
 *   "sort_order": 1
 * }
 */
router.post('/oj/problems/:problemId/samples', async (req, res) => {
  try {
    const { problemId } = req.params;
    const {
      input,
      output,
      explanation,
      is_hidden = false,
      is_displayed = true,
      sort_order = 0
    } = req.body;
    
    // 参数验证
    if (!input || !output) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：input, output'
      });
    }
    
    // 检查题目是否存在
    const [problems] = await pool.query('SELECT id FROM oj_problems WHERE id = ?', [problemId]);
    if (problems.length === 0) {
      return res.status(404).json({ success: false, error: '题目不存在' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, is_displayed, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [problemId, input, output, explanation, is_hidden, is_displayed, sort_order]
    );
    
    // 清除相关缓存
    await cacheUtils.oj.clearProblem(problemId);
    
    logger.info('创建测试样例成功', { sampleId: result.insertId, problemId });
    
    res.json({
      success: true,
      data: { id: result.insertId }
    });
  } catch (error) {
    logger.error('创建测试样例失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 批量创建测试样例
 * POST /api/oj/problems/:problemId/samples/batch
 * 
 * 请求体:
 * {
 *   "samples": [
 *     {
 *       "input": "3\n2 3 4",
 *       "output": "7",
 *       "explanation": "样例说明",
 *       "is_hidden": false,         // 提交后是否隐藏详细信息
 *       "is_displayed": true,        // 查看题目时是否展示
 *       "sort_order": 1
 *     },
 *     ...
 *   ]
 * }
 */
router.post('/oj/problems/:problemId/samples/batch', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { problemId } = req.params;
    const { samples } = req.body;
    
    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'samples必须是非空数组'
      });
    }
    
    // 检查题目是否存在
    const [problems] = await connection.query('SELECT id FROM oj_problems WHERE id = ?', [problemId]);
    if (problems.length === 0) {
      return res.status(404).json({ success: false, error: '题目不存在' });
    }
    
    await connection.beginTransaction();
    
    const insertedIds = [];
    for (const sample of samples) {
      const { input, output, explanation, is_hidden = false, is_displayed = true, sort_order = 0 } = sample;
      
      if (!input || !output) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          error: '每个样例都必须包含input和output'
        });
      }
      
      const [result] = await connection.query(
        `INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, is_displayed, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [problemId, input, output, explanation, is_hidden, is_displayed, sort_order]
      );
      
      insertedIds.push(result.insertId);
    }
    
    await connection.commit();
    
    // 清除相关缓存
    await cacheUtils.oj.clearProblem(problemId);
    
    logger.info('批量创建测试样例成功', { problemId, count: insertedIds.length });
    
    res.json({
      success: true,
      data: { ids: insertedIds, count: insertedIds.length }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('批量创建测试样例失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

/**
 * 更新测试样例
 * PUT /api/oj/samples/:id
 */
router.put('/oj/samples/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { input, output, explanation, is_hidden, is_displayed, sort_order } = req.body;
    
    // 检查样例是否存在并获取 problem_id
    const [existing] = await pool.query('SELECT problem_id FROM oj_samples WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: '测试样例不存在' });
    }
    
    const problemId = existing[0].problem_id;
    
    // 构建更新语句
    const updates = [];
    const params = [];
    
    if (input !== undefined) { updates.push('input = ?'); params.push(input); }
    if (output !== undefined) { updates.push('output = ?'); params.push(output); }
    if (explanation !== undefined) { updates.push('explanation = ?'); params.push(explanation); }
    if (is_hidden !== undefined) { updates.push('is_hidden = ?'); params.push(is_hidden); }
    if (is_displayed !== undefined) { updates.push('is_displayed = ?'); params.push(is_displayed); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: '没有需要更新的字段' });
    }
    
    params.push(id);
    await pool.query(
      `UPDATE oj_samples SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    // 清除相关缓存
    await cacheUtils.oj.clearProblem(problemId);
    
    logger.info('更新测试样例成功', { sampleId: id, problemId });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('更新测试样例失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 删除测试样例
 * DELETE /api/oj/samples/:id
 */
router.delete('/oj/samples/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先获取 problem_id 用于清除缓存
    const [existing] = await pool.query('SELECT problem_id FROM oj_samples WHERE id = ?', [id]);
    const problemId = existing.length > 0 ? existing[0].problem_id : null;
    
    const [result] = await pool.query('DELETE FROM oj_samples WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: '测试样例不存在' });
    }
    
    // 清除相关缓存
    if (problemId) {
      await cacheUtils.oj.clearProblem(problemId);
    }
    
    logger.info('删除测试样例成功', { sampleId: id, problemId });
    
    res.json({ success: true });
  } catch (error) {
    logger.error('删除测试样例失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 提交代码并判题（异步模式）
 * POST /api/oj/submit
 * 
 * 请求体:
 * {
 *   "problem_id": 1,
 *   "code": "C++代码",
 *   "language": "cpp"
 * }
 * 
 * 响应（立即返回）:
 * {
 *   "success": true,
 *   "submission_id": 123,
 *   "status": "queued",
 *   "message": "代码已提交，正在判题中..."
 * }
 */
router.post('/oj/submit', async (req, res) => {
  const requestReceivedAt = Date.now();
  
  try {
    const { problem_id, code, language, user_id: bodyUserId } = req.body;
    // 支持从多个来源获取 user_id：body > query > headers
    const user_id = bodyUserId || req.query.user_id || req.headers['x-user-id'] || null;
    
    // 参数验证
    if (!problem_id || !code || !language) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：problem_id, code, language'
      });
    }
    
    // 验证 user_id 是否有效（如果提供）
    let finalUserId = null;
    if (user_id !== null && user_id !== undefined && user_id !== '') {
      const userIdNum = parseInt(user_id, 10);
      if (isNaN(userIdNum) || userIdNum <= 0) {
        return res.status(400).json({
          success: false,
          error: '无效的 user_id 参数'
        });
      }
      finalUserId = userIdNum;
    }
    
    // 记录 user_id 的来源（用于调试）
    if (finalUserId) {
      logger.info('提交代码 - 用户ID来源', {
        userId: finalUserId,
        fromBody: !!bodyUserId,
        fromQuery: !!req.query.user_id,
        fromHeader: !!req.headers['x-user-id']
      });
    } else {
      logger.warn('提交代码 - 未提供用户ID', {
        problemId: problem_id,
        ipAddress: req.ip || req.connection?.remoteAddress
      });
    }
    
    const supportedLanguages = ['cpp'];
    if (!supportedLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        error: `不支持的语言: ${language}，当前仅支持: ${supportedLanguages.join(', ')}`
      });
    }
    
    // 验证题目是否存在（使用缓存，应该很快）
    const problem = await cacheUtils.oj.getProblem(problem_id, pool);
    if (!problem) {
      return res.status(404).json({ success: false, error: '题目不存在' });
    }
    
    // 获取题目的测试样例
    const samples = await cacheUtils.oj.getSamples(problem_id, pool);
    if (!samples || samples.length === 0) {
      return res.status(400).json({
        success: false,
        error: '题目缺少测试样例，无法判题'
      });
    }
    
    const ipAddress = req.ip || req.connection?.remoteAddress || null;
    
    let status = 'completed';
    let verdict = 'Accepted';
    let totalTests = 0;
    let passedTests = 0;
    let serializedResults = null;
    let errorMessage = null;
    let judgeDuration = 0;
    
    try {
      const judgeStart = Date.now();
      const judgeResult = await judgeCode(code, samples, {
        timeLimit: problem.time_limit,
        memoryLimit: problem.memory_limit
      });
      judgeDuration = Date.now() - judgeStart;
      
      verdict = judgeResult.verdict;
      totalTests = judgeResult.totalTests;
      passedTests = judgeResult.passedTests;
      serializedResults = judgeResult.results ? JSON.stringify(judgeResult.results) : null;
    } catch (judgeError) {
      status = 'error';
      verdict = 'Judge Error';
      errorMessage = judgeError.message || '判题失败';
      judgeDuration = Date.now() - requestReceivedAt;
      totalTests = samples.length;
      passedTests = 0;
      
      logger.error('判题失败', {
        problemId: problem_id,
        error: judgeError.message
      });
    }
    
    res.json({
      success: status === 'completed',
      status,
      verdict,
      total_tests: totalTests,
      passed_tests: passedTests,
      results: serializedResults ? JSON.parse(serializedResults) : [],
      duration: judgeDuration,
      error: errorMessage
    });
    
    // 响应发送完成后再异步写入数据库
    res.on('finish', () => {
    setImmediate(async () => {
      try {
          const [insertResult] = await pool.query(
            `INSERT INTO oj_submissions (
              problem_id,
          code,
              language,
              status,
              verdict,
              total_tests,
              passed_tests,
              results,
              error_message,
              submit_time,
              judge_start_time,
              judge_end_time,
              judge_duration,
              user_id,
              ip_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW(), ?, ?, ?)`,
            [
              problem_id,
              code,
              language,
              status,
              verdict,
              totalTests,
              passedTests,
              serializedResults,
              errorMessage,
              judgeDuration,
              finalUserId,  // 使用处理后的 user_id
              ipAddress
            ]
          );
          
          const submissionId = insertResult.insertId;
          
          logger.info('提交记录已写入数据库', {
            submissionId,
            problemId: problem_id,
            userId: finalUserId,
            verdict,
            status
          });
          
          if (status === 'completed') {
            const accepted = verdict === 'Accepted' ? 1 : 0;
            setImmediate(() => {
              pool.query(
                `UPDATE oj_problems 
                 SET total_submissions = total_submissions + 1,
                     accepted_submissions = accepted_submissions + ?
                 WHERE id = ?`,
                [accepted, problem_id]
              ).catch(err => {
                logger.error('更新题目统计失败', { problemId: problem_id, error: err.message });
              });
            });
          }
        } catch (persistError) {
          logger.error('保存提交记录失败', {
            problemId: problem_id,
            error: persistError.message
          });
      }
      });
    });
    
  } catch (error) {
    logger.error('提交失败', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: error.message || '提交失败'
    });
  }
});

/**
 * 查询提交结果
 * GET /api/oj/submissions/:id
 * 
 * 响应:
 * {
 *   "success": true,
 *   "data": {
 *     "id": 123,
 *     "problem_id": 1,
 *     "status": "completed",
 *     "verdict": "Accepted",
 *     "total_tests": 10,
 *     "passed_tests": 10,
 *     "results": [...],
 *     "submit_time": "2024-10-16T10:30:00",
 *     "judge_duration": 2500
 *   }
 * }
 */
router.get('/oj/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    
    const [submissions] = await pool.query(
      `SELECT 
        s.id,
        s.problem_id,
        p.title as problem_title,
        s.language,
        s.status,
        s.verdict,
        s.total_tests,
        s.passed_tests,
        s.results,
        s.error_message,
        s.submit_time,
        s.judge_start_time,
        s.judge_end_time,
        s.judge_duration
       FROM oj_submissions s
       LEFT JOIN oj_problems p ON s.problem_id = p.id
       WHERE s.id = ?
       ${userId ? 'AND s.user_id = ?' : ''}`,
      userId ? [id, userId] : [id]
    );
    
    if (submissions.length === 0) {
      return res.status(404).json({ success: false, error: '提交记录不存在' });
    }
    
    const submission = submissions[0];
    
    // 解析 JSON 结果
    if (submission.results) {
      try {
        submission.results = JSON.parse(submission.results);
      } catch (e) {
        // JSON解析失败，保持原样
      }
    }
    
    res.json({
      success: true,
      data: submission
    });
    
  } catch (error) {
    logger.error('查询提交记录失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取提交详情（包含代码）
 * GET /api/oj/submissions/:id/detail
 * 
 * 查询参数:
 * - userId: 用户ID（可选，用于校验所属）
 */
router.get('/oj/submissions/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId != null ? parseInt(req.query.userId, 10) : null;
    const viewerId = req.query.viewer_id != null ? parseInt(req.query.viewer_id, 10) : null;

    const [metaRows] = await pool.query(
      'SELECT user_id FROM oj_submissions WHERE id = ?',
      [id]
    );
    if (!metaRows.length) {
      return res.status(404).json({ success: false, error: '提交记录不存在' });
    }
    const ownerId = metaRows[0].user_id;
    const ownerMatch = userId != null && !Number.isNaN(userId) && userId === ownerId;
    const adminOk = viewerId != null && !Number.isNaN(viewerId) && await userIsOjAdmin(viewerId);
    if (!ownerMatch && !adminOk) {
      return res.status(403).json({ success: false, error: '无权查看该提交' });
    }

    const [rows] = await pool.query(
      `SELECT 
        s.id,
        s.problem_id,
        p.title AS problem_title,
        s.language,
        s.status,
        s.verdict,
        s.total_tests,
        s.passed_tests,
        s.results,
        s.error_message,
        s.code,
        s.submit_time,
        s.judge_start_time,
        s.judge_end_time,
        s.judge_duration,
        s.user_id,
        s.ip_address
       FROM oj_submissions s
       LEFT JOIN oj_problems p ON s.problem_id = p.id
       WHERE s.id = ?`,
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: '提交记录不存在' });
    }
    
    const submission = rows[0];
    
    if (submission.results) {
      try {
        submission.results = JSON.parse(submission.results);
      } catch (e) {
        logger.warn('提交详情结果JSON解析失败', { submissionId: id, error: e.message });
      }
    }
    
    res.json({
      success: true,
      data: submission
    });
    
  } catch (error) {
    logger.error('获取提交详情失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 查询用户的提交历史
 * GET /api/oj/submissions
 * 
 * 查询参数:
 * - userId: 用户ID（本人查看时必填）
 * - all_users: 1 时管理员可查全部用户提交（须配合 viewer_id）
 * - viewer_id: 当前操作者用户ID，用于校验管理员身份
 * - problemId: 题目ID（可选）
 * - page / pageSize / status
 */
router.get('/oj/submissions', async (req, res) => {
  try {
    const {
      userId,
      problemId,
      page = 1,
      pageSize = 20,
      status,
      all_users,
      viewer_id
    } = req.query;

    const pageNumber = parseInt(page, 10) || 1;
    let size = parseInt(pageSize, 10) || 20;
    const offset = (pageNumber - 1) * size;

    const allUsers = all_users === '1' || all_users === 'true';
    const viewerId = viewer_id != null ? parseInt(viewer_id, 10) : null;

    if (allUsers) {
      if (!viewerId || Number.isNaN(viewerId)) {
        return res.status(400).json({
          success: false,
          error: '管理员查看全部提交时需传 viewer_id'
        });
      }
      const ok = await userIsOjAdmin(viewerId);
      if (!ok) {
        return res.status(403).json({
          success: false,
          error: '仅管理员可查看全部用户提交'
        });
      }
      size = Math.min(Math.max(size, 1), 500);

      let query = `
      SELECT 
        s.id,
        s.problem_id,
        p.title AS problem_title,
        s.language,
        s.status,
        s.verdict,
        s.total_tests,
        s.passed_tests,
        s.submit_time,
        s.judge_duration,
        s.user_id,
        u.username,
        u.real_name
      FROM oj_submissions s
      LEFT JOIN oj_problems p ON s.problem_id = p.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
      const params = [];

      if (problemId) {
        query += ' AND s.problem_id = ?';
        params.push(parseInt(problemId, 10));
      }
      if (status) {
        query += ' AND s.status = ?';
        params.push(status);
      }
      query += ' ORDER BY s.submit_time DESC LIMIT ? OFFSET ?';
      params.push(size, offset);

      const [submissions] = await pool.query(query, params);

      let countQuery = 'SELECT COUNT(*) AS total FROM oj_submissions WHERE 1=1';
      const countParams = [];
      if (problemId) {
        countQuery += ' AND problem_id = ?';
        countParams.push(parseInt(problemId, 10));
      }
      if (status) {
        countQuery += ' AND status = ?';
        countParams.push(status);
      }
      const [countResult] = await pool.query(countQuery, countParams);

      return res.json({
        success: true,
        data: submissions,
        pagination: {
          page: pageNumber,
          pageSize: size,
          total: countResult[0]?.total || 0
        }
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：userId'
      });
    }

    let query = `
      SELECT 
        s.id,
        s.problem_id,
        p.title AS problem_title,
        s.language,
        s.status,
        s.verdict,
        s.total_tests,
        s.passed_tests,
        s.submit_time,
        s.judge_duration
      FROM oj_submissions s
      LEFT JOIN oj_problems p ON s.problem_id = p.id
      WHERE s.user_id = ?
    `;

    const params = [userId];

    if (problemId) {
      query += ' AND s.problem_id = ?';
      params.push(problemId);
    }

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    }

    query += ' ORDER BY s.submit_time DESC LIMIT ? OFFSET ?';
    params.push(size, offset);

    const [submissions] = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) AS total FROM oj_submissions WHERE user_id = ?';
    const countParams = [userId];

    if (problemId) {
      countQuery += ' AND problem_id = ?';
      countParams.push(problemId);
    }

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const [countResult] = await pool.query(countQuery, countParams);

    res.json({
      success: true,
      data: submissions,
      pagination: {
        page: pageNumber,
        pageSize: size,
        total: countResult[0]?.total || 0
      }
    });
  } catch (error) {
    logger.error('查询提交历史失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取判题队列状态
 * GET /api/oj/queue/status
 * 
 * 响应:
 * {
 *   "success": true,
 *   "data": {
 *     "waiting": 5,
 *     "active": 4,
 *     "completed": 120,
 *     "failed": 3,
 *     "total": 9
 *   }
 * }
 */
router.get('/oj/queue/status', async (req, res) => {
  try {
    const status = await getQueueStatus();
    
    res.json({
      success: true,
      data: status
    });
    
  } catch (error) {
    logger.error('获取队列状态失败', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出可复用函数
module.exports = router;
module.exports.submitOjInternal = submitOjInternal;

