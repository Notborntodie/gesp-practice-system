/**
 * 录入题目 [GESP202512 四级] 优先购买 及 10 个测试点到数据库。
 * 运行前请先执行: node gen_priority_purchase_tests.js 生成 priority_purchase_tests.json
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
  title: '[GESP202512 四级] 优先购买',
  description: `小 A 有 $M$ 元预算。商店中有 $N$ 个商品，每个商品具有三种属性：

- **商品名 $S$**
- **价格 $P$**
- **优先级 $V$**（正整数，且 $V$ 越小代表商品的优先级越高）

小 A 的购物策略如下：

1. 总是优先购买优先级最高的东西。
2. 如果有多个最高优先级商品，购买价格最低的。
3. 如果仍有多个优先级最高且价格最低的商品，购买商品名字典序最小的。

小 A 想知道他能购买哪些商品。`,
  input_format: `第一行包含两个正整数 $M$ 和 $N$，分别代表预算和商品数量。

接下来的 $N$ 行，每行描述一个商品，依次为 $S$（商品名）、$P$（价格）和 $V$（优先级）。

数据保证不存在两个名字相同的商品。`,
  output_format: `按照字典序从小到大的顺序，输出所有购买的商品名。`,
  data_range: '对于所有测试点，保证 $1 \\leq |S_i| \\leq 10$，$1 \\leq M, P_i \\leq 10^5$，$1 \\leq N \\leq 10^3$，$1 \\leq V_i \\leq 10$。商品名仅由小写字母组成且不存在两个相同的商品名。',
  time_limit: 1000,
  memory_limit: 512,
  level: 4,
  publish_date: '2025-12-01',
};

async function main() {
  const testsPath = path.join(__dirname, 'priority_purchase_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_priority_purchase_tests.js 生成 priority_purchase_tests.json');
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
    console.log('请执行清缓存: node scripts/clear_problem_cache.js ' + problemId);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
