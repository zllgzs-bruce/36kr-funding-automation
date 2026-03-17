import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { searchContacts, updateContact, getContactById, getContactsCount } from "./db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

// 团队共享密码（通过环境变量配置）
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || "phonebook2024";
const TEAM_USERNAME = process.env.TEAM_USERNAME || "team";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    // 统一账号密码登录（不依赖 Manus OAuth）
    teamLogin: publicProcedure
      .input(z.object({ username: z.string(), password: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (input.username !== TEAM_USERNAME || input.password !== TEAM_PASSWORD) {
          throw new Error("账号或密码错误");
        }
        // 使用 sdk.signSession 生成与框架兼容的 JWT（包含 openId / appId / name）
        const token = await sdk.signSession(
          { openId: "team-user", appId: ENV.appId || "phonebook", name: "团队成员" },
          { expiresInMs: 30 * 24 * 60 * 60 * 1000 }
        );

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
        return { success: true };
      }),
  }),

  contacts: router({
    // 搜索接口（需要登录）
    search: protectedProcedure
      .input(z.object({
        company: z.string().optional(),
        contactName: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }))
      .query(async ({ input }) => {
        return await searchContacts(input);
      }),

    // 获取总数（需要登录）
    count: protectedProcedure.query(async () => {
      return await getContactsCount();
    }),

    // 编辑联系人（需要登录）
    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        company: z.string().optional(),
        contactName: z.string().optional(),
        title: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const updatedBy = ctx.user?.name || "团队成员";
        await updateContact(id, { ...data, updatedBy });
        return { success: true };
      }),

    // 获取单条记录（需要登录）
    getById: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input }) => {
        return await getContactById(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
