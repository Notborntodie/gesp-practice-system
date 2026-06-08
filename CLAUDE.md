# 信奥成长计划 (gespgrowplan) — 项目交接文档

> 生成日期：2026-05-20
> 项目仓库：https://github.com/Notborntodie/gespgrowplan

---

## 一、项目概述

信奥成长计划 — GESP 编程能力等级认证练习平台，支持客观题练习、在线判题（OJ）、学习计划管理、教师端管理、AI 辅助等功能。

### 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | Vue 3, TypeScript, Vite, Pinia, CodeMirror |
| 微信小程序 | 微信小程序原生, TypeScript |
| 后端 | Node.js 18, Express, MySQL 8, Redis 6 |
| 判题 | isolate 沙箱 |
| AI 服务 | Python 3, FastAPI/Uvicorn, DashScope（端口 8001） |

### 项目结构

```
/root/SmartOI/gespgrowplan/
├── frontend/              # Vue 前端
├── backend_server/        # Node.js 后端 API
├── Al_server（no used）/  # 旧 AI 服务（已废弃）
├── agent（not used）/     # 旧 Agent 桌面端（已废弃）
└── docs/                  # GESP 课程文档
```

---

## 二、服务器信息

| 项目 | 值 |
|------|-----|
| 云平台 | 阿里云 |
| 操作系统 | Alibaba Cloud Linux 3.2104 U12 (OpenAnolis Edition) |
| 主机名 | iZuf69j1o4u05w19zpgkg6Z |
| 公网 IP | **106.14.143.27** |
| CPU | 多核（PM2 cluster 模式启动了 4 个实例） |
| 内存 | 7.3 GB（已用 3.4 GB，可用 3.8 GB） |
| 磁盘 | 40 GB（已用 29 GB，剩余 8.4 GB，使用率 78%） |
| Swap | 4 GB |

### 需要交接的账号

1. **阿里云控制台账号** — 用于管理 ECS 实例、安全组、域名解析等
2. **服务器 SSH root 账号** — IP: 106.14.143.27
3. **GitHub 账号 Notborntodie** — 仓库所有者，仓库地址: git@github.com:Notborntodie/gespgrowplan.git

---

## 三、域名与 HTTPS

| 项目 | 值 |
|------|-----|
| 域名 | **gesp.growplan.top** |
| DNS 托管 | 需确认域名注册商（阿里云/腾讯云等），需交接域名管理账号 |
| HTTPS | 已启用，HTTP 自动重定向到 HTTPS |
| SSL 证书 | Let's Encrypt |
| 证书到期 | **2026-08-04**（剩余约 76 天） |
| 证书路径 | `/etc/letsencrypt/live/gesp.growplan.top/fullchain.pem` |
| 私钥路径 | `/etc/letsencrypt/live/gesp.growplan.top/privkey.pem` |

### SSL 证书自动续期

已配置两种自动续期机制：
- crontab：每天 03:03 执行 `acme.sh --cron`
- systemd timer：`certbot-renew.timer`

**续期后需手动 reload nginx**：`systemctl reload nginx`

---

## 四、数据库 (MySQL)

| 项目 | 值 |
|------|-----|
| 版本 | MySQL 8.0.41 |
| 地址 | 127.0.0.1:3306（本机） |
| 数据库名 | **gesp_practice_system** |
| 用户名 | **gesp_user** |
| 密码 | **Gesp@2025!** |
| 字符集 | utf8mb4_unicode_ci |

### MySQL root 密码

需要另外交接 MySQL root 用户密码（本文件无法获取）。

### 数据量概览

| 表 | 记录数 |
|----|--------|
| users | 784 |
| exams | 111 |
| questions | 1,761 |
| oj_problems | 140 |
| learning_plans | 31 |

### 完整表清单（共 45+ 张表）

核心表：users, exams, questions, options, submissions, submission_answers
OJ 表：oj_problems, oj_samples, oj_submissions
学习计划：learning_plans, learning_tasks, task_exams, task_oj_problems, user_learning_plans, user_task_progress, user_exam_progress, user_oj_progress, user_plan_progress
知识点：knowledge_points, question_knowledge_points
权限：roles, permissions, user_roles, role_permissions, teacher_students
Test 聚合考试：tests, test_exams, test_oj_problems, test_attempts
统计视图：exam_stats, user_wrong_questions, submission_stats, knowledge_point_stats 等
其他：animations, api_keys, agent_users, mcp_logs, scheduled_tasks, plan_templates, question_images, question_uploads 等

### 建表脚本

- 全量建表（新库）：`backend_server/database/create_all_tables.sql`
- Test 迁移（可重复执行）：`backend_server/database/migrate_tests.sql`
- 计划模板迁移：`backend_server/database/migrate_plan_templates.sql`
- 导出最新 schema：`cd backend_server && node scripts/export_schema_for_agent.js`

---

## 五、Redis

