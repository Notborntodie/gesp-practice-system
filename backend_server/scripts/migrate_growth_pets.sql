-- ================================================================
-- 成长精灵 V1：精灵、阶段、积分流水
-- 可重复执行
-- ================================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET COLLATION_CONNECTION = 'utf8mb4_general_ci';

CREATE TABLE IF NOT EXISTS `growth_pet_species` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_growth_pet_species_code` (`code`),
  KEY `idx_growth_pet_species_active_sort` (`is_active`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='成长精灵种类表';

CREATE TABLE IF NOT EXISTS `growth_pet_stages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `species_id` int NOT NULL,
  `stage` int NOT NULL,
  `stage_name` varchar(100) NOT NULL,
  `required_points` int NOT NULL DEFAULT 0,
  `image_url` varchar(500) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_growth_pet_species_stage` (`species_id`, `stage`),
  KEY `idx_growth_pet_stages_species` (`species_id`),
  CONSTRAINT `growth_pet_stages_ibfk_1` FOREIGN KEY (`species_id`) REFERENCES `growth_pet_species` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='成长精灵阶段表';

CREATE TABLE IF NOT EXISTS `user_growth_pets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `species_id` int NOT NULL,
  `nickname` varchar(100) NOT NULL,
  `current_stage` int NOT NULL DEFAULT 1,
  `total_points` int NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_growth_pet` (`user_id`),
  KEY `idx_user_growth_pets_points` (`total_points`),
  KEY `idx_user_growth_pets_species` (`species_id`),
  CONSTRAINT `user_growth_pets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_growth_pets_ibfk_2` FOREIGN KEY (`species_id`) REFERENCES `growth_pet_species` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='用户成长精灵表';

CREATE TABLE IF NOT EXISTS `growth_pet_point_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `source_type` enum('exam','oj','manual','ai') NOT NULL,
  `source_id` int NOT NULL,
  `task_id` int DEFAULT NULL,
  `plan_id` int DEFAULT NULL,
  `points` int NOT NULL,
  `unique_key` varchar(191) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_growth_pet_point_event` (`unique_key`),
  KEY `idx_growth_pet_point_events_user` (`user_id`, `created_at`),
  KEY `idx_growth_pet_point_events_task` (`task_id`),
  KEY `idx_growth_pet_point_events_plan` (`plan_id`),
  CONSTRAINT `growth_pet_point_events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `growth_pet_point_events_ibfk_2` FOREIGN KEY (`task_id`) REFERENCES `learning_tasks` (`id`) ON DELETE SET NULL,
  CONSTRAINT `growth_pet_point_events_ibfk_3` FOREIGN KEY (`plan_id`) REFERENCES `learning_plans` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='成长精灵积分流水表';

INSERT INTO `growth_pet_species` (`code`, `name`, `description`, `sort_order`, `is_active`)
VALUES
  ('fire', '火系精灵', '热情勇敢，喜欢在完成挑战后点亮新的火焰纹章。', 1, 1),
  ('water', '水系精灵', '沉稳灵动，会把每一次练习变成清澈的能量。', 2, 1),
  ('earth', '土系精灵', '踏实可靠，随着积累长出更强壮的生命枝叶。', 3, 1)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `growth_pet_stages` (`species_id`, `stage`, `stage_name`, `required_points`, `image_url`)
SELECT `id`, 1, '火苗幼灵', 0, '/growth-pets/imagegen-transparent/candidate-01.png' FROM `growth_pet_species` WHERE `code` = 'fire'
ON DUPLICATE KEY UPDATE `stage_name` = VALUES(`stage_name`), `required_points` = VALUES(`required_points`), `image_url` = VALUES(`image_url`);
INSERT INTO `growth_pet_stages` (`species_id`, `stage`, `stage_name`, `required_points`, `image_url`)
SELECT `id`, 2, '炽焰伙伴', 100, '/growth-pets/imagegen-transparent/candidate-02.png' FROM `growth_pet_species` WHERE `code` = 'fire'
ON DUPLICATE KEY UPDATE `stage_name` = VALUES(`stage_name`), `required_points` = VALUES(`required_points`), `image_url` = VALUES(`image_url`);
INSERT INTO `growth_pet_stages` (`species_id`, `stage`, `stage_name`, `required_points`, `image_url`)
SELECT `id`, 3, '星火守护者', 300, '/growth-pets/imagegen-transparent/candidate-03.png' FROM `growth_pet_species` WHERE `code` = 'fire'
ON DUPLICATE KEY UPDATE `stage_name` = VALUES(`stage_name`), `required_points` = VALUES(`required_points`), `image_url` = VALUES(`image_url`);

INSERT INTO `growth_pet_stages` (`species_id`, `stage`, `stage_name`, `required_points`, `image_url`)
SELECT `id`, 1, '水滴幼灵', 0, '/growth-pets/imagegen-transparent/candidate-04.png' FROM `growth_pet_species` WHERE `code` = 'water'
ON DUPLICATE KEY UPDATE `stage_name` = VALUES(`stage_name`), `required_points` = VALUES(`required_points`), `image_url` = VALUES(`image_url`);
INSERT INTO `growth_pet_stages` (`species_id`, `stage`, `stage_name`, `required_points`, `image_url`)
SELECT `id`, 2, '浪花伙伴', 100, '/growth-pets/imagegen-transparent/candidate-05.png' FROM `growth_pet_species` WHERE `code` = 'water'
ON DUPLICATE KEY UPDATE `stage_name` = VALUES(`stage_name`), `required_points` = VALUES(`required_points`), `image_url` = VALUES(`image_url`);
INSERT INTO `growth_pet_stages` (`species_id`, `stage`, `stage_name`, `required_points`, `image_url`)
SELECT `id`, 3, '潮汐守护者', 300, '/growth-pets/imagegen-transparent/candidate-06.png' FROM `growth_pet_species` WHERE `code` = 'water'
ON DUPLICATE KEY UPDATE `stage_name` = VALUES(`stage_name`), `required_points` = VALUES(`required_points`), `image_url` = VALUES(`image_url`);

INSERT INTO `growth_pet_stages` (`species_id`, `stage`, `stage_name`, `required_points`, `image_url`)
SELECT `id`, 1, '岩芽幼灵', 0, '/growth-pets/imagegen-transparent/candidate-07.png' FROM `growth_pet_species` WHERE `code` = 'earth'
ON DUPLICATE KEY UPDATE `stage_name` = VALUES(`stage_name`), `required_points` = VALUES(`required_points`), `image_url` = VALUES(`image_url`);
INSERT INTO `growth_pet_stages` (`species_id`, `stage`, `stage_name`, `required_points`, `image_url`)
SELECT `id`, 2, '森林伙伴', 100, '/growth-pets/imagegen-transparent/candidate-08.png' FROM `growth_pet_species` WHERE `code` = 'earth'
ON DUPLICATE KEY UPDATE `stage_name` = VALUES(`stage_name`), `required_points` = VALUES(`required_points`), `image_url` = VALUES(`image_url`);
INSERT INTO `growth_pet_stages` (`species_id`, `stage`, `stage_name`, `required_points`, `image_url`)
SELECT `id`, 3, '山林守护者', 300, '/growth-pets/imagegen-transparent/candidate-09.png' FROM `growth_pet_species` WHERE `code` = 'earth'
ON DUPLICATE KEY UPDATE `stage_name` = VALUES(`stage_name`), `required_points` = VALUES(`required_points`), `image_url` = VALUES(`image_url`);
