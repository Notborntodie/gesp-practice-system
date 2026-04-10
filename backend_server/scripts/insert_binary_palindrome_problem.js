/**
 * 录入题目 [GESP 2026年3月认证 C++ 3级 T1] 二进制回文串 及 10 个测试点到数据库。
 * 运行前请先执行:
 *   1) g++ -O2 -std=c++17 binary_palindrome_ref.cpp -o binary_palindrome_ref
 *   2) node gen_binary_palindrome_tests.js
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
  title: '[GESP202603 三级] 二进制回文串',
  description: `将正整数 $n$ 转为二进制表示（无前导零），若该二进制串正着读和反着读相同，则称 $n$ 为**二进制回文数**。

例如：$9$ 的二进制为 $(1001)_2$，正反读相同，所以 $9$ 是二进制回文数；$12$ 的二进制为 $(1100)_2$，正反读不同，所以 $12$ 不是二进制回文数。

给定一个正整数 $n$，请计算 $1$ 到 $n$ 中有多少个二进制回文数。`,
  input_format: `输入一行，一个正整数 $n$。`,
  output_format: `输出一行，一个整数，表示 $1$ 到 $n$ 中二进制回文数的个数。`,
  data_range: '保证 $1 \\le n \\le 10^5$。',
  time_limit: 1000,
  memory_limit: 512,
  level: 3,
  publish_date: '2026-03-14',
  bank_visible: 1,
};

async function main() {
  const testsPath = path.join(__dirname, 'binary_palindrome_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_binary_palindrome_tests.js 生成 binary_palindrome_tests.json');
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
