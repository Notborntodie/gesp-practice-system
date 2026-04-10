/**
 * 录入题目「交朋友」及 10 个测试点到数据库。
 * 运行前请先执行: node gen_make_friend_tests.js 生成 make_friend_tests.json
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
  title: '[GESP202603 一级] 交朋友',
  description: `Alice 班上共有 4 个小朋友，身高分别为 $H_1, H_2, H_3, H_4$，其中 Alice 的身高为 $H_1$。

Alice 想要和身高最接近她的人交朋友，如果有多个人符合条件，则 Alice 想和其中较矮的那一人做朋友，你能告诉她这个人的身高是多少吗？`,
  input_format: `输入共 4 行，第 $i$ 行包含一个整数 $H_i$，表示班上小朋友的身高。`,
  output_format: `输出 1 行，包含一个整数 $h$，表示 Alice 想交的朋友的身高。`,
  data_range: '保证 $100 \\leq H_i \\leq 199$ 且 $H_i$ 互不相同。',
  time_limit: 1000,
  memory_limit: 256,
  level: 1,
  publish_date: new Date().toISOString().slice(0, 10),
  bank_visible: 1,
};

async function main() {
  const testsPath = path.join(__dirname, 'make_friend_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_make_friend_tests.js 生成 make_friend_tests.json');
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
      console.log('  样例', s.sort_order, s.is_displayed ? '(展示)' : '(隐藏)', 'OK');
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
