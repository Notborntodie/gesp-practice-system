# GESP Agent 安全设计文档

## 一、密钥安全管理

### 1.1 用户 LLM API Key 存储

> **风险**：用户 LLM Key 存储不当会导致费用被盗刷。

#### 方案一：本地加密存储（推荐）

```
用户输入 API Key
    ↓
桌面 App 加密存储
    ├─ macOS: Keychain API
    ├─ Windows: Credential Manager
    ├─ Linux: libsecret / Gnome Keyring
    ↓
Agent 启动时读取解密
    ↓
调用 LLM API
```

**实现代码**：
```python
import keyring  # 跨平台密钥存储

class SecureKeyStorage:
    """安全密钥存储"""
    
    SERVICE_NAME = "GESP-Agent"
    
    def store_llm_key(self, user_id: str, provider: str, api_key: str):
        """存储 LLM Key"""
        keyring.set_password(
            self.SERVICE_NAME,
            f"{user_id}_{provider}_llm",
            api_key
        )
    
    def retrieve_llm_key(self, user_id: str, provider: str) -> str:
        """读取 LLM Key"""
        return keyring.get_password(
            self.SERVICE_NAME,
            f"{user_id}_{provider}_llm"
        )
    
    def delete_llm_key(self, user_id: str, provider: str):
        """删除 LLM Key"""
        keyring.delete_password(
            self.SERVICE_NAME,
            f"{user_id}_{provider}_llm"
        )
```

#### 方案二：云端加密存储（可选）

```
用户输入 API Key
    ↓
桌面 App 本地加密（AES-256）
    ↓
上传加密后的 Key 到云端 agent_users.llm_api_key_encrypted
    ↓
云端存储加密密钥在环境变量（不存数据库）
    ↓
Agent 需用时下载并解密
```

**加密实现**：
```python
from cryptography.fernet import Fernet

class EncryptedKeyStorage:
    """加密密钥存储"""
    
    # 加密密钥从环境变量获取
    ENCRYPTION_KEY = os.getenv("AGENT_KEY_ENCRYPTION_KEY")
    
    def encrypt(self, api_key: str) -> str:
        """加密"""
        f = Fernet(self.ENCRYPTION_KEY)
        return f.encrypt(api_key.encode()).decode()
    
    def decrypt(self, encrypted: str) -> str:
        """解密"""
        f = Fernet(self.ENCRYPTION_KEY)
        return f.decrypt(encrypted.encode()).decode()
```

### 1.2 MCP API Key 设计

> **修正**：不直接存储单一 key，使用多设备、有效期管理。

```sql
CREATE TABLE api_keys (
    key_id VARCHAR(64) PRIMARY KEY,     -- 随机生成的 Key ID
    user_id INT NOT NULL,
    key_type VARCHAR(20) NOT NULL,      -- 'mcp' / 'agent_auth'
    device_name VARCHAR(100),           -- "办公室电脑" / "家里电脑"
    device_id VARCHAR(64),              -- 设备唯一标识
    created_at TIMESTAMP,
    expires_at TIMESTAMP,               -- 有效期（默认 90 天）
    last_used_at TIMESTAMP,
    is_active BOOLEAN,
    
    INDEX idx_user_active (user_id, is_active)
);
```

**Key 生成**：
```python
def generate_api_key(user_id: int, device_name: str) -> str:
    """生成 MCP API Key"""
    # 32 字节随机 + 用户 ID 哈希
    random_part = secrets.token_hex(16)
    user_hash = hashlib.sha256(str(user_id).encode()).hexdigest()[:8]
    key = f"gesp_{user_hash}_{random_part}"
    return key
```

**Key 验证**：
```python
async def validate_api_key(key: str) -> dict:
    """验证 MCP API Key"""
    record = await db.query("api_keys", {"key_id": key, "is_active": True})
    
    if not record:
        raise InvalidKeyError("Key 不存在或已失效")
    
    if record["expires_at"] < datetime.now():
        raise KeyExpiredError("Key 已过期，请重新生成")
    
    # 更新最后使用时间
    await db.update("api_keys", record["id"], {"last_used_at": datetime.now()})
    
    return {"user_id": record["user_id"], "device": record["device_name"]}
```

---

## 二、通信安全

### 2.1 Agent 与 MCP Server 通信

```
Agent (本地)
    ↓ HTTPS（强制）
MCP Server (云端)
    ├─ TLS 1.3
    ├─ 证书验证
    └─ 请求签名
```

**请求签名**：
```python
def sign_request(api_key: str, payload: dict, timestamp: int) -> str:
    """请求签名"""
    # 签名内容：payload + timestamp + key
    sign_content = f"{json.dumps(payload)}{timestamp}{api_key}"
    signature = hashlib.sha256(sign_content.encode()).hexdigest()
    return signature

# 请求头
headers = {
    "X-API-Key": api_key,
    "X-Timestamp": int(time.time()),
    "X-Signature": sign_request(api_key, payload, timestamp)
}
```

