-- 将两套 7 级 exam 的 level 设为 7（GESP 级别统一为 1-8 后使用）
-- 按名称匹配 7 级试卷并更新
UPDATE exams SET level = 7 WHERE name LIKE '%7级%' OR name LIKE '%GESP 7%';
