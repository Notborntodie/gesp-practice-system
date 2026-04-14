-- MCP API Keys 表迁移
-- 执行时间: 2026-04-15

-- 创建 api_keys 表
CREATE TABLE IF NOT EXISTS api_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    key_hash VARCHAR(64) NOT NULL COMMENT 'SHA256哈希后的key',
    key_prefix VARCHAR(12) NOT NULL COMMENT 'key前缀（用于识别，如mcp_xxx）',
    name VARCHAR(100) COMMENT 'Key名称',
    device VARCHAR(50) COMMENT '绑定设备',
    permissions JSON COMMENT '额外权限',
    quota_daily INT DEFAULT 100 COMMENT '每日调用限额',
    quota_used INT DEFAULT 0 COMMENT '已使用额度',
    quota_reset_date DATE COMMENT '额度重置日期',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否有效',
    expires_at DATETIME COMMENT '过期时间（NULL表示永不过期）',
    last_used_at DATETIME COMMENT '最后使用时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY (key_hash),
    INDEX (user_id),
    INDEX (key_prefix),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 为czy (user_id=1, 超级管理员) 创建 MCP API Key
-- 明文key: mcp_czy_d355dff9d06156de60747db70ad9978f
-- 请记录此key，后续不会再次显示明文

INSERT INTO api_keys (user_id, key_hash, key_prefix, name, permissions, quota_daily, is_active)
VALUES (
    1,
    'c6c9fa861bf4b1dbf46e58a5454b02bbedb2efc6b44e6eb303d0128c529c02a2',
    'mcp_czy_',
    'Czy超级管理员MCP Key',
    '{"bypass_approval": true, "all_tools": true}',
    -1,  -- -1表示无限制
    TRUE
);

-- 说明：
-- 1. 超级管理员的 quota_daily = -1 表示无限制
-- 2. bypass_approval = true 表示跳过审批流程
-- 3. key格式：mcp_{username}_{随机hex}

-- 查看创建的key
SELECT id, user_id, key_prefix, name, is_active, quota_daily FROM api_keys WHERE user_id = 1;