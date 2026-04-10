/**
 * 执行迁移：learning_plans 表增加 public_progress_token / public_progress_enabled
 * 运行方式：cd backend_server && node scripts/run_migrate_learning_plans_public_progress.js
 */

const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function runMigration() {
  let connection;
  try {
    console.log('开始迁移：learning_plans 增加公开成长进度字段\n');

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'gesp_user',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'gesp_practice_system',
      charset: 'utf8mb4',
      multipleStatements: true
    });

    console.log('✓ 数据库连接成功\n');

    const dbName = process.env.DB_NAME || 'gesp_practice_system';
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'learning_plans' AND COLUMN_NAME = 'public_progress_token'`,
      [dbName]
    );
    if (cols.length > 0) {
      console.log('⚠ public_progress_token 已存在，跳过迁移');
      return;
    }

    console.log('添加 public_progress_token, public_progress_enabled...');
    await connection.query(`
      ALTER TABLE learning_plans
        ADD COLUMN public_progress_token varchar(64) DEFAULT NULL,
        ADD COLUMN public_progress_enabled tinyint(1) NOT NULL DEFAULT 0
    `);
    console.log('✓ 迁移完成\n');
  } catch (err) {
    console.error('迁移失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
