CREATE TABLE `blog_category` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`accent` text DEFAULT 'red' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_category_slug_unique` ON `blog_category` (`slug`);--> statement-breakpoint
CREATE TABLE `blog_category_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text NOT NULL,
	`locale` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `blog_category`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_category_translation_locale_unq` ON `blog_category_translation` (`category_id`,`locale`);--> statement-breakpoint
CREATE TABLE `blog_post` (
	`id` text PRIMARY KEY NOT NULL,
	`category_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`reading_minutes` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `blog_category`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `blog_post_published_idx` ON `blog_post` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `blog_post_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`locale` text NOT NULL,
	`slug` text,
	`title` text DEFAULT '' NOT NULL,
	`excerpt` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `blog_post`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blog_post_translation_locale_unq` ON `blog_post_translation` (`post_id`,`locale`);--> statement-breakpoint
CREATE UNIQUE INDEX `blog_post_translation_slug_unq` ON `blog_post_translation` (`locale`,`slug`);--> statement-breakpoint
CREATE TABLE `contact_message` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`course` text,
	`message` text NOT NULL,
	`locale` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`read_at` integer,
	`archived_at` integer,
	`ip_address` text,
	`user_agent` text,
	`notification_status` text DEFAULT 'pending' NOT NULL,
	`notification_error` text,
	`notification_sent_at` integer
);
--> statement-breakpoint
CREATE INDEX `contact_message_created_idx` ON `contact_message` (`created_at`);--> statement-breakpoint
CREATE INDEX `contact_message_unread_idx` ON `contact_message` (`read_at`);--> statement-breakpoint
CREATE TABLE `contact_phone` (
	`id` text PRIMARY KEY NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`number` text DEFAULT '' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contact_phone_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_id` text NOT NULL,
	`locale` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`phone_id`) REFERENCES `contact_phone`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_phone_translation_locale_unq` ON `contact_phone_translation` (`phone_id`,`locale`);--> statement-breakpoint
CREATE TABLE `contact_settings` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`map_query` text DEFAULT '' NOT NULL,
	`map_embed_url` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contact_settings_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`locale` text NOT NULL,
	`page_title` text DEFAULT '' NOT NULL,
	`page_intro` text DEFAULT '' NOT NULL,
	`phones_heading` text DEFAULT '' NOT NULL,
	`address_heading` text DEFAULT '' NOT NULL,
	`form_heading` text DEFAULT '' NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`address_line1` text DEFAULT '' NOT NULL,
	`address_line2` text DEFAULT '' NOT NULL,
	`opening_hours` text DEFAULT '' NOT NULL,
	`footer_address` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contact_settings_translation_locale_unique` ON `contact_settings_translation` (`locale`);--> statement-breakpoint
CREATE TABLE `course_option` (
	`id` text PRIMARY KEY NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_option_value_unique` ON `course_option` (`value`);--> statement-breakpoint
CREATE TABLE `course_option_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`course_option_id` text NOT NULL,
	`locale` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`course_option_id`) REFERENCES `course_option`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_option_translation_locale_unq` ON `course_option_translation` (`course_option_id`,`locale`);--> statement-breakpoint
CREATE TABLE `instructor` (
	`id` text PRIMARY KEY NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`photo` text,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `instructor_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`instructor_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`badge` text DEFAULT '' NOT NULL,
	`experience` text DEFAULT '' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`instructor_id`) REFERENCES `instructor`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `instructor_translation_locale_idx` ON `instructor_translation` (`locale`);--> statement-breakpoint
CREATE UNIQUE INDEX `instructor_translation_locale_unq` ON `instructor_translation` (`instructor_id`,`locale`);--> statement-breakpoint
CREATE TABLE `opinion` (
	`id` text PRIMARY KEY NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`rating` integer DEFAULT 5 NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `opinion_translation` (
	`id` text PRIMARY KEY NOT NULL,
	`opinion_id` text NOT NULL,
	`locale` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`quote` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`opinion_id`) REFERENCES `opinion`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `opinion_translation_locale_unq` ON `opinion_translation` (`opinion_id`,`locale`);--> statement-breakpoint
CREATE TABLE `smtp_settings` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`host` text DEFAULT '' NOT NULL,
	`port` integer DEFAULT 587 NOT NULL,
	`secure` integer DEFAULT false NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`password_cipher` text,
	`from_name` text DEFAULT '' NOT NULL,
	`from_address` text DEFAULT '' NOT NULL,
	`to_address` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
