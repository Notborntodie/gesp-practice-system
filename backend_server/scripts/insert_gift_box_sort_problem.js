/**
 * 录入题目 [GESP 2026年3月认证 C++ 4级 T1] 礼盒排序 及 10 个测试点到数据库。
 * 运行前：g++ -O2 -std=c++17 gift_box_sort_ref.cpp -o gift_box_sort_ref && node gen_gift_box_sort_tests.js
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
  title: '[GESP202603 四级] 礼盒排序',
  description: `给定 $N$ 个礼盒，每个礼盒有 $4$ 个属性：长度 $L$、宽度 $W$、高度 $H$、重量 $WT$。请按以下优先级规则对 $N$ 个礼盒排序（优先级从高到低）：

1. **第一关键字**：按长度 $L$ **降序**；
2. **第二关键字**：若 $L$ 相同，按 $W+H+WT$ **升序**；
3. **第三关键字**：若前两者均相同，按底面面积 $L \\times W$ **降序**；
4. **第四关键字**：若前三者均相同，按四属性之和 $L+W+H+WT$ **升序**。`,
  input_format: `第一行一个整数 $N$，表示礼盒个数。

接下来 $N$ 行，每行四个整数 $L, W, H, WT$，分别表示该礼盒的长度、宽度、高度、重量。`,
  output_format: `输出 $N$ 行，每行四个整数 $L, W, H, WT$，用空格分隔，表示排序后的礼盒列表。`,
  data_range: '$1 \\le N \\le 10^5$，$1 \\le L, W, H, WT \\le 10^9$，均为整数。',
  time_limit: 1000,
  memory_limit: 512,
  level: 4,
  publish_date: '2026-03-14',
  bank_visible: 1,
};

async function main() {
  const testsPath = path.join(__dirname, 'gift_box_sort_tests.json');
  if (!fs.existsSync(testsPath)) {
    console.error('请先运行: node gen_gift_box_sort_tests.js');
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
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      await connection.execute(
        `INSERT INTO oj_samples (problem_id, input, output, explanation, is_hidden, is_displayed, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [problemId, s.input, s.output, s.explanation || null, s.is_hidden ? 1 : 0, s.is_displayed ? 1 : 0, s.sort_order]
      );
      console.log('  样例', s.sort_order, s.is_displayed ? '(展示)' : '', s.is_hidden ? '(隐藏)' : '', 'OK');
    }
    await connection.commit();
    console.log('录入完成。题目 ID:', problemId);
    console.log('请执行: node scripts/clear_problem_cache.js', problemId);
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
