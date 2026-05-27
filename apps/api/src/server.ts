import { Hono, HonoRequest } from "hono";
import { auth } from "./db/auth/auth";
import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "./trpc/router";
import { cors } from "hono/cors";
import { createContext } from "./trpc/context";

const app = new Hono();

app.get("/", (c) => c.text("Hono API running 🚀"));

const port = 8080;

app.use(
  "*",
  cors({
    origin: "http://localhost:3000",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
  })
);

serve({
  fetch: app.fetch,
  port,
});

console.log(`🚀 API listening on http://localhost:${port}`);
