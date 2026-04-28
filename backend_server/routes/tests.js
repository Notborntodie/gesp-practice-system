const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pool } = require('../config/database');
const { logger } = require('../config/logger');
const { submitExamInternal } = require('./submissions');
const { submitOjInternal } = require('./oj');

/** 从请求中取 user_id（query 或 body） */
function getUserId(req) {
  const id = req.body?.user_id ?? req.query?.user_id;
  if (id == null || id === '') return null;
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
}

/** 校验当前用户是否为管理员或教师 */
async function isAdminOrTeacher(connection, user_id) {
  if (!user_id) return false;
  const [rows] = await connection.execute(
    `SELECT 1 FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ? AND r.name IN ('admin', 'super_admin', 'teacher')`,
    [user_id]
  );
  return rows.length > 0;
}

/** 校验当前用户是否为管理员或超管（不含仅教师） */
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

/** 校验当前用户是否拥有教师角色（含同时为管理员的情况，用于「只看我的学生」筛选） */
async function hasTeacherRole(connection, user_id) {
  if (!user_id) return false;
  const [rows] = await connection.execute(
    `SELECT 1 FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ? AND r.name = 'teacher'`,
    [user_id]
  );
  return rows.length > 0;
}

/** 校验是否为某 Test 的创建者或管理员/教师（仅管理员/超管可管理任意测试，教师只能管理自己创建的） */
async function canManageTest(connection, testId, user_id) {
  if (!user_id) return false;
  const isAdmin = await isAdminOrSuperAdmin(connection, user_id);
  if (isAdmin) return true;
  const [creator] = await connection.execute(
    'SELECT 1 FROM tests WHERE id = ? AND created_by = ?',
    [testId, user_id]
  );
  return creator.length > 0;
}

/** 学生是否可参与该 Test（公开 或 是创建者教师的学生） */
async function canParticipateTest(connection, test, user_id) {
  if (test.is_public) return true;
  if (!test.created_by) return false;
  const [rows] = await connection.execute(
    'SELECT 1 FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
    [test.created_by, user_id]
  );
  return rows.length > 0;
}

/** 学生是否可在列表中看到该 Test */
async function canSeeTest(connection, test, user_id) {
  if (test.is_public) return true;
  if (!test.created_by) return false;
  const [rows] = await connection.execute(
    'SELECT 1 FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
    [test.created_by, user_id]
  );
  return rows.length > 0;
}

/** 对未交卷且已超时的 attempt 执行自动收卷 */
async function maybeAutoSubmit(connection, attempt) {
  if (attempt.submitted_at) return attempt;
  const now = new Date();
  const started = new Date(attempt.started_at);
  const deadline = new Date(started.getTime() + attempt.time_limit_seconds * 1000);
  if (now < deadline) return attempt;
  const testId = attempt.test_id;
  const attemptId = attempt.id;
  let examScore = 0;
  const [subRows] = await connection.execute(
    `SELECT exam_id, score, submit_time FROM submissions
     WHERE test_attempt_id = ? ORDER BY exam_id, submit_time DESC`,
    [attemptId]
  );
  const byExam = new Map();
  for (const row of subRows) {
    if (!byExam.has(row.exam_id)) byExam.set(row.exam_id, row.score);
  }
  const [teRows] = await connection.execute(
    'SELECT exam_id, score_weight FROM test_exams WHERE test_id = ?',
    [testId]
  );
  const weightByExam = new Map(teRows.map(r => [r.exam_id, r.score_weight != null ? r.score_weight : 100]));
  examScore = 0;
  for (const [eid, rawScore] of byExam) {
    const weight = weightByExam.get(eid) ?? 100;
    examScore += (Number(rawScore) / 100) * weight;
  }
  examScore = Math.round(examScore * 100) / 100;

  const [topRows] = await connection.execute(
    'SELECT problem_id, score_weight FROM test_oj_problems WHERE test_id = ?',
    [testId]
  );
  let ojScore = 0;
  for (const { problem_id, score_weight } of topRows) {
    const [last] = await connection.execute(
      `SELECT passed_tests, total_tests FROM oj_submissions
       WHERE test_attempt_id = ? AND problem_id = ? AND status = 'completed'
       ORDER BY submit_time DESC LIMIT 1`,
      [attemptId, problem_id]
    );
    if (last.length > 0 && last[0].total_tests > 0) {
      ojScore += Number((score_weight * last[0].passed_tests / last[0].total_tests).toFixed(2));
    }
  }
  const totalScore = examScore + ojScore;
  await connection.execute(
    'UPDATE test_attempts SET exam_score = ?, oj_score = ?, total_score = ?, submitted_at = NOW() WHERE id = ?',
    [examScore, ojScore, totalScore, attemptId]
  );
  return { ...attempt, submitted_at: now, exam_score: examScore, oj_score: ojScore, total_score: totalScore };
}

