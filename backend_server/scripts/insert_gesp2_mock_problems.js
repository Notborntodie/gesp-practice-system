/**
 * 录入两道 GESP 2 级模拟题到 oj_problems + oj_samples：
 * 1. [GESP 2级 模拟1] 小杨的幸运编号（纯数位拆分）
 * 2. [GESP 2级 模拟2] 小杨的曼哈顿圈
 *
 * 使用前请先：
 *   1) 在 backend_server/scripts 目录编译参考代码：
 *      g++ -O2 -std=c++17 gesp2_mock1_time_digit_ref.cpp -o gesp2_mock1_time_digit_ref
 *      g++ -O2 -std=c++17 gesp2_mock2_manhattan_ring_ref.cpp -o gesp2_mock2_manhattan_ring_ref
 *   2) 生成测试点 JSON：
 *      node gen_gesp2_mock1_time_digit_tests.js
 *      node gen_gesp2_mock2_manhattan_ring_tests.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
    title: '[GESP 2级 模拟1] 小杨的幸运编号',
    description: `小杨的学校给每位同学发了一个**学号**，是一个在 $L$ 到 $R$ 之间的正整数（包含 $L$ 和 $R$）。

小杨特别喜欢数字 $d$（$0 \\le d \\le 9$），他认为：如果某个学号的**十进制表示**里，数字 $d$ **恰好出现 $k$ 次**，这个学号就是「幸运编号」。

例如：$d = 1$，$k = 1$ 时，$[10,25]$ 中 $10,12,13,14,15,16,17,18,19,21$ 都是幸运编号（共 $10$ 个）；$11$ 不是（1 出现了 2 次）。

请你帮小杨统计：在 $L$ 到 $R$ 之间（包含两端）一共有多少个幸运编号。`,
    input_format: `一行，四个整数 $L, R, d, k$，依次表示学号范围的下界、上界、喜欢的数字、以及该数字需要出现的次数。`,
    output_format: `一行，一个整数，表示 $[L,R]$ 中幸运编号的个数。`,
    data_range: `- $0 \\le L \\le R \\le 10^5$
- $0 \\le d \\le 9$
- $1 \\le k \\le 6$（保证存在合法学号位数足够出现 $k$ 次；当区间含 $0$ 时需对 $0$ 单独判断）`,
    analysis: `本题属于 **数位拆分** 类型。

解题思路：

1. 枚举 $x$ 从 $L$ 到 $R$；
2. 对每个 $x$ 用数位拆分模版（\`while(x) { 取 x%10; x/=10; }\`）统计十进制中数字 $d$ 出现的次数；
3. 若次数等于 $k$ 则计数加一；
4. 注意 $x=0$ 需单独判断：\`while(x)\` 不会进入循环，只有 $d=0$ 时 0 的十进制表示算含 1 个 0。`,
    time_limit: 1000,
    memory_limit: 256,
    level: 2,
    publish_date: '2026-03-05',
    bank_visible: 0,
    testsJson: 'gesp2_mock1_time_digit_tests.json',
  },
  {
    title: '[GESP 2级 模拟2] 小杨的曼哈顿圈',
    description: `小杨在方格纸上画了一个 $n \\times n$ 的矩阵（$n$ 为奇数），行列编号从 1 到 $n$。

他从矩阵**正中心**的格子出发，每次只能向**上、下、左、右**走一格（不能斜走）。在所有格子中，**恰好走 $r$ 步能到达**的格子画 \`#\`，不能恰好 $r$ 步到达的格子画 \`.\`。这样得到的图案叫做 **曼哈顿圈**。

例如 $n=5$、$r=1$ 时，中心是第 3 行第 3 列，恰好 1 步能到的格子是上下左右四个邻格，输出如样例所示。

请你根据给定的 $n$ 和 $r$ 输出这个曼哈顿圈图案。`,
    input_format: `输入共两行：

- 第一行，一个奇数整数 $n$，表示矩阵大小；
- 第二行，一个正整数 $r$，表示“步数”。`,
    output_format: `输出共 $n$ 行，每行 $n$ 个字符，只包含 \`#\` 和 \`.\`，中间不能有多余的空格。`,
    data_range: `- $1 \\le n \\le 99$，且 $n$ 为奇数；
- $1 \\le r \\le \\dfrac{n-1}{2}$。`,
    analysis: `本题属于 **嵌套循环画图** 类型，需要自己归纳“规律”。

解题思路：

1. 读入 $n$ 和 $r$。矩阵正中心即第 $\\dfrac{n+1}{2}$ 行、第 $\\dfrac{n+1}{2}$ 列；
2. “恰好走 $r$ 步能到达”等价于该格子到中心的**曼哈顿距离**为 $r$，即 $|i - mid| + |j - mid| = r$；
3. 两重循环枚举行 $i$、列 $j$，若 $|i-mid|+|j-mid| = r$ 输出 \`#\`，否则输出 \`.\`；
4. 每行结束后换行。`,
    time_limit: 1000,
    memory_limit: 256,
    level: 2,
    publish_date: '2026-03-05',
    bank_visible: 0,
    testsJson: 'gesp2_mock2_manhattan_ring_tests.json',
  },
];

async function main() {
  const connection = await mysql.createConnection(dbConfig);
  await connection.beginTransaction();

  try {
    const problemIds = [];

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
      problemIds.push(problemId);
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
    console.log('两道 GESP 2级 模拟题录入完成，题目 ID 集合:', problemIds.join(', '));

    // 清除缓存
    for (const id of problemIds) {
      try {
        console.log(`调用 clear_problem_cache.js 清理题目 ${id} 的缓存...`);
        execSync(`node ${path.join(__dirname, 'clear_problem_cache.js')} ${id}`, {
          stdio: 'inherit',
        });
      } catch (e) {
        console.error(`清理题目 ${id} 缓存时出错:`, e.message);
      }
    }
  } catch (err) {
    await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();

