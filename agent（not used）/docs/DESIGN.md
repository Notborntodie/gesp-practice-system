# GESP Agent 设计文档

## 一、项目概述

为 gespgrowplan 教育平台构建一个智能 Agent，帮助教师通过自然语言管理题目、考试、学习计划，并进行学情分析。参考 Claude Code 的架构设计，采用混合架构实现。

---

## 二、核心架构

### 2.1 混合架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         教师电脑                                     │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Tauri Desktop App                                             ││
│  │                                                                ││
│  │  Vue 3 UI ──────────→ 本地 Python Agent                        ││
│  │                                                                ││
│  │  本地 Agent 功能：                                              ││
│  │  - Agent 主循环 (query loop)                                   ││
│  │  - LLM API 调用（用户配置的 key，用户付费）                      ││
│  │  - MCP Client（远程调用云端 MCP Server）                        ││
│  │  - 权限检查、上下文管理                                         ││
│  │  - Skills 执行                                                 ││
│  │  - 记忆系统                                                    ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
│                    ┌────────────────┴────────────────┐              │
│                    │                                 │              │
│                    ↓ HTTPS                           ↓ HTTPS        │
│              云端 MCP Server                    用户配置的 LLM       │
│                                                 (智谱/DeepSeek)     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      开发者云端服务器                                 │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  MCP Server (FastAPI, port 8001)                               ││
│  │                                                                ││
│  │  功能：                                                        ││
│  │  - 包装 backend API 为 MCP tools                               ││
│  │  - 验证教师身份                                                 ││
│  │  - OJ 代码验证（调用 backend 判题）                              ││
│  │  - 审批系统                                                    ││
│  │  - 定时任务调度                                                 ││
│  │  - Skill 云端库                                                ││
│  │  - 企业微信 Bot                                                ││
│  └────────────────────────────────────────────────────────────────┘│
│                              │                                     │
│                              ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  backend_server (Express, port 3000)                          ││
│  │                                                                ││
│  │  ✅ 不修改核心功能                                              ││
│  │  新增：/api/oj/test-run（临时代码验证）                          ││
│  └────────────────────────────────────────────────────────────────┘│
│                              │                                     │
│                              ↓                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  MySQL: gesp_practice_system                                   ││
│  │                                                                ││
│  │  业务表（已有）：users, questions, exams, learning_plans...   ││
│  │  Agent 表（新增）：见 2.2                                       ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据库设计

> **重要修正（2026-04-13）**：不直接修改 users 表，创建独立 agent_users 表避免耦合。