// ==================== 列表 ====================
router.get('/tests', async (req, res) => {
  try {
    const user_id = getUserId(req);
    const { page = 1, pageSize = 20 } = req.query;
    const connection = await pool.getConnection();
    let list = [];
    const [testsRows] = await connection.execute(
      'SELECT * FROM tests ORDER BY created_at DESC'
    );
    const isAdmin = user_id ? await isAdminOrSuperAdmin(connection, user_id) : false;
    const isTeacherOrAdmin = user_id ? await isAdminOrTeacher(connection, user_id) : false;
    for (const t of testsRows) {
      const canSee = user_id ? await canSeeTest(connection, t, user_id) : false;
      // 管理员/超管/教师：列表均可见全部测试（教师需在测试管理中看到所有测试）；普通用户：公开或 canSee
      const includeTest = isAdmin || isTeacherOrAdmin
        ? true
        : (t.is_public || canSee);
      if (includeTest) {
        let attempt = null;
        if (user_id) {
          const [a] = await connection.execute(
            'SELECT * FROM test_attempts WHERE test_id = ? AND user_id = ?',
            [t.id, user_id]
          );
          attempt = a[0] || null;
        }
        list.push({
          id: t.id,
          name: t.name,
          description: t.description,
          time_limit_minutes: t.time_limit_minutes,
          start_time: t.start_time,
          end_time: t.end_time,
          total_score: t.total_score,
          is_public: !!t.is_public,
          created_by: t.created_by,
          created_at: t.created_at,
          has_attempt: !!attempt,
          submitted_at: attempt?.submitted_at ?? null,
          attempt_id: attempt?.id ?? null,
          public_result_enabled: !!t.public_result_enabled,
          public_result_token: t.public_result_token || null
        });
      }
    }
    connection.release();
    const total = list.length;
    const start = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(pageSize, 10));
    const pageList = list.slice(start, start + Math.max(1, parseInt(pageSize, 10)));
    res.json({ list: pageList, total });
  } catch (e) {
    logger.error('GET /tests', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 详情（学生未参与 403） ====================
router.get('/tests/:id', async (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);
    const connection = await pool.getConnection();
    const [testRows] = await connection.execute('SELECT * FROM tests WHERE id = ?', [testId]);
    if (testRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Test 不存在' });
    }
    const test = testRows[0];
    const adminOrTeacher = user_id ? await isAdminOrTeacher(connection, user_id) : false;
    const [attemptRows] = await connection.execute(
      'SELECT * FROM test_attempts WHERE test_id = ? AND user_id = ?',
      [testId, user_id || 0]
    );
    const attempt = attemptRows[0] || null;
    const hasAttempt = !!attempt;
    const canSeeContent = adminOrTeacher || hasAttempt;
    if (!canSeeContent) {
      const canSee = user_id ? await canParticipateTest(connection, test, user_id) : false;
      if (!canSee) {
        connection.release();
        return res.status(403).json({ error: '无权查看该考试' });
      }
      connection.release();
      return res.status(403).json({ error: '未参与该考试，无法查看题目' });
    }
    const base = {
      id: test.id,
      name: test.name,
      description: test.description,
      time_limit_minutes: test.time_limit_minutes,
      start_time: test.start_time,
      end_time: test.end_time,
      total_score: test.total_score,
      is_public: !!test.is_public,
      created_by: test.created_by,
      public_result_enabled: !!test.public_result_enabled,
      public_result_token: test.public_result_token || null
    };
    if (!canSeeContent) {
      connection.release();
      return res.json(base);
    }
    const [teRows] = await connection.execute(
      'SELECT * FROM test_exams WHERE test_id = ? ORDER BY exam_order, id',
      [testId]
    );
    const [topRows] = await connection.execute(
      'SELECT * FROM test_oj_problems WHERE test_id = ? ORDER BY problem_order, id',
      [testId]
    );
    const attemptId = attempt ? attempt.id : null;
    const exams = [];
    for (const te of teRows) {
      const [e] = await connection.execute('SELECT * FROM exams WHERE id = ?', [te.exam_id]);
      if (e.length === 0) continue;
      let exam_submitted = false;
      if (attemptId != null) {
        const [subRows] = await connection.execute(
          'SELECT 1 FROM submissions WHERE test_attempt_id = ? AND exam_id = ? LIMIT 1',
          [attemptId, te.exam_id]
        );
        exam_submitted = subRows.length > 0;
      }
      const [qRows] = await connection.execute(
        `SELECT q.*, eq.question_number FROM questions q
         JOIN exam_questions eq ON q.id = eq.question_id WHERE eq.exam_id = ?
         ORDER BY eq.question_number`,
        [te.exam_id]
      );
      const questionIds = qRows.map(q => q.id);
      let opts = [];
      if (questionIds.length > 0) {
        const [optRows] = await connection.execute(
          `SELECT * FROM options WHERE question_id IN (${questionIds.map(() => '?').join(',')}) ORDER BY question_id, option_label`,
          questionIds
        );
        opts = optRows;
      }
      const questions = qRows.map(q => ({
        ...q,
        options: opts.filter(o => o.question_id === q.id)
      }));
      exams.push({
        exam_id: te.exam_id,
        exam_order: te.exam_order,
        score_weight: te.score_weight,
        exam_submitted,
        name: e[0].name,
        level: e[0].level,
        total_questions: e[0].total_questions,
        questions
      });
    }
    const oj_problems = [];
    for (const top of topRows) {
      const [p] = await connection.execute('SELECT * FROM oj_problems WHERE id = ?', [top.problem_id]);
      if (p.length === 0) continue;
      let score_obtained = null;
      const score_weight = top.score_weight != null ? top.score_weight : 100;
      if (attemptId != null) {
        const [lastOj] = await connection.execute(
          `SELECT passed_tests, total_tests FROM oj_submissions
           WHERE test_attempt_id = ? AND problem_id = ? AND status = 'completed'
           ORDER BY submit_time DESC LIMIT 1`,
          [attemptId, top.problem_id]
        );
        if (lastOj.length > 0 && lastOj[0].total_tests > 0) {
          score_obtained = Number((score_weight * lastOj[0].passed_tests / lastOj[0].total_tests).toFixed(2));
        }
      }
      const [samples] = await connection.execute(
        'SELECT input, output, explanation FROM oj_samples WHERE problem_id = ? AND is_displayed = 1 ORDER BY sort_order',
        [top.problem_id]
      );
      oj_problems.push({
        problem_id: top.problem_id,
        problem_order: top.problem_order,
        score_weight,
        score_obtained,
        title: p[0].title,
        description: p[0].description,
        level: p[0].level,
        samples
      });
    }
    connection.release();
    res.json({ ...base, exams, oj_problems });
  } catch (e) {
    logger.error('GET /tests/:id', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 管理端详情（无权限限制，仅管理员/教师可访问） ====================
router.get('/admin/tests/:id', async (req, res) => {
  let connection;
  try {
    const testId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);

    if (!user_id) {
      return res.status(401).json({ error: '请登录' });
    }

    connection = await pool.getConnection();

    // 验证权限
    const allowed = await isAdminOrTeacher(connection, user_id);
    if (!allowed) {
      connection.release();
      return res.status(403).json({ error: '仅管理员或教师可访问' });
    }

    const [testRows] = await connection.execute('SELECT * FROM tests WHERE id = ?', [testId]);
    if (testRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Test 不存在' });
    }

    const test = testRows[0];

    // 获取关联的 exams
    const [examRows] = await connection.execute(
      `SELECT te.exam_id, te.exam_order, te.score_weight, e.name as exam_name, e.category, e.level, e.type,
              (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = te.exam_id) as total_questions
       FROM test_exams te
       LEFT JOIN exams e ON te.exam_id = e.id
       WHERE te.test_id = ?
       ORDER BY te.exam_order`,
      [testId]
    );

    // 获取关联的 oj_problems
    const [ojRows] = await connection.execute(
      `SELECT tojp.problem_id, tojp.problem_order, tojp.score_weight, p.title, p.category, p.level
       FROM test_oj_problems tojp
       LEFT JOIN oj_problems p ON tojp.problem_id = p.id
       WHERE tojp.test_id = ?
       ORDER BY tojp.problem_order`,
      [testId]
    );

    connection.release();

    res.json({
      success: true,
      data: {
        id: test.id,
        name: test.name,
        description: test.description,
        time_limit_minutes: test.time_limit_minutes,
        start_time: test.start_time,
        end_time: test.end_time,
        total_score: test.total_score,
        is_public: !!test.is_public,
        created_by: test.created_by,
        exams: examRows.map(e => ({
          exam_id: e.exam_id,
          exam_order: e.exam_order,
          score_weight: e.score_weight,
          exam_name: e.exam_name,
          category: e.category,
          level: e.level,
          type: e.type,
          total_questions: e.total_questions
        })),
        oj_problems: ojRows.map(o => ({
          problem_id: o.problem_id,
          problem_order: o.problem_order,
          score_weight: o.score_weight,
          title: o.title,
          category: o.category,
          level: o.level
        }))
      }
    });
  } catch (e) {
    logger.error('GET /admin/tests/:id', { error: e.message });
    if (connection) connection.release();
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 创建 ====================
router.post('/tests', async (req, res) => {
  let connection;
  try {
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    connection = await pool.getConnection();
    const allowed = await isAdminOrTeacher(connection, user_id);
    if (!allowed) {
      connection.release();
      return res.status(403).json({ error: '仅管理员或教师可创建 Test' });
    }
    const {
      name,
      description,
      time_limit_minutes,
      start_time,
      end_time,
      is_public = true,
      created_by,
      exams = [],
      oj_problems = []
    } = req.body;
    if (!name || !time_limit_minutes) {
      connection.release();
      return res.status(400).json({ error: '缺少 name 或 time_limit_minutes' });
    }
    await connection.beginTransaction();
    const [ins] = await connection.execute(
      `INSERT INTO tests (name, description, time_limit_minutes, start_time, end_time, is_public, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, description || null, time_limit_minutes, start_time || null, end_time || null, is_public ? 1 : 0, created_by ?? user_id]
    );
    const testId = ins.insertId;
    let totalScore = 0;
    for (let i = 0; i < exams.length; i++) {
      const { exam_id, exam_order = i, score_weight } = exams[i];
      const w = score_weight != null ? score_weight : 100;
      totalScore += w;
      await connection.execute(
        'INSERT INTO test_exams (test_id, exam_id, exam_order, score_weight) VALUES (?, ?, ?, ?)',
        [testId, exam_id, exam_order, score_weight != null ? score_weight : null]
      );
    }
    for (let i = 0; i < oj_problems.length; i++) {
      const { problem_id, problem_order = i, score_weight = 100 } = oj_problems[i];
      totalScore += score_weight;
      await connection.execute(
        'INSERT INTO test_oj_problems (test_id, problem_id, problem_order, score_weight) VALUES (?, ?, ?, ?)',
        [testId, problem_id, problem_order, score_weight]
      );
    }
    await connection.execute('UPDATE tests SET total_score = ? WHERE id = ?', [totalScore, testId]);
    await connection.commit();
    connection.release();
    res.json({ id: testId, total_score: totalScore });
  } catch (e) {
    logger.error('POST /tests', { error: e.message });
    if (connection) { try { await connection.rollback(); } catch (_) {} connection.release(); }
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 更新 ====================
router.put('/tests/:id', async (req, res) => {
  let connection;
  try {
    const testId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    connection = await pool.getConnection();
    const allowed = await canManageTest(connection, testId, user_id);
    if (!allowed) {
      connection.release();
      return res.status(403).json({ error: '无权编辑该 Test' });
    }
    const {
      name,
      description,
      time_limit_minutes,
      start_time,
      end_time,
      is_public,
      created_by,
      exams = [],
      oj_problems = []
    } = req.body;
    await connection.beginTransaction();
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (time_limit_minutes !== undefined) { updates.push('time_limit_minutes = ?'); params.push(time_limit_minutes); }
    if (start_time !== undefined) { updates.push('start_time = ?'); params.push(start_time); }
    if (end_time !== undefined) { updates.push('end_time = ?'); params.push(end_time); }
    if (is_public !== undefined) { updates.push('is_public = ?'); params.push(is_public ? 1 : 0); }
    if (created_by !== undefined) { updates.push('created_by = ?'); params.push(created_by); }
    if (updates.length) {
      params.push(testId);
      await connection.execute(`UPDATE tests SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    await connection.execute('DELETE FROM test_exams WHERE test_id = ?', [testId]);
    await connection.execute('DELETE FROM test_oj_problems WHERE test_id = ?', [testId]);
    let totalScore = 0;
    for (let i = 0; i < exams.length; i++) {
      const { exam_id, exam_order = i, score_weight } = exams[i];
      totalScore += (score_weight != null ? score_weight : 100);
      await connection.execute(
        'INSERT INTO test_exams (test_id, exam_id, exam_order, score_weight) VALUES (?, ?, ?, ?)',
        [testId, exam_id, exam_order, score_weight != null ? score_weight : null]
      );
    }
    for (let i = 0; i < oj_problems.length; i++) {
      const { problem_id, problem_order = i, score_weight = 100 } = oj_problems[i];
      totalScore += score_weight;
      await connection.execute(
        'INSERT INTO test_oj_problems (test_id, problem_id, problem_order, score_weight) VALUES (?, ?, ?, ?)',
        [testId, problem_id, problem_order, score_weight]
      );
    }
    await connection.execute('UPDATE tests SET total_score = ? WHERE id = ?', [totalScore, testId]);
    await connection.commit();
    connection.release();
    res.json({ ok: true, total_score: totalScore });
  } catch (e) {
    logger.error('PUT /tests/:id', { error: e.message });
    try { if (connection) await connection.rollback(); } catch (_) {}
    if (connection && connection.release) connection.release();
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 删除 ====================
router.delete('/tests/:id', async (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const connection = await pool.getConnection();
    const allowed = await canManageTest(connection, testId, user_id);
    if (!allowed) {
      connection.release();
      return res.status(403).json({ error: '无权删除该 Test' });
    }
    await connection.execute('DELETE FROM tests WHERE id = ?', [testId]);
    connection.release();
    res.json({ ok: true });
  } catch (e) {
    logger.error('DELETE /tests/:id', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 开始考试 ====================
router.post('/tests/:id/start', async (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const connection = await pool.getConnection();
    const [testRows] = await connection.execute('SELECT * FROM tests WHERE id = ?', [testId]);
    if (testRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Test 不存在' });
    }
    const test = testRows[0];
    const adminOrTeacher = await isAdminOrTeacher(connection, user_id);
    const canPart = adminOrTeacher || (await canParticipateTest(connection, test, user_id));
    if (!canPart) {
      connection.release();
      return res.status(403).json({ error: '无权参与该考试' });
    }
    const now = new Date();
    if (test.start_time && new Date(test.start_time) > now) {
      connection.release();
      return res.status(400).json({ error: '考试尚未开始' });
    }
    if (test.end_time && new Date(test.end_time) < now) {
      connection.release();
      return res.status(400).json({ error: '考试已结束' });
    }
    const [attemptRows] = await connection.execute(
      'SELECT * FROM test_attempts WHERE test_id = ? AND user_id = ?',
      [testId, user_id]
    );
    let attempt = attemptRows[0] || null;
    if (attempt) {
      if (attempt.submitted_at) {
        connection.release();
        return res.status(403).json({ error: '已交卷，无法再进入' });
      }
      attempt = await maybeAutoSubmit(connection, attempt);
      if (attempt.submitted_at) {
        connection.release();
        return res.status(403).json({ error: '已交卷，无法再进入' });
      }
      const remaining = Math.max(0, attempt.time_limit_seconds - Math.floor((now - new Date(attempt.started_at)) / 1000));
      connection.release();
      return res.json({
        attempt_id: attempt.id,
        started_at: attempt.started_at,
        time_limit_seconds: attempt.time_limit_seconds,
        remaining_seconds: remaining
      });
    }
    const timeLimitSeconds = test.time_limit_minutes * 60;
    await connection.execute(
      'INSERT INTO test_attempts (test_id, user_id, started_at, time_limit_seconds) VALUES (?, ?, NOW(), ?)',
      [testId, user_id, timeLimitSeconds]
    );
    const [newRows] = await connection.execute(
      'SELECT * FROM test_attempts WHERE test_id = ? AND user_id = ?',
      [testId, user_id]
    );
    connection.release();
    const a = newRows[0];
    res.json({
      attempt_id: a.id,
      started_at: a.started_at,
      time_limit_seconds: a.time_limit_seconds,
      remaining_seconds: a.time_limit_seconds
    });
  } catch (e) {
    logger.error('POST /tests/:id/start', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 当前 attempt 状态 ====================
router.get('/tests/:id/attempt', async (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const connection = await pool.getConnection();
    const [attemptRows] = await connection.execute(
      'SELECT * FROM test_attempts WHERE test_id = ? AND user_id = ?',
      [testId, user_id]
    );
    let attempt = attemptRows[0] || null;
    if (!attempt) {
      connection.release();
      return res.json({ has_attempt: false, submitted: false });
    }
    attempt = await maybeAutoSubmit(connection, attempt);
    connection.release();
    if (attempt.submitted_at) {
      return res.json({
        has_attempt: true,
        submitted: true,
        attempt_id: attempt.id,
        exam_score: attempt.exam_score,
        oj_score: attempt.oj_score,
        total_score: attempt.total_score,
        submitted_at: attempt.submitted_at
      });
    }
    const now = new Date();
    const remaining = Math.max(0, attempt.time_limit_seconds - Math.floor((now - new Date(attempt.started_at)) / 1000));
    res.json({
      has_attempt: true,
      submitted: false,
      attempt_id: attempt.id,
      started_at: attempt.started_at,
      time_limit_seconds: attempt.time_limit_seconds,
      remaining_seconds: remaining
    });
  } catch (e) {
    logger.error('GET /tests/:id/attempt', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== Test 内提交客观题 ====================
router.post('/tests/attempts/:attemptId/submit-exam', async (req, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const { exam_id, answers, practice_duration_seconds } = req.body;
    if (!exam_id || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: '缺少 exam_id 或 answers' });
    }
    const connection = await pool.getConnection();
    const [aRows] = await connection.execute(
      'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?',
      [attemptId, user_id]
    );
    if (aRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'attempt 不存在或不属于当前用户' });
    }
    const attempt = aRows[0];
    if (attempt.submitted_at) {
      connection.release();
      return res.status(403).json({ error: '已交卷，无法再提交' });
    }
    const [teRows] = await connection.execute(
      'SELECT 1 FROM test_exams WHERE test_id = ? AND exam_id = ?',
      [attempt.test_id, exam_id]
    );
    if (teRows.length === 0) {
      connection.release();
      return res.status(400).json({ error: '该客观题不属于本场 Test' });
    }
    await connection.beginTransaction();
    const result = await submitExamInternal(
      connection, user_id, exam_id, answers,
      null, practice_duration_seconds ?? null, attemptId
    );
    await connection.commit();
    connection.release();
    res.json(result);
  } catch (e) {
    logger.error('POST .../submit-exam', { error: e.message });
    res.status(500).json({ error: e.message || '服务器错误' });
  }
});

// ==================== Test 内提交编程题 ====================
router.post('/tests/attempts/:attemptId/submit-oj', async (req, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const { problem_id, code, language, practice_duration_seconds } = req.body;
    if (!problem_id || !code || !language) {
      return res.status(400).json({ error: '缺少 problem_id, code 或 language' });
    }
    const connection = await pool.getConnection();
    const [aRows] = await connection.execute(
      'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?',
      [attemptId, user_id]
    );
    if (aRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'attempt 不存在或不属于当前用户' });
    }
    const attempt = aRows[0];
    if (attempt.submitted_at) {
      connection.release();
      return res.status(403).json({ error: '已交卷，无法再提交' });
    }
    const [topRows] = await connection.execute(
      'SELECT 1 FROM test_oj_problems WHERE test_id = ? AND problem_id = ?',
      [attempt.test_id, problem_id]
    );
    if (topRows.length === 0) {
      connection.release();
      return res.status(400).json({ error: '该编程题不属于本场 Test' });
    }
    await connection.beginTransaction();
    const result = await submitOjInternal(
      connection, user_id, problem_id, code, language,
      null, practice_duration_seconds ?? null, attemptId
    );
    await connection.commit();
    connection.release();
    res.json({ success: true, ...result });
  } catch (e) {
    logger.error('POST .../submit-oj', { error: e.message });
    res.status(500).json({ error: e.message || '服务器错误' });
  }
});

// ==================== 交卷 ====================
router.post('/tests/attempts/:attemptId/submit', async (req, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const connection = await pool.getConnection();
    const [aRows] = await connection.execute(
      'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?',
      [attemptId, user_id]
    );
    if (aRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'attempt 不存在或不属于当前用户' });
    }
    let attempt = aRows[0];
    if (attempt.submitted_at) {
      connection.release();
      return res.status(403).json({ error: '已交卷' });
    }
    attempt = await maybeAutoSubmit(connection, attempt);
    if (attempt.submitted_at) {
      connection.release();
      return res.json({
        exam_score: attempt.exam_score,
        oj_score: attempt.oj_score,
        total_score: attempt.total_score,
        submitted_at: attempt.submitted_at
      });
    }
    const testId = attempt.test_id;
    let examScore = 0;
    const [subRows] = await connection.execute(
      'SELECT exam_id, score, submit_time FROM submissions WHERE test_attempt_id = ? ORDER BY exam_id, submit_time DESC',
      [attemptId]
    );
    const byExam = new Map();
    for (const row of subRows) {
      if (!byExam.has(row.exam_id)) byExam.set(row.exam_id, row.score);
    }
    const [teRows] = await connection.execute(
      'SELECT exam_id, score_weight FROM test_exams WHERE test_id = ?',
      [testId]
    );
    const weightByExam = new Map(teRows.map(r => [r.exam_id, r.score_weight != null ? r.score_weight : 100]));
    examScore = 0;
    for (const [eid, rawScore] of byExam) {
      const weight = weightByExam.get(eid) ?? 100;
      examScore += (Number(rawScore) / 100) * weight;
    }
    examScore = Math.round(examScore * 100) / 100;

    const [topRows] = await connection.execute(
      'SELECT problem_id, score_weight FROM test_oj_problems WHERE test_id = ?',
      [testId]
    );
    let ojScore = 0;
    for (const { problem_id, score_weight } of topRows) {
      const [last] = await connection.execute(
        `SELECT passed_tests, total_tests FROM oj_submissions
         WHERE test_attempt_id = ? AND problem_id = ? AND status = 'completed'
         ORDER BY submit_time DESC LIMIT 1`,
        [attemptId, problem_id]
      );
      if (last.length > 0 && last[0].total_tests > 0) {
        ojScore += Number((score_weight * last[0].passed_tests / last[0].total_tests).toFixed(2));
      }
    }
    const totalScore = examScore + ojScore;
    await connection.execute(
      'UPDATE test_attempts SET exam_score = ?, oj_score = ?, total_score = ?, submitted_at = NOW() WHERE id = ?',
      [examScore, ojScore, totalScore, attemptId]
    );
    connection.release();
    res.json({
      exam_score: examScore,
      oj_score: ojScore,
      total_score: totalScore,
      submitted_at: new Date()
    });
  } catch (e) {
    logger.error('POST .../submit', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 排名 ====================
// 已参与且已交卷可查看；管理员可查看任意测试排名；教师可查看任意测试排名（含非自己创建的），支持 my_students_only=1 筛选自己的学生
router.get('/tests/:id/rankings', async (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);
    const my_students_only = req.query.my_students_only === '1' || req.query.my_students_only === 'true';
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const connection = await pool.getConnection();
    const [myAttempt] = await connection.execute(
      'SELECT id, submitted_at FROM test_attempts WHERE test_id = ? AND user_id = ?',
      [testId, user_id]
    );
    const canViewAsParticipant = myAttempt.length > 0 && myAttempt[0].submitted_at;
    const canManage = await canManageTest(connection, testId, user_id);
    const canViewAsTeacher = await hasTeacherRole(connection, user_id);
    const canFilterMyStudents = my_students_only && canViewAsTeacher;
    if (!canViewAsParticipant && !canManage && !canViewAsTeacher) {
      connection.release();
      return res.status(403).json({ error: '仅已参与且已交卷可查看排名，或需具有教师/管理权限' });
    }
    let sql = `
      SELECT ta.id, ta.user_id, ta.total_score, ta.exam_score, ta.oj_score, ta.submitted_at,
             u.username, u.real_name
      FROM test_attempts ta
      JOIN users u ON ta.user_id = u.id
      WHERE ta.test_id = ? AND ta.submitted_at IS NOT NULL
    `;
    const params = [testId];
    if (canFilterMyStudents) {
      sql += ` AND ta.user_id IN (SELECT student_id FROM teacher_students WHERE teacher_id = ?)`;
      params.push(user_id);
    }
    sql += ` ORDER BY ta.total_score DESC, ta.submitted_at ASC LIMIT 1000`;
    const [rows] = await connection.execute(sql, params);
    const countSql = canFilterMyStudents
      ? 'SELECT COUNT(*) AS total FROM test_attempts ta WHERE ta.test_id = ? AND ta.submitted_at IS NOT NULL AND ta.user_id IN (SELECT student_id FROM teacher_students WHERE teacher_id = ?)'
      : 'SELECT COUNT(*) AS total FROM test_attempts WHERE test_id = ? AND submitted_at IS NOT NULL';
    const countParams = canFilterMyStudents ? [testId, user_id] : [testId];
    const [countRows] = await connection.execute(countSql, countParams);
    connection.release();
    const list = rows.map((r, i) => ({
      rank: i + 1,
      user_id: r.user_id,
      username: r.username,
      real_name: r.real_name,
      total_score: r.total_score,
      exam_score: r.exam_score,
      oj_score: r.oj_score,
      submitted_at: r.submitted_at
    }));
    res.json({ list, total: countRows[0].total });
  } catch (e) {
    logger.error('GET /tests/:id/rankings', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 解析 ====================
router.get('/tests/attempts/:attemptId/review', async (req, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const connection = await pool.getConnection();
    const [aRows] = await connection.execute(
      'SELECT * FROM test_attempts WHERE id = ? AND user_id = ?',
      [attemptId, user_id]
    );
    if (aRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'attempt 不存在或不属于当前用户' });
    }
    const attempt = aRows[0];
    const adminOrTeacher = await isAdminOrTeacher(connection, user_id);
    if (!attempt.submitted_at && !adminOrTeacher) {
      connection.release();
      return res.status(403).json({ error: '仅已交卷可查看解析' });
    }
    const exam_review = [];
    const [subRows] = await connection.execute(
      `SELECT s.id AS submission_id, s.exam_id, s.score, s.submit_time
       FROM submissions s WHERE s.test_attempt_id = ?
       ORDER BY s.exam_id, s.submit_time DESC`,
      [attemptId]
    );
    const byExam = new Map();
    for (const row of subRows) {
      if (!byExam.has(row.exam_id)) byExam.set(row.exam_id, row);
    }
    for (const [examId, sub] of byExam) {
      const [examRows] = await connection.execute('SELECT id, name FROM exams WHERE id = ?', [examId]);
      const examName = examRows[0]?.name || `客观题 ${examId}`;
      const [ansRows] = await connection.execute(
        `SELECT sa.question_id, sa.user_answer, sa.is_correct, q.correct_answer, q.explanation, q.question_text
         FROM submission_answers sa JOIN questions q ON sa.question_id = q.id
         WHERE sa.submission_id = ? ORDER BY sa.question_id`,
        [sub.submission_id]
      );
      exam_review.push({
        exam_id: parseInt(examId, 10),
        exam_name: examName,
        submission_id: sub.submission_id,
        score: sub.score,
        questions: ansRows.map(q => ({
          question_id: q.question_id,
          user_answer: q.user_answer,
          correct_answer: q.correct_answer,
          is_correct: !!q.is_correct,
          explanation: q.explanation,
          question_text: q.question_text
        }))
      });
    }
    const oj_review = [];
    const [topRows] = await connection.execute(
      'SELECT problem_id, score_weight FROM test_oj_problems WHERE test_id = ?',
      [attempt.test_id]
    );
    for (const { problem_id, score_weight } of topRows) {
      const [last] = await connection.execute(
        `SELECT id, passed_tests, total_tests, verdict, code, submit_time FROM oj_submissions
         WHERE test_attempt_id = ? AND problem_id = ? AND status = 'completed'
         ORDER BY submit_time DESC LIMIT 1`,
        [attemptId, problem_id]
      );
      const [p] = await connection.execute(
        'SELECT id, title, description, analysis, video_url FROM oj_problems WHERE id = ?',
        [problem_id]
      );
      const [samples] = await connection.execute(
        'SELECT input, output, explanation FROM oj_samples WHERE problem_id = ? ORDER BY sort_order',
        [problem_id]
      );
      oj_review.push({
        problem_id,
        score_weight,
        submission_id: last.length ? last[0].id : null,
        passed_tests: last.length ? last[0].passed_tests : 0,
        total_tests: last.length ? last[0].total_tests : 0,
        verdict: last.length ? last[0].verdict : null,
        problem: p[0] || null,
        samples_or_explanation: samples
      });
    }
    connection.release();
    res.json({ exam_review, oj_review });
  } catch (e) {
    logger.error('GET .../review', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 为单个学生重新开启一次（教师/管理员） ====================
// 操作者 id 必须从 query 取，因 body 中的 user_id 是被重置的学生 id
router.post('/tests/:id/reset-attempt', async (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const operator_id = req.query.user_id != null ? parseInt(req.query.user_id, 10) : null;
    const student_id = req.body.user_id != null ? parseInt(req.body.user_id, 10) : null;
    if (!operator_id || !Number.isFinite(operator_id)) return res.status(401).json({ error: '请提供 user_id（query）' });
    if (!student_id || !Number.isFinite(student_id)) return res.status(400).json({ error: '请提供要重新开启的学生 user_id（body）' });
    const connection = await pool.getConnection();
    const canManage = await canManageTest(connection, testId, operator_id);
    const canViewAsTeacher = await hasTeacherRole(connection, operator_id);
    if (!canManage && !canViewAsTeacher) {
      connection.release();
      return res.status(403).json({ error: '无权操作' });
    }
    const [rows] = await connection.execute(
      'DELETE FROM test_attempts WHERE test_id = ? AND user_id = ?',
      [testId, student_id]
    );
    connection.release();
    res.json({ ok: true, message: '已为该学生重新开启一次测试，可重新作答' });
  } catch (e) {
    logger.error('POST /tests/:id/reset-attempt', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 开启公开查分 ====================
router.post('/tests/:id/enable-public-result', async (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const connection = await pool.getConnection();
    const allowed = await canManageTest(connection, testId, user_id);
    if (!allowed) {
      connection.release();
      return res.status(403).json({ error: '无权操作' });
    }
    const [t] = await connection.execute('SELECT id, public_result_token, public_result_enabled FROM tests WHERE id = ?', [testId]);
    if (t.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Test 不存在' });
    }
    let token = t[0].public_result_token;
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      await connection.execute(
        'UPDATE tests SET public_result_token = ?, public_result_enabled = 1 WHERE id = ?',
        [token, testId]
      );
    } else {
      await connection.execute('UPDATE tests SET public_result_enabled = 1 WHERE id = ?', [testId]);
    }
    connection.release();
    res.json({ ok: true, public_result_token: token });
  } catch (e) {
    logger.error('POST enable-public-result', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 关闭公开查分 ====================
router.post('/tests/:id/disable-public-result', async (req, res) => {
  try {
    const testId = parseInt(req.params.id, 10);
    const user_id = getUserId(req);
    if (!user_id) return res.status(401).json({ error: '请提供 user_id' });
    const connection = await pool.getConnection();
    const allowed = await canManageTest(connection, testId, user_id);
    if (!allowed) {
      connection.release();
      return res.status(403).json({ error: '无权操作' });
    }
    await connection.execute('UPDATE tests SET public_result_enabled = 0 WHERE id = ?', [testId]);
    connection.release();
    res.json({ ok: true });
  } catch (e) {
    logger.error('POST disable-public-result', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 公开查分：config ====================
router.get('/public-tests/:token/config', async (req, res) => {
  try {
    const token = req.params.token;
    const connection = await pool.getConnection();
    const [t] = await connection.execute(
      'SELECT id, name, description, public_result_enabled, end_time FROM tests WHERE public_result_token = ?',
      [token]
    );
    connection.release();
    if (t.length === 0) return res.status(404).json({ error: 'INVALID_TOKEN' });
    const test = t[0];
    if (!test.public_result_enabled) {
      return res.json({ allow_query: false, reason: 'NOT_ENABLED_OR_NOT_FINISHED' });
    }
    const now = new Date();
    if (test.end_time && new Date(test.end_time) < now) {
      return res.json({
        allow_query: true,
        test_name: test.name,
        description: test.description || null,
        finished: true
      });
    }
    return res.json({
      allow_query: true,
      test_name: test.name,
      description: test.description || null,
      finished: false
    });
  } catch (e) {
    logger.error('GET public-tests/:token/config', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 公开查分：query ====================
router.post('/public-tests/:token/query', async (req, res) => {
  try {
    const token = req.params.token;
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: '请提供姓名', found: false });
    }
    const trimName = name.trim();
    const connection = await pool.getConnection();
    const [t] = await connection.execute(
      'SELECT id, name, public_result_enabled, end_time FROM tests WHERE public_result_token = ?',
      [token]
    );
    if (t.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'INVALID_TOKEN' });
    }
    const test = t[0];
    if (!test.public_result_enabled) {
      connection.release();
      return res.status(403).json({ allow_query: false });
    }
    // 姓名同时按 real_name 与 username 匹配，多命中时优先 real_name 再按 id
    const [users] = await connection.execute(
      'SELECT id, real_name FROM users WHERE TRIM(real_name) = ? OR username = ? ORDER BY (CASE WHEN TRIM(real_name) = ? THEN 0 ELSE 1 END), id LIMIT 1',
      [trimName, trimName, trimName]
    );
    if (users.length === 0) {
      connection.release();
      return res.json({ found: false });
    }
    const user = users[0];
    const [attemptRows] = await connection.execute(
      'SELECT * FROM test_attempts WHERE test_id = ? AND user_id = ? AND submitted_at IS NOT NULL',
      [test.id, user.id]
    );
    if (attemptRows.length === 0) {
      connection.release();
      return res.json({ found: false });
    }
    const attempt = attemptRows[0];
    const [rankRows] = await connection.execute(
      `SELECT COUNT(*) + 1 AS rk FROM test_attempts
       WHERE test_id = ? AND submitted_at IS NOT NULL
         AND (total_score > ? OR (total_score = ? AND submitted_at < ?))`,
      [test.id, attempt.total_score, attempt.total_score, attempt.submitted_at]
    );
    const [totalRows] = await connection.execute(
      'SELECT COUNT(*) AS total FROM test_attempts WHERE test_id = ? AND submitted_at IS NOT NULL',
      [test.id]
    );
    connection.release();
    res.json({
      found: true,
      name: user.real_name || user.username,
      total_score: attempt.total_score,
      exam_score: attempt.exam_score,
      oj_score: attempt.oj_score,
      rank: rankRows[0].rk,
      total_participants: totalRows[0].total
    });
  } catch (e) {
    logger.error('POST public-tests/:token/query', { error: e.message });
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
