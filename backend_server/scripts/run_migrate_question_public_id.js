/**
 * 迁移：为 questions 添加 public_id，并回填 2026 年 3月 GESP 1-6级真题。
 *
 * 默认 dry-run：
 *   cd backend_server && node scripts/run_migrate_question_public_id.js
 *
 * 真正写入：
 *   cd backend_server && node scripts/run_migrate_question_public_id.js --apply
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const {
  buildGespPublicId,
  parseGespRealExamName
} = require('../utils/questionPublicId');

const APPLY = process.argv.includes('--apply');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4',
  dateStrings: true
};

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [DB_CONFIG.database, table, column]
  );
  return rows.length > 0;
}

async function ensurePublicIdColumn(connection) {
  const hasPublicId = await columnExists(connection, 'questions', 'public_id');
  if (hasPublicId) {
    console.log('- questions.public_id 已存在，跳过 ADD COLUMN');
    return;
  }

  if (!APPLY) {
    console.log('[dry-run] 将添加 questions.public_id varchar(64) unique');
    return;
  }

  await connection.query(`
    ALTER TABLE questions
    ADD COLUMN public_id varchar(64) DEFAULT NULL COMMENT '题目可见检索编号' AFTER id,
    ADD UNIQUE KEY unique_questions_public_id (public_id)
  `);
  console.log('✓ 已添加 questions.public_id');
}

async function getTargetExamRows(connection, hasPublicId) {
  const [rows] = await connection.query(`
    SELECT
      e.id AS exam_id,
      e.name AS exam_name,
      e.level AS exam_level,
      eq.question_id,
      eq.question_number,
      ${hasPublicId ? 'q.public_id' : 'NULL AS public_id'}
    FROM exams e
    JOIN exam_questions eq ON eq.exam_id = e.id
    JOIN questions q ON q.id = eq.question_id
    WHERE e.category = 'GESP'
      AND e.type = '真题'
      AND e.name LIKE '2026%3%GESP%真题%'
      AND e.level BETWEEN 1 AND 6
    ORDER BY e.level, eq.question_number
  `);

  return rows.filter(row => {
    const parsed = parseGespRealExamName(row.exam_name);
    return parsed && parsed.year === 2026 && parsed.month === 3 && parsed.level >= 1 && parsed.level <= 6;
  });
}

function validateTargetRows(rows) {
  const byExam = new Map();
  for (const row of rows) {
    if (!byExam.has(row.exam_id)) byExam.set(row.exam_id, []);
    byExam.get(row.exam_id).push(row);
  }

  if (byExam.size !== 6) {
    throw new Error(`预期 6 套 2026-03 GESP 真题，实际找到 ${byExam.size} 套`);
  }

  for (const [examId, examRows] of byExam) {
    const first = examRows[0];
    const parsed = parseGespRealExamName(first.exam_name);
    if (!parsed) throw new Error(`无法解析真题名称：${first.exam_name}`);
    if (examRows.length !== 25) {
      throw new Error(`${first.exam_name}(${examId}) 预期 25 道题，实际 ${examRows.length} 道`);
    }

    const numbers = [...new Set(examRows.map(row => row.question_number))].sort((a, b) => a - b);
    const expected = Array.from({ length: 25 }, (_, index) => index + 1);
    if (numbers.join(',') !== expected.join(',')) {
      throw new Error(`${first.exam_name}(${examId}) 题号不是 1-25：${numbers.join(',')}`);
    }
  }
}

async function assertNoPublicIdConflicts(connection, assignments) {
  const publicIds = assignments.map(item => item.publicId);
  const [rows] = await connection.query(
    `SELECT id, public_id
     FROM questions
     WHERE public_id IN (${publicIds.map(() => '?').join(',')})`,
    publicIds
  );

  const conflicts = rows.filter(row => {
    const assignment = assignments.find(item => item.publicId === row.public_id);
    return assignment && assignment.questionId !== row.id;
  });

  if (conflicts.length > 0) {
    const detail = conflicts.map(row => `${row.public_id} 已属于 question_id=${row.id}`).join('; ');
    throw new Error(`public_id 冲突：${detail}`);
  }
}

function buildAssignments(rows) {
  return rows.map(row => {
    const parsed = parseGespRealExamName(row.exam_name);
    return {
      questionId: row.question_id,
      publicId: buildGespPublicId(parsed.year, parsed.month, parsed.level, row.question_number),
      currentPublicId: row.public_id,
      examName: row.exam_name,
      questionNumber: row.question_number
    };
  });
}

async function applyAssignments(connection, assignments) {
  let changed = 0;
  for (const assignment of assignments) {
    if (assignment.currentPublicId === assignment.publicId) continue;
    await connection.query(
      'UPDATE questions SET public_id = ? WHERE id = ?',
      [assignment.publicId, assignment.questionId]
    );
    changed += 1;
  }
  return changed;
}

async function runMigration() {
  let connection;
  try {
    console.log(`开始迁移 questions.public_id (${APPLY ? 'apply' : 'dry-run'})\n`);
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✓ 数据库连接成功');

    await ensurePublicIdColumn(connection);

    const hasPublicId = await columnExists(connection, 'questions', 'public_id');
    const rows = await getTargetExamRows(connection, hasPublicId);
    validateTargetRows(rows);

    const assignments = buildAssignments(rows);
    if (hasPublicId) {
      await assertNoPublicIdConflicts(connection, assignments);
    } else {
      console.log('[dry-run] 字段尚不存在，跳过 public_id 冲突查询。');
    }

    const toChange = assignments.filter(item => item.currentPublicId !== item.publicId);
    console.log(`✓ 校验通过：目标 ${assignments.length} 题，需要更新 ${toChange.length} 题\n`);

    for (const item of toChange.slice(0, 12)) {
      console.log(`${APPLY ? 'update' : '[dry-run]'} question_id=${item.questionId} ${item.currentPublicId || '(empty)'} -> ${item.publicId} (${item.examName} #${item.questionNumber})`);
    }
    if (toChange.length > 12) {
      console.log(`... 其余 ${toChange.length - 12} 条省略`);
    }

    if (!APPLY) {
      console.log('\n未写入数据库。确认无误后加 --apply 执行。');
      return;
    }

    const changed = await applyAssignments(connection, assignments);
    console.log(`\n迁移完成，实际更新 ${changed} 题。`);
  } catch (err) {
    console.error('迁移失败:', err.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
