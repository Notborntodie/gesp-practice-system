---
name: gesp-mock-oj-create
description: 在本项目中基于已有 GESP 真题风格，系统化创建新的 GESP 模拟 OJ 题（含参考代码与测试点）的流程。
---

# 创建 GESP 模拟 OJ 题流程

本 SKILL 用于指导「如何在本项目中新增一套 **符合 GESP 风格** 的模拟 OJ 题」，并保证：

- 题面风格与难度与真实 GESP 题对齐；
- 测试点由脚本按题目逻辑**确定性生成**，输出由参考代码生成，强度足够；
- 题目与测试点正确写入数据库并在前端生效。

## 步骤 1：先看库里的 GESP 真题，摸清规律

1. 从数据库或导出脚本（如 `backend_server/scripts/export_gesp_level1_data.js`）中，查看目标级别（如 1 级）的现有 GESP 真题 / 模拟题。
2. 总结该级别的共性：
   - **题型**：数学应用、循环输入、枚举、进位运算等；
   - **难度**：计算复杂度、数据范围、边界设置；
   - **输入/输出格式**：是否多组数据、是否有小数、格式化输出要求；
   - **描述风格**：口语程度、变量命名、是否配图示例等。
3. 新题必须在题型、难度与叙述风格上尽量贴近真实 GESP 题，而不是完全“另起炉灶”。

## 步骤 2：设计题面（对齐真实 GESP 风格）

1. 确定本题的：
   - `level`（如 1）；
   - 主要考点组合（如「多重分支 + 金额边界」或「循环输入 + 分类计数」）。
2. 编写题面字段：
   - `title`：建议包含 `[GESP X级 模拟N]` 前缀；
   - `description`：用 GESP 风格中文描述题意，可配简单示例说明含义；
   - `input_format` / `output_format`：结构化描述输入输出形式；
   - `data_range`：清晰给出变量范围和边界；
   - `analysis`：简要说明解题思路与考点；
   - `level`：填入对应 GESP 级别。
3. 数学公式用 `$...$` 包裹，参考「幂和数」的格式。

## 步骤 3：编写 C++ 参考代码并编译

1. 在 `backend_server/scripts` 下新建参考代码文件：
   - 命名示例：`<题名英文或缩写>_ref.cpp`，例如：
     - `gesp1_mock1_shopping_ref.cpp`
     - `gesp1_mock2_exam_stats_ref.cpp`
2. 要求：
   - 严格按照题面逻辑实现；
   - 全部分支与关键边界（如 = 阈值、略小、略大）都要正确处理；
   - 使用标准输入输出（`cin/cout` 或 `scanf/printf`）。
3. 在 `backend_server/scripts` 目录编译：

```bash
cd backend_server/scripts
g++ -O2 -std=c++17 <ref.cpp> -o <ref_binary>
```

示例：

```bash
g++ -O2 -std=c++17 gesp1_mock1_shopping_ref.cpp -o gesp1_mock1_shopping_ref
g++ -O2 -std=c++17 gesp1_mock2_exam_stats_ref.cpp -o gesp1_mock2_exam_stats_ref
```

## 步骤 4：编写测试点生成脚本 `gen_*_tests.js`

目标：**由脚本按题意「确定性」生成输入，再用参考代码生成输出**，而不是手写具体数据。

1. 在 `backend_server/scripts` 下新增生成脚本：
   - 命名示例：
     - `gen_gesp1_mock1_shopping_tests.js`
     - `gen_gesp1_mock2_exam_stats_tests.js`
2. 生成脚本职责：
   - 用**规则/公式/seed** 生成多组输入（input）：
     - 覆盖所有逻辑分支（例如：不打折 / 只打折 / 打折+满减）；
     - 覆盖关键边界：阈值点（如 59/60、89/90、100/150 等）、极小值/极大值；
     - 包含若干「较大规模」数据，避免只用极小样例。
   - 对每组 input 调用参考二进制程序（`child_process.execSync` + stdin）生成 output。
   - 输出数组形如：

