/**
 * 录入题目 [GESP 2026年3月认证 C++ 3级 T2] 凯撒密码 及 10 个测试点到数据库。
 * 运行前请先执行:
 *   1) g++ -O2 -std=c++17 caesar_ref.cpp -o caesar_ref
 *   2) node gen_caesar_tests.js
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
  title: '[GESP202603 三级] 凯撒密码',
  description: `凯撒密码是一种替换加密方法：将明文中的每个字母在字母表上统一向前或向后偏移固定位数得到密文。

例如偏移为 $3$ 时：\`A\`→\`D\`，\`B\`→\`E\`，\`C\`→\`F\`；\`W\`→\`Z\`，\`X\`→\`A\`，\`Y\`→\`B\`，\`Z\`→\`C\`（字母表首尾相连）。据说凯撒曾用此法与将领通信；作为一种单表替换密码，凯撒密码易被破解，无法保证实际通信安全。

现已知一对**明文**和对应的**密文**（使用同一偏移加密），以及另一段用**同一偏移**加密的密文，请将这段密文解密为明文。`,
  input_format: `输入共三行：

- 第一行：已知的明文（已解密出的凯撒密文原文）；
- 第二行：与第一行对应的密文；
- 第三行：需要解密的一段凯撒密文。`,
  output_format: `输出一行，表示第三行密文所对应的明文。`,
  data_range: '保证所有字符串仅含大写英文字母，长度均不超过 $1000$。',
  time_limit: 1000,
  memory_limit: 512,
  level: 3,
  publish_date: '2026-03-14',
  bank_visible: 1,
};

async function main() {
  const testsPath = path.join(__dirname, 'caesar_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_caesar_tests.js 生成 caesar_tests.json');
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
        time_limit, memory_limit, level, publish_date, bank_visible
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        PROBLEM.bank_visible,
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
      console.log('  样例', s.sort_order, s.is_displayed ? '(展示)' : '', s.is_hidden ? '(提交后隐藏)' : '(提交后展示)', 'OK');
    }

    await connection.commit();
    console.log('录入完成。题目 ID:', problemId);
    console.log('请执行清缓存: node scripts/clear_problem_cache.js', problemId);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
