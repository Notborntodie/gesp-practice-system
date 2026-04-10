/**
 * 录入两道 GESP 3 级模拟题到 oj_problems + oj_samples：
 * 1. [GESP 3级 模拟1] 签到统计（桶排序/计数）
 * 2. [GESP 3级 模拟2] 高频词（字符串+映射）
 *
 * 使用前请先：
 *   1) 在 backend_server/scripts 目录编译参考代码：
 *      g++ -O2 -std=c++17 gesp3_mock1_checkin_ref.cpp -o gesp3_mock1_checkin_ref
 *      g++ -O2 -std=c++17 gesp3_mock2_high_freq_word_ref.cpp -o gesp3_mock2_high_freq_word_ref
 *   2) 生成测试点 JSON：
 *      node gen_gesp3_mock1_checkin_tests.js
 *      node gen_gesp3_mock2_high_freq_word_tests.js
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
    title: '[GESP 3级 模拟1] 签到统计',
    description: `老师组织活动，班上有 $N$ 位同学，编号从 $0$ 到 $N-1$。签到环节中，老师会依次记录同学们报出的编号（同一个人可能报多次）。

请你编写程序，根据签到记录，找出**没有签到**的同学编号；如果所有人都签到了，则输出 $N$。`,
    input_format: `输入共两行：

- 第一行两个整数 $N$ 和 $M$，表示班级有 $N$ 位同学，共有 $M$ 次报出的编号；
- 第二行 $M$ 个整数，依次表示每次报出的编号。`,
    output_format: `输出一行：

- 若所有同学都签到了，输出一个整数 $N$；
- 否则输出所有未签到同学的编号，按**从小到大**排列，相邻编号之间用一个空格分隔。`,
    data_range: `- $2 \\leq N, M \\leq 1000$
- 每次报出的编号均为 $[0, N-1]$ 范围内的整数。`,
    analysis: `本题属于 **桶排序/计数** 类型，考察用数组下标作为“桶”进行标记。

解题思路：

1. 开一个长度为 $N$ 的布尔数组（或计数数组），表示每个编号是否出现过；
2. 读入 $M$ 个编号，将对应下标的标记设为 true（或计数加一）；
3. 遍历 $0$ 到 $N-1$，若某编号未被标记，则说明未签到，加入输出列表；
4. 若未签到人数为 $0$，输出 $N$；否则按顺序输出未签到的编号。`,
    time_limit: 1000,
    memory_limit: 256,
    level: 3,
    publish_date: '2026-03-05',
    bank_visible: 1,
    testsJson: 'gesp3_mock1_checkin_tests.json',
  },
  {
    title: '[GESP 3级 模拟2] 高频词',
    description: `小杨有一份单词列表，他想知道其中**出现次数最多**的单词是哪一个。

若有多于一个单词出现次数相同且都是最多的，则输出其中**字典序最小**的那个。`,
    input_format: `输入格式如下：

- 第一行一个整数 $n$，表示单词的个数；
- 接下来 $n$ 行，每行一个由小写英文字母组成的单词。`,
    output_format: `输出一行，一个单词，为出现次数最多的单词（若多个并列最多，则输出字典序最小的那个）。`,
    data_range: `- $1 \\leq n \\leq 1000$
- 每个单词由小写字母组成，长度不超过 $50$。`,
    analysis: `本题属于 **字符串 + 映射统计** 类型，考察读入多行字符串并用映射（如 \\texttt{map}）计数。

解题思路：

1. 读入 $n$，再用循环读入 $n$ 个单词；
2. 使用 \\texttt{map<string,int>}（或数组等）统计每个单词出现的次数；
3. 遍历映射，找到出现次数最大的值；若有多个单词次数相同且最大，保留字典序最小的那个；
4. 输出该单词。`,
    time_limit: 1000,
    memory_limit: 256,
    level: 3,
    publish_date: '2026-03-05',
    bank_visible: 1,
    testsJson: 'gesp3_mock2_high_freq_word_tests.json',
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
    console.log('两道 GESP 3级 模拟题录入完成。请对两个题目 ID 分别执行：node scripts/clear_problem_cache.js <题目ID>');
  } catch (err) {
    await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