**新增表（不修改现有表）**：
```sql
-- Agent 用户配置（独立表，避免修改 users）
CREATE TABLE agent_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,          -- 关联 users.id
    mcp_api_key VARCHAR(64),              -- MCP 访问密钥（加密存储）
    mcp_quota_daily INT DEFAULT 100,      -- 每日调用额度
    mcp_quota_used INT DEFAULT 0,         -- 已使用额度
    mcp_quota_reset_date DATE,            -- 额度重置日期
    llm_provider VARCHAR(20),             -- 用户选择的 LLM Provider
    llm_api_key_encrypted TEXT,           -- 用户 LLM Key（加密存储）
    settings_json TEXT,                   -- Agent 设置
    agent_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API Key 管理（多设备、有效期）
CREATE TABLE api_keys (
    key_id VARCHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    key_type VARCHAR(20) NOT NULL,        -- 'mcp' / 'llm'
    device_name VARCHAR(100),
    device_id VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES agent_users(user_id)
);

-- 全局记忆
CREATE TABLE teacher_memory (
    teacher_id INT PRIMARY KEY,
    preferences_json TEXT,
    habits_json TEXT,
    patterns_json TEXT,
    subscribed_skills TEXT,
    created_skills TEXT,
    context_summary TEXT,                 -- 新增：压缩后的上下文摘要
    token_count_estimate INT DEFAULT 0,   -- 新增：Token 估算
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- 审批请求
CREATE TABLE approval_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(20),            -- 新增：资源类型
    resource_id INT,                      -- 新增：资源 ID
    resource_owner_id INT,                -- 新增：资源所有者
    params_json TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    admin_id INT,
    reason TEXT,
    teacher_confirmed BOOLEAN DEFAULT FALSE, -- 新增：审批后需教师二次确认
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    executed_at TIMESTAMP,                -- 新增：实际执行时间
    audit_log TEXT,                       -- 新增：审批日志
    FOREIGN KEY (teacher_id) REFERENCES users(id),
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- 定时任务
CREATE TABLE scheduled_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    task_name VARCHAR(100),
    task_type VARCHAR(20),       -- 'cron' / 'condition' / 'once'
    schedule_config TEXT,
    action_config TEXT,
    notify_channel VARCHAR(20),  -- 'wechat' / 'app'
    last_run_at TIMESTAMP,       -- 新增：上次执行时间
    next_run_at TIMESTAMP,       -- 新增：下次执行时间
    run_count INT DEFAULT 0,     -- 新增：执行次数
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- Skill 库
CREATE TABLE skills (
    id INT PRIMARY KEY AUTO_INCREMENT,
    skill_id VARCHAR(64) UNIQUE,
    name VARCHAR(100),
    description TEXT,
    author_id INT NOT NULL,
    trigger_keywords TEXT,
    workflow_json TEXT,
    params_template TEXT,
    version INT DEFAULT 1,
    use_count INT DEFAULT 0,
    rating_avg FLOAT DEFAULT 0,           -- 新增：平均评分
    rating_count INT DEFAULT 0,           -- 新增：评分人数
    is_public BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,    -- 新增：是否审核通过
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id)
);

-- Session 归档
CREATE TABLE session_archive (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    session_id VARCHAR(64),
    workflow_type VARCHAR(50),
    summary_json TEXT,
    compressed_context TEXT,              -- 新增：压缩后的上下文
    original_token_count INT,             -- 新增：原始 Token 数
    compressed_token_count INT,           -- 新增：压缩后 Token 数
    success BOOLEAN,
    created_at TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- MCP 日志
CREATE TABLE mcp_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    tool_name VARCHAR(50),
    params_json TEXT,
    response_status VARCHAR(20),
    execution_time_ms INT,                -- 新增：执行时间
    token_used INT DEFAULT 0,             -- 新增：Token 使用量
    cost_estimate FLOAT DEFAULT 0,        -- 新增：费用估算
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- OJ 验证记录（新增）
CREATE TABLE oj_verification_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    teacher_id INT NOT NULL,
    question_id INT,
    code TEXT NOT NULL,
    language VARCHAR(20),
    test_case_id INT,
    verdict VARCHAR(20),                  -- AC/WA/TLE/CE
    execution_time_ms INT,
    memory_used_kb INT,
    verified_by TEXT,                     -- 'reference_code' / 'invalid_test'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

-- 审计日志（新增）
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(20),
    resource_id INT,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 软删除标记（新增，用于敏感操作）
CREATE TABLE deleted_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NOT NULL,
    deleted_by INT NOT NULL,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    restore_before TIMESTAMP,             -- 可恢复截止时间
    restored_at TIMESTAMP,
    restored_by INT,
    data_backup TEXT,                     -- 删除前数据备份
    FOREIGN KEY (deleted_by) REFERENCES users(id)
);
```

---

## 三、设计决策汇总

### 3.1 交互形态

| 设计点 | 内容 |
|------|------|
| **可视化** | 对话区 + 结果预览区 + 状态栏 |
| **步骤干预** | 每步完成等待老师确认/修改 |
| **仓鼠动画** | 工作中（跑动）、等待（喝水）、完成（挥手） |
| **提示音** | 开始工作、需要干预、任务完成 |
| **风格模板** | 专业助手、友好伙伴、可爱宠物、教育专家 |

