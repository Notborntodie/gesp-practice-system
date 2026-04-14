# GESP Agent 开发日志

> 记录各会话的meta data + git commit引用
> 完整代码变更见git log

---

## 2026-04-14 会话记录

**Commit**: c075b55 "docs: 实现上下文↔文档调度机制"
**Meta**:
- 实现：创建CLAUDE.md、配置SessionStart Hook、简化DEV_LOG格式
- 关键文件：CLAUDE.md, .claude/settings.local.json

---

**Commit**: 72f77e8 "docs: 整理文档目录结构"
**Meta**:
- 实现：创建docs目录，整理文档位置，更新引用路径
- 关键文件：docs/DESIGN.md, docs/RUNNING.md, docs/SECURITY.md
- 规则：CLAUDE.md和DEV_LOG.md在根目录，其他文档在docs/

---

## 2026-04-13 会话记录

**Commit**: see-git-log "fix: Client端SSE解析和MCP端点修复"
**Meta**:
- 修复：SSE解析(跳过event行)、MCP端点(/mcp/tools)、user_key字段
- 关键文件：local/llm/client.py:331, local/mcp_client/client.py:92,143
- 结果：156测试通过，18个MCP工具，1177道真实题目

---

## 2026-04-12 会话记录

**Commit**: see-git-log "feat: Python打包和数据库迁移"
**Meta**:
- 实现：growplan-agent打包(16MB)、agent数据库表迁移、MCP Server验证
- 修复：async generator用法、Python3.6兼容
- 关键文件：local/main.py:330, 多个test文件

---

## 待办事项

- [ ] 创建Agent HTTP API（连接Vue前端和Client端）
- [ ] 安装Rust（Tauri桌面打包）
- [ ] 完整集成测试

---

## 端口与服务

| 服务 | 端口 | 命令 |
|------|------|------|
| MCP Server | 8001 | `cd server && uvicorn main:app --port 8001` |
| Backend | 3000 | pm2管理 |
| Vue Dev | 1420 | `cd desktop && npm run dev -- --host 127.0.0.1` |