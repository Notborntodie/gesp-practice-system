const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/database');
const { logger } = require('../config/logger');

const AL_SERVER_BASE = process.env.AL_SERVER_URL || 'http://localhost:8000';
const QUERY_TIMEOUT_MS = 10000;
const MAX_ROWS = 5000;

const SCHEMA_FILE = path.join(__dirname, '..', 'database', 'schema_for_agent.txt');

/** 读取 Agent 用表结构；若无文件则返回简短兜底说明 */
function getSchemaHint() {
  try {
    const content = fs.readFileSync(SCHEMA_FILE, 'utf8');
    const withoutComments = content
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n')
      .trim();
    return withoutComments || '表结构文件为空，请运行 node scripts/export_schema_for_agent.js 生成。';
  } catch {
    return '学习计划相关表: learning_plans, learning_tasks, user_learning_plans, user_task_progress, user_exam_progress, user_oj_progress, task_exams, task_oj_problems, users。请运行 backend_server/scripts/export_schema_for_agent.js 生成完整 schema_for_agent.txt。';
  }
}

/**
 * 校验是否为管理员（admin 或 super_admin）
 */
async function ensureAdmin(connection, userId) {
  if (!userId) return false;
  const [rows] = await connection.execute(
    `SELECT 1 FROM user_roles ur
     JOIN roles r ON ur.role_id = r.id
     WHERE ur.user_id = ? AND r.name IN ('admin', 'super_admin')`,
    [userId]
  );
  return rows.length > 0;
}

/**
 * 校验 SQL 仅允许单条 SELECT（禁止写操作与多语句）
 */
function isAllowedSql(sql) {
  const s = (sql || '').trim();
  if (!s) return false;
  const upper = s.toUpperCase();
  if (!upper.startsWith('SELECT')) return false;
  const withoutTrailing = s.replace(/;\s*$/, '');
  if (withoutTrailing.includes(';')) return false;
  if (/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE)\b/i.test(s)) return false;
  return true;
}

/**
 * POST /api/admin/ai-query
 * 请求体: { question: string, resultType: 'table'|'page', admin_user_id: number }
 * 返回: { success, data: { columns, rows }, truncated?, message? }
 */
router.post('/admin/ai-query', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { question, resultType, admin_user_id } = req.body || {};
    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ success: false, message: '缺少 question' });
    }
    const userId = admin_user_id != null ? parseInt(admin_user_id, 10) : null;
    const isAdmin = await ensureAdmin(connection, userId);
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: '仅管理员可调用' });
    }

    const generateUrl = `${AL_SERVER_BASE}/api/admin/generate-sql`;
    const schemaHint = getSchemaHint();
    const genRes = await axios.post(
      generateUrl,
      { question: question.trim(), schemaHint },
      { timeout: 15000, headers: { 'Content-Type': 'application/json' } }
    );
    let sql = (genRes.data && genRes.data.sql) || '';
    if (!sql || !isAllowedSql(sql)) {
      return res.status(400).json({ success: false, message: '仅允许单条 SELECT 语句', raw: sql.slice(0, 200) });
    }

    const runQuery = () => connection.execute(sql);
    const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('查询超时')), QUERY_TIMEOUT_MS));
    const [rows, fields] = await Promise.race([runQuery(), timeoutPromise]);

    const columns = (fields || []).map((f) => f.name);
    let resultRows = Array.isArray(rows) ? rows : [];
    let truncated = false;
    if (resultRows.length > MAX_ROWS) {
      resultRows = resultRows.slice(0, MAX_ROWS);
      truncated = true;
    }
    const data = { columns, rows: resultRows };
    if (truncated) data.truncated = true;

    res.json({ success: true, data });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || (err.message && err.message.includes('超时'))) {
      logger.warn('AI 查询失败: Al_server 不可达或超时', { error: err.message });
      return res.status(502).json({ success: false, message: 'AI 服务不可用或查询超时' });
    }
    if (err.response && err.response.status) {
      logger.warn('AI 生成 SQL 失败', { status: err.response.status, data: err.response.data });
      return res.status(502).json({ success: false, message: (err.response.data && err.response.data.error) || '生成 SQL 失败' });
    }
    if (err.sqlMessage || err.code === 'ER_') {
      return res.status(400).json({ success: false, message: err.sqlMessage || err.message || 'SQL 执行错误' });
    }
    logger.error('admin/ai-query 错误', { error: err.message });
    res.status(500).json({ success: false, message: err.message || '执行查询失败' });
  } finally {
    connection.release();
  }
});

module.exports = router;
