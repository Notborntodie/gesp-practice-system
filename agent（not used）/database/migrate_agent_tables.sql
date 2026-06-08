-- ============================================================
-- GESP Agent 数据库迁移脚本
-- ============================================================
-- 重要说明：
-- 1. 不修改现有 users 表，使用独立的 agent_users 表
-- 2. 所有敏感操作使用软删除
-- 3. 新增审计日志和删除记录表
--
-- 执行方式：
-- mysql -u root -p gesp_practice_system < migrate_agent_tables.sql
--
-- 回滚方式：
-- mysql -u root -p gesp_practice_system < rollback_agent_tables.sql

USE gesp_practice_system;

-- ============================================================
-- Step 1: 创建 Agent 用户配置表（不修改 users）
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE COMMENT '关联 users.id',
    mcp_api_key VARCHAR(64) COMMENT 'MCP 访问密钥',
    mcp_quota_daily INT DEFAULT 100 COMMENT '每日调用额度',
    mcp_quota_used INT DEFAULT 0 COMMENT '已使用额度',
    mcp_quota_reset_date DATE COMMENT '额度重置日期',
    llm_provider VARCHAR(20) COMMENT '用户选择的 LLM Provider',
    llm_api_key_encrypted TEXT COMMENT '用户 LLM Key（加密存储）',
    settings_json TEXT COMMENT 'Agent 设置',
    agent_enabled BOOLEAN DEFAULT TRUE COMMENT '是否启用 Agent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_user_id (user_id),
    INDEX idx_mcp_key (mcp_api_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent 用户配置';

-- ============================================================
-- Step 2: 创建 API Key 多设备管理表
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
    key_id VARCHAR(64) PRIMARY KEY COMMENT '随机生成的 Key ID',
    user_id INT NOT NULL COMMENT '用户 ID',
    key_type VARCHAR(20) NOT NULL COMMENT 'mcp 或 agent_auth',
    device_name VARCHAR(100) COMMENT '设备名称',
    device_id VARCHAR(64) COMMENT '设备唯一标识',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP COMMENT '有效期',
    last_used_at TIMESTAMP COMMENT '最后使用时间',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否激活',

    INDEX idx_user_active (user_id, is_active),
    INDEX idx_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES agent_users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='API Key 多设备管理';

-- ============================================================
-- Step 3: 创建教师全局记忆表
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_memory (
    teacher_id INT PRIMARY KEY COMMENT '教师 ID',
    preferences_json TEXT COMMENT '偏好设置',
    habits_json TEXT COMMENT '习惯设置',
    patterns_json TEXT COMMENT '操作模式',
    subscribed_skills TEXT COMMENT '订阅的 Skills',
    created_skills TEXT COMMENT '创建的 Skills',
    context_summary TEXT COMMENT '压缩后的上下文摘要',
    token_count_estimate INT DEFAULT 0 COMMENT 'Token 估算',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='教师全局记忆';

-- ============================================================
-- Step 4: 创建审批请求表（增加二次确认）
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL COMMENT '发起教师',
    action VARCHAR(50) NOT NULL COMMENT '操作类型',
    resource_type VARCHAR(20) COMMENT '资源类型',
    resource_id INT COMMENT '资源 ID',
    resource_owner_id INT COMMENT '资源所有者',
    params_json TEXT COMMENT '参数',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态',
    admin_id INT COMMENT '审批管理员',
    reason TEXT COMMENT '审批理由',
    teacher_confirmed BOOLEAN DEFAULT FALSE COMMENT '教师二次确认',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP COMMENT '审批时间',
    executed_at TIMESTAMP COMMENT '执行时间',
    audit_log TEXT COMMENT '审批日志',

    INDEX idx_teacher (teacher_id),
    INDEX idx_status (status),
    INDEX idx_resource (resource_type, resource_id),
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批请求';

-- ============================================================
-- Step 5: 创建定时任务表
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    task_name VARCHAR(100) COMMENT '任务名称',
    task_type VARCHAR(20) COMMENT 'cron/condition/once',
    schedule_config TEXT COMMENT '调度配置',
    action_config TEXT COMMENT '动作配置',
    notify_channel VARCHAR(20) COMMENT '通知渠道',
    last_run_at TIMESTAMP COMMENT '上次执行',
    next_run_at TIMESTAMP COMMENT '下次执行',
    run_count INT DEFAULT 0 COMMENT '执行次数',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_teacher_active (teacher_id, is_active),
    INDEX idx_next_run (next_run_at),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时任务';

-- ============================================================
-- Step 6: 创建 Skill 库表
-- ============================================================
CREATE TABLE IF NOT EXISTS skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    skill_id VARCHAR(64) UNIQUE NOT NULL COMMENT 'Skill ID',
    name VARCHAR(100) NOT NULL COMMENT '名称',
    description TEXT COMMENT '描述',
    author_id INT NOT NULL COMMENT '作者',
    trigger_keywords TEXT COMMENT '触发关键词',
    workflow_json TEXT COMMENT '工作流',
    params_template TEXT COMMENT '参数模板',
    version INT DEFAULT 1 COMMENT '版本',
    use_count INT DEFAULT 0 COMMENT '使用次数',
    rating_avg FLOAT DEFAULT 0 COMMENT '平均评分',
    rating_count INT DEFAULT 0 COMMENT '评分人数',
    is_public BOOLEAN DEFAULT TRUE COMMENT '是否公开',
    is_verified BOOLEAN DEFAULT FALSE COMMENT '是否审核',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,

    INDEX idx_author (author_id),
    INDEX idx_public (is_public),
    INDEX idx_verified (is_verified),
    FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Skill 库';

-- ============================================================
-- Step 7: 创建 Session 归档表（增加压缩信息）
-- ============================================================
CREATE TABLE IF NOT EXISTS session_archive (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    session_id VARCHAR(64) COMMENT 'Session ID',
    workflow_type VARCHAR(50) COMMENT '工作流类型',
    summary_json TEXT COMMENT '摘要',
    compressed_context TEXT COMMENT '压缩后上下文',
    original_token_count INT COMMENT '原始 Token',
    compressed_token_count INT COMMENT '压缩后 Token',
    success BOOLEAN COMMENT '是否成功',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_teacher (teacher_id),
    INDEX idx_session (session_id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Session 归档';

-- ============================================================
-- Step 8: 创建 MCP 日志表（增加费用追踪）
-- ============================================================
CREATE TABLE IF NOT EXISTS mcp_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    tool_name VARCHAR(50) COMMENT '工具名称',
    params_json TEXT COMMENT '参数',
    response_status VARCHAR(20) COMMENT '响应状态',
    execution_time_ms INT COMMENT '执行时间',
    token_used INT DEFAULT 0 COMMENT 'Token 使用',
    cost_estimate FLOAT DEFAULT 0 COMMENT '费用估算',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_time (user_id, created_at),
    INDEX idx_tool (tool_name),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='MCP 日志';

-- ============================================================
-- Step 9: 创建 OJ 验证记录表（新增）
-- ============================================================
CREATE TABLE IF NOT EXISTS oj_verification_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL COMMENT '教师',
    question_id INT COMMENT '题目',
    code TEXT NOT NULL COMMENT '代码',
    language VARCHAR(20) COMMENT '语言',
    test_case_id INT COMMENT '测试点',
    verdict VARCHAR(20) COMMENT '判定结果',
    execution_time_ms INT COMMENT '执行时间',
    memory_used_kb INT COMMENT '内存使用',
    verified_by TEXT COMMENT '验证类型',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_teacher (teacher_id),
    INDEX idx_question (question_id),
    INDEX idx_verdict (verdict),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OJ 验证记录';

-- ============================================================
-- Step 10: 创建审计日志表（新增）
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL COMMENT '操作用户',
    action VARCHAR(50) NOT NULL COMMENT '操作类型',
    resource_type VARCHAR(20) COMMENT '资源类型',
    resource_id INT COMMENT '资源 ID',
    old_value TEXT COMMENT '旧值',
    new_value TEXT COMMENT '新值',
    ip_address VARCHAR(45) COMMENT 'IP 地址',
    user_agent TEXT COMMENT 'User Agent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_resource (resource_type, resource_id),
    INDEX idx_time (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志';

-- ============================================================
-- Step 11: 创建删除记录表（软删除支持）
-- ============================================================
CREATE TABLE IF NOT EXISTS deleted_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(50) NOT NULL COMMENT '表名',
    record_id INT NOT NULL COMMENT '记录 ID',
    deleted_by INT NOT NULL COMMENT '删除者',
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '删除时间',
    restore_before TIMESTAMP COMMENT '可恢复截止',
    restored_at TIMESTAMP COMMENT '恢复时间',
    restored_by INT COMMENT '恢复者',
    data_backup TEXT COMMENT '数据备份',

    INDEX idx_table_record (table_name, record_id),
    INDEX idx_deleted_by (deleted_by),
    INDEX idx_restore_before (restore_before),
    FOREIGN KEY (deleted_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='删除记录（软删除）';

-- ============================================================
-- Step 12: 为现有表添加软删除字段（可选）
-- ============================================================
-- 如果 questions/exams 等表需要支持软删除，可添加：
-- ALTER TABLE questions ADD COLUMN deleted_at TIMESTAMP NULL;
-- ALTER TABLE questions ADD COLUMN deleted_by INT NULL;
-- ALTER TABLE exams ADD COLUMN deleted_at TIMESTAMP NULL;
-- ALTER TABLE exams ADD COLUMN deleted_by INT NULL;

-- ============================================================
-- Step 13: 初始化数据
-- ============================================================

-- 为现有教师创建 agent_users 记录（可选）
INSERT INTO agent_users (user_id, mcp_quota_daily, agent_enabled)
SELECT id, 100, TRUE FROM users WHERE role = 'teacher'
ON DUPLICATE KEY UPDATE user_id = user_id;

-- ============================================================
-- 验证迁移
-- ============================================================
SELECT 'Agent 数据库迁移完成' AS message;

SELECT COUNT(*) AS agent_users_count FROM agent_users;
SELECT COUNT(*) AS api_keys_count FROM api_keys;
SELECT COUNT(*) AS tables_count FROM information_schema.tables
WHERE table_schema = 'gesp_practice_system'
AND table_name IN (
    'agent_users', 'api_keys', 'teacher_memory', 'approval_requests',
    'scheduled_tasks', 'skills', 'session_archive', 'mcp_logs',
    'oj_verification_records', 'audit_logs', 'deleted_records'
);