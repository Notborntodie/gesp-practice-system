/**
 * 录入两道 GESP 4 级模拟题到 oj_problems + oj_samples：
 * 1. [GESP 4级 模拟1] 最大子矩阵和（二维与子矩阵）
 * 2. [GESP 4级 模拟2] 礼物分配（多关键字排序 + 简单贪心）
 *
 * 使用前请先：
 *   1) 在 backend_server/scripts 目录编译参考代码：
 *      g++ -O2 -std=c++17 gesp4_mock1_submatrix_ref.cpp -o gesp4_mock1_submatrix_ref
 *      g++ -O2 -std=c++17 gesp4_mock2_gift_ref.cpp -o gesp4_mock2_gift_ref
 *   2) 生成测试点 JSON：
 *      node gen_gesp4_mock1_submatrix_tests.js
 *      node gen_gesp4_mock2_gift_tests.js
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

const PROBLEMS = [
  {
    title: '[GESP 4级 模拟1] 最大子矩阵和',
    description: `小杨有一个 $n$ 行 $m$ 列的矩阵，矩阵中每个格子有一个整数。

小杨想找出所有**大小为 $k \\times k$ 的正方形子矩阵**（即连续 $k$ 行、$k$ 列构成的子块）中，**元素和最大**的是多少。

例如 $n=3$，$m=4$，$k=2$ 时，矩阵为三行四列，依次为：第一行 1 2 3 4，第二行 5 6 7 8，第三行 9 10 11 12。所有 $2 \\times 2$ 子矩阵的和分别为 $14, 18, 22, 30, 34, 38$，其中最大为 $38$。`,
    input_format: `输入格式如下：

- 第一行三个正整数 $n$、$m$、$k$，表示矩阵有 $n$ 行 $m$ 列，子矩阵边长为 $k$。
- 接下来 $n$ 行，每行 $m$ 个整数，表示矩阵各位置的值。`,
    output_format: `输出一行，一个整数，表示所有 $k \\times k$ 正方形子矩阵中元素和的最大值。`,
    data_range: `- $1 \\leq k \\leq n \\leq 50$，$1 \\leq k \\leq m \\leq 50$
- 矩阵元素均为整数，绝对值不超过 $100$。`,
    analysis: `本题属于 **二维与子矩阵** 类型，考察二重循环枚举子矩阵并求和。

解题思路：

1. 读入 $n, m, k$ 和矩阵；
2. 枚举所有满足 $1 \\leq i \\leq n-k+1$、$1 \\leq j \\leq m-k+1$ 的左上角 $(i, j)$；
3. 对每个左上角，计算以 $(i,j)$ 为左上角的 $k \\times k$ 子矩阵的元素和（二重循环累加）；
4. 在所有子矩阵和中取最大值输出。`,
    time_limit: 1000,
    memory_limit: 256,
    level: 4,
    publish_date: '2026-03-05',
    bank_visible: 1,
    testsJson: 'gesp4_mock1_submatrix_tests.json',
  },
  {
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
    time_limit: 1000,
    memory_limit: 256,
    level: 4,
    publish_date: '2026-03-05',
    bank_visible: 1,
    testsJson: 'gesp4_mock2_gift_tests.json',
  },
];

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  await connection.beginTransaction();

  try {
    for (const problem of PROBLEMS) {
      const testsPath = path.join(__dirname, problem.testsJson);
      if (!fs.existsSync(testsPath)) {
        throw new Error(`未找到测试点文件: ${testsPath}，请先运行对应的 gen_*.js 脚本生成。`);
      }
      const samples = JSON.parse(fs.readFileSync(testsPath, 'utf8'));

      console.log('插入题目:', problem.title);
      const [insertProblem] = await connection.execute(
        `INSERT INTO oj_problems (
          title, description, input_format, output_format, data_range, analysis,
          time_limit, memory_limit, level, publish_date, bank_visible
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          problem.title,
          problem.description,
          problem.input_format,
          problem.output_format,
          problem.data_range,
          problem.analysis || null,
          problem.time_limit,
          problem.memory_limit,
          problem.level,
          problem.publish_date,
          problem.bank_visible,
        ]
      );
      const problemId = insertProblem.insertId;
      console.log('题目 ID:', problemId);

      console.log('插入测试点...', samples.length);
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
        console.log(
          '  样例',
          s.sort_order,
          s.is_displayed ? '(展示)' : '',
          s.is_hidden ? '(提交后隐藏)' : '(提交后展示)'
        );
      }
    }

    await connection.commit();
    console.log('两道 GESP 4级 模拟题录入完成。请对两个题目 ID 分别执行：node scripts/clear_problem_cache.js <题目ID>');
  } catch (err) {
    await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
