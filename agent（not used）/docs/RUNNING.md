# GESP Agent 运行与测试指南

## 一、环境准备

### 1. Python 版本
```bash
# 需要 Python 3.8+
python --version
```

### 2. 安装依赖

**云端 MCP Server 依赖：**
```bash
cd /root/SmartOI/gespgrowplan/agent
pip install -r server/requirements.txt
```

**本地 Agent 依赖：**
```bash
pip install -r requirements.txt
```

**测试依赖：**
```bash
pip install pytest pytest-asyncio pytest-cov httpx
```

### 3. 数据库迁移

**执行数据库迁移（创建新表，不影响现有数据）：**
```bash
# 连接到 MySQL
mysql -u root -p gesp_practice_system

# 执行迁移脚本
source database/migrate_agent_tables.sql
```

---

## 二、MCP Server 运行

### 1. 配置环境变量

创建 `.env` 文件：
```bash
# 在 agent/server/.env
BACKEND_URL=http://localhost:3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=gesp_practice_system

# 企业微信（可选）
WECHAT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
```

### 2. 启动 MCP Server

```bash
cd /root/SmartOI/gespgrowplan/agent/server

# 开发模式启动
uvicorn main:app --reload --host 0.0.0.0 --port 8001

# 生产模式启动
uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4
```

### 3. 测试 MCP Server

```bash
# 健康检查
curl http://localhost:8001/health

# 获取工具列表
curl http://localhost:8001/tools

# 调用工具（示例）
curl -X POST http://localhost:8001/call \
  -H "Content-Type: application/json" \
  -d '{"tool": "list_questions", "params": {"category": "GESP"}}'
```

---

## 三、本地 Agent 运行

### 1. 配置 LLM API Key

创建配置文件 `config.json`：
```json
{
  "llm_provider": "zhipu",
  "llm_api_key": "your_zhipu_api_key",
  "llm_model": "glm-4-plus",
  "mcp_server_url": "http://localhost:8001",
  "mcp_api_key": "your_mcp_key",
  "teacher_id": 1001,
  "style": "专业助手"
}
```

### 2. 启动 Agent（交互式）

```bash
cd /root/SmartOI/gespgrowplan/agent

# 使用默认配置
python -m local.main

# 使用指定配置
python -m local.main --config config.json --llm-key your_key
```

### 3. 在代码中使用

```python
import asyncio
from local.main import GESPAgent

async def main():
    config = {
        "llm_provider": "zhipu",
        "llm_api_key": "your_key",
        "mcp_server_url": "http://localhost:8001",
        "teacher_id": 1001
    }
    
    agent = GESPAgent(config)
    await agent.initialize()
    
    # 处理用户输入
    result = await agent.process("查询二级排序题目")
    print(result)
    
    await agent.shutdown()

asyncio.run(main())
```

---

## 四、运行测试

### 1. 运行所有测试

```bash
cd /root/SmartOI/gespgrowplan/agent

# 运行全部测试
pytest tests/ -v

# 运行单元测试
pytest tests/unit/ -v

# 运行集成测试
pytest tests/integration/ -v
```

### 2. 运行特定测试

```bash
# 测试 QueryEngine
pytest tests/unit/local/core/test_engine.py -v

# 测试 LLM Client
pytest tests/unit/local/llm/test_client.py -v

# 测试权限系统
pytest tests/unit/local/permissions/test_gate.py -v

# 测试 MCP Tools
pytest tests/unit/server/mcp/test_tools.py -v
```

### 3. 运行带覆盖率的测试

```bash
pytest tests/ --cov=local --cov=server --cov-report=html
```

### 4. 运行需要真实 LLM 的测试（可选）

```bash
# 需要配置 LLM API Key
export LLM_API_KEY=your_key
pytest tests/ -v -m "requires_llm"
```

---

## 五、桌面应用开发

### 1. 安装前端依赖

```bash
cd /root/SmartOI/gespgrowplan/agent/desktop

# 创建 Vue 项目（如果还没有）
npm create vue@latest .

# 安装依赖
npm install
```

### 2. 开发模式运行

```bash
# 启动开发服务器
npm run dev
```

### 3. Tauri 集成（后续）

```bash
# 安装 Tauri CLI
npm install -D @tauri-apps/cli

# 初始化 Tauri
npm run tauri init

# 开发运行
npm run tauri dev

# 构建发布
npm run tauri build
```

---

## 六、完整启动流程

### 开发环境（全部服务）

```bash
# 1. 启动 Backend Server（已有的 Express 服务）
cd /root/SmartOI/gespgrowplan/backend_server
npm run dev

# 2. 启动 MCP Server
cd /root/SmartOI/gespgrowplan/agent/server
uvicorn main:app --reload --port 8001

# 3. 启动本地 Agent（交互式测试）
cd /root/SmartOI/gespgrowplan/agent
python -m local.main --config config.json

# 4. 启动桌面应用（可选）
cd /root/SmartOI/gespgrowplan/agent/desktop
npm run dev
```

### 生产环境

```bash
# MCP Server（后台运行）
cd /root/SmartOI/gespgrowplan/agent/server
nohup uvicorn main:app --host 0.0.0.0 --port 8001 --workers 4 > mcp.log 2>&1 &
```

---

## 七、常见问题

### 1. 数据库连接失败
```bash
# 检查数据库配置
mysql -u root -p -e "SHOW DATABASES;"

# 检查表是否存在
mysql -u root -p gesp_practice_system -e "SHOW TABLES LIKE '%agent%';"
```

### 2. MCP Server 启动失败
```bash
# 检查端口是否被占用
lsof -i :8001

# 检查依赖
pip install -r server/requirements.txt --upgrade
```

### 3. LLM API 调用失败
```bash
# 测试智谱 API 连接
curl https://open.bigmodel.cn/api/paas/v4/messages \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "glm-4-plus", "messages": [{"role": "user", "content": "hello"}]}'
```

### 4. 测试导入错误
```bash
# 确保在正确的目录
cd /root/SmartOI/gespgrowplan/agent

# 添加 PYTHONPATH
export PYTHONPATH=/root/SmartOI/gespgrowplan/agent:$PYTHONPATH
pytest tests/ -v
```

---

## 八、验证清单

启动后验证：

1. **MCP Server**
   - `curl http://localhost:8001/health` → 返回 `{"status": "ok"}`
   - `curl http://localhost:8001/tools` → 返回工具列表

2. **Backend OJ 端点**
   - `curl -X POST http://localhost:3000/api/oj/test-run -d '{"code": "print(1)", "language": "python"}'`
   - 返回验证结果

3. **Agent 初始化**
   - 运行 Agent 后看到 "初始化完成" 消息

4. **测试通过**
   - `pytest tests/unit/ -v` 至少基础测试通过