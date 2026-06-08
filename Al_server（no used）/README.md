# AI 服务

[gespgrowplan](https://github.com/Notborntodie/gespgrowplan) 项目的 AI 模块，基于 FastAPI 的 PDF 题目提取与解析生成，使用 DashScope（Qwen）API。

## 安装

```bash
pip install -r requirements.txt
```

## 配置

```bash
cp .env.example .env
```

在 `.env` 中设置：

- `DASHSCOPE_API_KEY` — 阿里云 DashScope API 密钥
- `LLM_MODEL` — 模型，如 `qwen-plus-latest`

## 启动

```bash
./start.sh
```

默认 `http://localhost:8000`，API 文档 `/docs`。

## API

- `POST /api/extract` — PDF 题目提取
- `POST /api/stream-extract` — 流式提取
- `POST /api/generate-explanation` — 单题解析生成
- `POST /api/generate-batch-explanations` — 批量解析生成

---

## AI 服务架构详解

### 支持的AI模型

| 提供商 | 模型 | 特点 | 适用场景 |
|--------|------|------|----------|
| **阿里云DashScope** | qwen-turbo, qwen-plus, qwen-max, qwen3.5-flash | 通义千问系列 | 通用问答、题目生成 |
| **智谱AI** | glm-4-flash, glm-4-air, glm-4-plus | GLM系列 | 智能体任务、代码处理 |

### 核心架构

```
┌─────────────┐
│  前端 Vue   │ ────→ 上传PDF
└─────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│         Nginx (端口 8080)               │
│  /ai-api/ → AI服务 (端口 8000)         │
│  /api/    → 后端服务 (端口 3000)       │
└─────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│      AI 服务 (Python FastAPI)          │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ llm_stream_processor.py         │   │
│  │  - PDF文本提取 (pdfplumber)     │   │
│  │  - LLM流式调用                 │   │
│  │  - 流式JSON解析                 │   │
│  │  - 题目验证与格式化             │   │
│  └─────────────────────────────────┘   │
│                                         │
│  支持功能：                             │
│  ✅ 流式输出 (SSE)                      │
│  ✅ 多模型支持 (DashScope/智谱AI)       │
│  ✅ PDF智能分割                         │
│  ✅ 题目数量估算                        │
│  ✅ 代码提取与格式化                     │
└─────────────────────────────────────────┘
       │
       ↓
┌─────────────────────────────────────────┐
│      LLM Provider API                   │
│  (DashScope or ZhipuAI)                │
└─────────────────────────────────────────┘
```

### 数据流

```
1. PDF上传
   ├─→ pdfplumber提取文本
   ├─→ 智能分割（按题目边界）
   └─→ 估算题目数量

2. LLM处理
   ├─→ 创建结构化Prompt
   ├─→ 流式调用API
   ├─→ 实时解析JSON响应
   └─→ 验证题目完整性

3. 流式输出
   ├─→ process_start (开始处理)
   ├─→ chunk_info (批次信息)
   ├─→ chunk_start (批次开始)
   ├─→ question (题目完成) ← 核心
   ├─→ chunk_complete (批次完成)
   └─→ process_complete (处理完成)
```

### API端点

| 端点 | 方法 | 功能 | 参数 |
|------|------|------|------|
| `/api/stream-extract` | POST | 流式提取PDF题目 | file: PDF文件<br>expected_questions: 预期题目数 |
| `/api/extract` | POST | 非流式提取（已废弃） | file: PDF文件 |

### 配置文件

**Al_server/.env**
```bash
# 选择AI模型
LLM_MODEL=glm-4-flash  # 或: qwen-plus, glm-4-air

# API密钥
DASHSCOPE_API_KEY=sk-xxx  # 阿里云
ZHIPU_API_KEY=xxx         # 智谱AI

# 性能配置
MAX_WORKERS=2              # 并发数
DEFAULT_EXPECTED_QUESTIONS=10
```

### 当前状态

✅ **已实现功能**：
- 多AI提供商支持（DashScope + 智谱AI）
- 流式实时输出（Server-Sent Events）
- PDF文本提取（pdfplumber）
- 题目自动格式化
- 代码提取与缩进处理
- 智能PDF分割
- 题目数量估算

⚠️ **已知限制**：
- 单次处理可能遗漏题目（设置15题，实际提取11题）
- API速率限制（glm-4-air更严格）
- 扫描版PDF需要OCR支持（未实现）

🚧 **优化计划**：
- 分批处理策略（每批3-5题）
- 两阶段边界识别
- API调用重试与延迟
- OCR支持（扫描版PDF）

### 日志查看

```bash
# 查看实时日志
tail -f Al_server/server.log

# 查看模型信息
tail -f Al_server/server.log | grep "使用模型"

# 查看提取进度
tail -f Al_server/server.log | grep "第.*个题目提取完成"
```

