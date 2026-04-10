/**
 * 将题目 131 替换为 [GESP 2级 模拟1] 小杨的幸运编号（纯数位拆分），并同步测试点、清缓存。
 * 运行前请先：g++ 编译 gesp2_mock1_time_digit_ref.cpp，再 node gen_gesp2_mock1_time_digit_tests.js
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

const TITLE_131 = '[GESP 2级 模拟1] 小杨的幸运编号';

const DESC_131 = `小杨的学校给每位同学发了一个**学号**，是一个在 $L$ 到 $R$ 之间的正整数（包含 $L$ 和 $R$）。

小杨特别喜欢数字 $d$（$0 \\le d \\le 9$），他认为：如果某个学号的**十进制表示**里，数字 $d$ **恰好出现 $k$ 次**，这个学号就是「幸运编号」。

例如：$d = 1$，$k = 1$ 时，$[10,25]$ 中 $10,12,13,14,15,16,17,18,19,21$ 都是幸运编号（共 $10$ 个）；$11$ 不是（1 出现了 2 次）。

请你帮小杨统计：在 $L$ 到 $R$ 之间（包含两端）一共有多少个幸运编号。`;

const INPUT_131 = `一行，四个整数 $L, R, d, k$，依次表示学号范围的下界、上界、喜欢的数字、以及该数字需要出现的次数。`;

const OUTPUT_131 = `一行，一个整数，表示 $[L,R]$ 中幸运编号的个数。`;

const RANGE_131 = `- $0 \\le L \\le R \\le 10^5$
- $0 \\le d \\le 9$
- $1 \\le k \\le 6$（保证存在合法学号位数足够出现 $k$ 次；当区间含 $0$ 时需对 $0$ 单独判断）`;

const ANALYSIS_131 = `本题属于 **数位拆分** 类型。

解题思路：

1. 枚举 $x$ 从 $L$ 到 $R$；
2. 对每个 $x$ 用数位拆分模版（\`while(x) { 取 x%10; x/=10; }\`）统计十进制中数字 $d$ 出现的次数；
3. 若次数等于 $k$ 则计数加一；
4. 注意 $x=0$ 需单独判断：\`while(x)\` 不会进入循环，只有 $d=0$ 时 0 的十进制表示算含 1 个 0。`;

async function main() {
  const jsonPath = path.join(__dirname, 'gesp2_mock1_time_digit_tests.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('请先运行 node gen_gesp2_mock1_time_digit_tests.js 生成测试点 JSON');
    process.exit(1);
  }
  const samples = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  const connection = await mysql.createConnection(dbConfig);
  await connection.beginTransaction();

  try {
    console.log('更新题目 131 为「小杨的幸运编号」...');
    await connection.execute(
      `UPDATE oj_problems
       SET title = ?, description = ?, input_format = ?, output_format = ?, data_range = ?, analysis = ?
       WHERE id = 131`,
      [TITLE_131, DESC_131, INPUT_131, OUTPUT_131, RANGE_131, ANALYSIS_131]
    );

    console.log('替换题目 131 的测试点...');
    await connection.execute('DELETE FROM oj_samples WHERE problem_id = ?', [131]);
    for (const s of samples) {
      await connection.execute(
        `INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, is_displayed, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [131, s.input, s.output, s.explanation || null, s.is_hidden ? 1 : 0, s.is_displayed ? 1 : 0, s.sort_order]
      );
    }
    console.log('已同步', samples.length, '个测试点。');

    await connection.commit();

    console.log('清除题目 131 缓存...');
    execSync(`node ${path.join(__dirname, 'clear_problem_cache.js')} 131`, { stdio: 'inherit' });
    console.log('完成。');
  } catch (err) {
    await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
