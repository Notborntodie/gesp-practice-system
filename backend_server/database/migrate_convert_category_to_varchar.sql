-- ================================================================
-- 将 category 字段从 ENUM 转换为 VARCHAR
-- 创建时间：2026-04-01
-- 说明：question_types 表已存在，只需转换字段类型
-- ================================================================

SET NAMES utf8mb4;

-- ================================================================
-- 1. 修改 questions 表：ENUM -> VARCHAR
-- ================================================================

-- 先添加临时字段
SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'questions'
    AND column_name = 'category_new'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `questions` ADD COLUMN `category_new` VARCHAR(50) NULL',
    'SELECT ''questions.category_new already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 迁移数据：将 CSP 映射到 CSP_J
UPDATE `questions` SET `category_new` = `category` WHERE `category` IS NOT NULL;
UPDATE `questions` SET `category_new` = 'GESP' WHERE `category_new` IS NULL;
-- 将旧的 CSP 值映射到 CSP_J
UPDATE `questions` SET `category_new` = 'CSP_J' WHERE `category_new` = 'CSP';
UPDATE `questions` SET `category_new` = 'NOI_P' WHERE `category_new` = 'NOI';

-- 删除旧字段并重命名新字段
ALTER TABLE `questions` DROP COLUMN `category`;
ALTER TABLE `questions` CHANGE COLUMN `category_new` `category` VARCHAR(50) NOT NULL COMMENT '题目类型';

-- 添加索引
SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'questions'
    AND index_name = 'idx_category'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE `questions` ADD INDEX `idx_category` (`category`)',
    'SELECT ''index idx_category already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 2. 修改 oj_problems 表
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'oj_problems'
    AND column_name = 'category_new'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `oj_problems` ADD COLUMN `category_new` VARCHAR(50) NULL',
    'SELECT ''oj_problems.category_new already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `oj_problems` SET `category_new` = `category` WHERE `category` IS NOT NULL;
UPDATE `oj_problems` SET `category_new` = 'GESP' WHERE `category_new` IS NULL;
UPDATE `oj_problems` SET `category_new` = 'CSP_J' WHERE `category_new` = 'CSP';
UPDATE `oj_problems` SET `category_new` = 'NOI_P' WHERE `category_new` = 'NOI';

ALTER TABLE `oj_problems` DROP COLUMN `category`;
ALTER TABLE `oj_problems` CHANGE COLUMN `category_new` `category` VARCHAR(50) NOT NULL COMMENT '题目类型';

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'oj_problems'
    AND index_name = 'idx_category'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE `oj_problems` ADD INDEX `idx_category` (`category`)',
    'SELECT ''index idx_category already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 3. 修改 exams 表
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'exams'
    AND column_name = 'category_new'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `exams` ADD COLUMN `category_new` VARCHAR(50) NULL',
    'SELECT ''exams.category_new already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `exams` SET `category_new` = `category` WHERE `category` IS NOT NULL;
UPDATE `exams` SET `category_new` = 'GESP' WHERE `category_new` IS NULL;
UPDATE `exams` SET `category_new` = 'CSP_J' WHERE `category_new` = 'CSP';
UPDATE `exams` SET `category_new` = 'NOI_P' WHERE `category_new` = 'NOI';

ALTER TABLE `exams` DROP COLUMN `category`;
ALTER TABLE `exams` CHANGE COLUMN `category_new` `category` VARCHAR(50) NOT NULL COMMENT '考试类型';

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'exams'
    AND index_name = 'idx_category'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE `exams` ADD INDEX `idx_category` (`category`)',
    'SELECT ''index idx_category already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 4. 修改 learning_plans 表
-- ================================================================

SET @column_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
    AND table_name = 'learning_plans'
    AND column_name = 'category_new'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE `learning_plans` ADD COLUMN `category_new` VARCHAR(50) NULL',
    'SELECT ''learning_plans.category_new already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `learning_plans` SET `category_new` = `category` WHERE `category` IS NOT NULL;
UPDATE `learning_plans` SET `category_new` = 'GESP' WHERE `category_new` IS NULL;
UPDATE `learning_plans` SET `category_new` = 'CSP_J' WHERE `category_new` = 'CSP';
UPDATE `learning_plans` SET `category_new` = 'NOI_P' WHERE `category_new` = 'NOI';

ALTER TABLE `learning_plans` DROP COLUMN `category`;
ALTER TABLE `learning_plans` CHANGE COLUMN `category_new` `category` VARCHAR(50) NOT NULL COMMENT '计划类型';

SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    AND table_name = 'learning_plans'
    AND index_name = 'idx_category'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE `learning_plans` ADD INDEX `idx_category` (`category`)',
    'SELECT ''index idx_category already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ================================================================
-- 5. 验证迁移结果
-- ================================================================

SELECT '====================================' AS '';
SELECT 'category 字段迁移完成！' AS '';
SELECT '====================================' AS '';
SELECT '' AS '';
SELECT '字段类型验证：' AS '';
SELECT '' AS '';

SELECT
    'questions' as table_name,
    COLUMN_TYPE as type,
    COLUMN_DEFAULT as default_value
FROM information_schema.COLUMNS
WHERE table_schema = DATABASE()
AND table_name = 'questions'
AND column_name = 'category'
UNION ALL
SELECT
    'oj_problems',
    COLUMN_TYPE,
    COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE table_schema = DATABASE()
AND table_name = 'oj_problems'
AND column_name = 'category'
UNION ALL
SELECT
    'exams',
    COLUMN_TYPE,
    COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE table_schema = DATABASE()
AND table_name = 'exams'
AND column_name = 'category'
UNION ALL
SELECT
    'learning_plans',
    COLUMN_TYPE,
    COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE table_schema = DATABASE()
AND table_name = 'learning_plans'
AND column_name = 'category';

SELECT '' AS '';
SELECT '数据分布：' AS '';
SELECT '' AS '';

SELECT
    'questions' as table_name,
    category,
    COUNT(*) as count
FROM questions GROUP BY category
UNION ALL
SELECT
    'oj_problems',
    category,
    COUNT(*)
FROM oj_problems GROUP BY category
UNION ALL
SELECT
    'exams',
    category,
    COUNT(*)
FROM exams GROUP BY category
ORDER BY table_name;
