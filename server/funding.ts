/**
 * 36氪融资日报服务
 * - 抓取RSS，提取融资快讯
 * - 用LLM提取结构化信息（企业名、投资方、金额、轮次、行业）
 * - 在话单库中模糊匹配联系人（HR优先）
 * - 发送HTML邮件到 wei.zhang@insgeek.com
 */

import RSSParser from "rss-parser";
import * as cheerio from "cheerio";
import nodemailer from "nodemailer";
import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { contacts } from "../drizzle/schema";
import { like, and, isNotNull, ne, sql } from "drizzle-orm";
import { fundingItems } from "../drizzle/schema";

// ─── 配置 ───────────────────────────────────────────────

const GMAIL_USER = process.env.GMAIL_USER || "zllgzs@gmail.com";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const RECIPIENT = process.env.FUNDING_REPORT_RECIPIENT || "wei.zhang@insgeek.com";

// 融资关键词（用于初步过滤RSS条目）
const FUNDING_TITLE_PATTERNS = [
  /完成.{0,8}融资/, /获.{0,5}融资/, /A轮融资/, /B轮融资/, /C轮融资/, /D轮融资/,
  /天使轮/, /Pre-A/, /Pre-B/, /战略融资/, /亿元融资/, /万元融资/,
  /亿美元融资/, /万美元融资/, /领投/,
];
const FUNDING_EXCLUDE = ["投建", "回购", "诉讼", "罚款", "年报", "季报", "营收",
  "净利润", "上市", "IPO", "减持", "增持", "分红", "收购", "并购", "拟收购"];
const FUNDING_DESC_PATTERNS = [
  /完成.{0,10}融资/, /获得.{0,10}融资/, /获.{0,5}(领投|跟投)/,
  /(A|B|C|D|E|F|天使|Pre-A|Pre-B)轮.{0,10}(融资|领投)/,
  /融资.{0,5}(亿|万).{0,3}(元|美元)/,
];

// HR职位关键词（优先级从高到低）
const HR_TITLES = [
  "HRD", "CHRO", "人力资源总监", "人事总监", "人力总监",
  "HRM", "HR经理", "人力资源经理", "人事经理",
  "HRBP", "HR主管", "人力资源主管", "人事主管",
  "HR", "人力资源", "人事", "招聘", "人才",
];

// ─── 类型定义 ────────────────────────────────────────────

export interface FundingItem {
  title: string;
  desc: string;
  link: string;
  published: string;
  // LLM提取的结构化字段
  investedCompany?: string;
  investedCompanyShort?: string;
  investors?: string[];
  amount?: string;
  round?: string;
  industry?: string;
}

export interface MatchedContact {
  contactName: string;
  title: string;
  phone: string;
  email: string;
  company: string;
  matchTerm: string;
}

// ─── RSS抓取 ─────────────────────────────────────────────

function isFundingItem(title: string, desc: string): boolean {
  for (const kw of FUNDING_EXCLUDE) {
    if (title.includes(kw)) return false;
  }
  const text = title + " " + desc.slice(0, 300);
  for (const p of FUNDING_TITLE_PATTERNS) {
    if (p.test(title)) return true;
  }
  for (const p of FUNDING_DESC_PATTERNS) {
    if (p.test(text)) return true;
  }
  return false;
}

export async function fetchFundingFromRSS(): Promise<FundingItem[]> {
  const parser = new RSSParser({
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "Accept": "application/rss+xml, application/xml, */*",
    },
    timeout: 20000,
  });

  let feed;
  try {
    feed = await parser.parseURL("https://36kr.com/feed");
  } catch (err) {
    console.error("[Funding] RSS fetch failed:", err);
    return [];
  }

  const results: FundingItem[] = [];
  for (const entry of feed.items || []) {
    const title = (entry.title || "").trim();
    const descHtml = entry.content || entry.summary || entry.contentSnippet || "";
    const $ = cheerio.load(descHtml);
    const desc = $.text().trim().slice(0, 500);
    const link = entry.link || "";
    const published = entry.pubDate || entry.isoDate || "";

    if (isFundingItem(title, desc)) {
      results.push({ title, desc, link, published });
    }
  }

  console.log(`[Funding] RSS: ${feed.items?.length ?? 0} items, ${results.length} funding-related`);
  return results;
}

