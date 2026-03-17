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

/**
 * 联系人编辑历史表 - 记录每次字段变更
 */
export const contactEditLogs = mysqlTable("contact_edit_logs", {
  id: int("id").autoincrement().primaryKey(),
  contactId: int("contact_id").notNull(),          // 关联的联系人ID
  field: varchar("field", { length: 64 }).notNull(), // 被修改的字段名（中文）
  fieldKey: varchar("field_key", { length: 64 }).notNull(), // 字段英文key
  oldValue: text("old_value"),                      // 修改前的值
  newValue: text("new_value"),                      // 修改后的值
  editedBy: varchar("edited_by", { length: 128 }),  // 操作人
  contactSnapshot: text("contact_snapshot"),        // 修改时联系人的公司+姓名快照（JSON）
  isReverted: tinyint("is_reverted").default(0).notNull(), // 是否已被撤销
  revertNote: varchar("revert_note", { length: 256 }), // 撤销备注（如：由张威撤销）
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContactEditLog = typeof contactEditLogs.$inferSelect;
export type InsertContactEditLog = typeof contactEditLogs.$inferInsert;
