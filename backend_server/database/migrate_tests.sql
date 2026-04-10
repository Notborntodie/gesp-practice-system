-- ================================================================
-- Test 聚合考试：数据库迁移脚本（可对已有库重复执行）
-- 1. 创建 tests / test_exams / test_oj_problems / test_attempts 表（IF NOT EXISTS）
-- 2. 为 submissions、oj_submissions 增加 test_attempt_id（仅当列不存在时执行）
-- 执行方式：mysql -u user -p your_db < migrate_tests.sql
-- ================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET COLLATION_CONNECTION = 'utf8mb4_general_ci';

-- ================================================================
-- 1. Test 聚合考试相关表
-- ================================================================

CREATE TABLE IF NOT EXISTS `tests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL COMMENT '考试名称',
  `description` text COMMENT '说明',
  `time_limit_minutes` int NOT NULL COMMENT '单次作答限时（分钟）',
  `start_time` datetime DEFAULT NULL COMMENT '考试窗口开始（可空=无限制）',
  `end_time` datetime DEFAULT NULL COMMENT '考试窗口结束（可空=无限制）',
  `total_score` int DEFAULT NULL COMMENT '满分（可冗余，用于展示）',
  `is_public` tinyint(1) NOT NULL DEFAULT '1' COMMENT '是否公开：1=全部可见可参与，0=仅创建人的学生可见可参与',
  `created_by` int DEFAULT NULL COMMENT '创建者 user_id（非公开时用于判定「自己的学生」）',
  `public_result_token` varchar(64) DEFAULT NULL COMMENT '公开查分链接 token',
  `public_result_enabled` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否开启公开查分：0=关闭，1=开启',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tests_time` (`start_time`,`end_time`),
  KEY `idx_tests_public_creator` (`is_public`,`created_by`),
  CONSTRAINT `fk_tests_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Test 聚合考试表';

CREATE TABLE IF NOT EXISTS `test_exams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `test_id` int NOT NULL,
  `exam_id` int NOT NULL,
  `exam_order` int DEFAULT 0 COMMENT '顺序',
  `score_weight` int DEFAULT NULL COMMENT '该 exam 在本 test 中的满分（NULL 则用 exam.total_questions 或 100）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_test_exam` (`test_id`,`exam_id`),
  KEY `idx_test_exams_test` (`test_id`),
  KEY `idx_test_exams_exam` (`exam_id`),
  CONSTRAINT `fk_test_exams_test` FOREIGN KEY (`test_id`) REFERENCES `tests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_test_exams_exam` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Test-客观题关联';

CREATE TABLE IF NOT EXISTS `test_oj_problems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `test_id` int NOT NULL,
  `problem_id` int NOT NULL,
  `problem_order` int DEFAULT 0 COMMENT '顺序',
  `score_weight` int NOT NULL DEFAULT 100 COMMENT '该题满分（用于 passed_tests/total_tests * score_weight）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_test_problem` (`test_id`,`problem_id`),
  KEY `idx_test_oj_test` (`test_id`),
  KEY `idx_test_oj_problem` (`problem_id`),
  CONSTRAINT `fk_test_oj_test` FOREIGN KEY (`test_id`) REFERENCES `tests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_test_oj_problem` FOREIGN KEY (`problem_id`) REFERENCES `oj_problems` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Test-编程题关联';

CREATE TABLE IF NOT EXISTS `test_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `test_id` int NOT NULL,
  `user_id` int NOT NULL,
  `started_at` datetime NOT NULL COMMENT '开始时间',
  `submitted_at` datetime DEFAULT NULL COMMENT '交卷时间（NULL=未交卷）',
  `time_limit_seconds` int NOT NULL COMMENT '本次限时（秒）',
  `exam_score` int DEFAULT NULL COMMENT '客观题得分',
  `oj_score` decimal(10,2) DEFAULT NULL COMMENT '编程题得分',
  `total_score` decimal(10,2) DEFAULT NULL COMMENT '总分',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_test_user` (`test_id`,`user_id`),
  KEY `idx_test_attempts_test` (`test_id`),
  KEY `idx_test_attempts_user` (`user_id`),
  KEY `idx_test_attempts_rank` (`test_id`,`total_score`,`submitted_at`),
  CONSTRAINT `fk_test_attempts_test` FOREIGN KEY (`test_id`) REFERENCES `tests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_test_attempts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='Test 参与记录表';

-- ================================================================
-- 2. 为 submissions / oj_submissions 增加 test_attempt_id（仅当列不存在时执行）
-- ================================================================

DELIMITER //

DROP PROCEDURE IF EXISTS add_test_attempt_columns//

CREATE PROCEDURE add_test_attempt_columns()
BEGIN
  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'submissions' AND COLUMN_NAME = 'test_attempt_id') = 0 THEN
    ALTER TABLE `submissions`
      ADD COLUMN `test_attempt_id` int DEFAULT NULL COMMENT 'Test 参与 ID（NULL=非 Test 内提交）' AFTER `task_id`,
      ADD KEY `idx_submissions_test_attempt` (`test_attempt_id`),
      ADD CONSTRAINT `fk_submissions_test_attempt` FOREIGN KEY (`test_attempt_id`) REFERENCES `test_attempts` (`id`) ON DELETE SET NULL;
  END IF;

  IF (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'oj_submissions' AND COLUMN_NAME = 'test_attempt_id') = 0 THEN
    ALTER TABLE `oj_submissions`
      ADD COLUMN `test_attempt_id` int DEFAULT NULL COMMENT 'Test 参与 ID（NULL=非 Test 内提交）' AFTER `task_id`,
      ADD KEY `idx_oj_submissions_test_attempt` (`test_attempt_id`),
      ADD CONSTRAINT `fk_oj_submissions_test_attempt` FOREIGN KEY (`test_attempt_id`) REFERENCES `test_attempts` (`id`) ON DELETE SET NULL;
  END IF;
END//

DELIMITER ;

CALL add_test_attempt_columns();
DROP PROCEDURE IF EXISTS add_test_attempt_columns;

-- ================================================================
-- 迁移完成
-- ================================================================
