/**
 * 录入两道 GESP 1 级模拟题到 oj_problems + oj_samples：
 * 1. [GESP 1级 模拟1] 小杨的周末购物
 * 2. [GESP 1级 模拟2] 测验统计
 *
 * 使用前请先：
 *   1) 在 backend_server/scripts 目录编译参考代码：
 *      g++ -O2 -std=c++17 gesp1_mock1_shopping_ref.cpp -o gesp1_mock1_shopping_ref
 *      g++ -O2 -std=c++17 gesp1_mock2_exam_stats_ref.cpp -o gesp1_mock2_exam_stats_ref
 *   2) 生成测试点 JSON：
 *      node gen_gesp1_mock1_shopping_tests.js
 *      node gen_gesp1_mock2_exam_stats_tests.js
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
    title: '[GESP 1级 模拟1] 小杨的周末购物',
    description: `小杨周末去超市买零食。每包零食的单价为 $p$ 元，他一共买了 $n$ 包。

超市有如下优惠活动：

1. 如果总金额（未打折前）不少于 $100$ 元，可以先享受 $9$ 折优惠；
2. 打完折后，如果金额仍然不少于 $150$ 元，则可以再减 $20$ 元；
3. 如果总金额未达到 $100$ 元，则不享受任何优惠。

请你帮小杨计算最终需要支付的金额，结果保留两位小数。`,
    input_format: `输入一行，包含两个数：

- 一个实数 $p$，表示每包零食的单价（元）；
- 一个整数 $n$，表示购买的零食包数。`,
    output_format: `输出一行，一个实数，为小杨最终需要支付的金额，单位为元，保留两位小数。`,
    data_range: `- $0 < p \\leq 1000$
- $1 \\leq n \\leq 1000$`,
    analysis: `本题属于 **数学应用计算题**，考察多条件分支与小数计算，以及格式化输出。

解题思路：

1. 读入单价 $p$ 和数量 $n$，计算原价 $\\text{total} = p \\times n$；
2. 若 $\\text{total} \\geq 100$，则先打九折：$\\text{total} = \\text{total} \\times 0.9$；
3. 再判断打完折后的金额，若 $\\text{total} \\geq 150$，则再减 $20$ 元：$\\text{total} = \\text{total} - 20$；
4. 使用格式控制（如 C++ 中的 \\texttt{printf(\"%.2lf\", total);}）保留两位小数输出。`,
    time_limit: 1000,
    memory_limit: 256,
    level: 1,
    publish_date: '2026-03-05',
    bank_visible: 1,
    testsJson: 'gesp1_mock1_shopping_tests.json',
  },
  {
    title: '[GESP 1级 模拟2] 测验统计',
    description: `一次班级小测验结束后，老师想统计班级情况。

规定：

- 分数不低于 $60$ 分（含 $60$ 分）为「合格」；
- 分数不低于 $90$ 分（含 $90$ 分）为「优秀」。

给出全班每位同学的成绩，请你统计：

1. 合格的同学有多少人；
2. 优秀的同学有多少人。`,
    input_format: `输入格式如下：

- 第一行输入一个整数 $T$，表示学生人数；
- 接下来 $T$ 行，每行输入一个整数 $s$，表示一位学生的成绩。`,
    output_format: `输出一行，包含两个整数：

- 第一个整数为合格人数；
- 第二个整数为优秀人数。

两个整数之间用一个空格分隔。`,
    data_range: `- $1 \\leq T \\leq 1000$
- $0 \\leq s \\leq 100$，为整数`,
    analysis: `本题属于 **循环输入 + 计数统计** 类型。

解题思路：

1. 读入学生人数 $T$；
2. 使用两个计数变量 passCnt 和 excellentCnt，初始值都设为 $0$；
3. 循环 $T$ 次读入每位学生的成绩 $s$：
   - 若 $s \\geq 60$，则将 passCnt 加一；
   - 若 $s \\geq 90$，则将 excellentCnt 加一；
4. 循环结束后，输出 passCnt 和 excellentCnt。`,
    time_limit: 1000,
    memory_limit: 256,
    level: 1,
    publish_date: '2026-03-05',
    bank_visible: 1,
    testsJson: 'gesp1_mock2_exam_stats_tests.json',
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
          s.is_displayed ? '(展示)' : '(隐藏)',
          s.is_hidden ? '(提交后隐藏)' : '(提交后展示)'
        );
      }
    }

    await connection.commit();
    console.log('两道 GESP 1级 模拟题录入完成。');
  } catch (err) {
    await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

