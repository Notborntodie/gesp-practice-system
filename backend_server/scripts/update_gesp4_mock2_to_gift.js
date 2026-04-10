/**
 * 将已入库的 [GESP 4级 模拟2] 任务调度（id=136）替换为 礼物分配。
 * 更新 oj_problems 的题面，并用 gesp4_mock2_gift_tests.json 覆盖 oj_samples。
 *
 * 运行前请先：
 *   g++ -O2 -std=c++17 gesp4_mock2_gift_ref.cpp -o gesp4_mock2_gift_ref
 *   node gen_gesp4_mock2_gift_tests.js
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

const PROBLEM_ID = 136;

const UPDATED_PROBLEM = {
  title: '[GESP 4级 模拟2] 礼物分配',
  description: `小杨有 $C$ 份礼物，要分给 $n$ 个孩子。第 $i$ 个孩子**需要** $a_i$ 份礼物才会满意，若被满足则会获得**满意度** $v_i$（每人最多分一次，要么分够 $a_i$ 份，要么不分）。

小杨的目标是：**在满足人数尽量多的前提下**，再让**总满意度**（被满足的孩子的 $v_i$ 之和）尽量大。请问最多能满足几个孩子，以及在该人数下能得到的最大总满意度是多少？

例如：$n=4$，$C=10$，$(a_i, v_i)$ 依次为 $(3,5)$、$(2,1)$、$(5,20)$、$(4,10)$。按需求升序、同需求按满意度降序排序后为 $(2,1)$、$(3,5)$、$(4,10)$、$(5,20)$。依次分 $2,3,4$ 份后剩余 $1$，无法再满足需要 $5$ 份的，故最多满足 $3$ 人，总满意度为 $1+5+10=16$。`,
  input_format: `输入格式如下：

- 第一行两个正整数 $n$、$C$，表示孩子个数和礼物总份数。
- 接下来 $n$ 行，每行两个正整数 $a_i$、$v_i$，表示第 $i$ 个孩子需要的礼物份数和满意度。`,
  output_format: `输出一行，两个整数，用空格分隔：第一个为最多能满足的孩子人数，第二个为在人数最多的前提下能得到的最大总满意度。`,
  data_range: `- $1 \\leq n \\leq 500$
- $0 \\leq C \\leq 10^4$，$1 \\leq a_i \\leq 1000$，$1 \\leq v_i \\leq 1000$。`,
  analysis: `本题属于 **多关键字排序 + 贪心** 类型。

解题思路：

1. 将孩子按**第一关键字 $a_i$ 升序**（需求小的先满足，才能让人数最多）、**第二关键字 $v_i$ 降序**（同需求时优先选满意度高的）排序；
2. 从第一个孩子开始，若当前剩余礼物 $\\geq a_i$，则分给他，剩余礼物减去 $a_i$，人数加一，总满意度加上 $v_i$；否则跳过；
3. 输出最终人数和总满意度。`,
};

async function main() {
  const jsonPath = path.join(__dirname, 'gesp4_mock2_gift_tests.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error('未找到 gesp4_mock2_gift_tests.json，请先运行 node gen_gesp4_mock2_gift_tests.js');
  }
  const samples = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const connection = await mysql.createConnection(dbConfig);
  await connection.beginTransaction();

  try {
    console.log('更新题目 id=', PROBLEM_ID, '->', UPDATED_PROBLEM.title);
    await connection.execute(
      `UPDATE oj_problems SET
        title = ?, description = ?, input_format = ?, output_format = ?,
        data_range = ?, analysis = ?
       WHERE id = ?`,
      [
        UPDATED_PROBLEM.title,
        UPDATED_PROBLEM.description,
        UPDATED_PROBLEM.input_format,
        UPDATED_PROBLEM.output_format,
        UPDATED_PROBLEM.data_range,
        UPDATED_PROBLEM.analysis,
        PROBLEM_ID,
      ]
    );

    console.log('删除原测试点并插入新测试点...', samples.length);
    await connection.execute('DELETE FROM oj_samples WHERE problem_id = ?', [PROBLEM_ID]);
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
    console.log('已替换为 礼物分配。请执行：node scripts/clear_problem_cache.js', PROBLEM_ID);
  } catch (e) {
    await connection.rollback();
    console.error(e);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