**UI 布局**：
```
┌─────────────────────────────────────────────────────────────────┐
│                        GESP Agent                                │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │   对话区域           │  │   结果预览区                    │  │
│  │                     │  │                                 │  │
│  │   老师: 创建排序题   │  │   📄 题目JSON预览               │  │
│  │   Agent: 好的...    │  │   [编辑] [下载]                 │  │
│  │                     │  │                                 │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🐹 状态栏: 等待干预 | Step 2/4 | 额度: 95/100             │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  输入框: [________________] [发送]                         │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 权限边界

> **重要修正（2026-04-13）**：增加资源所有权检查，权限不只是基于操作类型，还要基于"谁的数据"。

**四级权限模型**：

| 操作类型 | 权限级别 | 条件 | 执行方式 |
|----------|----------|------|----------|
| **查询** | SAFE | 无 | 自动执行 |
| **创建** | SAFE | 无 | 自动执行，提示结果 |
| **修改自己的** | MODERATE | `resource.owner_id == teacher_id` | 教师确认后执行 |
| **修改他人的** | HIGH_RISK | `resource.owner_id != teacher_id` | 管理员审批 + 教师二次确认 |
| **删除自己的** | HIGH_RISK | `resource.owner_id == teacher_id` | 管理员审批 + 教师二次确认 + 软删除 |
| **删除他人的** | CRITICAL | `resource.owner_id != teacher_id` | 超级管理员审批 + 48小时可恢复 |

**权限检查流程**：
```python
async def check_permission(teacher, action, resource):
    # Step 1: 确定操作级别
    base_level = get_base_level(action)  # SAFE/MODERATE/HIGH_RISK/CRITICAL
    
    # Step 2: 检查资源所有权
    if resource and base_level >= PermissionLevel.MODERATE:
        if resource.owner_id == teacher.id:
            # 自己的资源，权限降一级
            effective_level = base_level - 1
        elif teacher.role == "super_admin":
            # 超级管理员，权限降一级
            effective_level = base_level - 1
        else:
            # 他人的资源，保持原权限级别
            effective_level = base_level
    
    # Step 3: 返回决策
    if effective_level == PermissionLevel.SAFE:
        return {"allowed": True, "need_approval": False}
    elif effective_level == PermissionLevel.MODERATE:
        return {"allowed": False, "need_confirm": True}
    elif effective_level >= PermissionLevel.HIGH_RISK:
        return {"allowed": False, "need_approval": True, "approval_type": "admin"}
```

**审批流程（修正版）**：
```
老师发起敏感操作
    ↓
系统检查资源所有权
    ↓
    ├─ 自己的资源 → 管理员审批 → 教师二次确认 → 软删除 → 48小时可恢复
    └─ 他人的资源 → 超级管理员审批 → 教师二次确认 → 软删除 → 审计日志
    ↓
通知教师结果（推送 + App）
```

**二次确认机制**：
```python
# 审批通过后不自动执行
approval.status = "approved"

# 推送通知教师
await push_to_teacher(teacher_id, {
    "type": "approval_approved",
    "approval_id": approval.id,
    "message": "您的删除请求已批准，请在24小时内确认执行"
})

# 教师确认后才执行
if teacher.confirm_delete(approval_id):
    # 软删除
    await soft_delete(resource, backup=True)
    # 记录审计日志
    await log_audit(action="delete", ...)
```

**软删除设计**：
```python
async def soft_delete(table_name, record_id, deleted_by):
    # 1. 备份原数据
    original_data = await get_record(table_name, record_id)
    
    # 2. 插入删除记录
    await db.insert("deleted_records", {
        "table_name": table_name,
        "record_id": record_id,
        "deleted_by": deleted_by,
        "restore_before": now() + timedelta(hours=48),
        "data_backup": json.dumps(original_data)
    })
    
    # 3. 标记删除（不真正删除）
    await db.update(table_name, record_id, {
        "deleted_at": now(),
        "deleted_by": deleted_by
    })
    
    # 4. 48小时后自动清理（或管理员手动清理）
```

### 3.3 角色设计

> **修正（2026-04-13）**：细分管理员权限，增加超级管理员。

| 角色 | 权限范围 | 审批权限 | 数据范围 |
|------|----------|----------|----------|
| **超级管理员** | 全部 | 审批所有操作（含他人资源） | 全平台数据 |
| **普通管理员** | 部分 | 审批教师自己资源的操作 | 本机构数据 |
| **教师** | 自己的数据 | 无 | 自己创建的题目/考试/学生 |
| **学生** | 仅查看自己进度 | 无 | 自己的学习数据（预留） |

**角色判断**：
```python
def get_admin_level(user):
    if user.role == "admin":
        if user.is_super_admin:  # 新增字段
            return AdminLevel.SUPER
        return AdminLevel.NORMAL
    return AdminLevel.NONE
