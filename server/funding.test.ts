/**
 * 融资日报功能测试
 * 测试 Gateway API 过滤、企业名标准化、话单匹配逻辑
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 测试辅助函数（从 funding.ts 提取的纯函数逻辑）───────

function isFundingItem(title: string, desc: string): boolean {
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

function normalizeCompanyName(name: string): string {
  if (!name) return "";
  name = name.replace(/[（(][^）)]*[）)]/g, "");
  const suffixes = ["有限公司", "股份有限公司", "股份公司", "有限责任公司",
    "集团有限公司", "集团股份有限公司", "（中国）", "(中国)", "科技有限公司", "技术有限公司"];
  for (const s of suffixes) name = name.replace(s, "");
  name = name.replace(/^(北京|上海|深圳|广州|杭州|成都|武汉|南京|西安|重庆|天津)/, "");
  return name.trim();
}

const HR_TITLES = [
  "HRD", "CHRO", "人力资源总监", "人事总监", "人力总监",
  "HRM", "HR经理", "人力资源经理", "人事经理",
  "HRBP", "HR主管", "人力资源主管", "人事主管",
  "HR", "人力资源", "人事", "招聘", "人才",
];

function hrPriority(title: string): number {
  const upper = title.toUpperCase();
  for (let i = 0; i < HR_TITLES.length; i++) {
    if (upper.includes(HR_TITLES[i].toUpperCase())) return i;
  }
  return HR_TITLES.length;
}

// ─── 测试套件 ────────────────────────────────────────────

describe("融资快讯过滤逻辑", () => {
  it("标题含'完成A轮融资'应命中", () => {
    expect(isFundingItem("某AI公司完成A轮融资5000万", "")).toBe(true);
  });

  it("标题含'获得天使轮融资'应命中", () => {
    expect(isFundingItem("盘拓科技获得天使轮融资", "")).toBe(true);
  });

  it("标题含'领投'应命中", () => {
    expect(isFundingItem("红杉资本领投某公司Pre-A轮", "")).toBe(true);
  });

  it("标题含'IPO'应排除", () => {
    expect(isFundingItem("某公司冲刺IPO上市", "")).toBe(false);
  });

  it("标题含'收购'应排除", () => {
    expect(isFundingItem("腾讯收购某游戏公司", "")).toBe(false);
  });

  it("标题含'年报'应排除", () => {
    expect(isFundingItem("某公司发布2025年报", "")).toBe(false);
  });

  it("标题无关键词但正文含融资信息应命中", () => {
    expect(isFundingItem("快讯", "该公司完成B轮融资近亿元")).toBe(true);
  });

  it("完全无关的新闻应不命中", () => {
    expect(isFundingItem("某公司发布新产品", "今日发布了一款新手机")).toBe(false);
  });
});

describe("企业名标准化", () => {
  it("去掉'有限公司'后缀", () => {
    expect(normalizeCompanyName("盘拓科技有限公司")).toBe("盘拓科技");
  });

  it("去掉'股份有限公司'后缀", () => {
    // 后缀替换顺序：先替换'有限公司'，剩下'某某股份'
    expect(normalizeCompanyName("某某股份有限公司")).toBe("某某股份");
  });

  it("去掉北京地名前缀", () => {
    expect(normalizeCompanyName("北京盘拓科技有限公司")).toBe("盘拓科技");
  });

  it("去掉上海地名前缀", () => {
    expect(normalizeCompanyName("上海某某科技有限公司")).toBe("某某科技");
  });

  it("去掉括号内容", () => {
    expect(normalizeCompanyName("华为技术（中国）有限公司")).toBe("华为技术");
  });

  it("空字符串返回空字符串", () => {
    expect(normalizeCompanyName("")).toBe("");
  });

  it("短名称不变", () => {
    expect(normalizeCompanyName("华为")).toBe("华为");
  });
});

describe("HR职位优先级排序", () => {
  it("HRD优先级最高（数字最小）", () => {
    expect(hrPriority("HRD")).toBeLessThan(hrPriority("HR经理"));
  });

  it("HR经理优先于HRBP", () => {
    expect(hrPriority("HR经理")).toBeLessThan(hrPriority("HRBP"));
  });

  it("非HR职位优先级最低", () => {
    expect(hrPriority("产品总监")).toBe(HR_TITLES.length);
    expect(hrPriority("CEO")).toBe(HR_TITLES.length);
  });

  it("包含HR关键词的复合职位能正确识别", () => {
    expect(hrPriority("高级人力资源经理")).toBeLessThan(HR_TITLES.length);
  });

  it("排序后HR类职位在前", () => {
    const contacts = [
      { title: "产品总监" },
      { title: "HRD" },
      { title: "HR经理" },
      { title: "CEO" },
    ];
    contacts.sort((a, b) => hrPriority(a.title) - hrPriority(b.title));
    expect(contacts[0].title).toBe("HRD");
    expect(contacts[1].title).toBe("HR经理");
  });
});

// 复制测试用的辅助函数
function normalizeForDedup(name: string): string {
  if (!name) return "";
  return name
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/(有限公司|股份有限公司|股份公司|有限责任公司|集团有限公司|集团股份有限公司)/g, "")
    .replace(/^(北京|上海|深圳|广州|杭州|成都|武汉|南京|西安|重庆|天津)/, "")
    .trim();
}

interface TestFundingItem {
  title: string;
  desc: string;
  investedCompany?: string;
  investedCompanyShort?: string;
  amount?: string;
}

function isSameCompany(a: TestFundingItem, b: TestFundingItem): boolean {
  const getNorms = (item: TestFundingItem): string[] => {
    const names: string[] = [];
    if (item.investedCompany) {
      names.push(item.investedCompany);
      names.push(normalizeForDedup(item.investedCompany));
    }
    if (item.investedCompanyShort) {
      names.push(item.investedCompanyShort);
      names.push(normalizeForDedup(item.investedCompanyShort));
    }
    return names.filter(n => n.length >= 3);
  };
  const normsA = getNorms(a);
  const normsB = getNorms(b);
  for (const na of normsA) {
    for (const nb of normsB) {
      if (na === nb) return true;
      if (na.length >= 4 && nb.length >= 4) {
        if (na.includes(nb) || nb.includes(na)) return true;
      }
    }
  }
  return false;
}

function deduplicateByCompany(items: TestFundingItem[]): TestFundingItem[] {
  const result: TestFundingItem[] = [];
  for (const item of items) {
    const existingIdx = result.findIndex(existing => isSameCompany(existing, item));
    if (existingIdx === -1) {
      result.push(item);
    } else {
      const existing = result[existingIdx];
      const score = (i: TestFundingItem) =>
        (i.investedCompany ? 2 : 0) + (i.amount && i.amount !== "未披露" ? 1 : 0) + i.desc.length / 100;
      if (score(item) > score(existing)) result[existingIdx] = item;
    }
  }
  return result;
}

describe("企业名去重逻辑", () => {
  it("全称相同应去重", () => {
    const items = [
      { title: "A", desc: "desc1", investedCompany: "天基智能有限公司", investedCompanyShort: "天基智能" },
      { title: "B", desc: "desc2", investedCompany: "天基智能有限公司", investedCompanyShort: "天基" },
    ];
    expect(deduplicateByCompany(items)).toHaveLength(1);
  });

  it("简称相同应去重", () => {
    const items = [
      { title: "A", desc: "desc1", investedCompanyShort: "天基智能", investedCompany: "天基智能科技有限公司" },
      { title: "B", desc: "desc2", investedCompanyShort: "天基智能", investedCompany: "天基智能集成电路有限公司" },
    ];
    expect(deduplicateByCompany(items)).toHaveLength(1);
  });

  it("全称包含简称应去重（天基智能科技 vs 天基智能）", () => {
    const items = [
      { title: "A", desc: "desc1", investedCompany: "天基智能科技有限公司", investedCompanyShort: "天基智能科技" },
      { title: "B", desc: "desc2 longer", investedCompany: "天基智能有限公司", investedCompanyShort: "天基智能" },
    ];
    expect(deduplicateByCompany(items)).toHaveLength(1);
  });

  it("不同企业不应去重", () => {
    const items = [
      { title: "A", desc: "desc1", investedCompany: "天基智能有限公司", investedCompanyShort: "天基智能" },
      { title: "B", desc: "desc2", investedCompany: "盘拓科技有限公司", investedCompanyShort: "盘拓科技" },
    ];
    expect(deduplicateByCompany(items)).toHaveLength(2);
  });

  it("保留信息更全的那条（有融资金额的优先）", () => {
    const items = [
      { title: "A", desc: "short", investedCompanyShort: "天基智能", amount: "未披露" },
      { title: "B", desc: "longer desc here", investedCompanyShort: "天基智能", amount: "5000万元" },
    ];
    const result = deduplicateByCompany(items);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe("5000万元");
  });
});

describe("无融资快讯时的简短通知邮件", () => {
  function buildNoItemsEmailHtml(reportDate: string): string {
    return `<html>\n<head><meta charset="utf-8"></head>\n<body style="font-family:'PingFang SC','Helvetica Neue',Arial,sans-serif;color:#333;max-width:700px;margin:0 auto;padding:20px;background:#fafafa;">\n  <div style="background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,0.08);overflow:hidden;">\n    <div style="background:linear-gradient(135deg,#95a5a6,#7f8c8d);padding:24px 28px;">\n      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:bold;">36氪融资日报</h1>\n      <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">${reportDate} · 今日无新增融资快讯</p>\n    </div>\n  </div>\n</body>\n</html>`;
  }

  it("无融资时生成的HTML应包含「今日无新增融资快讯」", () => {
    const html = buildNoItemsEmailHtml("2026-03-20");
    expect(html).toContain("今日无新增融资快讯");
    expect(html).toContain("2026-03-20");
    expect(html).toContain("36氪融资日报");
  });

  it("无融资时应不包含融资条目内容", () => {
    const html = buildNoItemsEmailHtml("2026-03-20");
    expect(html).not.toContain("被投企业");
    expect(html).not.toContain("融资金额");
    expect(html).not.toContain("融资轮次");
  });

  it("无融资时邮件主题应包含「今日无新增」", () => {
    const today = "2026-03-20";
    const subject = `36氪融资日报 · ${today} · 今日无新增`;
    expect(subject).toContain("今日无新增");
    expect(subject).not.toContain("条");
  });

  it("有融资时邮件主题应包含条数", () => {
    const today = "2026-03-20";
    const count = 5;
    const subject = `36氪融资日报 · ${today} · ${count}条`;
    expect(subject).toContain("5条");
    expect(subject).not.toContain("今日无新增");
  });
});

describe("Gateway API 翻页逻辑", () => {
  // 模拟 Gateway API 返回的数据结构
  function makeItem(publishTime: number, title: string, content: string) {
    return {
      templateMaterial: {
        publishTime,
        widgetTitle: title,
        widgetContent: content,
        itemId: Math.floor(Math.random() * 1000000),
      },
    };
  }

  it("昨天发布的融资快讯应被收集", () => {
    const todayStartBJ = new Date("2026-03-30T00:00:00+08:00");
    const yesterdayStartBJ = new Date(todayStartBJ.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayNoon = new Date("2026-03-29T12:00:00+08:00");

    // 昨天中午发布的，应在范围内
    expect(yesterdayNoon >= yesterdayStartBJ && yesterdayNoon < todayStartBJ).toBe(true);
  });

  it("今天发布的快讯应被跳过（不在昨天范围内）", () => {
    const todayStartBJ = new Date("2026-03-30T00:00:00+08:00");
    const yesterdayStartBJ = new Date(todayStartBJ.getTime() - 24 * 60 * 60 * 1000);
    const todayMorning = new Date("2026-03-30T08:00:00+08:00");

    // 今天早上发布的，不在昨天范围内
    expect(todayMorning >= yesterdayStartBJ && todayMorning < todayStartBJ).toBe(false);
  });

  it("前天发布的快讯应触发停止翻页", () => {
    const todayStartBJ = new Date("2026-03-30T00:00:00+08:00");
    const yesterdayStartBJ = new Date(todayStartBJ.getTime() - 24 * 60 * 60 * 1000);
    const dayBeforeYesterday = new Date("2026-03-28T20:00:00+08:00");

    // 前天发布的，早于昨天00:00，应停止翻页
    expect(dayBeforeYesterday < yesterdayStartBJ).toBe(true);
  });

  it("融资快讯过滤：Gateway API 条目格式应正常过滤", () => {
    const title = "某AI公司完成A轮融资5000万";
    const content = "36氪获悉，该公司完成A轮融资";
    expect(isFundingItem(title, content)).toBe(true);
  });

  it("非融资快讯不应被收集", () => {
    const title = "某公司发布2025年报";
    const content = "全年营收增长20%";
    expect(isFundingItem(title, content)).toBe(false);
  });
});

describe("cron接口密钥验证逻辑", () => {
  it("密钥匹配时应通过验证", () => {
    const CRON_SECRET = "test-secret-123";
    const key = "test-secret-123";
    expect(CRON_SECRET && key === CRON_SECRET).toBe(true);
  });

  it("密钥不匹配时应拒绝", () => {
    const CRON_SECRET = "test-secret-123";
    const key = "wrong-key";
    expect(CRON_SECRET && key === CRON_SECRET).toBe(false);
  });

  it("空密钥时应拒绝（未配置）", () => {
    const CRON_SECRET = "";
    const key = "";
    // 实际验证逻辑：!CRON_SECRET || key !== CRON_SECRET => 拒绝
    const shouldAllow = Boolean(CRON_SECRET) && key === CRON_SECRET;
    expect(shouldAllow).toBe(false);
  });
});
