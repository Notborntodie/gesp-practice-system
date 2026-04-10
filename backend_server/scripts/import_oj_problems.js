require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库连接配置（优先使用环境变量，否则使用本地数据库默认值）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4',
  connectTimeout: 60000
};

async function importOJProblems() {
  let connection;
  
  try {
    console.log('正在连接数据库...');
    console.log(`连接信息: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    connection = await mysql.createConnection(dbConfig);
    console.log('数据库连接成功！\n');
    
    // 读取 JSON 文件
    const jsonPath = path.join(__dirname, '..', 'oj_problems.json');
    console.log(`正在读取文件: ${jsonPath}`);
    const jsonData = fs.readFileSync(jsonPath, 'utf8');
    const problems = JSON.parse(jsonData);
    console.log(`✓ 成功读取 ${problems.length} 道题目\n`);
    
    console.log('=========================================');
    console.log('开始导入 OJ 题目');
    console.log('=========================================\n');
    
    await connection.beginTransaction();
    
    const insertedIds = [];
    
    for (let i = 0; i < problems.length; i++) {
      const problem = problems[i];
      const {
        title,
        description,
        input_format,
        output_format,
        data_range,
        time_limit = 1000,
        memory_limit = 256,
        level,
        publish_date,
        total_submissions = 0,
        accepted_submissions = 0
      } = problem;
      
      console.log(`[${i + 1}/${problems.length}] 正在导入题目: ${title}`);
      
      // 插入题目
      const [result] = await connection.execute(
        `INSERT INTO oj_problems (
          title, description, input_format, output_format, data_range, analysis,
          time_limit, memory_limit, level, publish_date,
          total_submissions, accepted_submissions
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title,
          description,
          input_format || null,
          output_format || null,
          data_range || null,
          (problem.analysis || null),
          time_limit,
          memory_limit,
          level,
          publish_date || null,
          total_submissions,
          accepted_submissions
        ]
      );
      
      const problemId = result.insertId;
      insertedIds.push(problemId);
      console.log(`  ✓ 题目创建成功，ID: ${problemId}\n`);
    }
    
    await connection.commit();
    
    console.log('=========================================');
    console.log('导入完成！');
    console.log('=========================================');
    console.log(`成功导入 ${insertedIds.length} 道题目`);
    console.log(`题目ID列表: ${insertedIds.join(', ')}\n`);
    
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('导入失败:', error);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行导入
importOJProblems()
  .then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });

