# Bug 反馈与修复日志

> 记录项目中发现的问题、排查过程及修复方案。

---

## BUG-001: 学生管理界面加载缓慢无法显示

- **发现日期**: 2026-05-12
- **严重程度**: 高
- **影响范围**: 教师端学生管理页面 (`/teacher/students`)
- **发现人**: 用户反馈

### 问题描述

教师打开学生管理界面后，页面长时间处于加载状态，无法显示学生列表。

### 根因分析

**后端 SQL 笛卡尔积爆炸** — `GET /teacher/:teacherId/students` 接口在查询学生列表时，额外 JOIN 了 `submissions` 和 `submission_answers` 两张表，用于计算 `submission_count`、`total_answers`、`correct_answers`、`correct_rate` 四个统计字段。这导致：

- 每个学生 × 每次提交 × 每道答案 = 巨大中间结果集
- 随着做题数据增长，查询时间指数级增加，最终超时
- 而前端表格根本没使用这 4 个统计字段，只显示班级、姓名、用户名和操作

**前端错误处理缺失** — API 请求失败后只 `console.error`，用户看到的是一直转圈或空列表，无任何错误提示和重试入口。

### 修复方案

1. **后端** `backend_server/routes/teachers.js`:
   - 移除 `LEFT JOIN submissions` 和 `LEFT JOIN submission_answers`
   - 移除 4 个统计字段和 `GROUP BY`
   - 查询从多表聚合变为简单 `users JOIN teacher_students`

2. **前端** `frontend/src/views/teacher/StudentManagementView.vue`:
   - 添加 15 秒请求超时
   - 新增 `loadError` 状态，区分超时/500/其他错误
   - 模板中新增错误状态 UI：显示错误信息 + 重试按钮

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `backend_server/routes/teachers.js` | 去掉无用 JOIN，简化为双表查询 |
| `frontend/src/views/teacher/StudentManagementView.vue` | 增加超时、错误状态展示、重试按钮 |

### 验证

- 后端 `pm2 restart all` 重启
- 前端 `npm run build && ./deploy-frontend.sh` 部署
- 学生列表页面秒级加载

---

## BUG-002: 组卷时知识点标签导致白屏

- **发现日期**: 2026-05-12
- **严重程度**: 高
- **影响范围**: 管理后台 → 练习管理 → 创建练习（题库筛选知识点时）
- **发现人**: 沈天祎

### 问题描述

创建练习时，在题库中进行知识点筛选会导致白屏，浏览器回退后若不手动删除知识点筛选中的 tag，再次进行任何筛选都会导致白屏。

### 复现步骤

1. 管理后台 → 练习管理 → 创建练习
2. 点击题库筛选中的知识点标签
3. 页面变为白屏，无法继续操作

### 根因分析

**后端返回格式与前端预期不匹配** — `GET /available-questions` 接口使用 `GROUP_CONCAT(DISTINCT kp.name ...)` 拼接知识点名称，返回的 `knowledge_points` 字段是一个逗号分隔的字符串（如 `"循环, 数组"`）。但前端 `ExamEditorView.vue` 的 `filteredPool` computed 属性中，将 `it.knowledge_points` 当作**数组**来调用 `.some()`：

```javascript
const kps = it.knowledge_points || []  // 字符串 || [] → 字符串（非空字符串为 truthy）
return kps.some((kp: any) => kp.id === kpId || kp.knowledge_point_id === kpId)
// → TypeError: kps.some is not a function
```

`"循环, 数组".some()` 抛出 `TypeError`，在 Vue computed 属性中未被捕获，导致整个组件渲染崩溃 → 白屏。浏览器回退后 `poolKnowledgePointFilter` 值仍残留，组件重新挂载时 computed 立即再次触发崩溃。

**附带问题** — `QuestionList.vue` 的 `fetchKnowledgePoints()` 缺少数组校验，API 返回非数组时 `.map()` 也会崩溃导致白屏。

### 修复方案

1. **后端** `backend_server/routes/exams.js` (`/available-questions`):
   - 去掉 `GROUP_CONCAT` 和 `LEFT JOIN question_knowledge_points/knowledge_points`
   - 先查题目基本信息，再批量查知识点关联并组装为数组对象格式
   - `knowledge_points` 从字符串 `"循环, 数组"` 变为数组 `[{id, name, category, level}, ...]`

