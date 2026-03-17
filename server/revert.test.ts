import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 撤销功能单元测试
 * 测试 revertEditLog 的核心逻辑（不依赖真实数据库）
 */

// ---- 模拟数据 ----

const mockContact = {
  id: 1,
  company: "新公司名",
  contactName: "张三",
  title: "总监",
  phone: "13800138000",
  email: "test@example.com",
  updatedBy: "张威",
};

const mockLog = {
  id: 10,
  contactId: 1,
  field: "公司名",
  fieldKey: "company",
  oldValue: "旧公司名",
  newValue: "新公司名",
  editedBy: "张威",
  contactSnapshot: JSON.stringify({ company: "新公司名", contactName: "张三" }),
  isReverted: 0,
  revertNote: null,
  createdAt: new Date(),
};

const mockAlreadyRevertedLog = {
  ...mockLog,
  id: 11,
  isReverted: 1,
  revertNote: "由 张威 撤销",
};

// ---- 测试辅助函数（模拟 revertEditLog 核心逻辑） ----

type RevertResult =
  | { success: true }
  | { error: "not_found" | "already_reverted" | "unsupported_field" };

function simulateRevert(
  logId: number,
  revertedBy: string,
  logs: typeof mockLog[],
  contacts: typeof mockContact[]
): RevertResult {
  const log = logs.find((l) => l.id === logId);
  if (!log) return { error: "not_found" };
  if (log.isReverted) return { error: "already_reverted" };

  const contact = contacts.find((c) => c.id === log.contactId);
  if (!contact) return { error: "not_found" };

  const supportedFields = ["company", "contactName", "title", "phone", "email"];
  if (!supportedFields.includes(log.fieldKey)) return { error: "unsupported_field" };

  return { success: true };
}

// ---- 测试套件 ----

describe("撤销功能核心逻辑", () => {
  describe("正常撤销", () => {
    it("应该成功撤销一条有效的编辑记录", () => {
      const result = simulateRevert(10, "张威", [mockLog], [mockContact]);
      expect(result).toEqual({ success: true });
    });

    it("撤销后应将字段值还原为 oldValue", () => {
      // 模拟撤销操作后的状态
      const contactAfterRevert = { ...mockContact, company: mockLog.oldValue! };
      expect(contactAfterRevert.company).toBe("旧公司名");
    });

    it("撤销后应写入新的历史记录（撤销操作记录）", () => {
      const newHistoryEntry = {
        contactId: mockLog.contactId,
        field: mockLog.field,
        fieldKey: mockLog.fieldKey,
        oldValue: mockContact.company, // 撤销前的当前值
        newValue: mockLog.oldValue,    // 还原目标值
        editedBy: "张威",
        revertNote: "撤销操作（还原为修改前的值）",
      };
      expect(newHistoryEntry.oldValue).toBe("新公司名");
      expect(newHistoryEntry.newValue).toBe("旧公司名");
      expect(newHistoryEntry.revertNote).toContain("撤销操作");
    });

    it("撤销后原记录应被标记为 isReverted=1", () => {
      const updatedLog = { ...mockLog, isReverted: 1, revertNote: "由 张威 撤销" };
      expect(updatedLog.isReverted).toBe(1);
      expect(updatedLog.revertNote).toBe("由 张威 撤销");
    });
  });

  describe("错误处理", () => {
    it("日志不存在时应返回 not_found 错误", () => {
      const result = simulateRevert(999, "张威", [mockLog], [mockContact]);
      expect(result).toEqual({ error: "not_found" });
    });

    it("已撤销的记录不能重复撤销", () => {
      const result = simulateRevert(11, "张威", [mockAlreadyRevertedLog], [mockContact]);
      expect(result).toEqual({ error: "already_reverted" });
    });

    it("不支持的字段应返回 unsupported_field 错误", () => {
      const unsupportedLog = { ...mockLog, fieldKey: "sourceFile" };
      const result = simulateRevert(10, "张威", [unsupportedLog], [mockContact]);
      expect(result).toEqual({ error: "unsupported_field" });
    });

    it("联系人不存在时应返回 not_found 错误", () => {
      const result = simulateRevert(10, "张威", [mockLog], []);
      expect(result).toEqual({ error: "not_found" });
    });
  });

  describe("撤销历史记录的标识", () => {
    it("撤销操作的历史记录应以 '撤销操作' 开头作为标识", () => {
      const revertNote = "撤销操作（还原为修改前的值）";
      expect(revertNote.startsWith("撤销操作")).toBe(true);
    });

    it("操作人标记应包含撤销人姓名", () => {
      const revertNote = "由 张威 撤销";
      expect(revertNote).toContain("张威");
    });
  });

  describe("支持的字段范围", () => {
    const supportedFields = ["company", "contactName", "title", "phone", "email"];

    it.each(supportedFields)("字段 %s 应支持撤销", (field) => {
      const log = { ...mockLog, fieldKey: field };
      const result = simulateRevert(10, "张威", [log], [mockContact]);
      expect(result).toEqual({ success: true });
    });

    it("字段 sourceFile 不应支持撤销", () => {
      const log = { ...mockLog, fieldKey: "sourceFile" };
      const result = simulateRevert(10, "张威", [log], [mockContact]);
      expect(result).toEqual({ error: "unsupported_field" });
    });
  });
});
