CREATE TABLE `funding_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`report_date` varchar(16) NOT NULL,
	`title` text NOT NULL,
	`link` varchar(1024) NOT NULL,
	`published` varchar(128),
	`desc` text,
	`invested_company` varchar(512),
	`invested_company_short` varchar(256),
	`investors` text,
	`amount` varchar(128),
	`round` varchar(64),
	`industry` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `funding_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `funding_items_link_unique` UNIQUE(`link`)
);
