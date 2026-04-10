/**
 * 迁移：为 oj_problems 增加 analysis 文本解析字段。
 * 运行方式：cd backend_server && node scripts/run_migrate_oj_problem_analysis.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'gesp_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gesp_practice_system',
  charset: 'utf8mb4'
};

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
    [DB_CONFIG.database, table, column]
  );
  return rows.length > 0;
}

async function runMigration() {
  let connection;
  try {
    console.log('开始迁移：为 oj_problems 增加 analysis 文本解析字段\\n');

    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✓ 数据库连接成功\\n');

    const hasCol = await columnExists(connection, 'oj_problems', 'analysis');
    if (!hasCol) {
      await connection.query(`
        ALTER TABLE oj_problems
        ADD COLUMN analysis text COMMENT '题目文字解析说明，用于 Test「我的解析」展示官方解析' AFTER data_range
      `);
      console.log('✓ oj_problems 已添加 analysis 列');
    } else {
      console.log('- oj_problems 已存在 analysis 列，跳过 ADD COLUMN');
    }

    console.log('\\n迁移完成。');
  } catch (err) {
    console.error('迁移失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();

