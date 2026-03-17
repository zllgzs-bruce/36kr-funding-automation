CREATE TABLE `contact_edit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contact_id` int NOT NULL,
	`field` varchar(64) NOT NULL,
	`field_key` varchar(64) NOT NULL,
	`old_value` text,
	`new_value` text,
	`edited_by` varchar(128),
	`contact_snapshot` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contact_edit_logs_id` PRIMARY KEY(`id`)
);