```js
{
  input: string,
  output: string,
  is_hidden: boolean,
  is_displayed: boolean,
  sort_order: number,
  explanation?: string | null,
}[]
```

3. **禁止**的做法：
   - 先让 LLM 或人工列出一堆具体输入，再「抄写」到 `gen_*_tests.js` 或 `*_tests.json` 里当固定数组。
4. **允许**的做法：
   - 由人或 LLM 设计「生成规律」，再在脚本里实现该规律（循环/公式/伪随机等），**由脚本自己算出所有 input**。
5. 要求：
   - 同一版本「生成脚本 + 参考代码」多次运行，产出的所有 `{input, output}` 必须完全一致（可复现）。

## 步骤 5：设置展示规则并生成 `*_tests.json`

测试点展示约定（以 10 个测试点为例）：

- 第 1 个：样例点 — `sort_order=1`，`is_displayed=true`，`is_hidden=false`（题面展示 + 提交后展示）；
- 第 2～5 个：正常展示 — `is_displayed=false`，`is_hidden=false`（提交后展示明细，但题面不展示）；
- 第 6～10 个：隐藏点 — `is_displayed=false`，`is_hidden=true`（提交后不展示明细）。

在生成脚本中按 `sort_order` 自动设置上述字段，然后运行：

```bash
node gen_<...>_tests.js
```

生成如：

- `golden_grid_tests.json`
- `gesp1_mock1_shopping_tests.json`
- `gesp1_mock2_exam_stats_tests.json`

## 步骤 6：编写插入脚本，写入 `oj_problems` + `oj_samples`

1. 参考现有脚本：
   - `backend_server/scripts/insert_golden_grid_problem.js`
   - `backend_server/scripts/insert_gesp1_mock_problems.js`
2. 插入脚本做的事：
   - 准备一个 `PROBLEM` 或 `PROBLEMS` 对象，填充：
     - `title, description, input_format, output_format, data_range, analysis`
     - `time_limit, memory_limit, level, publish_date, bank_visible`
   - 执行 SQL：
     - `INSERT INTO oj_problems (...) VALUES (...)`，得到 `problemId`；
     - 读取对应的 `*_tests.json`，循环执行：

```sql
INSERT INTO oj_samples
  (problem_id, input, output, explanation, is_hidden, is_displayed, sort_order)
VALUES
  (?, ?, ?, ?, ?, ?, ?)
```

3. `bank_visible` / `publish_date` 控制题目是否在题库中公开：
   - 刷题题库公开题：`bank_visible=1`，`publish_date` 为上线日期或当天；
   - 仅在计划 / Test 中使用的内部题：`bank_visible=0`。

## 步骤 7：如需调优测试点，用同步脚本覆盖更新

当你想增强一题的测试点（但题面不变）时：

1. 先修改参考代码或 `gen_*_tests.js`：
   - 确保分支、边界、规模覆盖更强；
   - 重新运行 `node gen_*_tests.js` 生成新的 `*_tests.json`。
2. 使用「同步测试点」脚本覆盖数据库中原有样例，例如：
   - `scripts/sync_golden_grid_samples.js`（黄金格）
   - `scripts/sync_gesp1_mock_samples.js`（GESP1 模拟题）
3. 同步脚本逻辑：
   - `DELETE FROM oj_samples WHERE problem_id = ?`；
   - 从最新的 `*_tests.json` 读取所有样例并重新 `INSERT`。

## 步骤 8：清缓存让新题生效

每次更新某题的 `oj_problems` 或 `oj_samples` 后，必须清理 Redis 缓存，否则前端仍然可能看到旧数据。

在 `backend_server` 目录执行：

```bash
node scripts/clear_problem_cache.js <题目ID>
```

对多题依次执行一遍即可。

