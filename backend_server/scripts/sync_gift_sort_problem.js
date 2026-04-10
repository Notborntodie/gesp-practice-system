/**
 * 将题目 143 更新为 [GESP202603 四级] 礼物排序（N 个礼盒每盒 K 个礼物价格，按总价/最大/最小/编号排序，输出 1-based 编号），并同步 gift_sort_tests.json。
 * 运行前：g++ -O2 -std=c++17 gift_sort_ref.cpp -o gift_sort_ref && node gen_gift_sort_tests.js
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

const PROBLEM_ID = 143;

const PROBLEM_UPDATE = {
  title: '[GESP202603 四级] 礼物排序',
  description: `有 $N$ 个礼盒，每个礼盒内有 $K$ 个礼物，每个礼物有一个价格。请按以下规则对礼盒**从小到大**排序（优先级从高到低）：

1. **优先级 1**：按礼盒内所有礼物的**总价值**从小到大；
2. **优先级 2**：若总价值相同，按礼盒内**最大礼物价格**从小到大；
3. **优先级 3**：若最大价格也相同，按礼盒内**最小礼物价格**从小到大；
4. **优先级 4**：若以上都相同，按**输入顺序（编号）**从小到大。`,
  input_format: `第一行两个整数 $N$、$K$，表示礼盒数量和每个礼盒中的礼物数量。

接下来 $N$ 行，每行 $K$ 个整数，表示该礼盒中每个礼物的价格。`,
  output_format: `输出一行，为排序后的礼盒**编号**（1 到 $N$，按输入顺序编号），编号之间用空格分隔。`,
  data_range: '$1 \\le N, K \\le 100$，价格均为正整数，常规范围。',
};

async function main() {
  const testsPath = path.join(__dirname, 'gift_sort_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_gift_sort_tests.js');
    process.exit(1);
  }
  const samples = JSON.parse(fs.readFileSync(testsPath, 'utf8'));
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    console.log('更新题目', PROBLEM_ID, '...');
    await connection.execute(
      `UPDATE oj_problems SET title = ?, description = ?, input_format = ?, output_format = ?, data_range = ? WHERE id = ?`,
      [
        PROBLEM_UPDATE.title,
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
        [PROBLEM_ID, s.input, s.output, s.explanation || null, s.is_hidden ? 1 : 0, s.is_displayed ? 1 : 0, s.sort_order]
      );
    }

    await connection.commit();
    console.log('已更新题目', PROBLEM_ID, '。请执行: node scripts/clear_problem_cache.js', PROBLEM_ID);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