| 项目 | 值 |
|------|-----|
| 版本 | 6.2.19 |
| 地址 | 127.0.0.1:6379（本机） |
| 密码 | 无 |
| 运行状态 | 正常（已运行 173 天） |

---

## 六、后端服务

### 运行状态

| 项目 | 值 |
|------|-----|
| 进程管理 | PM2 |
| 进程名 | gesp-api |
| 实例数 | 4（cluster 模式，使用所有 CPU 核心） |
| 端口 | 3000（仅监听 127.0.0.1） |
| 运行状态 | online |
| 启动时间 | 2026-05-13 |
| 最大内存 | 1 GB/实例 |
| 代码路径 | `/root/SmartOI/gespgrowplan/backend_server/` |
| 入口文件 | `server.js` |

### 后端 .env 完整配置

```env
NODE_ENV=production
PORT=3000
HOST=127.0.0.1

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=gesp_practice_system
DB_USER=gesp_user
DB_PASSWORD=YOUR_DB_PASSWORD
DB_CONNECTION_LIMIT=20
DB_ACQUIRE_TIMEOUT=60000
DB_TIMEOUT=60000
DB_MAX_IDLE=60000
DB_IDLE_TIMEOUT=60000

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100
REDIS_CONNECT_TIMEOUT=10000
REDIS_COMMAND_TIMEOUT=5000

UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

BASE_URL=http://106.14.143.27
ALLOWED_ORIGINS=http://106.14.143.27,https://gesp.growplan.top,http://localhost:3000,http://localhost:5173
```

### 常用运维命令

```bash
# 重启后端
cd /root/SmartOI/gespgrowplan/backend_server
pm2 restart gesp-api

# 查看状态
pm2 status

# 查看日志
pm2 logs gesp-api

# 健康检查
curl http://localhost:3000/health

# 完整部署（含依赖安装、健康检查）
cd /root/SmartOI/gespgrowplan/backend_server
bash deploy.sh
```

---

## 七、前端服务

### 运行状态

| 项目 | 值 |
|------|-----|
| 部署方式 | 静态文件由 Nginx 托管 |
| 部署路径 | `/var/www/gesp-frontend/` |
| 动画上传目录 | `/var/www/gesp-uploads/html/`（独立于部署目录） |
| 访问地址 | https://gesp.growplan.top |
| 本地开发地址 | http://localhost:8080（Nginx 代理） |

### 前端 .deploy-config 完整配置

```
DEPLOY_SERVER_IP=106.14.143.27
DEPLOY_SERVER_USER=root
DEPLOY_PATH=/var/www/gesp-frontend
NGINX_CONFIG_PATH=/etc/nginx/conf.d/gesp-frontend.conf

DOMAIN_NAME=gesp.growplan.top

SSL_CERT_PATH=/etc/letsencrypt/live/gesp.growplan.top/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/gesp.growplan.top/privkey.pem
ENABLE_HTTPS=true

API_BASE_URL=/api
AI_API_BASE_URL=/ai-api

OJ_API_CONFIGS='[{"url":"","name":"主服务器","priority":1,"enabled":true}]'
```

### 前端部署命令

```bash
cd /root/SmartOI/gespgrowplan/frontend

# 构建并部署（推荐）
./deploy-frontend.sh --build

# 仅部署（已有 dist 目录）
./deploy-frontend.sh
```

---

## 八、AI 服务

| 项目 | 值 |
|------|-----|
| 框架 | Python FastAPI + Uvicorn |
| 端口 | 8001（监听 0.0.0.0） |
| 进程 | python3 (pid=1518968), uvicorn (pid=1517740) |
| 外部访问 | 通过 Nginx 代理 `/ai-api/` → `http://127.0.0.1:8000/api/` |
| LLM 提供商 | DashScope（智谱/阿里云） |

### 需要交接

- DashScope API Key（在 AI 服务的 .env 中，具体路径需确认）

---

## 九、Nginx 配置

### 配置文件

| 文件 | 用途 |
|------|------|
| `/etc/nginx/nginx.conf` | 主配置 |
| `/etc/nginx/conf.d/gesp-frontend.conf` | 前端 + API 反向代理（**生产环境主配置**） |
| `/etc/nginx/conf.d/gesp-local-dev.conf` | 本地开发配置（端口 8080） |

### 端口监听

| 端口 | 服务 |
|------|------|
| 80 | Nginx（HTTP，重定向到 HTTPS） |
| 443 | Nginx（HTTPS，前端 + API） |
| 8080 | Nginx（本地开发） |
| 3000 | Node.js 后端（仅 127.0.0.1） |
| 8001 | AI 服务 |
| 6379 | Redis |
| 3306 | MySQL |
| 22 | SSH |
| 5137 | 前端 Vite dev server（开发用） |

### Nginx 常用命令

```bash
# 测试配置
nginx -t

# 重载配置
systemctl reload nginx

# 重启
systemctl restart nginx

# 查看状态
systemctl status nginx

# 查看错误日志
tail -50 /var/log/nginx/error.log

# 查看 API 访问日志
tail -50 /var/log/nginx/gesp-backend-access.log
```

