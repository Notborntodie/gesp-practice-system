-- ================================================================
-- 创建可扩展的题目类型系统
-- 创建时间：2026-04-01
-- 说明：将 category ENUM 改为 VARCHAR，添加 question_types 表支持自定义类型
-- ================================================================

SET NAMES utf8mb4;

-- ================================================================
-- 1. 创建题目类型表
-- ================================================================

CREATE TABLE IF NOT EXISTS `question_types` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL COMMENT '类型名称，如：GESP、CSP_J、CSP_S',
  `display_name` VARCHAR(100) NOT NULL COMMENT '显示名称，如：GESP、CSP-J、CSP-S',
  `description` TEXT COMMENT '类型描述',
  `is_system` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为系统预设类型：0=用户自定义，1=系统预设',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序权重',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用：0=禁用，1=启用',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_sort_order` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='题目类型表';

-- ================================================================
-- 2. 插入系统预设类型
-- ================================================================

INSERT INTO `question_types` (`name`, `display_name`, `description`, `is_system`, `sort_order`) VALUES
('GESP', 'GESP', 'GESP 1-8级真题', 1, 1),
('CSP_J', 'CSP-J', 'CSP 普及组（CSP-J 第一轮）', 1, 2),
('CSP_S', 'CSP-S', 'CSP 提高组（CSP-J 第二轮）', 1, 3),
('NOI_P', 'NOI普及', 'NOI 普及组', 1, 4),
('NOI_A', 'NOI提高', 'NOI 提高组', 1, 5),
('NOI_IOI', 'NOI省选', 'NOI 省选/国选', 1, 6),
('Other', '其他', '其他类型题目', 1, 99);

-- ================================================================
-- 3. 修改 questions 表：category 改为 VARCHAR + 外键
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

-- 迁移数据
UPDATE `questions` SET `category_new` = `category` WHERE `category` IS NOT NULL;
UPDATE `questions` SET `category_new` = 'GESP' WHERE `category_new` IS NULL;

-- 删除旧字段并重命名新字段
ALTER TABLE `questions` DROP COLUMN `category`;
ALTER TABLE `questions` CHANGE COLUMN `category_new` `category` VARCHAR(50) NOT NULL COMMENT '题目类型';

-- 添加索引
ALTER TABLE `questions` ADD INDEX `idx_category` (`category`);

-- ================================================================
-- 4. 同样修改 oj_problems 表
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

ALTER TABLE `oj_problems` DROP COLUMN `category`;
ALTER TABLE `oj_problems` CHANGE COLUMN `category_new` `category` VARCHAR(50) NOT NULL COMMENT '题目类型';
ALTER TABLE `oj_problems` ADD INDEX `idx_category` (`category`);

-- ================================================================
-- 5. 修改 exams 表
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

ALTER TABLE `exams` DROP COLUMN `category`;
ALTER TABLE `exams` CHANGE COLUMN `category_new` `category` VARCHAR(50) NOT NULL COMMENT '考试类型';
ALTER TABLE `exams` ADD INDEX `idx_category` (`category`);

-- ================================================================
-- 6. 修改 learning_plans 表
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

ALTER TABLE `learning_plans` DROP COLUMN `category`;
ALTER TABLE `learning_plans` CHANGE COLUMN `category_new` `category` VARCHAR(50) NOT NULL COMMENT '计划类型';
ALTER TABLE `learning_plans` ADD INDEX `idx_category` (`category`);

-- ================================================================
-- 7. 验证迁移结果
-- ================================================================

SELECT '====================================' AS '';
SELECT '可扩展题目类型系统迁移完成！' AS '';
SELECT '====================================' AS '';
SELECT '' AS '';
SELECT '已创建：' AS '';
SELECT '  - question_types 表（支持自定义类型）' AS '';
SELECT '  - 7个系统预设类型' AS '';
SELECT '' AS '';
SELECT '系统预设类型：' AS '';
SELECT name, display_name, description FROM question_types WHERE is_system = 1 ORDER BY sort_order;
SELECT '' AS '';
SELECT '字段变更：' AS '';
SELECT '  - questions.category: ENUM -> VARCHAR(50)' AS '';
SELECT '  - oj_problems.category: ENUM -> VARCHAR(50)' AS '';
SELECT '  - exams.category: ENUM -> VARCHAR(50)' AS '';
SELECT '  - learning_plans.category: ENUM -> VARCHAR(50)' AS '';
SELECT '====================================' AS '';

-- 显示统计
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
ORDER BY table_name;