**防重放攻击**：
```python
# MCP Server 端验证
def validate_request_signature(headers: dict, payload: dict):
    timestamp = int(headers["X-Timestamp"])
    
    # 5分钟内的请求有效
    if abs(time.time() - timestamp) > 300:
        raise ReplayAttackError("请求已过期")
    
    # 验证签名
    api_key = get_key_from_db(headers["X-API-Key"])
    expected_sig = sign_request(api_key, payload, timestamp)
    
    if headers["X-Signature"] != expected_sig:
        raise InvalidSignatureError("签名验证失败")
```

### 2.2 微信 Bot 安全

#### 企业微信 Bot（官方 API）

```python
# 企业微信消息签名验证
def verify_wechat_signature(token: str, timestamp: str, nonce: str, signature: str) -> bool:
    """验证企业微信签名"""
    sort_str = sorted([token, timestamp, nonce])
    join_str = "".join(sort_str)
    hash_str = hashlib.sha1(join_str.encode()).hexdigest()
    return hash_str == signature
```

#### 个人微信 Bot（Wechaty）

> **风险提示**：个人微信 Bot 有封号风险，需告知用户。

**免责声明**（首次连接时显示）：
```
⚠️ 风险提示

个人微信 Bot 功能存在以下风险：
1. 微信官方可能限制或封禁账号
2. Web 协议已逐步停用，建议使用 Pad 协议
3. 频繁登录登出会增加封号风险
4. 大量消息推送可能触发风控

使用建议：
- 使用专用微信号，不建议用主号
- 保持登录状态稳定，不要频繁登出
- 消息频率控制在每分钟 5 条以内
- 避免批量群发消息

您确认了解以上风险并自愿使用吗？
[确认使用] [取消]
```

**防护措施**：
```python
class WechatySafetyGuard:
    """微信安全防护"""
    
    MAX_MSG_PER_MINUTE = 5        # 每分钟最多 5 条
    MAX_MSG_PER_HOUR = 100       # 每小时最多 100 条
    MIN_LOGIN_INTERVAL = 3600    # 重新登录间隔至少 1 小时
    
    async def check_message_limit(self) -> bool:
        """检查消息限制"""
        recent_count = await self.get_recent_msg_count(minutes=1)
        return recent_count < self.MAX_MSG_PER_MINUTE
    
    async def throttle_message(self):
        """消息限流"""
        if not await self.check_message_limit():
            await asyncio.sleep(60)  # 等待 1 分钟
```

---

## 三、数据安全

### 3.1 敏感数据加密

| 数据类型 | 存储方式 | 加密强度 |
|----------|----------|----------|
| 用户 LLM Key | 系统密钥库 / AES-256 | 高 |
| MCP API Key | 数据库（可明文，有签名保护） | 中 |
| 教师记忆数据 | 数据库 JSON（无敏感信息） | 低 |
| 学生数据 | 数据库（访问控制） | 中 |
| 审批日志 | 数据库（不可篡改） | 低 |

### 3.2 访问控制

```python
class DataAccessControl:
    """数据访问控制"""
    
    async def check_access(self, user, resource_type, resource_id, action):
        """检查数据访问权限"""
        
        # 1. 验证用户身份
        if not user.is_authenticated:
            raise UnauthorizedError()
        
        # 2. 检查资源所有权
        resource = await self.get_resource(resource_type, resource_id)
        
        if action in ["read", "update", "delete"]:
            if resource.owner_id != user.id:
                # 不是自己的资源
                if user.role != "admin":
                    raise ForbiddenError("无权访问他人资源")
        
        # 3. 记录访问日志
        await self.log_access(user.id, resource_type, resource_id, action)
        
        return True
```

### 3.3 审计日志

```python
async def log_audit(user_id, action, resource_type, resource_id, old_value=None, new_value=None):
    """记录审计日志"""
    
    await db.insert("audit_logs", {
        "user_id": user_id,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "old_value": json.dumps(old_value) if old_value else None,
        "new_value": json.dumps(new_value) if new_value else None,
        "ip_address": get_client_ip(),
        "user_agent": get_user_agent(),
        "created_at": datetime.now()
    })
```

---

## 四、操作安全

### 4.1 删除操作安全

> **修正**：不使用硬删除，采用软删除 + 可恢复机制。