---

## 十、完整的需交接清单

### 1. 服务器与云平台

- [ ] 阿里云控制台账号密码（管理 ECS、安全组、域名）
- [ ] 服务器 SSH root 账号（IP: 106.14.143.27）
- [ ] 域名 gesp.growplan.top 的管理账号（DNS 解析配置权限）

### 2. 数据库

- [ ] MySQL root 密码
- [ ] MySQL 应用账号：gesp_user / Gesp@2025!（数据库名: gesp_practice_system）

### 3. Git 仓库

- [ ] GitHub 账号 Notborntodie 的访问权限（或将仓库转让）
- [ ] 仓库 SSH Key（如已配置 deploy key）

### 4. API Key / 第三方服务

- [ ] DashScope API Key（AI 服务使用，在 AI 服务的 .env 中）
- [ ] 微信小程序相关配置（AppID、AppSecret，如 miniprogram 模块在用）

### 5. SSL 证书

- [ ] Let's Encrypt 证书自动续期（已配置 acme.sh + certbot timer）
- [ ] 证书到期日：**2026-08-04**，到期前需确认续期正常

### 6. 部署相关文件路径

- [ ] 后端代码：`/root/SmartOI/gespgrowplan/backend_server/`
- [ ] 前端代码：`/root/SmartOI/gespgrowplan/frontend/`
- [ ] 前端部署目录：`/var/www/gesp-frontend/`
- [ ] 动画上传目录：`/var/www/gesp-uploads/html/`
- [ ] Nginx 配置：`/etc/nginx/conf.d/gesp-frontend.conf`
- [ ] PM2 配置：`backend_server/ecosystem.config.js`
- [ ] PM2 日志：`backend_server/logs/`
- [ ] 后端上传文件：`backend_server/uploads/`

---

## 十一、日常运维参考

### 后端更新部署

```bash
cd /root/SmartOI/gespgrowplan/backend_server
git pull
npm install           # 如有新依赖
pm2 restart gesp-api  # 重启服务
pm2 logs gesp-api     # 检查日志确认启动正常
```

### 前端更新部署

```bash
cd /root/SmartOI/gespgrowplan/frontend
git pull
./deploy-frontend.sh --build   # 构建并部署
```

### 数据库备份

```bash
mysqldump -u gesp_user -p'Gesp@2025!' gesp_practice_system > backup_$(date +%Y%m%d).sql
```

### 排查问题顺序

1. 检查服务是否在线：`pm2 status`、`curl http://localhost:3000/health`
2. 检查日志：`pm2 logs gesp-api --lines 50`
3. 检查 Nginx：`nginx -t`、`tail /var/log/nginx/error.log`
4. 检查数据库连接：`mysql -u gesp_user -p -e "SELECT 1;" gesp_practice_system`
5. 检查 Redis：`redis-cli ping`
6. 检查磁盘：`df -h`（当前 78%，需关注）
7. 检查内存：`free -h`

### 已知问题与 Bug 记录

详见 `BUG_LOG.md`，已修复的问题包括：
- BUG-001: 学生管理界面加载缓慢（SQL 笛卡尔积）
- BUG-002: 组卷时知识点标签导致白屏（类型不匹配）
- BUG-003: 计划分配页面学生列表加载缓慢（N+1 查询）
- BUG-004: 创建/上传练习后列表不刷新（KeepAlive 缓存）
- BUG-005: 图片模态框点开后无法显示（CSS 百分比高度无基准）

### 注意事项

- **磁盘空间**：当前使用 78%（29G/40G），需要定期清理日志和上传文件
- **SSL 证书**：2026-08-04 到期，需确认自动续期正常工作
- **PM2 开机自启**：已通过 `pm2 startup` 配置，重启服务器后自动恢复
- **后端 HOST=127.0.0.1**：后端仅监听本机，外部访问必须通过 Nginx 反向代理
- **agent 和 Al_server 目录**：标记为 `not used` / `no used`，已废弃，可忽略

---

## 十二、项目文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 项目 README | `README.md` | 项目总览、快速开始 |
| 后端 README | `backend_server/README.md` | 后端 API 与部署 |
| 前端 README | `frontend/README.md` | 前端开发与部署 |
| 数据库设计 | `backend_server/database/数据库.md` | 完整 ER 设计 |
| HTTPS 配置方案 | `backend_server/docs/HTTPS配置方案.md` | SSL 配置详细步骤 |
| HTTPS 配置完成 | `backend_server/docs/HTTPS配置完成.md` | 当前 HTTPS 配置记录 |
| 数据库排查 | `backend_server/docs/数据库连接问题排查.md` | 数据库问题排查指南 |
| Bug 记录 | `BUG_LOG.md` | 已修复 Bug 的详细记录 |
| GESP 课程 | `docs/GESP/` | GESP 1-4 级编程内容 |
