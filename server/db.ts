import { eq, like, and, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, contacts, InsertContact, Contact, contactEditLogs, InsertContactEditLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ── Contacts 查询辅助 ──

export async function searchContacts(params: {
  company?: string;
  contactName?: string;
  page: number;
  pageSize: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { company, contactName, page, pageSize } = params;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (company && company.trim()) {
    conditions.push(like(contacts.company, `%${company.trim()}%`));
  }
  if (contactName && contactName.trim()) {
    conditions.push(like(contacts.contactName, `%${contactName.trim()}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db.select().from(contacts)
      .where(whereClause)
      .orderBy(sql`priority_time DESC, id DESC`)
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(contacts).where(whereClause),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}

export async function updateContact(id: number, data: Partial<Pick<Contact, 'company' | 'contactName' | 'title' | 'phone' | 'email'>> & { updatedBy?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contacts).set({ ...data, updatedAt: new Date() }).where(eq(contacts.id, id));
}

export async function getContactById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getContactsCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(contacts);
  return Number(result[0]?.count ?? 0);
}

// ── 编辑历史 ──

/** 字段中英文映射 */
const FIELD_LABELS: Record<string, string> = {
  company: "公司名",
  contactName: "联系人姓名",
  title: "职位",
  phone: "电话",
  email: "邮箱",
};

/**
 * 写入编辑历史：对比旧值和新值，每个变更的字段写一条记录
 */
export async function writeEditLogs(
  contactId: number,
  oldData: Partial<Record<string, string | null>>,
  newData: Partial<Record<string, string | null>>,
  editedBy: string,
  snapshot: { company: string | null; contactName: string | null }
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const logs: InsertContactEditLog[] = [];
  for (const key of Object.keys(newData)) {
    const oldVal = oldData[key] ?? null;
    const newVal = newData[key] ?? null;
    // 只记录实际发生变化的字段
    if (oldVal !== newVal) {
      logs.push({
        contactId,
        field: FIELD_LABELS[key] ?? key,
        fieldKey: key,
        oldValue: oldVal,
        newValue: newVal,
        editedBy,
        contactSnapshot: JSON.stringify(snapshot),
      });
    }
  }

  if (logs.length > 0) {
    await db.insert(contactEditLogs).values(logs);
  }
}

/**
 * 查询单条联系人的编辑历史
 */
export async function getContactEditHistory(contactId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(contactEditLogs)
    .where(eq(contactEditLogs.contactId, contactId))
    .orderBy(desc(contactEditLogs.createdAt))
    .limit(200);
}

/**
 * 根据 ID 获取单条编辑日志
 */
export async function getEditLogById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(contactEditLogs)
    .where(eq(contactEditLogs.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * 撤销一条编辑记录：将字段还原为 old_value，并写入撤销历史
 */
export async function revertEditLog(
  logId: number,
  revertedBy: string
): Promise<{ success: true }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 获取原始日志
  const log = await getEditLogById(logId);
  if (!log) throw new Error("记录不存在");
  if (log.isReverted) throw new Error("该记录已经被撤销过，不能重复撤销");

  // 获取联系人当前字段值（用于写入撤销历史的 oldValue）
  const contact = await getContactById(log.contactId);
  if (!contact) throw new Error("联系人不存在");

  const fieldMap: Record<string, keyof typeof contact> = {
    company: "company",
    contactName: "contactName",
    title: "title",
    phone: "phone",
    email: "email",
  };
  const fieldKey = log.fieldKey;
  const contactField = fieldMap[fieldKey];
  if (!contactField) throw new Error(`不支持撤销字段: ${fieldKey}`);

  const currentValue = (contact[contactField] as string | null) ?? null;
  const restoreValue = log.oldValue ?? null;

  // 将字段还原为修改前的值
  await db
    .update(contacts)
    .set({ [fieldKey]: restoreValue, updatedAt: new Date(), updatedBy: revertedBy })
    .where(eq(contacts.id, log.contactId));

  // 标记原日志为已撤销
  const revertNote = `由 ${revertedBy} 撤销`;
  await db
    .update(contactEditLogs)
    .set({ isReverted: 1, revertNote })
    .where(eq(contactEditLogs.id, logId));

  // 写入撤销操作的历史记录
  const snapshot = (() => {
    try { return JSON.parse(log.contactSnapshot || "{}"); } catch { return {}; }
  })();
  await db.insert(contactEditLogs).values({
    contactId: log.contactId,
    field: log.field,
    fieldKey: log.fieldKey,
    oldValue: currentValue,
    newValue: restoreValue,
    editedBy: revertedBy,
    contactSnapshot: JSON.stringify(snapshot),
    isReverted: 0,
    revertNote: `撤销操作（还原为修改前的值）`,
  });

  return { success: true };
}

/**
 * 查询全局编辑历史（分页）
 */
export async function listEditLogs(params: { page: number; pageSize: number; editedBy?: string }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { page, pageSize, editedBy } = params;
  const offset = (page - 1) * pageSize;

  const whereClause = editedBy
    ? like(contactEditLogs.editedBy, `%${editedBy}%`)
    : undefined;

  const [items, countResult] = await Promise.all([
    db.select().from(contactEditLogs)
      .where(whereClause)
      .orderBy(desc(contactEditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(contactEditLogs).where(whereClause),
  ]);

  return {
    items,
    total: Number(countResult[0]?.count ?? 0),
  };
}
