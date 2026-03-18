import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { searchContacts, updateContact, getContactById, getContactsCount, writeEditLogs, getContactEditHistory, listEditLogs, revertEditLog } from "./db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { runDailyFundingReport } from "./funding";

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
      .input(z.object({
        username: z.string(),
        password: z.string(),
        userName: z.string().min(1, "姓名不能为空").max(32, "姓名最夓32个字符"),
      }))
      .mutation(async ({ ctx, input }) => {
        if (input.username !== TEAM_USERNAME || input.password !== TEAM_PASSWORD) {
          throw new Error("账号或密码错误");
        }
        // 将用户输入的姓名写入 JWT——后续编辑操作将使用该姓名
        const token = await sdk.signSession(
          { openId: "team-user", appId: ENV.appId || "phonebook", name: input.userName },
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
        const editedBy = ctx.user?.name || "团队成员";

        // 先读取旧值，用于对比变更
        const oldContact = await getContactById(id);
        const oldData: Record<string, string | null> = {
          company: oldContact?.company ?? null,
          contactName: oldContact?.contactName ?? null,
          title: oldContact?.title ?? null,
          phone: oldContact?.phone ?? null,
          email: oldContact?.email ?? null,
        };

        // 构建新值（只包含本次传入的字段）
        const newData: Record<string, string | null> = {};
        if (data.company !== undefined) newData.company = data.company || null;
        if (data.contactName !== undefined) newData.contactName = data.contactName || null;
        if (data.title !== undefined) newData.title = data.title || null;
        if (data.phone !== undefined) newData.phone = data.phone || null;
        if (data.email !== undefined) newData.email = data.email || null;

        // 执行更新
        await updateContact(id, { ...data, updatedBy: editedBy });

        // 写入编辑历史
        await writeEditLogs(
          id,
          oldData,
          newData,
          editedBy,
          { company: oldContact?.company ?? null, contactName: oldContact?.contactName ?? null }
        );

        return { success: true };
      }),

    // 获取单条联系人的编辑历史
    getHistory: protectedProcedure
      .input(z.object({ contactId: z.number().int() }))
      .query(async ({ input }) => {
        return await getContactEditHistory(input.contactId);
      }),

    // 获取单条记录（需要登录）
    getById: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .query(async ({ input }) => {
        return await getContactById(input.id);
      }),
  }),

  // 融资日报触发接口
  funding: router({
    // 手动触发融资日报（需要登录）
    triggerReport: protectedProcedure
      .mutation(async () => {
        const result = await runDailyFundingReport();
        return result;
      }),

    // cron-job.org 定时触发（用密钥验证，无需登录）
    // 通过 POST /api/funding-cron?key=<CRON_SECRET> 触发
  }),

  editLogs: router({
    // 全局编辑历史（分页）
    list: protectedProcedure
      .input(z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(30),
        editedBy: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await listEditLogs(input);
      }),

    // 撤销一条编辑记录
    revert: protectedProcedure
      .input(z.object({ logId: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        const revertedBy = ctx.user?.name || "团队成员";
        return await revertEditLog(input.logId, revertedBy);
      }),
  }),
});

export type AppRouter = typeof appRouter;