```

### 3.4 记忆系统

> **修正（2026-04-13）**：增加上下文压缩策略，避免长对话 Token 超限。

| 记忆类型 | 内容 | 存储 | 生命周期 | 压缩策略 |
|----------|------|------|----------|----------|
| **全局记忆** | 偏好、习惯、Skill订阅、操作模式 | 云端数据库 | 永久 | 无需压缩 |
| **局部记忆** | 对话历史、工作流状态、草稿 | 本地内存/文件 | Session内 | 动态压缩 |
| **压缩摘要** | 关键信息提取、用户意图、工作流结果 | 云端 session_archive | 归档后 | 智能摘要 |

**全局记忆内容**：
- 对话风格偏好
- 干预频率偏好
- 题目创建习惯（故事化/难度倾向/测试数据数量）
- 成功工作流模式
- 订阅/创建的 Skills

**上下文压缩策略**：
```python
class ContextCompressor:
    """上下文压缩器"""
    
    MAX_TOKENS = 40000              # 上下文上限
    KEEP_RECENT_MESSAGES = 10       # 保持最近 10 轮完整消息
    SUMMARY_THRESHOLD = 20000       # 超过 20k token 开始压缩
    
    async def compress(self, messages: list) -> list:
        current_tokens = self.count_tokens(messages)
        
        if current_tokens < self.SUMMARY_THRESHOLD:
            return messages  # 无需压缩
        
        # 保留最近 10 轮完整消息
        recent = messages[-self.KEEP_RECENT_MESSAGES * 2:]  # user+agent
        
        # 历史消息生成摘要
        history = messages[:-self.KEEP_RECENT_MESSAGES * 2]
        summary = await self.generate_summary(history)
        
        # 返回压缩后的上下文
        compressed = [
            {"role": "system", "content": f"[历史摘要]\n{summary}"},
            {"role": "system", "content": f"[用户偏好]\n{self.user_preferences}"},
            *recent
        ]
        
        return compressed
    
    async def generate_summary(self, history: list) -> str:
        """生成历史摘要"""
        # 提取关键信息
        key_info = {
            "topics_discussed": self.extract_topics(history),
            "actions_taken": self.extract_actions(history),
            "results": self.extract_results(history),
            "user_intent": self.extract_intent(history),
            "important_data": self.extract_data(history)
        }
        
        # 生成摘要文本
        summary = f"""
讨论主题: {', '.join(key_info['topics_discussed'][:5])}
执行操作: {', '.join(key_info['actions_taken'][:5])}
关键结果: {key_info['results'][-3:]}
用户意图: {key_info['user_intent']}
重要数据: {key_info['important_data']}
"""
        return summary
    
    def count_tokens(self, messages: list) -> int:
        """Token 计数"""
        total = 0
        for msg in messages:
            total += self.llm.count_tokens(msg["content"])
        return total
```

**压缩触发时机**：
```
每次发送消息前检查 Token 数
    ↓
超过阈值 → 执行压缩
    ↓
压缩后 Token 数 < 10000 → 继续对话
压缩后 Token 数 >= 10000 → 建议用户开始新 Session
```

**用户费用预估**：
```python
class CostTracker:
    """费用追踪器"""
    
    # 各 Provider 价格（元/千 token）
    PRICES = {
        "zhipu": {"input": 0.001, "output": 0.001},
        "deepseek": {"input": 0.001, "output": 0.002},
        "claude": {"input": 0.015, "output": 0.075}
    }
    
    async def estimate_cost(self, messages: list, provider: str) -> float:
        input_tokens = self.count_input_tokens(messages)
        # 预估输出 token（约输入的 50%）
        output_tokens = input_tokens * 0.5
        
        price = self.PRICES[provider]
        cost = (input_tokens * price["input"] + output_tokens * price["output"]) / 1000
        
        return cost
    
    async def show_cost_warning(self, messages: list, provider: str):
        """费用预警"""
        cost = await self.estimate_cost(messages, provider)
        
        if cost > 0.5:
            # 单次对话超过 0.5 元，提示用户
            return {
                "warning": True,
                "message": f"本次对话预计消耗 ¥{cost:.2f}",
                "suggestion": "建议压缩历史对话或开始新 Session"
            }
        
        return {"warning": False}
