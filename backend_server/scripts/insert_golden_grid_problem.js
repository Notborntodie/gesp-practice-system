/**
 * 录入题目 [GESP202512 二级] 黄金格 及 10 个测试点到数据库。
 * 运行前请先执行: node gen_golden_grid_tests.js 生成 golden_grid_tests.json
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
  title: '[GESP202512 二级] 黄金格',
  description: `小杨发现了一张神奇的矩形地图，地图有 $H$ 行和 $W$ 列。

每个格子的坐标表示为 $(r, c)$，其中 $r$ 代表行号（从 $1$ 到 $H$），$c$ 代表列号（从 $1$ 到 $W$）。

地图中隐藏着「黄金格」，这些格子满足一个特定的数学不等式关系。

黄金格的条件是：$\\sqrt{r^2 + c^2} \\leq x + r - c$

示例：如果参数 $x=5$，格子 $(4,3)$ 就是黄金格。因为左边 $\\sqrt{4^2 + 3^2} = \\sqrt{25} = 5$，而右边 $x + r - c = 5 + 4 - 3 = 6$。$5 \\leq 6$ 成立，所以 $(4,3)$ 是黄金格。

请你计算满足条件的黄金格总数。`,
  input_format: `共三行，每行一个正整数。

这三个正整数分别表示 **H**（行数）、**W**（列数）和 **x**（问题中的参数），含义如题面所示。`,
  output_format: `共一行，包含一个整数，表示满足条件的「黄金格」的总数量。`,
  data_range: '对于所有测试点，保证给出的正整数不超过 1000。',
  time_limit: 1000,
  memory_limit: 512,
  level: 2,
  publish_date: '2025-12-01',
};

async function main() {
  const testsPath = path.join(__dirname, 'golden_grid_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_golden_grid_tests.js 生成 golden_grid_tests.json');
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
