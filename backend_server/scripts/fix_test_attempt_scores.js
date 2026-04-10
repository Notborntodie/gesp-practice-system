/**
 * 一次性修复：按 test_exams.score_weight 重算已提交 Test 的客观题分、编程题分与总分。
 * 与 routes/tests.js 交卷逻辑一致（客观题：百分制 × 权重；编程题：score_weight × 通过率）。
 * 运行方式：cd backend_server && node scripts/fix_test_attempt_scores.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4'
};

async function run() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log('数据库连接成功\n');

    const [attempts] = await connection.execute(
      'SELECT id, test_id, exam_score AS old_exam, oj_score AS old_oj, total_score AS old_total FROM test_attempts WHERE submitted_at IS NOT NULL'
    );
    console.log(`已提交的 Test 参与记录数: ${attempts.length}\n`);

    let updated = 0;
    for (const attempt of attempts) {
      const attemptId = attempt.id;
      const testId = attempt.test_id;

      // 客观题：按 test_exams.score_weight 折算
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
      let examScore = 0;
      for (const [eid, rawScore] of byExam) {
        const weight = weightByExam.get(eid) ?? 100;
        examScore += (Number(rawScore) / 100) * weight;
      }
      examScore = Math.round(examScore * 100) / 100;

      // 编程题：与交卷逻辑一致
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
      const totalScore = Math.round((examScore + ojScore) * 100) / 100;

      const oldExam = attempt.old_exam != null ? Number(attempt.old_exam) : null;
      const oldOj = attempt.old_oj != null ? Number(attempt.old_oj) : null;
      const oldTotal = attempt.old_total != null ? Number(attempt.old_total) : null;
      const changed = oldExam !== examScore || oldOj !== ojScore || oldTotal !== totalScore;

      if (changed) {
        await connection.execute(
          'UPDATE test_attempts SET exam_score = ?, oj_score = ?, total_score = ? WHERE id = ?',
          [examScore, ojScore, totalScore, attemptId]
        );
        updated++;
        console.log(
          `  attempt ${attemptId} (test ${testId}): 客观题 ${oldExam} -> ${examScore}, 编程题 ${oldOj} -> ${ojScore}, 总分 ${oldTotal} -> ${totalScore}`
        );
      }
    }

    console.log(`\n完成。共 ${attempts.length} 条已提交记录，修正 ${updated} 条。`);
  } catch (e) {
    console.error('执行失败:', e.message);
    process.exit(1);
  } finally {
    if (connection) connection.end();
  }
}

run();
