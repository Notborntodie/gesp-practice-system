/**
 * 更新题目 144 [GESP202603 四级] 山谷：改为二维矩阵谷格题意，并同步 valley_tests.json 的测试点。
 * 运行前：g++ -O2 -std=c++17 valley_ref.cpp -o valley_ref && node gen_valley_tests.js
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

const PROBLEM_ID = 144;

const PROBLEM_UPDATE = {
  description: `给定 $n \\times m$ 的高程矩阵，每个格子有一个高度值。若某格子 $(i,j)$ 的高度**不大于**其**八邻**（上、下、左、右、左上、右上、左下、右下，边界格只考虑存在的邻居）中任意一格的高度，则称该格子为**山谷**。

请统计矩阵中山谷的总个数。

**说明**：若整个矩阵所有格子高度相同，则每个格子都算作山谷。`,
  input_format: `第一行两个整数 $n$、$m$，表示矩阵行数和列数。

接下来 $n$ 行，每行 $m$ 个整数，表示该行每格的高度。`,
  output_format: `输出一行一个整数，表示山谷的个数。`,
  data_range: '$1 \\le n, m \\le 100$，$1 \\le A_{ij} \\le 10^6$。',
};

async function main() {
  const testsPath = path.join(__dirname, 'valley_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_valley_tests.js');
    process.exit(1);
  }
  const samples = JSON.parse(fs.readFileSync(testsPath, 'utf8'));
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    console.log('更新题目', PROBLEM_ID, '描述与数据范围...');
    await connection.execute(
      `UPDATE oj_problems SET description = ?, input_format = ?, output_format = ?, data_range = ? WHERE id = ?`,
      [
        PROBLEM_UPDATE.description,
        PROBLEM_UPDATE.input_format,
        PROBLEM_UPDATE.output_format,
        PROBLEM_UPDATE.data_range,
        PROBLEM_ID,
      ]
    );

    console.log('删除原测试点...');
    await connection.execute('DELETE FROM oj_samples WHERE problem_id = ?', [PROBLEM_ID]);

    console.log('插入', samples.length, '个测试点...');
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
    console.log('已更新题目', PROBLEM_ID, '并同步测试点。请执行: node scripts/clear_problem_cache.js', PROBLEM_ID);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
