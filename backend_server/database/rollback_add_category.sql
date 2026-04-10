-- ================================================================
-- 回滚 category 字段（恢复到添加前的状态）
-- 创建时间：2026-04-01
-- 说明：可重复执行，用于删除 category 字段及索引
-- 警告：执行后 category 字段的数据将永久丢失！
-- ================================================================

-- 设置字符集
SET NAMES utf8mb4;

-- ================================================================
-- 1. questions 表删除 category 字段
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'questions'
    AND column_name = 'category'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE `questions` DROP COLUMN `category`',
    'SELECT ''questions.category does not exist'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 2. oj_problems 表删除 category 字段
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'oj_problems'
    AND column_name = 'category'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE `oj_problems` DROP COLUMN `category`',
    'SELECT ''oj_problems.category does not exist'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 3. exams 表删除 category 字段
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'exams'
    AND column_name = 'category'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE `exams` DROP COLUMN `category`',
    'SELECT ''exams.category does not exist'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 4. learning_plans 表删除 category 字段
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'learning_plans'
    AND column_name = 'category'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE `learning_plans` DROP COLUMN `category`',
    'SELECT ''learning_plans.category does not exist'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 5. 验证回滚结果
-- ================================================================

SELECT '====================================' AS '';
SELECT '数据库回滚完成！' AS '';
SELECT '====================================' AS '';
SELECT '已删除字段：' AS '';
SELECT '  - questions.category' AS '';
SELECT '  - oj_problems.category' AS '';
SELECT '  - exams.category' AS '';
SELECT '  - learning_plans.category' AS '';
SELECT '' AS '';
SELECT '注意：category 相关的数据已永久丢失' AS '';
SELECT '====================================' AS '';

-- 检查字段是否已删除
SELECT
    TABLE_NAME,
    CASE
        WHEN COLUMN_NAME IS NULL THEN '✓ 已删除'
        ELSE '✗ 仍存在'
    END AS status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME IN ('questions', 'oj_problems', 'exams', 'learning_plans')
AND COLUMN_NAME = 'category'
ORDER BY TABLE_NAME;
