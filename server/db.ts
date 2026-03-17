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