2. **前端** `frontend/src/components/admin/ExamEditorView.vue`:
   - `filteredPool` 中知识点筛选增加类型判断：字符串跳过，数组正常筛选，兼容两种格式

3. **前端** `frontend/src/components/admin/QuestionList.vue`:
   - `fetchKnowledgePoints()` 增加 `Array.isArray` 校验和 catch 中置空

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `backend_server/routes/exams.js` | `/available-questions` 改为两步查询，返回知识点数组对象 |
| `frontend/src/components/admin/ExamEditorView.vue` | 知识点筛选增加类型安全判断 |
| `frontend/src/components/admin/QuestionList.vue` | `fetchKnowledgePoints` 增加数组校验 |

### 验证

- 后端 `pm2 restart all` 重启
- 前端 `npm run build && ./deploy-frontend.sh` 部署
- 创建练习页面选择知识点筛选不再白屏，知识点按 ID 正确匹配

---

## BUG-003: 计划分配页面学生列表加载缓慢

- **发现日期**: 2026-05-12
- **严重程度**: 中
- **影响范围**: 教师端 → 计划分配页面 (`/teacher/plan-assignment`) 选择计划后加载学生列表
- **发现人**: 用户反馈

### 问题描述

计划分配页面选择学习计划后，学生列表加载缓慢，需要等待较长时间才能显示已加入/未加入学生的分组。

### 根因分析

**N+1 查询问题** — 计划分配页调用了 `GET /teacher/:teacherId/learning-plans/:planId/all-students-progress` 接口来获取已加入学生列表。该接口为每个学生循环执行多次查询：

- 1 次查 `user_plan_progress`
- 每个任务 3 次：`user_task_progress` + 客观题完成统计 + OJ 完成统计
- 1 次查 `teacher_students` 绑定关系

每个学生执行 `1 + 任务数×3 + 1` 次查询。50 个学生、5 个任务 = **350 次 SQL 查询**。

而计划分配页面根本不需要这些进度详情数据，只需要知道**哪些学生 ID 已加入该计划**。

### 修复方案

1. **后端新增轻量接口** `backend_server/routes/learningPlans.js`:
   - 新增 `GET /learning-plans/:planId/student-ids`
   - 只执行一条 SQL：`SELECT user_id FROM user_learning_plans WHERE plan_id = ?`
   - 返回 `{ success: true, data: [1, 2, 3, ...] }`

2. **前端** `frontend/src/views/teacher/PlanAssignmentView.vue`:
   - `fetchJoinedStudents` 改用新轻量接口，从 350 次查询降为 1 次
   - 切换计划时复用已加载的学生列表，避免重复请求 `fetchStudents()`
   - 刷新操作也做同样优化

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `backend_server/routes/learningPlans.js` | 新增 `GET /learning-plans/:planId/student-ids` 轻量接口 |
| `frontend/src/views/teacher/PlanAssignmentView.vue` | 改用轻量接口，复用学生列表缓存 |

### 验证

- 后端 `pm2 restart all` 重启
- 前端 `npm run build && ./deploy-frontend.sh` 部署
- 计划分配页选择计划后学生列表秒级加载

---

## BUG-004: 创建/上传练习后练习列表不刷新

- **发现日期**: 2026-05-13
- **严重程度**: 中
- **影响范围**: 管理后台 → 练习管理页面 (`/admin/exams`)
- **发现人**: 用户反馈

### 问题描述

创建练习或上传练习成功后，返回练习列表页面，列表未更新，新创建的练习不显示，需要手动刷新页面才能看到。

### 根因分析

**KeepAlive 缓存未触发刷新** — `ExamManagement.vue` 被 `AdminLayout.vue` 的 `<KeepAlive>` 缓存，从 ExamEditor 或 ExamBatchUpload 页面返回时，组件不会重新执行 `onMounted`，而是从缓存中恢复。此时列表数据仍是旧数据，不会重新请求 API。

