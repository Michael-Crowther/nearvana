// context.ts
import type { Context as HonoContext } from "hono";
import { auth } from "../db/auth/auth";
import { TRPCError } from "@trpc/server";

export async function createContext(_opts: any, c: HonoContext) {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return {
    auth: session,
    env: c.env,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
