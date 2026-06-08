-- ============================================================
-- GESP Agent 数据库回滚脚本
-- ============================================================
-- 使用方式：
-- mysql -u root -p gesp_practice_system < rollback_agent_tables.sql
--
-- 注意：回滚会删除所有 Agent 相关数据，谨慎操作

USE gesp_practice_system;

-- ============================================================
-- Step 1: 删除新增表
-- ============================================================
DROP TABLE IF EXISTS deleted_records;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS oj_verification_records;
DROP TABLE IF EXISTS mcp_logs;
DROP TABLE IF EXISTS session_archive;
DROP TABLE IF EXISTS skills;
DROP TABLE IF EXISTS scheduled_tasks;
DROP TABLE IF EXISTS approval_requests;
DROP TABLE IF EXISTS teacher_memory;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS agent_users;

-- ============================================================
-- Step 2: 移除软删除字段（如果添加了）
-- ============================================================
-- ALTER TABLE questions DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE questions DROP COLUMN IF EXISTS deleted_by;
-- ALTER TABLE exams DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE exams DROP COLUMN IF EXISTS deleted_by;

-- ============================================================
-- 验证回滚
-- ============================================================
SELECT 'Agent 数据库回滚完成' AS message;

SELECT COUNT(*) AS remaining_agent_tables FROM information_schema.tables
WHERE table_schema = 'gesp_practice_system'
AND table_name LIKE '%agent%' OR table_name LIKE '%mcp%';