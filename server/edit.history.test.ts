/**
 * 编辑历史功能测试
 * 验证 writeEditLogs 的核心逻辑：字段变更检测、只记录实际变化的字段
 */
import { describe, it, expect } from "vitest";

// ── 内联 writeEditLogs 的核心逻辑（不依赖数据库）──
const FIELD_LABELS: Record<string, string> = {
  company: "公司名",
  contactName: "联系人姓名",
  title: "职位",
  phone: "电话",
  email: "邮箱",
};

function computeEditLogs(
  oldData: Record<string, string | null>,
  newData: Record<string, string | null>,
  editedBy: string,
  snapshot: { company: string | null; contactName: string | null }
) {
  const logs: Array<{
    field: string;
    fieldKey: string;
    oldValue: string | null;
    newValue: string | null;
    editedBy: string;
    contactSnapshot: string;
  }> = [];

  for (const key of Object.keys(newData)) {
    const oldVal = oldData[key] ?? null;
    const newVal = newData[key] ?? null;
    if (oldVal !== newVal) {
      logs.push({
        field: FIELD_LABELS[key] ?? key,
        fieldKey: key,
        oldValue: oldVal,
        newValue: newVal,
        editedBy,
        contactSnapshot: JSON.stringify(snapshot),
      });
    }
  }
  return logs;
}

describe("编辑历史 - writeEditLogs 核心逻辑", () => {
  it("修改单个字段时，只生成一条历史记录", () => {
    const logs = computeEditLogs(
      { company: "老公司", contactName: "张三", title: "HR", phone: null, email: null },
      { company: "新公司" },
      "团队成员",
      { company: "老公司", contactName: "张三" }
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].fieldKey).toBe("company");
    expect(logs[0].field).toBe("公司名");
    expect(logs[0].oldValue).toBe("老公司");
    expect(logs[0].newValue).toBe("新公司");
    expect(logs[0].editedBy).toBe("团队成员");
  });

  it("修改多个字段时，生成多条历史记录", () => {
    const logs = computeEditLogs(
      { company: "老公司", contactName: "张三", title: "HR", phone: null, email: null },
      { company: "新公司", title: "HRD" },
      "销售六部",
      { company: "老公司", contactName: "张三" }
    );
    expect(logs).toHaveLength(2);
    const keys = logs.map((l) => l.fieldKey);
    expect(keys).toContain("company");
    expect(keys).toContain("title");
  });

  it("值未变化时，不生成历史记录", () => {
    const logs = computeEditLogs(
      { company: "同一公司", contactName: "李四", title: "CTO", phone: null, email: null },
      { company: "同一公司" }, // 值相同
      "团队成员",
      { company: "同一公司", contactName: "李四" }
    );
    expect(logs).toHaveLength(0);
  });

  it("从有值改为空值时，正确记录", () => {
    const logs = computeEditLogs(
      { company: "某公司", contactName: "王五", title: "Manager", phone: "13800138000", email: null },
      { phone: null },
      "团队成员",
      { company: "某公司", contactName: "王五" }
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].fieldKey).toBe("phone");
    expect(logs[0].oldValue).toBe("13800138000");
    expect(logs[0].newValue).toBeNull();
  });

  it("从空值改为有值时，正确记录", () => {
    const logs = computeEditLogs(
      { company: "某公司", contactName: "赵六", title: null, phone: null, email: null },
      { email: "test@example.com" },
      "团队成员",
      { company: "某公司", contactName: "赵六" }
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].fieldKey).toBe("email");
    expect(logs[0].oldValue).toBeNull();
    expect(logs[0].newValue).toBe("test@example.com");
  });

  it("contactSnapshot 正确序列化为 JSON", () => {
    const logs = computeEditLogs(
      { company: "保险极客", contactName: "张威", title: "销售总监", phone: null, email: null },
      { title: "区域总监" },
      "张威",
      { company: "保险极客", contactName: "张威" }
    );
    expect(logs).toHaveLength(1);
    const snapshot = JSON.parse(logs[0].contactSnapshot);
    expect(snapshot.company).toBe("保险极客");
    expect(snapshot.contactName).toBe("张威");
  });

  it("字段中文标签映射正确", () => {
    const cases: Array<[string, string]> = [
      ["company", "公司名"],
      ["contactName", "联系人姓名"],
      ["title", "职位"],
      ["phone", "电话"],
      ["email", "邮箱"],
    ];
    for (const [key, label] of cases) {
      expect(FIELD_LABELS[key]).toBe(label);
    }
  });
});