// ─── LLM提取结构化信息 ──────────────────────────────────

export async function enrichWithLLM(items: FundingItem[]): Promise<FundingItem[]> {
  const enriched: FundingItem[] = [];

  for (const item of items) {
    try {
      const resp = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "你是一个专业的融资信息提取助手，只返回JSON格式数据，不要任何其他内容。",
          },
          {
            role: "user",
            content: `请从以下融资快讯中提取结构化信息：

标题：${item.title}
正文：${item.desc}

请提取：
1. invested_company: 被投企业工商全称（如"北京盘拓科技有限公司"，没有则填品牌名）
2. invested_company_short: 被投企业品牌简称（如"盘拓科技"）
3. investors: 投资机构列表（数组）
4. amount: 融资金额（如"近亿元"，未披露则填"未披露"）
5. round: 融资轮次（如"A轮"，未知则填"未披露"）
6. industry: 所属行业（简短描述，如"半导体材料"）

只返回JSON，格式：{"invested_company":"","invested_company_short":"","investors":[],"amount":"","round":"","industry":""}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "funding_info",
            strict: true,
            schema: {
              type: "object",
              properties: {
                invested_company: { type: "string" },
                invested_company_short: { type: "string" },
                investors: { type: "array", items: { type: "string" } },
                amount: { type: "string" },
                round: { type: "string" },
                industry: { type: "string" },
              },
              required: ["invested_company", "invested_company_short", "investors", "amount", "round", "industry"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = resp.choices[0]?.message?.content || "{}";
      const extracted = typeof content === "string" ? JSON.parse(content) : content;

      enriched.push({
        ...item,
        investedCompany: extracted.invested_company || "",
        investedCompanyShort: extracted.invested_company_short || "",
        investors: extracted.investors || [],
        amount: extracted.amount || "",
        round: extracted.round || "",
        industry: extracted.industry || "",
      });
    } catch (err) {
      console.warn(`[Funding] LLM extraction failed for "${item.title.slice(0, 30)}":`, err);
      enriched.push({ ...item, investors: [] });
    }
  }

  return enriched;
}

// ─── 话单库匹配 ──────────────────────────────────────────

function normalizeCompanyName(name: string): string {
  if (!name) return "";
  // 去括号内容
  name = name.replace(/[（(][^）)]*[）)]/g, "");
  // 去常见企业后缀
  const suffixes = ["有限公司", "股份有限公司", "股份公司", "有限责任公司",
    "集团有限公司", "集团股份有限公司", "（中国）", "(中国)", "科技有限公司", "技术有限公司"];
  for (const s of suffixes) name = name.replace(s, "");
  // 去地名前缀
  name = name.replace(/^(北京|上海|深圳|广州|杭州|成都|武汉|南京|西安|重庆|天津)/, "");
  return name.trim();
}

function hrPriority(title: string): number {
  const upper = title.toUpperCase();
  for (let i = 0; i < HR_TITLES.length; i++) {
    if (upper.includes(HR_TITLES[i].toUpperCase())) return i;
  }
  return HR_TITLES.length;
}

export async function matchContactsInDB(
  companyFull: string,
  companyShort: string
): Promise<MatchedContact[]> {
  const db = await getDb();
  if (!db) return [];

  // 构建搜索词列表（从精确到模糊）
  const terms: string[] = [];
  if (companyFull) {
    terms.push(companyFull);
    const norm = normalizeCompanyName(companyFull);
    if (norm && norm !== companyFull) terms.push(norm);
  }
  if (companyShort && !terms.includes(companyShort)) {
    terms.push(companyShort);
    const norm = normalizeCompanyName(companyShort);
    if (norm && norm !== companyShort && !terms.includes(norm)) terms.push(norm);
  }

  // 去重
  const uniqueTerms = Array.from(new Set(terms));

  for (const term of uniqueTerms) {
    if (term.length < 3) continue; // 太短的词不搜，避免误匹配

    try {
      const rows = await db
        .select({
          contactName: contacts.contactName,
          title: contacts.title,
          phone: contacts.phone,
          email: contacts.email,
          company: contacts.company,
        })
        .from(contacts)
        .where(
          and(
            like(contacts.company, `%${term}%`),
            isNotNull(contacts.phone),
            ne(contacts.phone, "")
          )
        )
        .limit(50);

      if (rows.length === 0) continue;

      // 去重（同一手机号只保留一条）
      const seenPhones = new Set<string>();
      const unique: MatchedContact[] = [];
      for (const row of rows) {
        const phone = (row.phone || "").trim();
        if (phone && !seenPhones.has(phone)) {
          seenPhones.add(phone);
          unique.push({
            contactName: row.contactName || "",
            title: row.title || "",
            phone,
            email: row.email || "",
            company: row.company || "",
            matchTerm: term,
          });
        }
      }

      // HR优先排序
      unique.sort((a, b) => hrPriority(a.title) - hrPriority(b.title));
      return unique.slice(0, 20);
    } catch (err) {
      console.warn("[Funding] DB match failed:", err);
    }
  }

  return [];
}

// ─── 邮件HTML生成 ────────────────────────────────────────

function buildContactsHtml(contacts: MatchedContact[]): string {
  if (contacts.length === 0) {
    return `<div style="color:#bbb;font-size:12px;padding:5px 0;">⚪ 话单库无匹配</div>`;
  }

  const rows = contacts.map(c => {
    const isHR = HR_TITLES.slice(0, 9).some(kw => c.title.toUpperCase().includes(kw.toUpperCase()));
    const badge = isHR
      ? `<span style="background:#fef0f0;color:#e74c3c;border-radius:3px;padding:1px 5px;font-size:11px;margin-right:4px;">HR</span>`
      : "";
    const titleColor = isHR ? "#e74c3c" : "#555";
    const contact = c.phone + (c.email ? ` · ${c.email}` : "");
    return `
<tr style="border-bottom:1px solid #f5f5f5;">
  <td style="padding:5px 8px;font-size:12px;color:#333;white-space:nowrap;">${c.contactName}</td>
  <td style="padding:5px 8px;font-size:12px;color:${titleColor};white-space:nowrap;">${badge}${c.title}</td>
  <td style="padding:5px 8px;font-size:12px;color:#2980b9;">${contact}</td>
</tr>`;
  }).join("");

  return `
<div style="margin-top:10px;border:1px solid #e8f4fd;border-radius:6px;overflow:hidden;">
  <div style="background:#e8f4fd;padding:5px 10px;font-size:12px;color:#2980b9;font-weight:bold;">
    🔍 话单库匹配 · ${contacts.length} 个联系人（匹配词：${contacts[0].matchTerm}）
  </div>
  <table style="width:100%;border-collapse:collapse;background:#fff;">
    <tr style="background:#f8fbff;">
      <th style="padding:4px 8px;font-size:11px;color:#999;text-align:left;font-weight:normal;">姓名</th>
      <th style="padding:4px 8px;font-size:11px;color:#999;text-align:left;font-weight:normal;">职位</th>
      <th style="padding:4px 8px;font-size:11px;color:#999;text-align:left;font-weight:normal;">联系方式</th>
    </tr>
    ${rows}
  </table>
</div>`;
}

export async function buildEmailHtml(items: FundingItem[], reportDate: string): Promise<string> {
  if (items.length === 0) {
    return `<html><body style="font-family:'PingFang SC',Arial,sans-serif;color:#333;max-width:700px;margin:0 auto;padding:20px;">
<h2 style="color:#e74c3c;">36氪融资日报 · ${reportDate}</h2>
<p style="color:#999;">今日暂无融资快讯。</p>
</body></html>`;
  }

  const rowsHtml: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const company = item.investedCompany || item.investedCompanyShort || "—";
    const investors = item.investors?.join("、") || "—";
    const amount = item.amount || "—";
    const round = item.round || "—";
    const industry = item.industry || "—";
    const desc = item.desc.length > 150 ? item.desc.slice(0, 150) + "…" : item.desc;

    // 匹配话单库
    const matchedContacts = await matchContactsInDB(
      item.investedCompany || "",
      item.investedCompanyShort || ""
    );
    const contactsHtml = buildContactsHtml(matchedContacts);

    rowsHtml.push(`
<tr style="border-bottom:1px solid #f0f0f0;">
  <td style="padding:16px 12px;vertical-align:top;width:28px;color:#999;font-size:13px;">${i + 1}</td>
  <td style="padding:16px 12px;vertical-align:top;">
    <div style="margin-bottom:6px;">
      <a href="${item.link}" style="font-size:15px;font-weight:bold;color:#2c3e50;text-decoration:none;">${item.title}</a>
    </div>
    <div style="margin-bottom:8px;color:#555;font-size:13px;line-height:1.6;">${desc}</div>
    <table style="border-collapse:collapse;font-size:12px;">
      <tr><td style="padding:2px 8px 2px 0;color:#999;">被投企业</td><td style="padding:2px 0;color:#2c3e50;font-weight:bold;">${company}</td></tr>
      <tr><td style="padding:2px 8px 2px 0;color:#999;">投资机构</td><td style="padding:2px 0;color:#27ae60;">${investors}</td></tr>
      <tr><td style="padding:2px 8px 2px 0;color:#999;">融资金额</td><td style="padding:2px 0;color:#e67e22;">${amount}</td></tr>
      <tr><td style="padding:2px 8px 2px 0;color:#999;">融资轮次</td><td style="padding:2px 0;">${round}</td></tr>
      <tr><td style="padding:2px 8px 2px 0;color:#999;">所属行业</td><td style="padding:2px 0;">${industry}</td></tr>
    </table>
    ${contactsHtml}
  </td>
</tr>`);
  }

  return `<html>
<head><meta charset="utf-8"></head>
<body style="font-family:'PingFang SC','Helvetica Neue',Arial,sans-serif;color:#333;max-width:700px;margin:0 auto;padding:20px;background:#fafafa;">
  <div style="background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:hidden;">
    <div style="background:linear-gradient(135deg,#e74c3c,#c0392b);padding:24px 28px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:bold;">36氪融资日报</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${reportDate} · 共 ${items.length} 条融资快讯</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${rowsHtml.join("")}
    </table>
    <div style="padding:16px 28px;background:#f8f8f8;border-top:1px solid #eee;font-size:12px;color:#aaa;text-align:center;">
      数据来源：36氪 · 每日自动抓取 · 仅供参考
    </div>
  </div>
</body>
</html>`;
}

// ─── 邮件发送 ────────────────────────────────────────────

export async function sendEmail(subject: string, html: string): Promise<boolean> {
  if (!GMAIL_APP_PASSWORD) {
    console.error("[Funding] GMAIL_APP_PASSWORD not configured");
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD.replace(/\s/g, ""),
    },
  });

  try {
    await transporter.sendMail({
      from: `"36氪融资日报" <${GMAIL_USER}>`,
      to: RECIPIENT,
      subject,
      html,
    });
    console.log(`[Funding] Email sent to ${RECIPIENT}`);
    return true;
  } catch (err) {
    console.error("[Funding] Email send failed:", err);
    return false;
  }
}

// ─── 主流程 ──────────────────────────────────────────────

export async function runDailyFundingReport(): Promise<{
  success: boolean;
  itemCount: number;
  message: string;
}> {
  const today = new Date().toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).replace(/\//g, "-");

  console.log(`[Funding] === 融资日报任务开始 ${new Date().toISOString()} ===`);

  // 1. 抓取RSS
  const rawItems = await fetchFundingFromRSS();

  // 2. LLM提取结构化信息
  const enrichedItems = rawItems.length > 0 ? await enrichWithLLM(rawItems) : [];

  // 3. 去重（同一企业只保留一条）
  const deduped = deduplicateByCompany(enrichedItems);

  // 4. 存入数据库（缓存当天数据）
  if (deduped.length > 0) {
    await saveFundingItems(deduped, today);
  }

  // 5. 生成邮件HTML（含话单匹配）
  const subject = `36氪融资日报 · ${today} · ${deduped.length}条`;
  const html = await buildEmailHtml(deduped, today);

  // 6. 发送邮件
  const sent = await sendEmail(subject, html);

  const message = sent
    ? `成功发送 ${deduped.length} 条融资快讯`
    : `邮件发送失败，共 ${deduped.length} 条快讯`;

  console.log(`[Funding] === 任务结束: ${message} ===`);
  return { success: sent, itemCount: deduped.length, message };
}

function normalizeForDedup(name: string): string {
  if (!name) return "";
  // 去掉常见企业后缀和地名前缀，用于匹配比较
  return name
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/(有限公司|股份有限公司|股份公司|有限责任公司|集团有限公司|集团股份有限公司)/g, "")
    .replace(/^(北京|上海|深圳|广州|杭州|成都|武汉|南京|西安|重庆|天津)/, "")
    .trim();
}

function isSameCompany(a: FundingItem, b: FundingItem): boolean {
  // 收集双方所有可能的名称变体
  const getNorms = (item: FundingItem): string[] => {
    const names: string[] = [];
    if (item.investedCompany) {
      names.push(item.investedCompany);
      names.push(normalizeForDedup(item.investedCompany));
    }
    if (item.investedCompanyShort) {
      names.push(item.investedCompanyShort);
      names.push(normalizeForDedup(item.investedCompanyShort));
    }
    return names.filter(n => n.length >= 3); // 过短的不参与比较
  };

  const normsA = getNorms(a);
  const normsB = getNorms(b);

  // 任意一对名称相同，就是同一家企业
  for (const na of normsA) {
    for (const nb of normsB) {
      if (na === nb) return true;
      // 一方包含另一方（全称包含简称）
      if (na.length >= 4 && nb.length >= 4) {
        if (na.includes(nb) || nb.includes(na)) return true;
      }
    }
  }
  return false;
}

function deduplicateByCompany(items: FundingItem[]): FundingItem[] {
  const result: FundingItem[] = [];

  for (const item of items) {
    // 检查是否已有相同企业
    const existingIdx = result.findIndex(existing => isSameCompany(existing, item));

    if (existingIdx === -1) {
      // 新企业，直接加入
      result.push(item);
    } else {
      // 重复企业，保留信息更全的那一条
      const existing = result[existingIdx];
      const existingScore = (existing.investedCompany ? 2 : 0) + (existing.amount && existing.amount !== "未披露" ? 1 : 0) + existing.desc.length / 100;
      const newScore = (item.investedCompany ? 2 : 0) + (item.amount && item.amount !== "未披露" ? 1 : 0) + item.desc.length / 100;
      if (newScore > existingScore) {
        result[existingIdx] = item;
      }
    }
  }

  return result;
}

// ─── 数据库存储 ──────────────────────────────────────────

async function saveFundingItems(items: FundingItem[], reportDate: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    for (const item of items) {
      // 用link做唯一键，避免重复插入
      await db.insert(fundingItems).values({
        reportDate,
        title: item.title,
        link: item.link,
        published: item.published,
        desc: item.desc,
        investedCompany: item.investedCompany || null,
        investedCompanyShort: item.investedCompanyShort || null,
        investors: item.investors ? JSON.stringify(item.investors) : null,
        amount: item.amount || null,
        round: item.round || null,
        industry: item.industry || null,
      }).onDuplicateKeyUpdate({
        set: {
          investedCompany: item.investedCompany || null,
          investedCompanyShort: item.investedCompanyShort || null,
          investors: item.investors ? JSON.stringify(item.investors) : null,
          amount: item.amount || null,
          round: item.round || null,
          industry: item.industry || null,
        },
      });
    }
    console.log(`[Funding] Saved ${items.length} items to DB`);
  } catch (err) {
    console.warn("[Funding] DB save failed:", err);
  }
}