**goBack 使用硬刷新绕过了 Vue 路由** — `ExamEditorView.vue` 和 `ExamBatchUploadView.vue` 的 `goBack` 函数使用 `window.location.href = '/admin/exams'` 做整页跳转，虽然能刷新数据，但丢失了 Vue SPA 的路由体验和 KeepAlive 缓存优势。

**上传练习成功后未跳转** — `ExamBatchUploadView.vue` 提交成功后只是重置了表单状态停留在本页，没有导航回练习列表。

### 修复方案

1. **ExamManagement.vue**: 添加 `onActivated` 生命周期钩子，KeepAlive 重新激活时调用 `fetchExams(true)` 强制刷新
2. **ExamEditorView.vue**: `goBack` 从 `window.location.href` 改为 `router.push('/admin/exams')`，配合 KeepAlive 触发 onActivated 刷新
3. **ExamBatchUploadView.vue**: `goBack` 同样改为 `router.push`；成功弹窗 1.5s 后自动 `router.push('/admin/exams')` 跳转回列表

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `frontend/src/components/admin/ExamManagement.vue` | 添加 `onActivated` 钩子强制刷新列表 |
| `frontend/src/components/admin/ExamEditorView.vue` | `goBack` 改用 `router.push`，新增 `useRouter` 导入 |
| `frontend/src/components/admin/ExamBatchUploadView.vue` | `goBack` 改用 `router.push`，成功后自动跳转回列表 |

### 验证

- 前端 `npm run build && ./deploy-frontend.sh` 部署
- 创建练习 → 保存 → 自动返回列表 → 新练习立即显示
- 上传练习 → 提交 → 弹窗提示 → 自动返回列表 → 新练习立即显示

---

## BUG-005: 图片模态框点开后图片无法显示

- **发现日期**: 2026-05-28
- **严重程度**: 中
- **影响范围**: 练习页题目图片弹窗（`/plan-exam/:examId`、`/exam/:examId`、管理后台题库图片查看）
- **发现人**: 用户反馈

### 问题描述

题目图片点击放大后，模态框内图片无法显示或尺寸不正常，原因是图片的 `max-height: 100%` 依赖父容器的显式高度，而父容器 `.image-modal-content` 只有 `max-height: 90%` 无固定 `height`，百分比计算无基准。

### 根因分析

**.image-modal-content 缺少基准高度** — 所有图片模态框的 CSS 结构为：

```css
.image-modal-content {
  max-width: 90%;    /* 基准不明确 */
  max-height: 90%;   /* 基准不明确 */
}

.modal-image {
  max-width: 100%;   /* 依赖父容器宽度 → OK */
  max-height: 100%;  /* 依赖父容器高度 → ❌ 无基准 */
}
```

父容器 `.image-modal-content` 是 `flex-direction: column` 的 flex 容器，其实际高度由内容撑开。图片的 `max-height: 100%` 因为没有明确的父容器高度引用而解析为无效值，导致图片不显示或显示异常。

### 修复方案

将原来依赖百分比的尺寸改为使用视口单位（vw/vh），不依赖父容器高度：

1. **`.image-modal-content`**: `max-width: 90%` → `max-width: 90vw`，`max-height: 90%` → `max-height: 90vh`
2. **`.modal-image`**: `max-width: 100%` → `max-width: 90vw`，`max-height: 100%` → `max-height: 85vh`，新增 `width: auto; height: auto`

同时给 `QuestionList.vue` 的 `.image-modal-content` 补充了 `display: flex` 相关属性（之前缺少 flex 布局）。

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `frontend/src/views/PlanExamView.vue` | `.image-modal-content` 改用 vw/vh + `justify-content: center`；`.modal-image` 改用 vw/vh + `width/height: auto` |
| `frontend/src/views/GESPEaxmView.vue` | 同上 |
| `frontend/src/components/admin/QuestionList.vue` | 同上，额外补充 `display: flex`、`align-items: center`、`justify-content: center` |

### 验证

- 前端 `npm run build && ./deploy-frontend.sh` 部署后验证
- 练习页点击题目图片 → 模态框正常显示大图
- 管理后台题库点击图片 → 模态框正常显示大图

---
