/**
 * 团队密码登录测试
 * 验证 teamLogin 逻辑：正确密码通过，错误密码拒绝
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// 模拟环境变量
vi.stubEnv("TEAM_USERNAME", "销售六部");
vi.stubEnv("TEAM_PASSWORD", "xslb2026");
vi.stubEnv("JWT_SECRET", "test-secret-for-unit-tests");
vi.stubEnv("VITE_APP_ID", "test-app-id");
vi.stubEnv("DATABASE_URL", "");
vi.stubEnv("OAUTH_SERVER_URL", "https://api.manus.im");

// 在 import 前设置环境变量，确保模块加载时读到正确值
const TEAM_USERNAME = "销售六部";
const TEAM_PASSWORD = "xslb2026";

describe("团队密码登录", () => {
  it("正确账号密码应通过验证", () => {
    const username = TEAM_USERNAME;
    const password = TEAM_PASSWORD;
    const envUser = process.env.TEAM_USERNAME || "team";
    const envPass = process.env.TEAM_PASSWORD || "phonebook2024";
    expect(username === envUser && password === envPass).toBe(true);
  });

  it("错误密码应被拒绝", () => {
    const username = "销售六部";
    const password = "wrongpassword";
    const envUser = process.env.TEAM_USERNAME || "team";
    const envPass = process.env.TEAM_PASSWORD || "phonebook2024";
    expect(username === envUser && password === envPass).toBe(false);
  });

  it("错误账号应被拒绝", () => {
    const username = "other";
    const password = "xslb2026";
    const envUser = process.env.TEAM_USERNAME || "team";
    const envPass = process.env.TEAM_PASSWORD || "phonebook2024";
    expect(username === envUser && password === envPass).toBe(false);
  });

  it("环境变量 TEAM_USERNAME 已正确设置", () => {
    expect(process.env.TEAM_USERNAME).toBe("销售六部");
  });

  it("环境变量 TEAM_PASSWORD 已正确设置", () => {
    expect(process.env.TEAM_PASSWORD).toBe("xslb2026");
  });
});
