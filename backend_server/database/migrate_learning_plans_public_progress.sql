-- 学习计划公开成长进度链接
ALTER TABLE learning_plans ADD COLUMN public_progress_token varchar(64) DEFAULT NULL, ADD COLUMN public_progress_enabled tinyint(1) NOT NULL DEFAULT 0;