```python
async def safe_delete(user, resource_type, resource_id):
    """安全删除流程"""
    
    # 1. 检查权限
    await check_permission(user, "delete", resource_type, resource_id)
    
    # 2. 备份数据
    original = await get_resource(resource_type, resource_id)
    
    # 3. 插入删除记录
    delete_record = await db.insert("deleted_records", {
        "table_name": resource_type,
        "record_id": resource_id,
        "deleted_by": user.id,
        "deleted_at": datetime.now(),
        "restore_before": datetime.now() + timedelta(hours=48),
        "data_backup": json.dumps(original)
    })
    
    # 4. 标记软删除
    await db.update(resource_type, resource_id, {
        "deleted_at": datetime.now(),
        "deleted_by": user.id
    })
    
    # 5. 记录审计
    await log_audit(user.id, "soft_delete", resource_type, resource_id, original)
    
    # 6. 通知用户可恢复
    await notify_user(user.id, {
        "type": "resource_deleted",
        "message": f"{resource_type} 已删除，48小时内可恢复",
        "restore_id": delete_record["id"]
    })
    
    return {"deleted": True, "restore_id": delete_record["id"]}


async def restore_deleted(user, restore_id):
    """恢复删除"""
    
    record = await db.get("deleted_records", restore_id)
    
    if not record:
        raise NotFoundError("删除记录不存在")
    
    if record["restored_at"]:
        raise AlreadyRestoredError("已恢复")
    
    if datetime.now() > record["restore_before"]:
        raise ExpiredError("恢复期限已过")
    
    # 恢复数据
    original_data = json.loads(record["data_backup"])
    await db.update(record["table_name"], record["record_id"], {
        "deleted_at": None,
        "deleted_by": None,
        **original_data
    })
    
    # 更新删除记录
    await db.update("deleted_records", restore_id, {
        "restored_at": datetime.now(),
        "restored_by": user.id
    })
    
    await log_audit(user.id, "restore", record["table_name"], record["record_id"])
    
    return {"restored": True}
```

### 4.2 批量操作限制

```python
class BatchOperationGuard:
    """批量操作限制"""
    
    MAX_BATCH_SIZE = 50           # 单次最多 50 条
    MAX_DAILY_DELETES = 100       # 每天最多删除 100 条
    
    async def check_batch_delete(self, user_id, count):
        """检查批量删除"""
        if count > self.MAX_BATCH_SIZE:
            raise BatchLimitError(f"单次最多删除 {self.MAX_BATCH_SIZE} 条")
        
        daily_count = await self.get_daily_delete_count(user_id)
        if daily_count + count > self.MAX_DAILY_DELETES:
            raise DailyLimitError(f"今日删除已达上限")
```

---

## 五、输入验证

### 5.1 防注入

```python
class InputValidator:
    """输入验证"""
    
    MAX_INPUT_LENGTH = 10000      # 输入最大长度
    
    def validate_user_input(self, input_text: str) -> str:
        """验证用户输入"""
        
        # 长度限制
        if len(input_text) > self.MAX_INPUT_LENGTH:
            raise InputTooLongError()
        
        # 移除危险字符（但不影响中文）
        # 仅对特殊场景（如代码执行）做严格过滤
        
        return input_text.strip()
    
    def validate_code_input(self, code: str, language: str) -> str:
        """验证代码输入（用于 OJ）"""
        # OJ 代码在沙箱执行，相对安全
        # 但需限制长度
        if len(code) > 50000:
            raise CodeTooLongError()
        
        return code
```

### 5.2 SQL 注入防护

```python
# 使用 ORM 或参数化查询，不拼接 SQL
async def safe_query(table, conditions):
    """安全查询"""
    # 使用 aiomysql 的参数化
    sql = "SELECT * FROM {table} WHERE user_id = %s"
    params = (conditions["user_id"],)
    
    return await db.execute(sql, params)
```

---

## 六、安全检查清单

| 项目 | 状态 | 实现位置 |
|------|------|----------|
| API Key 加密存储 | ✓ | `SecureKeyStorage` |
| MCP Key 多设备管理 | ✓ | `api_keys` 表 |
| HTTPS 强制通信 | ✓ | MCP Server 配置 |
| 请求签名验证 | ✓ | `sign_request` |
| 防重放攻击 | ✓ | 时间戳验证 |
| 微信 Bot 免责声明 | ✓ | UI 首次连接 |
| 微信消息限流 | ✓ | `WechatySafetyGuard` |
| 软删除 + 可恢复 | ✓ | `safe_delete` |
| 审计日志 | ✓ | `log_audit` |
| 批量操作限制 | ✓ | `BatchOperationGuard` |
| 输入长度限制 | ✓ | `InputValidator` |
| SQL 注入防护 | ✓ | 参数化查询 |

---

## 七、安全事件响应

### 7.1 API Key 泄露处理

```
检测到异常调用
    ↓
自动禁用 Key
    ↓
通知用户
    ↓
用户重新生成 Key
```

### 7.2 异常行为检测

```python
async def detect_abnormal_usage(user_id):
    """检测异常使用"""
    
    # 1. 调用频率异常
    hourly_calls = await get_hourly_call_count(user_id)
    if hourly_calls > 1000:
        await suspend_user(user_id, reason="异常高频调用")
        await notify_admin(f"用户 {user_id} 异常高频调用")
    
    # 2. Token 使用异常
    daily_tokens = await get_daily_token_usage(user_id)
    if daily_tokens > 1000000:
        await notify_user(user_id, "今日 Token 使用异常，请检查")
    
    # 3. 删除操作异常
    daily_deletes = await get_daily_delete_count(user_id)
    if daily_deletes > 50:
        await notify_admin(f"用户 {user_id} 异常批量删除")
```