/**
 * 数据迁移脚本：从SQLite contacts.db 导入到 MySQL
 * 运行方式：node migrate_contacts.mjs
 */
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { config } from 'dotenv';

config({ path: '.env' });

const SQLITE_PATH = '/home/ubuntu/phonebook/contacts.db';
const BATCH_SIZE = 500;

async function main() {
  console.log('开始迁移数据...');

  // 连接 SQLite
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const totalRows = sqlite.prepare('SELECT COUNT(*) as cnt FROM contacts').get().cnt;
  console.log(`SQLite 总记录数: ${totalRows.toLocaleString()}`);

  // 连接 MySQL
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL 未设置');

  const conn = await mysql.createConnection(dbUrl);
  console.log('MySQL 连接成功');

  // 清空目标表
  await conn.execute('TRUNCATE TABLE contacts');
  console.log('已清空 contacts 表');

  // 分批迁移
  let offset = 0;
  let inserted = 0;

  while (offset < totalRows) {
    const rows = sqlite.prepare(`
      SELECT id, company, contact_name, title, phone, phone_type, phone_valid,
             email, source_file, source_label, priority_time
      FROM contacts
      ORDER BY id
      LIMIT ? OFFSET ?
    `).all(BATCH_SIZE, offset);

    if (rows.length === 0) break;

    const values = rows.map(r => [
      r.company || null,
      r.contact_name || null,
      r.title || null,
      r.phone || null,
      r.phone_type || null,
      r.phone_valid ?? 1,
      r.email || null,
      r.source_file || null,
      r.source_label || null,
      (typeof r.priority_time === 'number' ? r.priority_time : null),
    ]);

    await conn.query(
      `INSERT INTO contacts
       (company, contact_name, title, phone, phone_type, phone_valid, email, source_file, source_label, priority_time)
       VALUES ?`,
      [values]
    );

    inserted += rows.length;
    offset += BATCH_SIZE;

    if (inserted % 10000 === 0 || inserted === totalRows) {
      const pct = ((inserted / totalRows) * 100).toFixed(1);
      console.log(`进度: ${inserted.toLocaleString()} / ${totalRows.toLocaleString()} (${pct}%)`);
    }
  }

  sqlite.close();
  await conn.end();

  console.log(`\n✅ 迁移完成！共导入 ${inserted.toLocaleString()} 条记录`);
}

main().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
