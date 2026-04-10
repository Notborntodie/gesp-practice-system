/**
 * 用最新生成的 JSON 覆盖更新两道 GESP1 模拟题的测试点：
 * - problem_id=129: [GESP 1级 模拟1] 小杨的周末购物
 * - problem_id=130: [GESP 1级 模拟2] 测验统计
 *
 * 运行前请先在 scripts 目录执行：
 *   node gen_gesp1_mock1_shopping_tests.js
 *   node gen_gesp1_mock2_exam_stats_tests.js
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
  {
    problemId: 129,
    json: 'gesp1_mock1_shopping_tests.json',
  },
  {
    problemId: 130,
    json: 'gesp1_mock2_exam_stats_tests.json',
  },
];

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  await connection.beginTransaction();

  try {
    for (const cfg of CONFIGS) {
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
    console.log('GESP1 模拟题测试点同步完成。');
  } catch (e) {
    await connection.rollback();
    console.error(e);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

