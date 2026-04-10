/**
 * 用最新生成的 JSON 覆盖更新两道 GESP3 模拟题的测试点。
 * 首次录入后，请将下方 problemId 改为实际题目 ID（运行 insert_gesp3_mock_problems.js 时会输出）。
 *
 * 运行前请先在 scripts 目录执行：
 *   node gen_gesp3_mock1_checkin_tests.js
 *   node gen_gesp3_mock2_high_freq_word_tests.js
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

const CONFIGS = [
  { problemId: 133, json: 'gesp3_mock1_checkin_tests.json' },   // [GESP 3级 模拟1] 签到统计
  { problemId: 134, json: 'gesp3_mock2_high_freq_word_tests.json' }, // [GESP 3级 模拟2] 高频词
];

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  await connection.beginTransaction();

  try {
    for (const cfg of CONFIGS) {
      if (!cfg.problemId) {
        console.warn('跳过未配置 problemId 的题目，请编辑本文件填入题目 ID。');
        continue;
      }
      const jsonPath = path.join(__dirname, cfg.json);
      if (!fs.existsSync(jsonPath)) {
        throw new Error(`未找到测试点文件: ${jsonPath}，请先运行对应的 gen_*.js 脚本生成。`);
      }
      const samples = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      console.log('覆盖更新题目', cfg.problemId, '的', samples.length, '个测试点');

      await connection.execute('DELETE FROM oj_samples WHERE problem_id = ?', [cfg.problemId]);

      for (const s of samples) {
        await connection.execute(
          `INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, is_displayed, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            cfg.problemId,
            s.input,
            s.output,
            s.explanation || null,
            s.is_hidden ? 1 : 0,
            s.is_displayed ? 1 : 0,
            s.sort_order,
          ]
        );
      }
    }

    await connection.commit();
    console.log('GESP3 模拟题测试点同步完成。请对两题分别执行：node scripts/clear_problem_cache.js <题目ID>');
  } catch (e) {
    await connection.rollback();
    console.error(e);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
