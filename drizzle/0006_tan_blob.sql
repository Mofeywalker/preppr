CREATE INDEX `recipes_user_created_idx` ON `recipes` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `recipes_visibility_created_idx` ON `recipes` (`visibility`,`created_at`);