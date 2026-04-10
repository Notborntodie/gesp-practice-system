-- ================================================================
-- 添加 category 字段支持多类型题目
-- 创建时间：2026-04-01
-- 说明：可重复执行，用于给 questions、oj_problems、exams、learning_plans 添加 category 字段
-- ================================================================

-- 设置字符集
SET NAMES utf8mb4;

-- ================================================================
-- 1. questions 表添加 category 字段
-- ================================================================

-- 检查并添加 category 字段
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'questions'
    AND column_name = 'category'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `questions` ADD COLUMN `category` ENUM(''GESP'', ''CSP'', ''NOI'', ''其他'') NOT NULL DEFAULT ''GESP'' COMMENT ''题目类型：GESP/CSP/NOI/其他'' AFTER `level`, ADD INDEX `idx_category` (`category`)',
    'SELECT ''questions.category already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 2. oj_problems 表添加 category 字段
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'oj_problems'
    AND column_name = 'category'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `oj_problems` ADD COLUMN `category` ENUM(''GESP'', ''CSP'', ''NOI'', ''其他'') NOT NULL DEFAULT ''GESP'' COMMENT ''题目类型：GESP/CSP/NOI/其他'' AFTER `level`, ADD INDEX `idx_category` (`category`)',
    'SELECT ''oj_problems.category already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 3. exams 表添加 category 字段
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'exams'
    AND column_name = 'category'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `exams` ADD COLUMN `category` ENUM(''GESP'', ''CSP'', ''NOI'', ''其他'') NOT NULL DEFAULT ''GESP'' COMMENT ''考试类型：GESP/CSP/NOI/其他'' AFTER `level`, ADD INDEX `idx_category` (`category`)',
    'SELECT ''exams.category already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 4. learning_plans 表添加 category 字段
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'learning_plans'
    AND column_name = 'category'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `learning_plans` ADD COLUMN `category` ENUM(''GESP'', ''CSP'', ''NOI'', ''其他'') NOT NULL DEFAULT ''GESP'' COMMENT ''计划类型：GESP/CSP/NOI/其他'' AFTER `level`, ADD INDEX `idx_category` (`category`)',
    'SELECT ''learning_plans.category already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 5. 验证迁移结果
-- ================================================================

-- 显示各表的 category 字段信息
SELECT
    '====================================' AS '';
SELECT '数据库迁移完成！' AS '';
SELECT '====================================' AS '';
SELECT '已添加字段：' AS '';
SELECT '  - questions.category' AS '';
SELECT '  - oj_problems.category' AS '';
SELECT '  - exams.category' AS '';
SELECT '  - learning_plans.category' AS '';
SELECT '' AS '';
SELECT '旧数据默认值：category = ''GESP''' AS '';
SELECT '' AS '';
SELECT '字段信息：' AS '';
SELECT '  类型：ENUM(''GESP'', ''CSP'', ''NOI'', ''其他'')' AS '';
SELECT '  默认值：''GESP''' AS '';
SELECT '  索引：idx_category' AS '';
SELECT '' AS '';
SELECT '后续步骤：' AS '';
SELECT '1. 更新后端验证逻辑' AS '';
SELECT '2. 更新前端UI组件' AS '';
SELECT '3. 测试验证' AS '';
SELECT '====================================' AS '';

-- 检查字段是否创建成功
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    COLUMN_TYPE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND COLUMN_NAME = 'category'
AND TABLE_NAME IN ('questions', 'oj_problems', 'exams', 'learning_plans')
ORDER BY TABLE_NAME;