```

### 3.5 Skills 系统

**Skill 结构**：
```json
{
    "skill_id": "skill_001",
    "name": "创建排序题",
    "description": "快速创建一道排序类型的OJ题目",
    "trigger_keywords": ["创建排序题", "新建排序", "排序题"],
    "author_id": 123,
    "workflow": [
        {"step": 1, "action": "generate_description", "name": "题目描述"},
        {"step": 2, "action": "generate_test_data", "name": "测试数据"},
        {"step": 3, "action": "generate_reference_code", "name": "参考代码"},
        {"step": 4, "action": "verify_code", "name": "验证代码"},
        {"step": 5, "action": "upload_to_oj", "name": "上传题库"}
    ],
    "params_template": {
        "difficulty": {"default": "medium", "options": ["easy", "medium", "hard"]},
        "category": {"default": "GESP", "options": ["GESP", "CSP_J", "CSP_S"]}
    },
    "version": 1,
    "use_count": 0
}
```

**Skill 分享**：
- 云端 Skill 库
- 早期自由分享，无审核
- 老师可发布/订阅 Skill

### 3.6 微信 Bot（双模式）

#### 企业微信 Bot（云端运行）

**位置**：云端 MCP Server
**功能**：推送提醒、审批通知
**技术**：企业微信官方 API / Webhook

#### 个人微信 Bot（本地运行）

**位置**：教师电脑本地运行
**技术**：Wechaty 框架
**连接方式**：扫码登录（二维码显示在桌面 App）

```
架构：

教师电脑（一直开着）
    │
    ├── Python Agent（本地）
    │   - LLM Client（用户 key）
    │   - MCP Client（调用云端）
    │   - Skills / Memory
    │
    └── Wechaty Bot（本地）
        - 显示二维码
        - 手机扫码后连接
        - 消息转发给 Agent
        - Agent 回复发回微信
    │
    ↓ HTTPS
云端 MCP Server（处理数据请求）
```

**使用流程**：
```
1. 教师打开桌面 App
2. 点击"连接个人微信"
3. 显示二维码
4. 手机微信扫码
5. 连接成功 → 可以在手机微信对话
6. 电脑需保持运行
```

**功能**：
- 快速查询（学生数据、题目、进度）
- 接收推送（审批请求、定时任务结果）
- 对话交互（仓鼠风格）

**示例**：
```
/查询学生 张三
/查询题目 二级 排序
/今日提醒
```

**风险提示**：
- 个人微信 Bot 有封号风险
- 建议使用 Pad 协议而非免费 Web 协议
- 不要频繁登录登出

### 3.7 数据同步

#### 全局记忆同步

**存储位置**：云端数据库 `teacher_memory` 表
**同步机制**：
- 每次操作后自动同步到云端
- 每次启动时从云端拉取最新
- 多设备自动同步（家里电脑、办公室电脑、微信 Bot）

```
老师家里电脑 → 更新偏好 → 云端存储
老师办公室电脑 → 登录 → 自动拉取偏好
老师微信 Bot → 发消息 → 使用同一份全局记忆
```

#### Session 处理

**方案**：Session 归档后可继续

```
场景：老师在家创建题目，到办公室想继续

流程：
1. 家里结束 Session → 自动归档到云端 session_archive 表
2. 到办公室打开 App → 查看历史 Session
3. 选择"继续上次任务" → 加载归档继续
```

**暂不做实时同步**（复杂度高，先实现归档后继续）

### 3.8 定时任务

**任务类型**：
| 类型 | 说明 | 示例 |
|------|------|------|
| 定时任务 | 固定时间执行 | "每天20:00推送今日摘要" |
| 条件任务 | 条件满足时触发 | "张三连续3天未提交提醒我" |
| 周期任务 | 每周/每月执行 | "每周一推送上周学情报告" |
| 一次性任务 | 指定时间执行一次 | "下周五提醒我检查考试" |

**老师自己控制**，通过对话设置。

### 3.8 OJ 代码验证

> **重要修正（2026-04-13）**：不只验证参考代码，还要验证测试数据的正确性。

**完整验证流程**：
```
Agent 生成题目
    ↓
