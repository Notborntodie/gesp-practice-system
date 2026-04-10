/**
 * 录入题目 [GESP202512 三级] 密码强度 及 10 个测试点。
 * 运行前请先生成 password_strength_tests.json（可运行 node -e "..." 或 gen 脚本）。
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
  title: '[GESP202512 三级] 密码强度',
  description: '小杨是学校网络安全小组的成员，今天他的任务是设计一个「密码强度检测器」，帮助同学们检查自己的密码是否足够安全。\n\n一个安全的密码需要满足以下条件：\n\n- 密码至少包含 8 个字符（太短的密码容易被猜出来哦！）。\n- 密码至少包含一个大写字母（$A$、$B$、$C$、…、$Z$ 都可以）。\n- 密码至少包含一个数字（$0$、$1$、$2$、$3$、…、$9$ 都可以）。\n\n请你根据上述规则，对每组密码判断是否为安全密码。',
  input_format: '第一行一个正整数 $T$，代表需要安全检测的密码组数。\n\n对于每组密码，一行包含一个字符串，代表需要安全检测的密码。',
  output_format: '对于每组密码，输出一行。若该密码满足安全条件则输出 $Y$，否则输出 $N$。',
  data_range: '对于所有测试点，保证 $1 \\leq T \\leq 100$。每个密码长度不超过 100 且至少 1 个字符，且仅包含大写字母、小写字母与数字。',
  time_limit: 1000,
  memory_limit: 512,
  level: 3,
  publish_date: '2025-12-01',
};

async function main() {
  const testsPath = path.join(__dirname, 'password_strength_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先生成 password_strength_tests.json');
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

    console.log('插入', samples.length, '个测试点...');
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
