# gespgrowplan

信奥成长计划 — GESP 编程能力等级认证练习平台，支持客观题、在线判题（OJ）、学习计划管理。

- 仓库：https://github.com/Notborntodie/gespgrowplan

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | Vue 3, TypeScript, Vite, Pinia, CodeMirror |
| 微信小程序 | 微信小程序原生, TypeScript |
| 后端 | Node.js, Express, MySQL, Redis |
| 判题 | isolate 沙箱 |
| AI 服务 | Python, FastAPI, DashScope (可选) |

## 项目结构

```
gespgrowplan/
├── frontend/         # Vue 前端
├── miniprogram/      # 微信小程序（家长端）
├── backend_server/   # Node.js 后端 API
├── Al_server/        # PDF 题目提取、解析生成（可选）
└── docs/             # 部署与配置文档
```

## 环境要求

- Node.js >= 18
- MySQL >= 8.0
- Redis >= 5.0
- Python >= 3.8（仅 AI 服务需）

## 快速开始

### 0. 克隆项目

```bash
git clone https://github.com/Notborntodie/gespgrowplan.git
cd gespgrowplan
```

### 1. 安装依赖

```bash
# 后端
cd backend_server && npm install

# 前端
cd frontend && npm install

# AI 服务（可选）
cd Al_server && pip install -r requirements.txt
```

### 2. 数据库

```bash
mysql -u root -p -e "CREATE DATABASE gesp_practice_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cd backend_server/database
mysql -u root -p gesp_practice_system < create_all_tables.sql
```

### 3. 环境变量

复制示例并修改：

```bash
# 后端
cp backend_server/.env.example backend_server/.env

# 前端（开发）
# 创建 frontend/.env，设置 VITE_API_BASE_URL=http://localhost:3000/api

# AI 服务（可选）
cp Al_server/.env.example Al_server/.env
```

### 4. 安装 isolate（判题沙箱）

```bash
cd backend_server/isolate-master
make isolate && sudo make install
sudo isolate --init
```

### 5. 启动

```bash
# 终端 1：后端
cd backend_server && npm run dev

# 终端 2：前端
cd frontend && npm run dev

# 终端 3：AI 服务（可选）
cd Al_server && ./start.sh
```

访问 `http://localhost:5173`。

## 各模块说明

- [frontend/README.md](frontend/README.md) — 前端开发与部署
- [miniprogram/README.md](miniprogram/README.md) — 微信小程序（家长端）开发与部署
- [backend_server/README.md](backend_server/README.md) — 后端 API 与部署
- [Al_server/README.md](Al_server/README.md) — AI 服务说明

## 文档

- [backend_server/database/数据库.md](backend_server/database/数据库.md) — 数据库设计
- [docs/仅本机访问配置说明.md](docs/仅本机访问配置说明.md) — 本机监听与 Nginx 配置

## 部署

- 后端：`backend_server/deploy.sh`，或 PM2：`pm2 start ecosystem.config.js --env production`
- 前端：`frontend/deploy-frontend.sh --build`（需配置 `.deploy-config`）

## License

MIT
