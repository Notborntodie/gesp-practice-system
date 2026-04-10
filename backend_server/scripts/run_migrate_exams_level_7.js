/**
 * 执行迁移：将名称包含「7级」或「GESP 7」的试卷 level 设为 7
 * 运行方式：cd backend_server && node scripts/run_migrate_exams_level_7.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  let connection;
  try {
    console.log('开始迁移：将 7 级 exam 的 level 设为 7\n');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'gesp_user',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gesp_practice_system',
      charset: 'utf8mb4'
    });

    console.log('✓ 数据库连接成功\n');

    const [rows] = await connection.query(
      "UPDATE exams SET level = 7 WHERE name LIKE '%7级%' OR name LIKE '%GESP 7%'"
    );
    const affected = rows.affectedRows;
    console.log('✓ 更新完成，影响行数:', affected, '\n');

    if (affected > 0) {
      const [list] = await connection.query(
        "SELECT id, name, level FROM exams WHERE name LIKE '%7级%' OR name LIKE '%GESP 7%' ORDER BY id"
      );
      console.log('当前匹配的试卷:');
      list.forEach((r) => console.log('  id=%s level=%s name=%s', r.id, r.level, r.name));
    }
  } catch (err) {
    console.error('迁移失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
