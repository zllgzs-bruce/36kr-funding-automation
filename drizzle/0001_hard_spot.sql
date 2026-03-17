CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`company` varchar(512),
	`contact_name` varchar(128),
	`title` varchar(256),
	`phone` varchar(32),
	`phone_type` varchar(16),
	`phone_valid` tinyint DEFAULT 1,
	`email` varchar(320),
	`source_file` varchar(512),
	`source_label` varchar(128),
	`priority_time` float,
	`updated_by` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
