ALTER TABLE `contact_edit_logs` ADD `is_reverted` tinyint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `contact_edit_logs` ADD `revert_note` varchar(256);