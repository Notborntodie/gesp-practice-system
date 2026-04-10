/**
 * 录入题目 [GESP 2026年3月认证 C++ 1级 编程题2] 数字替换 及 10 个测试点到数据库。
 * 运行前请先执行:
 *   1) g++ -O2 -std=c++17 digit_replace_ref.cpp -o digit_replace_ref
 *   2) node gen_digit_replace_tests.js
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
  title: '[GESP202603 一级] 数字替换',
  description: `Alice 不喜欢数字 4，但觉得数字 8 寓意好。她想把数中的 4 全都替换成 8；若数中不含 4 则无需修改。你能帮帮她吗？`,
  input_format: `输入一行，包含一个整数 $A$，表示替换前的数。`,
  output_format: `输出一行，包含一个整数 $B$，表示替换后的数。`,
  data_range: '保证 $A$ 为整数，位数不超过 $10$ 位。',
  time_limit: 1000,
  memory_limit: 512,
  level: 1,
  publish_date: '2026-03-14',
  bank_visible: 1,
};

async function main() {
  const testsPath = path.join(__dirname, 'digit_replace_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_digit_replace_tests.js 生成 digit_replace_tests.json');
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
        time_limit, memory_limit, level, publish_date, bank_visible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        PROBLEM.bank_visible,
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
      console.log('  样例', s.sort_order, s.is_displayed ? '(展示)' : '', s.is_hidden ? '(提交后隐藏)' : '(提交后展示)', 'OK');
    }

    await connection.commit();
    console.log('录入完成。题目 ID:', problemId);
    console.log('请执行清缓存: node scripts/clear_problem_cache.js', problemId);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
