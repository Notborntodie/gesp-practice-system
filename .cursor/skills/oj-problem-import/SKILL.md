---
name: oj-problem-import
description: 在本项目中录入 OJ 题目与测试点到数据库的完整流程。Use when the user wants to add a new OJ problem, import GESP-style problems, create test cases for oj_problems/oj_samples, or run scripts to sync samples and clear problem cache.
---

# 录入 OJ 题目 (gespgrowplan)

在本项目中新增一道 OJ 题需要：**题目表一条记录 + 若干测试点**。题目与测试点会走 Redis 缓存，改库后需清缓存。

## 表结构速览

| 表 | 关键字段 |
|----|----------|
| **oj_problems** | id, title, description, input_format, output_format, data_range, time_limit, memory_limit, level, publish_date, bank_visible |
| **oj_samples** | problem_id, input, output, explanation, is_hidden, is_displayed, sort_order |

- `is_hidden`: 提交后是否不显示该点详情（true=提交后 hide，false=提交后展示）
- `is_displayed`: 查看题目时是否展示该样例（**仅第 1 个测试点设为 true，作为题面样例**）

OJ 题目的「是否公开」主要由：

- `oj_problems.bank_visible`：1=题库可见，0=题库不可见；**仅影响 level-exams 题库列表**，计划与 Test 中仍可使用该题；
- `oj_problems.publish_date`：为空或小于等于当前日期时，视为已经上线；大于当前日期可以用作「预发布」。

常用约定：

- **公开的刷题题库题**：`bank_visible=1`，`publish_date` 设为「实际上线日期」（或今天）；
- **暂不在题库中单独展示的内部题**：`bank_visible=0`，但可以通过学习计划或 Test 关联给学生做。

**测试点约定（10 个时）**：第 1 个为样例点（`is_displayed=true`，仅此一个在题面展示）；第 1～5 个提交时展示（`is_hidden=false`）；第 6～10 个提交时隐藏（`is_hidden=true`）。

详见 `backend_server/database/数据库.md` 中「OJ（在线判题）实体类」。

## 录入流程总览

1. **题目描述 / 输入格式 / 输出格式 / 数据范围 / 分析**：都写成 Markdown 文本，**数学一律用 `$...$` 或 `$$...$$`**（与「幂和数」一致，可参考 `backend_server/scripts/converted_problems/level_2/problem_2__GESP202506_二级__幂和数.json`），不要使用 `\(` `\)` 或 `\[` `\]` 这类写法。
2. **参考代码**：根据题目描述编写 C++ 参考实现（保存为 `scripts/<题名>_ref.cpp`），编译成可执行文件，用于**对每组输入运行得到标准输出**；若用户已提供则沿用并整理为可编译的 `*_ref.cpp`。
3. **输入生成脚本**：按题目逻辑编写脚本（如根据 M、N、H、seed 等参数**确定性生成**符合题意的输入），**禁止由 LLM 或人工手写具体测试数据**。脚本运行后生成多组 input（可输出到 JSON 的 `input` 字段或中间文件），**必须覆盖：正常情况 + 所有分支 + 关键边界（极大/极小值、恰好等于阈值等）**。
4. **输出由参考代码生成**：对脚本生成的每一组 input，**运行参考代码**（stdin 为该 input），将参考代码的 stdout 作为该测试点的 output。不得手算、不得在脚本里用“等价逻辑”直接算 output，必须通过运行参考代码得到；**任何时刻修改参考代码后，都要重新跑生成脚本，保证 output 与最新逻辑一致**。
5. **写入数据库**：插入 `oj_problems`，再插入多条 `oj_samples`（或先删该题旧样例再插）。
6. **清缓存**：执行 `node scripts/clear_problem_cache.js <题目ID>`，否则前端可能仍看到旧题目/旧样例。

## 脚本位置与用法（索引集中在这里）

均在 `backend_server/` 下执行（需配置 `.env` 与数据库、Redis）。

