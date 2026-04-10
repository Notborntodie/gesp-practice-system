-- 为 oj_problems 和 exams 增加「题库可见」字段
-- 仅影响 level-exams 题库列表展示；计划与测试仍可使用不可见题目/考试。
-- 执行前请备份数据库。若表已有 bank_visible 列，请先跳过对应 ALTER 或使用 run_migrate_bank_visible.js。

-- 1. oj_problems 增加 bank_visible
ALTER TABLE `oj_problems`
  ADD COLUMN `bank_visible` tinyint(1) NOT NULL DEFAULT '1'
  COMMENT '题库可见：1=可见 0=不可见（仅影响 level-exams 题库列表）'
  AFTER `accepted_submissions`;

-- 2. exams 增加 bank_visible
ALTER TABLE `exams`
  ADD COLUMN `bank_visible` tinyint(1) NOT NULL DEFAULT '1'
  COMMENT '题库可见：1=可见 0=不可见（仅影响 level-exams 题库列表）'
  AFTER `type`;

-- 3. 已有数据设为可见
UPDATE `oj_problems` SET `bank_visible` = 1 WHERE 1=1;
UPDATE `exams` SET `bank_visible` = 1 WHERE 1=1;
