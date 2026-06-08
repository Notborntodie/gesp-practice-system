---
name: create-objective-mock-exam
description: 在本项目中从 GESP 某级别客观题题库随机抽题组卷（客观题模拟卷）的流程。Use when the user wants to create an objective mock exam, 组卷, 客观题模拟卷, 从题库抽题组卷, or 模拟卷 前15选择后10判断.
---

# 创建客观题模拟卷 (gespgrowplan)

从 **Questions** 表中按 GESP 级别筛选客观题，按选项数区分选择题与判断题，随机抽取指定数量组卷，写入 **exams** 与 **exam_questions**。形式与「2025年12月 GESP 1级真题」类似：前 15 道选择题、后 10 道判断题（共 25 道），类型为「模拟」。

## 表结构速览

| 表 | 关键字段 |
|----|----------|
| **exams** | id, name, level, description, type, total_questions, bank_visible |
| **exam_questions** | exam_id, question_id, question_number |
| **questions** | id, level, question_text, correct_answer, ... |
| **options** | question_id, option_label, option_value, option_text |

- **选择题**：该题在 `options` 表中的记录数 **> 2**（如 A/B/C/D）。
- **判断题**：该题在 `options` 表中的记录数 **= 2**（如 正确/错误 或 仅两个选项）。

`exams.bank_visible`：1=在按级别展示的题库列表中可见，0=不在题库列表展示（计划与 Test 仍可使用）。

详见 `backend_server/database/数据库.md` 中 Exams、Questions、Options、exam_questions。

## 组卷流程

1. **按级别统计题目与选项数**  
   查询 `questions`（`level = 目标级别`）并 `LEFT JOIN options`，按 `question_id` 分组，`COUNT(o.id)` 得到每题选项数。
2. **分类**  
   - 选项数 > 2 → 选择题池  
   - 选项数 = 2 → 判断题池  
3. **校验数量**  
   若选择题池 < 15 或 判断题池 < 10，直接报错并退出。
4. **随机抽取**  
   从选择题池中随机取 15 道，从判断题池中随机取 10 道（Fisher-Yates 或等价 shuffle），按顺序组成 25 道题（前 15 选择，后 10 判断）。
5. **写入数据库**  
   - 插入 **exams**：`name`、`level`、`description`、`type='模拟'`、`total_questions=25`、`bank_visible`（按需，如 0 或 1）。  
   - 插入 **exam_questions**：`exam_id`、`question_id`、`question_number` 为 1～25。
6. **可选**  
   若不需要在题库列表展示，执行 `UPDATE exams SET bank_visible = 0 WHERE name = ?`。

若已存在同名考试，应先跳过创建并提示，或要求用户先删除/改名后再运行，避免重复组卷。

## 脚本位置与用法

| 用途 | 脚本 | 说明 |
|------|------|------|
| 创建「GESP 1级模拟1」 | `backend_server/scripts/create_gesp1_mock1_exam.js` | 从 level=1 客观题中随机抽 15 选择 + 10 判断，插入 exams 与 exam_questions；默认 `bank_visible=1`，可事后改为 0 |

在 `backend_server/` 下执行（需配置 `.env` 与数据库）：

```bash
cd backend_server && node scripts/create_gesp1_mock1_exam.js
```

设置该模拟卷不在题库列表展示：

```bash
# 在 backend_server 下用 node -e 或写小脚本执行：
# UPDATE exams SET bank_visible = 0 WHERE name = 'GESP 1级模拟1';
```

## 扩展为其他级别或模拟卷

- **其他级别**：修改脚本中 `WHERE q.level = 1` 为目标 level，并相应修改考试 `name`、`level`、`description`。
- **同一级别多套模拟**：考试名改为不同名称（如「GESP 1级模拟2」），脚本内「已存在同名考试」的检查会避免覆盖；可复制脚本并替换名称与 level。
- **题量变化**：若需非 15+10（如 20+5），修改 `needChoice`、`needJudge` 及 `total_questions`，并确保对应题目池数量足够。

## 参考实现要点（与脚本一致）

- 区分选择/判断仅依据 **选项条数**（2 为判断，>2 为选择），不依赖 `question_type` 等其它字段。
- 随机使用 Fisher-Yates shuffle 后 `slice(0, needChoice)` / `slice(0, needJudge)`。
- 先查是否已有同名 exam，有则不再插入并提示。