| 用途 | 脚本 | 说明 |
|------|------|------|
| 清某题缓存 | `node scripts/clear_problem_cache.js <problemId>` | 清除 `cache:oj:problem:*`、`cache:oj:samples:*` 及题目列表相关键 |
| 参考录入示例 | `scripts/insert_golden_grid_problem.js` | 插入题目 + 从 `golden_grid_tests.json` 读测试点插入；可复制改造成新题 |
| 生成「黄金格」测试点 JSON | `scripts/gen_golden_grid_tests.js` | ① 按题目逻辑生成 10 组 input；② 优先调用 `golden_grid_ref` 参考程序得到 output；③ 输出 `golden_grid_tests.json` |
| 「黄金格」参考代码 | `scripts/golden_grid_ref.cpp` | 二级题 [黄金格] 的 C++ 参考实现，编译为 `golden_grid_ref` 提供给生成脚本调用 |
| 仅同步「黄金格」测试点 | `scripts/sync_golden_grid_samples.js` | 先 DELETE 该题所有 oj_samples，再按 `golden_grid_tests.json` INSERT；需在脚本内配置目标 problem_id |
| 录入 GESP1 模拟题（公开） | `scripts/insert_gesp1_mock_problems.js` | 一次性插入 `[GESP 1级 模拟1] 小杨的周末购物` 与 `[GESP 1级 模拟2] 测验统计`，两题均设置为 `bank_visible=1`，publish_date 为当日 |
| 生成「周末购物」测试点 JSON | `scripts/gen_gesp1_mock1_shopping_tests.js` | 使用确定性规则生成 10 组 `(p, n)`，调用 `gesp1_mock1_shopping_ref` 得到 output，输出 `gesp1_mock1_shopping_tests.json` |
| 「周末购物」参考代码 | `scripts/gesp1_mock1_shopping_ref.cpp` | 一年级模拟题「小杨的周末购物」的 C++ 参考实现，编译为 `gesp1_mock1_shopping_ref` |
| 生成「测验统计」测试点 JSON | `scripts/gen_gesp1_mock2_exam_stats_tests.js` | 使用确定性规则生成多种分布的分数数组，调用 `gesp1_mock2_exam_stats_ref` 得到 output，输出 `gesp1_mock2_exam_stats_tests.json` |
| 「测验统计」参考代码 | `scripts/gesp1_mock2_exam_stats_ref.cpp` | 一年级模拟题「测验统计」的 C++ 参考实现，编译为 `gesp1_mock2_exam_stats_ref` |
| 同步 GESP1 模拟题测试点 | `scripts/sync_gesp1_mock_samples.js` | 使用最新 JSON 覆盖更新 problem_id=129/130 的 `oj_samples`，便于调优测试点后一键同步 |

## 题目描述格式

