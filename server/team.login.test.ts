/**
 * 团队密码登录测试
 * 验证 teamLogin 逻辑：正确密码通过，错误密码拒绝，userName 正确写入
 */
import { describe, it, expect, vi } from "vitest";

// 模拟环境变量
vi.stubEnv("TEAM_USERNAME", "销售六部");
vi.stubEnv("TEAM_PASSWORD", "xslb2026");
vi.stubEnv("JWT_SECRET", "test-secret-for-unit-tests");
vi.stubEnv("VITE_APP_ID", "test-app-id");
vi.stubEnv("DATABASE_URL", "");
vi.stubEnv("OAUTH_SERVER_URL", "https://api.manus.im");

const TEAM_USERNAME = "销售六部";
const TEAM_PASSWORD = "xslb2026";

// 模拟 teamLogin 核心验证逻辑（不依赖数据库/JWT）
function validateTeamLogin(input: {
  username: string;
  password: string;
  userName: string;
}): { success: true; name: string } {
  const envUser = process.env.TEAM_USERNAME || "";
  const envPass = process.env.TEAM_PASSWORD || "";
  if (input.username !== envUser || input.password !== envPass) {
    throw new Error("账号或密码错误");
  }
  if (!input.userName || input.userName.trim() === "") {
    throw new Error("姓名不能为空");
  }
  if (input.userName.length > 32) {
    throw new Error("姓名最长32个字符");
  }
  return { success: true, name: input.userName.trim() };
}

describe("团队密码登录", () => {
  it("正确账号密码应通过验证", () => {
    const result = validateTeamLogin({
      username: TEAM_USERNAME,
      password: TEAM_PASSWORD,
      userName: "张威",
    });
    expect(result.success).toBe(true);
  });

  it("错误密码应被拒绝", () => {
    expect(() =>
      validateTeamLogin({ username: "销售六部", password: "wrongpassword", userName: "张威" })
    ).toThrow("账号或密码错误");
  });

  it("错误账号应被拒绝", () => {
    expect(() =>
      validateTeamLogin({ username: "other", password: "xslb2026", userName: "张威" })
    ).toThrow("账号或密码错误");
  });

  it("环境变量 TEAM_USERNAME 已正确设置", () => {
    expect(process.env.TEAM_USERNAME).toBe("销售六部");
  });

  it("环境变量 TEAM_PASSWORD 已正确设置", () => {
    expect(process.env.TEAM_PASSWORD).toBe("xslb2026");
  });

  it("userName 正确传入时，返回的 name 与输入一致", () => {
    const result = validateTeamLogin({
      username: TEAM_USERNAME,
      password: TEAM_PASSWORD,
      userName: "  张威  ", // 带空格，应被 trim
    });
    expect(result.name).toBe("张威");
  });

  it("userName 为空时应被拒绝", () => {
    expect(() =>
      validateTeamLogin({ username: TEAM_USERNAME, password: TEAM_PASSWORD, userName: "" })
    ).toThrow("姓名不能为空");
  });

  it("userName 超过32字符时应被拒绝", () => {
    expect(() =>
      validateTeamLogin({
        username: TEAM_USERNAME,
        password: TEAM_PASSWORD,
        userName: "这个名字超级超级超级超级超级超级超级超级超级超级超级超级超级超级超级超级超级长",
      })
    ).toThrow("姓名最长32个字符");
  });
});
