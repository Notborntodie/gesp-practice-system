/**
 * 迁移：为 oj_problems 和 exams 增加 bank_visible 字段，并将已有数据设为可见。
 * 运行方式：cd backend_server && node scripts/run_migrate_bank_visible.js
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
    console.log('开始迁移：添加 bank_visible 字段并设置已有数据为可见\n');

    connection = await mysql.createConnection(DB_CONFIG);
    console.log('✓ 数据库连接成功\n');

    // 1. oj_problems
    const ojHasCol = await columnExists(connection, 'oj_problems', 'bank_visible');
    if (!ojHasCol) {
      await connection.query(`
        ALTER TABLE oj_problems
        ADD COLUMN bank_visible tinyint(1) NOT NULL DEFAULT 1
        COMMENT '题库可见：1=可见 0=不可见（仅影响 level-exams 题库列表）'
        AFTER accepted_submissions
      `);
      console.log('✓ oj_problems 已添加 bank_visible 列');
    } else {
      console.log('- oj_problems 已存在 bank_visible 列，跳过 ADD COLUMN');
    }
    const [ojUp] = await connection.query('UPDATE oj_problems SET bank_visible = 1 WHERE 1=1');
    console.log('✓ oj_problems 已有数据已设为可见，影响行数:', ojUp.affectedRows, '\n');

    // 2. exams
    const examsHasCol = await columnExists(connection, 'exams', 'bank_visible');
    if (!examsHasCol) {
      await connection.query(`
        ALTER TABLE exams
        ADD COLUMN bank_visible tinyint(1) NOT NULL DEFAULT 1
        COMMENT '题库可见：1=可见 0=不可见（仅影响 level-exams 题库列表）'
        AFTER type
      `);
      console.log('✓ exams 已添加 bank_visible 列');
    } else {
      console.log('- exams 已存在 bank_visible 列，跳过 ADD COLUMN');
    }
    const [exUp] = await connection.query('UPDATE exams SET bank_visible = 1 WHERE 1=1');
    console.log('✓ exams 已有数据已设为可见，影响行数:', exUp.affectedRows, '\n');

    console.log('迁移完成。');
  } catch (err) {
    console.error('迁移失败:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

runMigration();