- **数学公式**：行内用 `$...$`，例如 `$\\sqrt{r^2 + c^2} \\leq x + r - c$`（JS 字符串中 `\\` 表示一个 `\`）。
- **参考**：与「[GESP202506 二级] 幂和数」一致，前端才能正确渲染；勿用 `\( \)` 或仅纯文本公式。

## 测试点设计建议（含强度要求）

- **数量**：通常 10 个。
- **样例与展示/隐藏**：
  - **只设第 1 个为样例**：`is_displayed=true` 仅给 `sort_order=1`，题面只展示这一组。
  - **1～5**：提交后展示（`is_hidden=false`）。
  - **6～10**：提交后隐藏（`is_hidden=true`）。
- **输入必须由脚本按题目逻辑生成**：在生成脚本中根据题目含义定义参数（如 M、N、H、seed），用确定性逻辑生成每一组输入（例如矩阵按公式或伪随机生成），**不得用 LLM 或人工手写一长串具体数字**。  
  - 禁止的做法：让 LLM/人工先产出一堆具体输入，再「抄写」到 `gen_*_tests.js` 或 `*_tests.json` 里当成固定数组。  
  - 允许的做法：由人或 LLM 设计「生成规律」，再用脚本实现该规律，让脚本自己算出所有 input。  
  - 要求：脚本运行一次即得到全部 input，**同一版本脚本 + 参考代码多次运行结果必须完全一致（可复现）**。
- **输出必须由参考代码运行得到**：对上述每组 input，在脚本中**调用参考代码**（如 `child_process.execSync` 将 input 作为 stdin 传入），以参考代码的 stdout 作为该测试点的 output。**禁止**在脚本里复现“等价逻辑”来算 output，也禁止手算、手写，以避免与参考实现不一致或笔误导致正确代码被判错。
- **参考代码**：无现成代码时，根据题面实现 C++ 参考程序（`scripts/<题名>_ref.cpp`），编译后供生成脚本调用；题面样例可单独写死在脚本中（仅第一组），其余组由脚本生成 input 再跑参考代码得 output。

### 强测试覆盖 checklist

录入或修改一题前，请检查以下项目，确保测试点「够强」：

1. **所有分支是否都被覆盖**  
   - if/else / 多重分支（例如「不打折 / 只打折 / 打折+满减」）每个分支至少有 1 个测试点。  
   - 对于循环 + 条件类题目，需覆盖「从未满足条件」「只满足一次」「多次满足」等情况。
2. **关键边界是否被覆盖**  
   - 阈值点：恰好等于、略小于、略大于（如 59/60、89/90、99/100）。  
   - 输入规模：最小值、常规值、最大/接近最大值（如 1、若干中等值、上界 Nmax）。  
3. **数据规模是否足够**  
   - 至少有 1～2 组「较大规模」输入（例如 n 很大、矩阵边长较大），避免只用极小样例。  
   - 对于 1 级题：规模不需卡性能，但要让低复杂度错误（如少循环/少读一行）暴露出来。  
4. **是否能区分常见错误解**  
   - 尝试在脑中列举 2～3 种学生常犯错误（如「没处理某一分支」「少等号」「计数条件写错」），确保至少有若干测试点能把这些错误区分出来。  
5. **生成逻辑是否简单可维护**  
   - 生成脚本应使用清晰的公式/循环，而不是硬编码长数组；  
   - 如需“看上去随机”，使用固定 seed 的伪随机或简单规律，保证可复现。

## 测试点生成标准流程（输入→参考代码→输出）

1. **按题目逻辑写输入生成**：在 `gen_*_tests.js` 中根据题目定义参数（如 M、N、H、seed），用确定性脚本逻辑生成每一组 input，不手写/不交给 LLM 生成具体数据。
2. **脚本运行得到 input**：执行 `node gen_*_tests.js`，脚本内对每组参数生成 input 字符串或文件。
3. **参考代码生成 output**：对每组 input，在脚本中调用已编译的参考程序（stdin 传入 input），将其 stdout 作为该测试点的 output；脚本输出最终 `{ input, output, ... }[]` 写入 `*_tests.json`。

题面样例（第 1 组）可在脚本中写死 input（与题面一致），其 output 也需用参考代码对该 input 跑一遍得到，保证一致。

## 完整示例：黄金格

1. 题目内容写进 `insert_golden_grid_problem.js` 的 `PROBLEM`（或单独 SQL/脚本）。
2. 测试点：`gen_golden_grid_tests.js` 按题目逻辑生成 10 组 input，对每组运行参考代码得到 output，写出 `golden_grid_tests.json`（第 1 个为样例 `is_displayed=true`，1～5 为 `is_hidden=false`，6～10 为 `is_hidden=true`）。
3. 入库：运行 `insert_golden_grid_problem.js` 首次录入；若只更新测试点则用 `sync_golden_grid_samples.js`（需把题目 id 改为目标题）。
4. 清缓存：`node scripts/clear_problem_cache.js 124`（124 为黄金格题目 id）。

## 修改已有题目的测试点后

- 更新 `oj_samples` 后务必执行：`node scripts/clear_problem_cache.js <题目ID>`，否则接口会继续返回缓存的旧样例。
