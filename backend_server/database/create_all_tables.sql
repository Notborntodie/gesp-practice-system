-- ================================================================
-- GESP练习系统数据库建表脚本
-- 编码格式：utf8mb4
-- 排序规则：utf8mb4_general_ci
-- 创建时间：2025-01-20
-- ================================================================

-- 设置数据库默认字符集和排序规则
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET COLLATION_CONNECTION = 'utf8mb4_general_ci';

-- ================================================================
-- 1. 用户相关表
-- ================================================================

-- 1.1 用户表
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `real_name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户表';

-- 1.2 角色表
CREATE TABLE IF NOT EXISTS `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text,
  `is_system` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='角色表';

-- 1.3 权限表
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text,
  `resource` varchar(50) NOT NULL,
  `action` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_permissions_resource` (`resource`),
  KEY `idx_permissions_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='权限表';

-- 1.4 用户角色关联表
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  `assigned_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_role` (`user_id`,`role_id`),
  KEY `idx_user_roles_user` (`user_id`),
  KEY `idx_user_roles_role` (`role_id`),
  KEY `idx_user_roles_assigned_by` (`assigned_by`),
  CONSTRAINT `user_roles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_ibfk_2` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_roles_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户角色关联表';

-- 1.5 角色权限关联表
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `permission_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_role_permission` (`role_id`,`permission_id`),
  KEY `idx_role_permissions_role` (`role_id`),
  KEY `idx_role_permissions_permission` (`permission_id`),
  CONSTRAINT `role_permissions_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='角色权限关联表';

-- 1.6 教师学生关联表
CREATE TABLE IF NOT EXISTS `teacher_students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `teacher_id` int NOT NULL,
  `student_id` int NOT NULL,
  `class_no` varchar(50) DEFAULT NULL COMMENT '班级编号，如1班、2班、A班等',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_teacher_student` (`teacher_id`,`student_id`),
  KEY `idx_teacher_students_teacher` (`teacher_id`),
  KEY `idx_teacher_students_student` (`student_id`),
  CONSTRAINT `teacher_students_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `teacher_students_ibfk_2` FOREIGN KEY (`student_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='教师学生关联表';

-- ================================================================
-- 2. 知识点相关表
-- ================================================================

-- 2.1 知识点表
CREATE TABLE IF NOT EXISTS `knowledge_points` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `category` varchar(50) NOT NULL,
  `level` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_knowledge_point` (`name`,`level`),
  KEY `idx_knowledge_points_category` (`category`),
  KEY `idx_knowledge_points_level` (`level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='知识点表';

-- ================================================================
-- 3. 题目相关表
-- ================================================================

-- 3.1 题目表
CREATE TABLE IF NOT EXISTS `questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `public_id` varchar(64) DEFAULT NULL COMMENT '题目可见检索编号',
  `question_text` text NOT NULL,
  `question_type` enum('text','code') DEFAULT 'text',
  `question_code` text,
  `correct_answer` varchar(10) NOT NULL,
  `explanation` text,
  `level` int NULL DEFAULT NULL,
  `difficulty` enum('easy','medium','hard') DEFAULT 'medium',
  `image_url` varchar(500) DEFAULT NULL,
  `question_date` varchar(7) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_questions_public_id` (`public_id`),
  KEY `idx_questions_level` (`level`),
  KEY `idx_questions_date` (`question_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='题目表';

-- 3.2 选项表
CREATE TABLE IF NOT EXISTS `options` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_id` int NOT NULL,
  `option_label` varchar(10) NOT NULL,
  `option_value` varchar(10) NOT NULL,
  `option_text` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_option` (`question_id`,`option_label`),
  KEY `idx_options_question` (`question_id`),
  CONSTRAINT `options_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='选项表';

-- 3.3 题目图片表
CREATE TABLE IF NOT EXISTS `question_images` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_id` int NOT NULL,
  `image_url` varchar(500) NOT NULL,
  `image_type` enum('question','explanation','hint') DEFAULT 'question',
  `display_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_question_images_question` (`question_id`),
  CONSTRAINT `question_images_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='题目图片表';

-- 3.4 题目知识点关联表
CREATE TABLE IF NOT EXISTS `question_knowledge_points` (
  `id` int NOT NULL AUTO_INCREMENT,
  `question_id` int NOT NULL,
  `knowledge_point_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_question_knowledge` (`question_id`,`knowledge_point_id`),
  KEY `idx_question_knowledge_points_question` (`question_id`),
  KEY `idx_question_knowledge_points_knowledge` (`knowledge_point_id`),
  CONSTRAINT `question_knowledge_points_ibfk_1` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `question_knowledge_points_ibfk_2` FOREIGN KEY (`knowledge_point_id`) REFERENCES `knowledge_points` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='题目知识点关联表';

-- 3.5 题目上传记录表
CREATE TABLE IF NOT EXISTS `question_uploads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `question_id` int NOT NULL,
  `upload_type` enum('manual','batch','import') DEFAULT 'manual',
  `upload_status` enum('pending','approved','rejected') DEFAULT 'pending',
  `review_notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_question_uploads_status` (`upload_status`),
  KEY `question_uploads_ibfk_1` (`user_id`),
  KEY `question_uploads_ibfk_2` (`question_id`),
  CONSTRAINT `question_uploads_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `question_uploads_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='题目上传记录表';

-- ================================================================
-- 4. 考试相关表
-- ================================================================

-- 4.1 考试表
CREATE TABLE IF NOT EXISTS `exams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `level` int NULL DEFAULT NULL,
  `description` text,
  `total_questions` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `type` enum('真题','模拟','专项') NOT NULL DEFAULT '真题' COMMENT '考试类型：真题、模拟、专项',
  `bank_visible` tinyint(1) NOT NULL DEFAULT '1' COMMENT '题库可见：1=可见 0=不可见（仅影响 level-exams 题库列表）',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='考试表';

-- 4.2 考试题目关联表
CREATE TABLE IF NOT EXISTS `exam_questions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL,
  `question_id` int NOT NULL,
  `question_number` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_exam_question` (`exam_id`,`question_id`),
  UNIQUE KEY `unique_exam_question_number` (`exam_id`,`question_number`),
  KEY `question_id` (`question_id`),
  KEY `idx_exam_questions_exam` (`exam_id`),
  CONSTRAINT `exam_questions_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `exam_questions_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='考试题目关联表';

-- 4.3 提交记录表
CREATE TABLE IF NOT EXISTS `submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `exam_id` int NOT NULL,
  `task_id` int DEFAULT NULL COMMENT '任务ID（NULL表示非任务内提交）',
  `attempt_number` int NOT NULL,
  `score` int NOT NULL,
  `submit_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `practice_duration_seconds` int DEFAULT NULL COMMENT '本次练习持续时间（秒）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_attempt` (`user_id`,`exam_id`,`attempt_number`),
  KEY `idx_submissions_user_exam` (`user_id`,`exam_id`),
  KEY `idx_submissions_exam_score` (`exam_id`,`score`),
  KEY `idx_submissions_task_id` (`task_id`),
  CONSTRAINT `fk_submissions_task` FOREIGN KEY (`task_id`) REFERENCES `learning_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `submissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `submissions_ibfk_2` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='提交记录表';

-- 4.4 提交答案表
CREATE TABLE IF NOT EXISTS `submission_answers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `submission_id` int NOT NULL,
  `question_id` int NOT NULL,
  `user_answer` varchar(10) NOT NULL,
  `is_correct` tinyint(1) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_submission_answers_submission` (`submission_id`),
  KEY `idx_submission_answers_question` (`question_id`),
  CONSTRAINT `submission_answers_ibfk_1` FOREIGN KEY (`submission_id`) REFERENCES `submissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `submission_answers_ibfk_2` FOREIGN KEY (`question_id`) REFERENCES `questions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='提交答案表';

-- ================================================================
-- 5. OJ（在线判题）相关表
-- ================================================================

-- 5.1 OJ题目表
CREATE TABLE IF NOT EXISTS `oj_problems` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '题目ID',
  `title` varchar(200) NOT NULL COMMENT '题目标题',
  `description` text NOT NULL COMMENT '题目描述',
  `input_format` text COMMENT '输入格式说明',
  `output_format` text COMMENT '输出格式说明',
  `data_range` text COMMENT '数据范围说明',
  `analysis` text COMMENT '题目文字解析说明，用于 Test「我的解析」展示官方解析',
  `video_url` varchar(500) DEFAULT NULL COMMENT '解析视频URL',
  `time_limit` int DEFAULT '1000' COMMENT '时间限制（毫秒）',
  `memory_limit` int DEFAULT '256' COMMENT '内存限制（MB）',
  `level` int NULL DEFAULT NULL COMMENT 'GESP级别 1-8，非GESP分类可为NULL',
  `publish_date` date DEFAULT NULL COMMENT '发布日期（年月日）',
  `total_submissions` int DEFAULT '0' COMMENT '总提交数',
  `accepted_submissions` int DEFAULT '0' COMMENT '通过提交数',
  `bank_visible` tinyint(1) NOT NULL DEFAULT '1' COMMENT '题库可见：1=可见 0=不可见（仅影响 level-exams 题库列表）',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_level` (`level`),
  KEY `idx_publish_date` (`publish_date`),
  KEY `idx_bank_visible` (`bank_visible`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='OJ题目表';

-- 5.2 OJ测试样例表
CREATE TABLE IF NOT EXISTS `oj_samples` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '样例ID',
  `problem_id` int NOT NULL COMMENT '题目ID',
  `input` text NOT NULL COMMENT '输入数据',
  `output` text NOT NULL COMMENT '预期输出',
  `explanation` text COMMENT '样例说明（可选，支持Markdown）',
  `is_hidden` tinyint(1) DEFAULT '0' COMMENT '是否为隐藏测试点（true=提交后不显示详细信息，false=提交后可显示）',
  `is_displayed` tinyint(1) DEFAULT '1' COMMENT '是否在查看题目时展示（true=展示，false=不展示）',
  `sort_order` int DEFAULT '0' COMMENT '显示顺序',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_problem_id` (`problem_id`),
  KEY `idx_problem_hidden` (`problem_id`,`is_hidden`),
  KEY `idx_problem_displayed` (`problem_id`,`is_displayed`),
  CONSTRAINT `oj_samples_ibfk_1` FOREIGN KEY (`problem_id`) REFERENCES `oj_problems` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='OJ测试样例表';

-- 5.3 OJ提交记录表
CREATE TABLE IF NOT EXISTS `oj_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `problem_id` int NOT NULL,
  `task_id` int DEFAULT NULL COMMENT '任务ID（NULL表示非任务内提交）',
  `code` text NOT NULL,
  `language` varchar(20) NOT NULL DEFAULT 'cpp',
  `status` enum('queued','judging','completed','error') NOT NULL DEFAULT 'queued',
  `verdict` varchar(50) DEFAULT NULL COMMENT 'Accepted, Wrong Answer, Time Limit Exceeded, etc.',
  `total_tests` int DEFAULT '0',
  `passed_tests` int DEFAULT '0',
  `results` json DEFAULT NULL COMMENT '每个测试点的详细结果',
  `error_message` text,
  `submit_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `practice_duration_seconds` int DEFAULT NULL COMMENT '本次练习持续时间（秒）',
  `judge_start_time` datetime DEFAULT NULL,
  `judge_end_time` datetime DEFAULT NULL,
  `judge_duration` int DEFAULT NULL COMMENT '判题耗时（毫秒）',
  `user_id` int DEFAULT NULL COMMENT '用户ID（预留）',
  `ip_address` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_problem_id` (`problem_id`),
  KEY `idx_status` (`status`),
  KEY `idx_submit_time` (`submit_time`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_oj_submissions_task_id` (`task_id`),
  CONSTRAINT `fk_oj_submissions_task` FOREIGN KEY (`task_id`) REFERENCES `learning_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `oj_submissions_ibfk_1` FOREIGN KEY (`problem_id`) REFERENCES `oj_problems` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='OJ提交记录表';

-- ================================================================
-- 6. 学习计划相关表
-- ================================================================

-- 6.1 学习计划表
CREATE TABLE IF NOT EXISTS `learning_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL COMMENT '计划名称',
  `description` text COMMENT '计划描述',
  `level` int NULL DEFAULT NULL COMMENT 'GESP级别(1-8)，非GESP分类可为NULL',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` int DEFAULT NULL COMMENT '创建者ID',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  `public_progress_token` varchar(64) DEFAULT NULL COMMENT '公开成长进度链接 token',
  `public_progress_enabled` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否开启公开成长进度',
  PRIMARY KEY (`id`),
  KEY `idx_level` (`level`),
  KEY `idx_time` (`start_time`,`end_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='学习计划表';

-- 6.2 学习任务表
CREATE TABLE IF NOT EXISTS `learning_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `plan_id` int NOT NULL COMMENT '所属计划ID',
  `name` varchar(255) NOT NULL COMMENT '任务名称',
  `description` text COMMENT '任务描述',
  `review_content` text COMMENT '复习内容（文本）',
  `review_content_type` enum('text','pdf') DEFAULT 'text',
  `review_video_url` varchar(500) DEFAULT NULL COMMENT '复习视频链接',
  `start_time` datetime NOT NULL COMMENT '开始时间',
  `end_time` datetime NOT NULL COMMENT '结束时间',
  `task_order` int DEFAULT '0' COMMENT '任务顺序',
  `is_exam_mode` tinyint(1) DEFAULT '0' COMMENT '是否为考试模式',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_plan_id` (`plan_id`),
  KEY `idx_order` (`task_order`),
  CONSTRAINT `learning_tasks_ibfk_1` FOREIGN KEY (`plan_id`) REFERENCES `learning_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='学习任务表';

-- 6.3 任务-客观题关联表
CREATE TABLE IF NOT EXISTS `task_exams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL COMMENT '任务ID',
  `exam_id` int NOT NULL COMMENT '考试ID',
  `exam_order` int DEFAULT '0' COMMENT '练习顺序',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_exam` (`task_id`,`exam_id`),
  KEY `exam_id` (`exam_id`),
  KEY `idx_task_id` (`task_id`),
  CONSTRAINT `task_exams_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `learning_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_exams_ibfk_2` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='任务-客观题关联表';

-- 6.4 任务-OJ题关联表
CREATE TABLE IF NOT EXISTS `task_oj_problems` (
  `id` int NOT NULL AUTO_INCREMENT,
  `task_id` int NOT NULL COMMENT '任务ID',
  `problem_id` int NOT NULL COMMENT 'OJ题目ID',
  `problem_order` int DEFAULT '0' COMMENT '题目顺序',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_problem` (`task_id`,`problem_id`),
  KEY `problem_id` (`problem_id`),
  KEY `idx_task_id` (`task_id`),
  CONSTRAINT `task_oj_problems_ibfk_1` FOREIGN KEY (`task_id`) REFERENCES `learning_tasks` (`id`) ON DELETE CASCADE,
  CONSTRAINT `task_oj_problems_ibfk_2` FOREIGN KEY (`problem_id`) REFERENCES `oj_problems` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='任务-OJ题关联表';

-- 6.5 用户加入的计划表
CREATE TABLE IF NOT EXISTS `user_learning_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `plan_id` int NOT NULL COMMENT '计划ID',
  `joined_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `status` varchar(50) DEFAULT 'active' COMMENT '状态: active/completed/cancelled',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_plan` (`user_id`,`plan_id`),
  KEY `plan_id` (`plan_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `user_learning_plans_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_learning_plans_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `learning_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户加入的计划表';

-- 6.6 用户任务完成进度表
CREATE TABLE IF NOT EXISTS `user_task_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `task_id` int NOT NULL COMMENT '任务ID',
  `is_completed` tinyint(1) DEFAULT '0' COMMENT '是否完成',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_task` (`user_id`,`task_id`),
  KEY `task_id` (`task_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `user_task_progress_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_task_progress_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `learning_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户任务完成进度表';

-- 6.7 用户客观题进度表
CREATE TABLE IF NOT EXISTS `user_exam_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `exam_id` int NOT NULL,
  `task_id` int DEFAULT NULL COMMENT '任务ID（NULL表示非任务内完成）',
  `is_completed` tinyint(1) DEFAULT '0',
  `best_score` int DEFAULT '0',
  `attempt_count` int DEFAULT '0',
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_exam_task` (`user_id`,`exam_id`,`task_id`),
  KEY `exam_id` (`exam_id`),
  KEY `idx_task_id` (`task_id`),
  CONSTRAINT `fk_user_exam_progress_task` FOREIGN KEY (`task_id`) REFERENCES `learning_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户客观题进度表';

-- 6.8 用户OJ题进度表
CREATE TABLE IF NOT EXISTS `user_oj_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `problem_id` int NOT NULL,
  `task_id` int DEFAULT NULL COMMENT '任务ID（NULL表示非任务内完成）',
  `is_completed` tinyint(1) DEFAULT '0',
  `best_verdict` varchar(50) DEFAULT NULL,
  `attempt_count` int DEFAULT '0',
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_problem_task` (`user_id`,`problem_id`,`task_id`),
  KEY `problem_id` (`problem_id`),
  KEY `idx_task_id` (`task_id`),
  CONSTRAINT `fk_user_oj_progress_task` FOREIGN KEY (`task_id`) REFERENCES `learning_tasks` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户OJ题进度表';

-- 6.9 用户计划完成进度表
CREATE TABLE IF NOT EXISTS `user_plan_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户ID',
  `plan_id` int NOT NULL COMMENT '计划ID',
  `is_completed` tinyint(1) DEFAULT '0' COMMENT '是否完成',
  `completed_tasks` int DEFAULT '0' COMMENT '已完成任务数',
  `total_tasks` int DEFAULT '0' COMMENT '总任务数',
  `completed_at` datetime DEFAULT NULL COMMENT '完成时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_plan` (`user_id`,`plan_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_plan_id` (`plan_id`),
  CONSTRAINT `user_plan_progress_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_plan_progress_ibfk_2` FOREIGN KEY (`plan_id`) REFERENCES `learning_plans` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户计划完成进度表';

-- ================================================================
-- 7. Test 聚合考试相关表（独立于学习计划）
-- ================================================================

-- 7.1 Test 聚合考试主表
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

-- 7.2 Test 关联的客观题考试
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

-- 7.3 Test 关联的编程题
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

-- 7.4 Test 参与记录表（每人每 Test 一条）
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

-- 7.5 为 submissions 增加 Test 关联字段
ALTER TABLE `submissions`
  ADD COLUMN `test_attempt_id` int DEFAULT NULL COMMENT 'Test 参与 ID（NULL=非 Test 内提交）' AFTER `task_id`,
  ADD KEY `idx_submissions_test_attempt` (`test_attempt_id`),
  ADD CONSTRAINT `fk_submissions_test_attempt` FOREIGN KEY (`test_attempt_id`) REFERENCES `test_attempts` (`id`) ON DELETE SET NULL;

-- 7.6 为 oj_submissions 增加 Test 关联字段
ALTER TABLE `oj_submissions`
  ADD COLUMN `test_attempt_id` int DEFAULT NULL COMMENT 'Test 参与 ID（NULL=非 Test 内提交）' AFTER `task_id`,
  ADD KEY `idx_oj_submissions_test_attempt` (`test_attempt_id`),
  ADD CONSTRAINT `fk_oj_submissions_test_attempt` FOREIGN KEY (`test_attempt_id`) REFERENCES `test_attempts` (`id`) ON DELETE SET NULL;

-- ================================================================
-- 建表脚本完成
-- ================================================================
