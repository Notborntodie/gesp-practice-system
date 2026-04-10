/**
 * 用 gesp2_mock2_manhattan_ring_tests.json 覆盖更新题目 132（小杨的曼哈顿圈）的测试点
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4',
};

const PROBLEM_ID = 132;

async function main() {
  const jsonPath = path.join(__dirname, 'gesp2_mock2_manhattan_ring_tests.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('请先运行 node gen_gesp2_mock2_manhattan_ring_tests.js 生成测试点 JSON');
    process.exit(1);
  }
  const samples = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const connection = await mysql.createConnection(dbConfig);
  await connection.beginTransaction();
  try {
    await connection.execute('DELETE FROM oj_samples WHERE problem_id = ?', [PROBLEM_ID]);
    for (const s of samples) {
      await connection.execute(
        `INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, is_displayed, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          PROBLEM_ID,
          s.input,
          s.output,
          s.explanation || null,
          s.is_hidden ? 1 : 0,
          s.is_displayed ? 1 : 0,
          s.sort_order,
        ]
      );
    }
    await connection.commit();
    console.log('已同步', samples.length, '个测试点到题目', PROBLEM_ID);
    execSync(`node ${path.join(__dirname, 'clear_problem_cache.js')} ${PROBLEM_ID}`, { stdio: 'inherit' });
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    await connection.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
