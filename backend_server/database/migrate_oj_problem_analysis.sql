-- 为 oj_problems 增加「文本解析」字段，用于 Test「我的解析」展示官方解析
-- 执行前请先备份数据库。

ALTER TABLE `oj_problems`
  ADD COLUMN `analysis` text COMMENT '题目文字解析说明，用于 Test「我的解析」展示官方解析' AFTER `data_range`;

