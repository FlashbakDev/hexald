import cors from "@fastify/cors";
import Fastify from "fastify";
import { createDb } from "@hexald/db";
import { env } from "./env.ts";
import { actionRoutes } from "./routes/actions.ts";
import { contentRoutes } from "./routes/content.ts";
import { healthRoutes } from "./routes/health.ts";
import { worldRoutes } from "./routes/worlds.ts";
import { sessionPlugin, sessionRoutes } from "./session/index.ts";

export async function buildApp() {
  const app = Fastify({
    logger: env.isDev
      ? {
          transport: {
            target: "pino-pretty",
            options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" }
          }
        }
      : true
  });

  const { db, client } = createDb(env.databaseUrl);
  app.decorate("db", db);
  app.decorate("dbClient", client);

  app.addHook("onClose", async () => {
    await client.end({ timeout: 5 });
  });

  await app.register(cors, {
    origin: env.corsOrigins,
    credentials: true
  });

  await sessionPlugin(app);

  await app.register(healthRoutes);
  await app.register(sessionRoutes, { prefix: "/v1" });
  await app.register(contentRoutes, { prefix: "/v1" });
  await app.register(worldRoutes, { prefix: "/v1" });
  await app.register(actionRoutes, { prefix: "/v1" });

  return app;
}
