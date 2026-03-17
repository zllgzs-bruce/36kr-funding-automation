import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float, tinyint } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 话单联系人表 - 对应SQLite contacts表字段
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  company: varchar("company", { length: 512 }),
  contactName: text("contact_name"),
  title: varchar("title", { length: 256 }),
  phone: varchar("phone", { length: 128 }),
  phoneType: varchar("phone_type", { length: 16 }),   // mobile / landline
  phoneValid: tinyint("phone_valid").default(1),
  email: varchar("email", { length: 320 }),
  sourceFile: varchar("source_file", { length: 512 }),
  sourceLabel: varchar("source_label", { length: 128 }),
  priorityTime: float("priority_time"),               // 文件修改时间戳，越大越新
  updatedBy: varchar("updated_by", { length: 128 }),  // 最后编辑人
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;