Step 1: 验证参考代码
    ├─ 输入：参考代码 + 所有测试点
    ├─ 期望：所有测试点 AC
    └─ MCP 调用 backend /api/oj/test-run
    ↓
Step 2: 验证测试数据边界
    ├─ 空输入测试
    ├─ 最大输入测试（n=上限）
    ├─ 特殊值测试（负数、零、极大值）
    └ MCP 调用 backend /api/oj/test-run
    ↓
Step 3: 验证判定正确性（反向测试）
    ├─ 输入错误代码 → 期望 WA
    ├─ 输入超时代码 → 期望 TLE
    ├─ 输入编译错误代码 → 期望 CE
    └ MCP 调用 backend /api/oj/test-run
    ↓
全部通过 → 上传题库
任一失败 → Agent 分析原因 → 调整代码/数据 → 重试
```

**验证代码示例**：
```python
async def verify_oj_question(code, test_cases, language):
    results = {
        "reference_code": None,
        "boundary_tests": [],
        "reverse_tests": []
    }
    
    # Step 1: 参考代码必须通过所有测试点
    for test_case in test_cases:
        verdict = await mcp.call_tool("verify_oj_code", {
            "code": code,
            "language": language,
            "input": test_case["input"],
            "expected": test_case["expected"]
        })
        if verdict != "AC":
            return {"success": False, "error": f"参考代码未通过测试点: {verdict}"}
    results["reference_code"] = "AC"
    
    # Step 2: 边界测试
    boundary_tests = [
        {"input": "", "desc": "空输入"},
        {"input": generate_max_input(), "desc": "最大输入"},
        {"input": generate_edge_values(), "desc": "边界值"}
    ]
    for test in boundary_tests:
        verdict = await mcp.call_tool("verify_oj_code", {...})
        results["boundary_tests"].append({"desc": test["desc"], "verdict": verdict})
    
    # Step 3: 反向测试（验证判定正确）
    wrong_codes = [
        {"code": "print('wrong')", "expect": "WA"},
        {"code": generate_timeout_code(), "expect": "TLE"},
        {"code": generate_compile_error(), "expect": "CE"}
    ]
    for wrong in wrong_codes:
        verdict = await mcp.call_tool("verify_oj_code", {
            "code": wrong["code"],
            ...
        })
        if verdict != wrong["expect"]:
            return {"success": False, "error": f"判定错误: {verdict} 应为 {wrong['expect']}"}
        results["reverse_tests"].append({"expect": wrong["expect"], "actual": verdict})
    
    return {"success": True, "results": results}
```

**Backend API 修正**：
```
POST /api/oj/test-run
{
    "code": "...",
    "language": "python",
    "input": "...",
    "expected_output": "...",
    "time_limit": 1000,        // 可自定义时间限制
    "memory_limit": 256        // 可自定义内存限制
}

