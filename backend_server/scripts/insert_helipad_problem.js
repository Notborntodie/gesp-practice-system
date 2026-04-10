/**
 * 录入题目 [GESP202512 四级] 建造 及 10 个测试点到数据库。
 * 运行前请先执行: node gen_helipad_tests.js 生成 helipad_tests.json
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

const PROBLEM = {
  title: '[GESP202512 四级] 建造',
  description: `小A有一张 $M$ 行 $N$ 列的地形图，其中第 $i$ 行第 $j$ 列的数字 $a_{ij}$ 代表坐标 $(i,j)$ 的海拔高度。

停机坪为一个 $3 \\times 3$ 的区域，且内部所有 9 个点的最大高度和最小高度之差不超过 $H$。

小A想请你计算出，在所有适合建造停机坪的区域中，区域内部 9 个点海拔之和最大是多少。`,
  input_format: `第一行包含三个正整数 $M, N, H$，其含义如题面所述。

之后 $M$ 行，每行包含 $N$ 个整数 $a_{i1}, a_{i2}, \\ldots, a_{iN}$，代表坐标 $(i,j)$ 的高度。`,
  output_format: `输出一行，代表最大的海拔之和。`,
  data_range: '对于所有测试点，保证 $1 \\le M, N \\le 10^3$，$1 \\le H, a_{ij} \\le 10^5$。',
  time_limit: 1000,
  memory_limit: 512,
  level: 4,
  publish_date: '2025-12-01',
};

async function main() {
  const testsPath = path.join(__dirname, 'helipad_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_helipad_tests.js 生成 helipad_tests.json');
    process.exit(1);
  }
  const samples = JSON.parse(fs.readFileSync(testsPath, 'utf8'));

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    console.log('插入题目:', PROBLEM.title);
    const [insertProblem] = await connection.execute(
      `INSERT INTO oj_problems (
        title, description, input_format, output_format, data_range, analysis,
        time_limit, memory_limit, level, publish_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        PROBLEM.title,
        PROBLEM.description,
        PROBLEM.input_format,
        PROBLEM.output_format,
        PROBLEM.data_range,
        PROBLEM.analysis || null,
        PROBLEM.time_limit,
        PROBLEM.memory_limit,
        PROBLEM.level,
        PROBLEM.publish_date,
      ]
    );
    const problemId = insertProblem.insertId;
    console.log('题目 ID:', problemId);

    console.log('插入 10 个测试点...');
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      await connection.execute(
        `INSERT INTO oj_samples (
          problem_id, input, output, explanation,
          is_hidden, is_displayed, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          problemId,
          s.input,
          s.output,
          s.explanation || null,
          s.is_hidden ? 1 : 0,
          s.is_displayed ? 1 : 0,
          s.sort_order,
        ]
      );
      console.log('  样例', s.sort_order, s.is_displayed ? '(展示)' : '(隐藏)', 'OK');
    }

    await connection.commit();
    console.log('录入完成。题目 ID:', problemId);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
