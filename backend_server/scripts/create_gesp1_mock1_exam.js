/**
 * 从 GESP 1 级客观题题库中随机抽题，组卷「GESP 1级模拟1」
 * 形式与 2025年12月 GESP 1级真题 类似：前 15 道选择题，后 10 道判断题（仅 2 个选项）
 * 类型：模拟
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4'
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  let connection;
  try {
    console.log('连接数据库...');
    connection = await mysql.createConnection(dbConfig);

    // 1) 获取所有 level=1 的题目及其选项数量
    const [rows] = await connection.execute(`
      SELECT q.id AS question_id, COUNT(o.id) AS option_count
      FROM questions q
      LEFT JOIN options o ON o.question_id = q.id
      WHERE q.level = 1
      GROUP BY q.id
    `);

    const choiceIds = [];  // 选择题：选项数 > 2
    const judgeIds = [];   // 判断题：选项数 = 2

    for (const r of rows) {
      const cnt = r.option_count || 0;
      if (cnt > 2) choiceIds.push(r.question_id);
      else if (cnt === 2) judgeIds.push(r.question_id);
    }

    console.log(`GESP 1 级：选择题(>2选项) ${choiceIds.length} 道，判断题(2选项) ${judgeIds.length} 道`);

    const needChoice = 15;
    const needJudge = 10;
    if (choiceIds.length < needChoice) {
      throw new Error(`选择题不足：需要 ${needChoice} 道，仅有 ${choiceIds.length} 道`);
    }
    if (judgeIds.length < needJudge) {
      throw new Error(`判断题不足：需要 ${needJudge} 道，仅有 ${judgeIds.length} 道`);
    }

    const selectedChoice = shuffle(choiceIds).slice(0, needChoice);
    const selectedJudge = shuffle(judgeIds).slice(0, needJudge);
    const questionIds = [...selectedChoice, ...selectedJudge];

    // 2) 检查是否已存在同名考试
    const [existing] = await connection.execute(
      "SELECT id, name FROM exams WHERE name = ?",
      ['GESP 1级模拟1']
    );
    if (existing.length > 0) {
      console.log('已存在考试「GESP 1级模拟1」，id =', existing[0].id);
      console.log('若需重新组卷，请先在管理端删除该考试或改名为其他模拟卷后再运行本脚本。');
      process.exit(0);
      return;
    }

    // 3) 插入 exams
    const [examResult] = await connection.execute(
      `INSERT INTO exams (name, level, description, type, total_questions, bank_visible)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['GESP 1级模拟1', 1, '从GESP 1级客观题中随机抽取：前15道选择题，后10道判断题。', '模拟', 25, 1]
    );
    const examId = examResult.insertId;
    console.log('已创建考试 id =', examId, '，name = GESP 1级模拟1');

    // 4) 插入 exam_questions（题号 1~25）
    for (let i = 0; i < questionIds.length; i++) {
      await connection.execute(
        `INSERT INTO exam_questions (exam_id, question_id, question_number) VALUES (?, ?, ?)`,
        [examId, questionIds[i], i + 1]
      );
    }
    console.log('已写入 25 道题目到 exam_questions（前15题为选择题，后10题为判断题）');
    console.log('完成。');

  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
