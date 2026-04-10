/**
 * 用 priority_purchase_tests.json 覆盖更新「优先购买」题目 (problem_id=128) 的 10 个测试点
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4',
};

const PROBLEM_ID = 128; // [GESP202512 四级] 优先购买

async function main() {
  const jsonPath = path.join(__dirname, 'priority_purchase_tests.json');
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
    console.log('请执行: node scripts/clear_problem_cache.js', PROBLEM_ID);
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    await connection.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