Response:
{
    "verdict": "AC" / "WA" / "TLE" / "CE" / "MLE" / "RE",
    "output": "...",
    "execution_time_ms": 50,
    "memory_used_kb": 1024,
    "compile_error": "...",    // CE 时返回编译错误信息
    "runtime_error": "...",    // RE 时返回运行错误信息
    "diff": "..."              // WA 时返回差异对比
}
```

**验证记录保存**：
```python
# 每次验证都记录，便于追溯问题
await db.insert("oj_verification_records", {
    "teacher_id": teacher_id,
    "code": code,
    "language": language,
    "verdict": verdict,
    "execution_time_ms": exec_time,
    "verified_by": "reference_code" / "boundary" / "reverse"
})
```

### 3.9 Agent 对话风格

**预设模板**：
| 风格 | 语气 | 示例 |
|------|------|------|
| 专业助手 | 正式、精准 | "已为您查询到12道题目" |
| 友好伙伴 | 亲切、温和 | "好的老师！我来帮您~" |
| 可爱宠物 | 活泼、仓鼠语气 | "吱吱！题目找好了！" |
| 教育专家 | 专业建议 | "建议这道题放在循环章节后..." |

**动态调整**：
- 根据全局记忆使用偏好风格
- 敏感操作时更正式
- 连续拒绝时更温和

---

## 四、项目结构

```
agent/
├── local/                    # 本地 Agent（教师电脑）
│   ├── core/                 # Agent 核心
│   │   ├── engine.py         # QueryEngine
│   │   ├── query.py          # 主循环
│   │   ├── state.py          # 状态管理
│   │   └── session.py        # Session 管理
│   │
│   ├── skills/               # Skills 系统
│   │   ├── base.py           # Skill 基类
│   │   ├── registry.py       # Skill 注册
│   │   ├── executor.py       # Skill 执行器
│   │   └── builtins/         # 内置 Skills
│   │
│   ├── memory/               # 记忆系统
│   │   ├── global_store.py   # 全局记忆
│   │   ├── local_store.py    # 局部记忆
│   │   └── style_adapter.py  # 风格调整
│   │
│   ├── tools/                # 工具系统
│   │   ├── base.py           # Tool 基类
│   │   ├── factory.py        # build_tool
│   │   └── registry.py       # 工具注册
│   │
│   ├── permissions/          # 权限系统
│   │   ├── gate.py           # 权限决策
│   │   └── levels.py         # 权限级别
│   │
│   ├── llm/                  # LLM Client
│   │   ├── client.py         # 多 Provider
│   │   ├── streaming.py      # 流式处理
│   │   └── context_compress.py
│   │
│   ├── mcp_client/           # MCP Client
│   │   ├── client.py         # 远程调用
│   │   └── transport.py      # HTTPS 传输
│   │
│   ├── wechat_bot/           # 个人微信 Bot（本地）
│   │   ├── bot_service.py    # Wechaty 服务
│   │   ├── message_handler.py
│   │   ├── whitelist.py      # 白名单管理
│   │   └── qrcode_server.py  # 二维码生成
│   │
│   ├── prompts/              # 提示词
│   │   ├── system_prompt.py
│   │   └── skill_prompts.py
│   │
│   └── main.py
│
├── server/                   # 云端 MCP Server
│   ├── mcp/                  # MCP 核心
│   │   ├── tools/            # MCP Tools
│   │   │   ├── questions_api.py
│   │   │   ├── exams_api.py
│   │   │   ├── oj_api.py     # 含代码验证
│   │   │   ├── learning_plans_api.py
│   │   │   ├── teachers_api.py
│   │   │   └── knowledge_api.py
│   │   └── server.py
│   │
│   ├── approval/             # 审批系统
│   │   ├── manager.py
│   │   └── handler.py
│   │
│   ├── scheduler/            # 定时任务
│   │   ├── task_manager.py
│   │   └── executor.py
│   │
│   ├── wechat_bot/           # 企业微信 Bot
│   │   ├── bot.py
│   │   ├── message_handler.py
│   │   ├── push_scheduler.py
│   │   └── card_formatter.py
│   │
│   ├── skill_cloud/          # Skill 云端库
│   │   ├── storage.py
│   │   ├── publish.py
│   │   └── subscribe.py
│   │
│   ├── memory_sync/          # 记忆同步
│   │   └── sync_manager.py
│   │
│   └── backend_client/       # Backend 调用
│   │   └lient.py
│   │
│   └── main.py
│
├── desktop/                  # Tauri 桌面应用
│   ├── src-tauri/            # Rust 核心
│   │   ├── src/
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   │   └── icons/
│   │
│   ├── src/                  # Vue 3 前端
│   │   ├── components/
│   │   │   ├── ChatPanel.vue
│   │   │   ├── MessageList.vue
│   │   │   ├── ResultPreview.vue
│   │   │   ├── WorkflowSteps.vue
│   │   │   ├── HamsterAnimation.vue
│   │   │   ├── PermissionDialog.vue
│   │   │   ├── ApprovalQueue.vue     # 管理员审批
│   │   │   ├── SettingsPanel.vue
│   │   │   ├── SkillLibrary.vue      # Skill 库浏览
│   │   │   ├── TaskScheduler.vue     # 定时任务设置
│   │   │   ├── WechatConnect.vue     # 微信连接面板
│   │   │   ├── WechatQRCode.vue      # 二维码显示
│   │   │   └── StatusBar.vue
│   │   ├── stores/
│   │   ├── utils/
│   │   ├── styles/
│   │   └── assets/
│   │       └── hamster/              # 仓鼠动画素材
│   │           ├── running.gif
│   │           ├── waiting.gif
│   │           ├── happy.gif
│   │       └── sounds/               # 提示音
│   │           ├── start.mp3
│   │           ├── intervene.mp3
│   │           ├── done.mp3
│   │   └── main.ts
│   │
│   └── package.json
│
├── database/
│   └── migrate_agent_tables.sql
│
└── README.md
```

---

## 五、教师配置流程

```
首次启动：

