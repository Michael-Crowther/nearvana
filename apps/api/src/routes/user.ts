import { router, procedure } from "../trpc/init";
import { TRPCError } from "@trpc/server";
import { db } from "../db/client";
import { user } from "../db/schema";
import { eq } from "drizzle-orm";

export const userRouter = router({
  loggedInUser: procedure.query(async ({ ctx: { auth } }) => {
    const [userRow] = await db
      .select()
      .from(user)
      .where(eq(user.id, auth.user.id));
    return userRow;
  }),
});
