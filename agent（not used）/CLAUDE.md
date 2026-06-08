# GESP Agent 项目规则

> 版本：2026-04-14
> 作用：引导Claude理解项目结构和工作流程

---

## 一、项目概述

GESP Agent 是为gespgrowplan教育平台构建的智能助手，帮助教师通过自然语言管理题目、考试、学习计划。

**架构**：本地Python Agent + 云端MCP Server + Vue桌面前端

---

## 二、文档系统

本项目使用**git commits + DEV_LOG.md**组合记录开发记忆：

| 文档 | 位置 | 内容 | 读取时机 |
|------|------|------|----------|
| **DEV_LOG.md** | 根目录 | 会话meta data + commit引用 | 会话开始时自动读取 |
| **CLAUDE.md** | 根目录 | 项目规则入口（本文件） | 每次会话加载 |
| **docs/DESIGN.md** | docs/ | 系统架构设计 | 涉及架构决策时 |
| **docs/RUNNING.md** | docs/ | 启动命令、端口配置 | 需要启动服务时 |
| **docs/SECURITY.md** | docs/ | 安全设计、密钥管理 | 涉及认证权限时 |
| **docs/DOC_STANDARD.md** | docs/ | 文档命名规范 | 创建新文档时参考 |
| **git commits** | git log | 完整代码变更 + 详细说明 | 需要时git log查看 |

---

## 三、会话工作流程

```
会话开始 → 自动读取DEV_LOG最新节 → 了解上次进度
    ↓
开发工作 → 正常进行
    ↓
会话结束前 → 检查git status → git commit → 更新DEV_LOG.md
```

### Commit Message规范

```
<type>: <简要描述>

详细说明：
- 修复/实现了什么
- 关键文件：path/to/file.py:line
- 为什么这样改

示例：
fix: 修复LLM SSE流式解析

- 修复问题：Anthropic格式event行未处理
- 关键文件：local/llm/client.py:331
- 原因：DashScope使用event/data分开的SSE格式
```

### DEV_LOG格式

```markdown
## YYYY-MM-DD 会话记录

**Commit**: <hash> "<type>: <描述>"
**Meta**:
- 修复/实现：简要说明
- 关键文件：path:line
- 待办：下步事项

---
```

---

## 四、端口与服务

| 服务 | 端口 | 启动命令 |
|------|------|----------|
| MCP Server | 8001 | `cd server && uvicorn main:app --port 8001` |
| Backend | 3000 | pm2管理 |
| Vue Dev | 1420 | `cd desktop && npm run dev -- --host 127.0.0.1` |

---

## 五、关键配置

```json
{
  "llm_provider": "zhipu",
  "llm_model": "glm-5",
  "llm_base_url": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
  "mcp_server_url": "http://localhost:8001",
  "mcp_api_key": "test_571"
}
```

**注意**：DashScope采用Anthropic格式，SSE包含thinking_delta和text_delta。

---

## 六、已修复的关键问题

| 问题 | 文件 | 解决方案 |
|------|------|----------|
| async generator | 多文件 | `async for in stream()` |
| SSE解析 | client.py:331 | 处理event行，解析data行 |
| MCP端点 | client.py:92,143 | `/mcp/tools`, `/mcp/call` + user_key |

---

## 七、待办事项

- [ ] 创建Agent HTTP API（连接Vue前端）
- [ ] 安装Rust（Tauri打包）
- [ ] 完整集成测试