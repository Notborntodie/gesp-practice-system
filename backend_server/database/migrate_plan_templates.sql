-- ================================================================
-- 学习计划模板：数据库迁移脚本（可对已有库重复执行）
-- 1. 创建 plan_templates / template_tasks / template_task_exams / template_task_oj_problems 表
-- 执行方式：mysql -u user -p your_db < migrate_plan_templates.sql
-- ================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET COLLATION_CONNECTION = 'utf8mb4_general_ci';

-- ================================================================
-- 1. 计划模板主表
-- ================================================================

CREATE TABLE IF NOT EXISTS `plan_templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL COMMENT '模板名称',
  `description` text COMMENT '模板描述',
  `category` varchar(50) NOT NULL DEFAULT 'GESP' COMMENT '分类',
  `level` int DEFAULT NULL COMMENT 'GESP级别',
  `created_by` int DEFAULT NULL COMMENT '创建者ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='学习计划模板';

-- ================================================================
-- 2. 模板任务表（完整副本，含复习内容/视频/考试模式）
-- ================================================================

CREATE TABLE IF NOT EXISTS `template_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_id` int NOT NULL COMMENT '所属模板ID',
  `name` varchar(255) NOT NULL COMMENT '任务名称',
  `description` text COMMENT '任务描述',
  `review_content` text COMMENT '复习内容',
  `review_content_type` varchar(20) DEFAULT 'text' COMMENT '复习内容类型: text/pdf',
  `review_video_url` varchar(500) DEFAULT NULL COMMENT '复习视频链接',
  `task_order` int DEFAULT 0 COMMENT '任务顺序',
  `start_time` datetime DEFAULT NULL COMMENT '任务开始时间',
  `end_time` datetime DEFAULT NULL COMMENT '任务结束时间',
  `is_exam_mode` tinyint(1) DEFAULT 0 COMMENT '考试模式',
  PRIMARY KEY (`id`),
  KEY `idx_template_id` (`template_id`),
  CONSTRAINT `fk_template_tasks_template` FOREIGN KEY (`template_id`) REFERENCES `plan_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='模板任务';

-- ================================================================
-- 3. 模板任务-客观题关联表
-- ================================================================

CREATE TABLE IF NOT EXISTS `template_task_exams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_task_id` int NOT NULL COMMENT '模板任务ID',
  `exam_id` int NOT NULL COMMENT '考试ID',
  `exam_order` int DEFAULT 0 COMMENT '练习顺序',
  PRIMARY KEY (`id`),
  KEY `idx_template_task_id` (`template_task_id`),
  CONSTRAINT `fk_template_task_exams_task` FOREIGN KEY (`template_task_id`) REFERENCES `template_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='模板任务-客观题关联';

-- ================================================================
-- 4. 模板任务-OJ编程题关联表
-- ================================================================

CREATE TABLE IF NOT EXISTS `template_task_oj_problems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_task_id` int NOT NULL COMMENT '模板任务ID',
  `problem_id` int NOT NULL COMMENT 'OJ题目ID',
  `problem_order` int DEFAULT 0 COMMENT '题目顺序',
  PRIMARY KEY (`id`),
  KEY `idx_template_task_id` (`template_task_id`),
  CONSTRAINT `fk_template_task_oj_task` FOREIGN KEY (`template_task_id`) REFERENCES `template_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='模板任务-OJ编程题关联';
