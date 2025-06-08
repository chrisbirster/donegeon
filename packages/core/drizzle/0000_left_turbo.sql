CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text(256) NOT NULL,
	`description` text(512) NOT NULL,
	`due_at` integer,
	`scheduled_for` integer,
	`repeat_rule` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` integer,
	`priority` integer DEFAULT 3,
	`difficulty` integer DEFAULT 3,
	`xp_reward` integer DEFAULT 0,
	`gold_reward` integer DEFAULT 0,
	`energy_cost` integer DEFAULT 0,
	`parent_id` integer,
	`tags` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text(320) NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`ip_hash` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_email_unique` ON `waitlist` (`email`);