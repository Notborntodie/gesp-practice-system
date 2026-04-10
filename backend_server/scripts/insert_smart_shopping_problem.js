/**
 * 录入题目 [GESP202512 三级] 小杨的智慧购物 及 10 个测试点。
 * 运行前请先执行: node gen_smart_shopping_tests.js
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
  title: '[GESP202512 三级] 小杨的智慧购物',
  description: '小杨的班级要举办环保手工作品展览，老师请小杨到文具店购买 $M$ 种不同种类的文具（如铅笔、橡皮、直尺等）。\n\n文具店共有 $N$ 件文具，每件文具有一个类别编号（从 $1$ 到 $M$）和价格。\n\n小杨的预算有限，他的策略是：每种文具只买**最便宜**的一件；若同一种类有多件价格相同且都是最便宜，则只买其中一件。\n\n请帮他计算购买齐 $M$ 种文具所需的总花费。',
  input_format: '第一行两个正整数 $M$ 和 $N$，分别表示文具种类数和店内文具总数。\n\n接下来 $N$ 行，每行两个正整数 $K$ 和 $P$，表示一件文具的类别编号和价格。\n\n题面保证每种文具至少有一件。',
  output_format: '一行一个整数，表示购买齐 $M$ 种文具所需的总花费。',
  data_range: '对于所有测试点，保证 $1 \\leq M \\leq N \\leq 10^5$，$1 \\leq K_i \\leq M$，$1 \\leq P_i \\leq 10^3$。',
  time_limit: 1000,
  memory_limit: 512,
  level: 3,
  publish_date: '2025-12-01',
};

async function main() {
  const testsPath = path.join(__dirname, 'smart_shopping_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_smart_shopping_tests.js');
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

    console.log('插入', samples.length, '个测试点...');
    for (const s of samples) {
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