Step 1: 配置 LLM
   选择 Provider（智谱/DeepSeek/OpenAI）
   输入 API Key（用户自己付费）
   测试连接

Step 2: 登录 gespgrowplan
   输入用户名密码
   登录成功 → 自动获取 MCP API key

Step 3: 选择风格
   选择对话风格模板
   存入全局记忆

Step 4: 开始使用
```

---

## 六、成本分析

| 成本项目 | 承担方 | 说明 |
|----------|--------|------|
| LLM API | 教师 | 用户配置自己的 key |
| MCP Server 运行 | 开发者 | 轻量服务，极低成本 |
| Backend API | 开发者 | 已有，无新增成本 |
| 企业微信 Bot | 开发者 | 消息推送，极低成本 |
| Skill 云端库 | 开发者 | 存储分享，极低成本 |

---

## 七、实施阶段

| 阶段 | 时间 | 内容 |
|------|------|------|
| Phase 1 | Week 1 | 云端 MCP Server + 数据库表 |
| Phase 2 | Week 2-3 | 本地 Agent 核心引擎 + LLM Client |
| Phase 3 | Week 4 | MCP Client + 记忆系统 |
| Phase 4 | Week 5 | Skills 系统 + 权限 Gate |
| Phase 5 | Week 6 | 审批系统 + 定时任务 |
| Phase 6 | Week 7-8 | 企业微信 Bot + Skill 云端库 |
| Phase 7 | Week 9-10 | Tauri 桌面应用 + 仓鼠动画 |
| Phase 8 | Week 11 | Mac/Windows 打包测试 |
| Phase 9 | Week 12 | 集成测试 + 发布 |

---

## 八、Claude Code 参考文件

| Claude Code 文件 | 借鉴内容 | Python 对应 |
|-----------------|----------|-------------|
| `QueryEngine.ts` | Agent 主循环状态机 | `local/core/engine.py` |
| `query.ts` | while(true) 循环 | `local/core/query.py` |
| `Tool.ts` | 工具抽象 + buildTool | `local/tools/base.py` |
| `useCanUseTool.tsx` | 权限决策交互 | `local/permissions/gate.py` |
| `services/mcp/` | MCP 协议 | `server/mcp/` |
| `services/compact/` | 上下文压缩 | `local/llm/context_compress.py` |
| `.claude/memory/` | 记忆系统 | `local/memory/` |
| `.claude/skills/` | Skills 设计 | `local/skills/` |

---

## 九、预留扩展

| 功能 | 状态 | 说明 |
|------|------|------|
| 学生使用 Agent | 预留 | 个人微信 Bot，查看自己进度 |
| 个人微信 Bot | 预留 | 学生端推送 |
| 超级/普通管理员区分 | 预留 | 后续可细分权限 |
| Skill 版本控制 | 预留 | Skill 可发布新版本 |
| Skill 嵌套调用 | 预留 | 一个 Skill 调用另一个 |
| Skill 审核 | 预留 | 早期自由分享，后续可加审核 |