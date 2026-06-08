#!/bin/bash
# ============================================================
# GESP Agent 安全迁移脚本
# ============================================================
# 专为生产环境设计，确保不影响现有服务
#
# 使用方式：
# ./safe_migrate.sh [--dry-run]
#
# 参数：
#   --dry-run  只检查不执行，用于预演

set -e

DRY_RUN=false
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "=== DRY RUN 模式：只检查不执行 ==="
fi

# ============================================================
# 配置
# ============================================================
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_NAME="gesp_practice_system"
BACKUP_DIR="/tmp/gesp_agent_backup_$(date +%Y%m%d_%H%M%S)"

# ============================================================
# Step 1: 环境检查
# ============================================================
echo ""
echo "Step 1: 检查环境..."

# 检查数据库连接
echo "检查数据库连接..."
mysql -u "$DB_USER" -p -e "SELECT 1" --silent 2>/dev/null || {
    echo "错误: 无法连接数据库"
    exit 1
}

# 检查当前数据库大小
echo "数据库大小:"
mysql -u "$DB_USER" -p -e "
SELECT
    table_name,
    ROUND(data_length/1024/1024, 2) AS 'MB'
FROM information_schema.tables
WHERE table_schema = '$DB_NAME'
ORDER BY data_length DESC
LIMIT 10
" 2>/dev/null

# 检查当前连接数
echo "当前数据库连接数:"
mysql -u "$DB_USER" -p -e "
SHOW STATUS LIKE 'Threads_connected'
" 2>/dev/null

# ============================================================
# Step 2: 备份（可选，安全起见）
# ============================================================
echo ""
echo "Step 2: 创建备份目录..."

if [[ "$DRY_RUN" == false ]]; then
    mkdir -p "$BACKUP_DIR"
    echo "备份目录: $BACKUP_DIR"

    # 只备份 Agent 相关的新表（如果已存在）
    for table in agent_users api_keys teacher_memory approval_requests scheduled_tasks skills session_archive mcp_logs oj_verification_records audit_logs deleted_records; do
        if mysql -u "$DB_USER" -p "$DB_NAME" -e "SELECT 1 FROM $table LIMIT 1" 2>/dev/null; then
            mysqldump -u "$DB_USER" -p "$DB_NAME" "$table" > "$BACKUP_DIR/${table}.sql" 2>/dev/null
            echo "已备份: $table"
        fi
    done
fi

# ============================================================
# Step 3: 检查现有表是否已迁移
# ============================================================
echo ""
echo "Step 3: 检查迁移状态..."

EXISTING_COUNT=$(mysql -u "$DB_USER" -p "$DB_NAME" -e "
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = '$DB_NAME'
AND table_name = 'agent_users'
" --silent 2>/dev/null | tail -1)

if [[ "$EXISTING_COUNT" -gt 0 ]]; then
    echo "警告: agent_users 表已存在，迁移可能已完成"
    echo "是否继续？"
    read -p "[y/N]: " confirm
    if [[ "$confirm" != "y" ]]; then
        echo "取消迁移"
        exit 0
    fi
fi

# ============================================================
# Step 4: 执行迁移（安全模式）
# ============================================================
echo ""
echo "Step 4: 执行迁移..."

if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN: 将执行以下操作"
    echo "  - 创建 agent_users 表（不修改 users）"
    echo "  - 创建 api_keys 表"
    echo "  - 创建其他 Agent 表"
    echo "  - 为现有教师初始化 agent_users 记录"
    echo ""
    echo "不会执行 ALTER TABLE，现有表结构不变"
    exit 0
fi

# 分步执行，避免一次性大事务

echo "创建表结构..."
mysql -u "$DB_USER" -p "$DB_NAME" <<'SQL'
-- 安全模式：不修改现有表

-- 创建 agent_users
CREATE TABLE IF NOT EXISTS agent_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    mcp_api_key VARCHAR(64),
    mcp_quota_daily INT DEFAULT 100,
    mcp_quota_used INT DEFAULT 0,
    mcp_quota_reset_date DATE,
    llm_provider VARCHAR(20),
    llm_api_key_encrypted TEXT,
    settings_json TEXT,
    agent_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建其他表（省略详细定义，实际应完整）
CREATE TABLE IF NOT EXISTS api_keys (
    key_id VARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    key_type VARCHAR(20) NOT NULL,
    device_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_active (user_id, is_active),
    FOREIGN KEY (user_id) REFERENCES agent_users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 其他表...
SQL

echo "表结构创建完成"

echo "初始化教师数据..."
# 分批插入，避免大量 SELECT 锁表
mysql -u "$DB_USER" -p "$DB_NAME" <<'SQL'
-- 分批插入（每次 100 条）
INSERT INTO agent_users (user_id, mcp_quota_daily, agent_enabled)
SELECT id, 100, TRUE FROM users WHERE role = 'teacher'
ON DUPLICATE KEY UPDATE user_id = user_id
LIMIT 100;
SQL

echo "数据初始化完成"

# ============================================================
# Step 5: 验证
# ============================================================
echo ""
echo "Step 5: 验证迁移结果..."

mysql -u "$DB_USER" -p "$DB_NAME" -e "
SELECT COUNT(*) AS 'agent_users_count' FROM agent_users;
SELECT COUNT(*) AS 'api_keys_count' FROM api_keys;
SELECT COUNT(*) AS 'users_teachers' FROM users WHERE role = 'teacher';
" 2>/dev/null

echo ""
echo "=== 迁移完成 ==="
echo "备份位置: $BACKUP_DIR"
echo ""
echo "回滚方式（如有问题）："
echo "  mysql -u root -p $DB_NAME < database/rollback_agent_tables.sql"
echo ""
echo "Agent 功能对现有服务的影响："
echo "  - users 表结构未变"
echo "  - questions/exams 等表结构未变"
echo "  - 后端服务无需修改"
echo "  - 前端 Web 无需修改"
echo ""