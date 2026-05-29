import { z } from "zod";
import { router, procedure } from "./init";
import { auth } from "../db/auth/auth";
import { user } from "../db/schema";
import { userRouter } from "../routes/user";
import { searchEventsRouter } from "../routes/search-events";

export const appRouter = router({
  hello: procedure.input(z.object({ text: z.string() })).query(({ input }) => {
    return { greeting: `Hello ${input.text}` };
  }),
  user: userRouter,
  searchEvents: searchEventsRouter,
});

export type AppRouter = typeof appRouter;
