# GESP Agent 文档规范

## 一、文档分类

| 类型 | 文件名 | 位置 | 用途 | 写入时机 |
|------|--------|------|------|----------|
| **项目规则** | `CLAUDE.md` | 根目录 | Claude自动加载的项目规则 | 项目初始化 |
| **开发日志** | `DEV_LOG.md` | 根目录 | 会话meta data + commit引用 | 每次会话结束时更新 |
| **设计文档** | `DESIGN.md` | docs/ | 架构设计、技术选型 | 开发前规划 |
| **运行指南** | `RUNNING.md` | docs/ | 启动命令、测试方法 | 功能可运行后 |
| **安全文档** | `SECURITY.md` | docs/ | 密钥管理、权限设计 | 涉及安全功能时 |
| **文档规范** | `DOC_STANDARD.md` | docs/ | 本规范文件 | 制定规范时 |

## 二、文档位置规范

```
agent/                      # Agent模块根目录
├── CLAUDE.md              # 项目规则入口（Claude自动加载）
├── DEV_LOG.md             # 开发进度日志（会话自动读取）
│
├── docs/                  # 文档目录（其他文档统一存放）
│   ├── DESIGN.md         # Agent整体设计
│   ├── RUNNING.md        # 运行指南
│   ├── SECURITY.md       # 安全设计
│   ├── DOC_STANDARD.md   # 本规范文件
│   └── HIGH_AVAILABILITY.md  # 高可用设计（可选）
│
├── server/                # Server子模块
│   └── README.md          # Server简介（可选）
│
├── local/                 # Local子模块
│   └ README.md            # Local简介（可选）
│
├── desktop/               # Desktop子模块
│   ├── README.md          # Desktop简介
│   └── BUILD.md           # 打包指南
│
└── tests/                 # 测试
    └ README.md            # 测试说明
    └ docs/
    │   ├── TEST_PLAN.md   # 测试计划
    │   └ VENV_SETUP.md    # 环境配置
```

**规则**：
- `CLAUDE.md` 和 `DEV_LOG.md` 必须在根目录（Claude需要自动加载）
- 其他所有文档统一放入 `docs/` 目录
- 子模块可以有独立的 `README.md`

## 三、文档内容结构

### DEV_LOG.md（开发日志）- 必须格式
```markdown
# GESP Agent 开发日志

## 2026-04-14 会话记录

### 完成事项
- [x] 修复LLM SSE解析（Anthropic格式）
- [x] 修复MCP Client端点

### 修复问题
| 问题 | 文件 | 原因 | 解决方案 |
|------|------|------|----------|
| async generator TypeError | client.py | `await stream()` | `async for in stream()` |

### 待办事项
- [ ] 创建Agent HTTP API
- [ ] 安装Rust打包

---

## 2026-04-13 会话记录
...
```

### DESIGN.md（设计文档）
- 必须有版本日期
- 必须有修改记录
- 关键决策必须有"为什么"

### RUNNING.md（运行指南）
- 必须有快速启动命令
- 必须有端口列表
- 必须有常见问题

## 四、禁止行为

1. **禁止在根目录随意创建.md文件**
2. **禁止创建无日期的临时文档**
3. **禁止创建功能重复的文档**
4. **禁止文档内容过于简略**

## 五、现有文档处理

| 文档 | 处理方式 |
|------|----------|
| `DESIGN.md` | 保留，添加日期 |
| `DEV_NOTES.md` | 重命名为 `DEV_LOG.md`，按日期组织 |
| `RUNNING_GUIDE.md` | 重命名为 `RUNNING.md` |
| `SECURITY.md` | 保留，添加日期 |
| `HIGH_AVAILABILITY.md` | 合并入 `DESIGN.md` 或删除（暂不需要） |

## 六、Claude应遵循的规则

1. **写文档前先问用户**："需要创建XX文档吗？"
2. **更新文档先告知**："我更新了DEV_LOG.md，记录了今天的修复"
3. **每个会话结束时更新DEV_LOG.md**
4. **删除过时/重复文档前先告知**