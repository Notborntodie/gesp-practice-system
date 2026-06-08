---
name: deploy-checklist
description: Checklist for database migrations, backend restarts, and frontend redeploys in this project. Use when the user asks whether DB needs extra steps, backend restart, or frontend redeploy after code changes.
---

# 部署与检查清单（本项目）

## 何时使用本 skill

当你在本项目中：

- 修改了数据库结构（`backend_server/database`、`scripts/init_*.sql`、`migrate_*.sql` 等）
- 修改了后端 Node 代码（`backend_server/routes`、`backend_server/scripts`、`backend_server/main.js` 等）
- 修改了前端 Vue 代码（`frontend/src`、`frontend/vite.config.ts` 等）
- 用户问「数据库还要执行什么？后端需要重启？前端需要重新部署吗？」这类问题

就按下面清单来判断并给出明确操作建议。

---

## 一、数据库相关检查

1. **是否改了表结构或初始化 / 迁移脚本**
   - 例如：
     - `backend_server/database/create_all_tables.sql`
     - `backend_server/database/migrate_*.sql`
     - `backend_server/scripts/init_*_database.js`
     - `backend_server/scripts/run_migrate_*.js`
   - 如果只是读/写数据逻辑变更（路由里的 SQL 查询条件变化），一般**不需要**额外 DB 操作。

2. **当前开发机数据库**
   - 如果已经在本机执行过相应迁移脚本（例如本次对 `bank_visible` 字段，已运行过 `node scripts/run_migrate_bank_visible.js`），可以回答：
     - 「本机数据库已执行完迁移，不用再额外操作。」

3. **其它环境（测试 / 线上）**
   - 提醒用户：其它环境需要**分别执行一次迁移**，常见两种方式：
     - 推荐：在服务所在机器运行  
       `cd backend_server && node scripts/run_migrate_xxx.js`
     - 或者：在数据库里手动执行对应的 `migrate_xxx.sql`，注意处理「列已存在」等情况。

4. **回答模板（数据库）**
   - 开发机：说明是否已经执行过迁移。
   - 其它环境：说明「需要执行同一个迁移脚本或 SQL 文件」即可。

---

## 二、后端重启检查

1. **是否修改了后端代码**
   - 例如：
     - 任意 `backend_server/routes/*.js`
     - `backend_server/llm_processor.py`、`backend_server/main.js`
     - `backend_server/scripts/*.js`（如果会在运行时被调用）
   - 只要改动了后端源码，**都需要让运行中的 Node 进程加载新代码**。

2. **按运行方式给建议**
   - 如果项目使用自动重启工具（`nodemon`、`pm2 --watch` 等）：
     - 提醒「保存后会自动重启，一般不需要手动操作；若不确定，可手动重启一次以保险」。
   - 如果是手工 `node main.js` 之类：
     - 明确建议「需要重启后端进程一次」。

3. **回答模板（后端）**
   - 「是的，后端路由有修改，**需要重启 backend 服务** 让新代码生效。」
   - 如果用户问线上环境：让他按现有发布流程做一次重启/滚动重启即可。

---

## 三、前端重新部署检查

1. **是否修改了前端代码**
   - 例如：
     - `frontend/src/**` 任意 Vue/TS/CSS 变更
     - `frontend/vite.config.ts`
   - 如果前端行为或 UI 有变化（如本次增加「题库可见」勾选，或更改 level-exams 列表行为），**线上环境必须重新打包部署**。

2. **按环境区分**
   - 开发环境（本地 `npm run dev` / `pnpm dev`）：
     - Vite dev server 会自动热更新，**无需额外部署**。
   - 线上环境：
     - 需要按照项目已有流程重新构建并发布，例如：
       - 在 `frontend` 目录下运行：`npm run build` 或 `pnpm build`
       - 然后使用（或提示使用）现有的部署脚本（如 `deploy-frontend.sh`）把 `dist` 上传到服务器。

3. **回答模板（前端）**
   - 「开发环境：dev server 会自动更新，**不需要再做什么**。」
   - 「线上环境：前端有改动，**需要重新打包 + 部署** 一次。」

---

## 四、综合回答示例

当用户问：**「数据库还要执行什么？ 后端需要重启？ 前端需要重新部署吗？」** 时，可以按以下结构回答：

1. **数据库**
   - 说明当前机器是否已执行迁移。
   - 提醒其它环境要执行同样迁移（脚本 or SQL）。

2. **后端**
   - 只要改了后端代码，就回答「需要重启一次」，并根据是否有自动重启工具做补充说明。

3. **前端**
   - 本地开发：说明 dev server 自动更新。
   - 线上：说明需要「重新 build + 部署」。

保持回答简洁，分别用三四行中文说明「数据库 / 后端 / 前端」三个部分即可。

