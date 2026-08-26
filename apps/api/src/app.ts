import cors from "@fastify/cors";
import Fastify from "fastify";
import { createDb } from "@hexald/db";
import { env } from "./env.ts";
import { adminRoutes } from "./routes/admin.ts";
import { contentRoutes } from "./routes/content.ts";
import { healthRoutes } from "./routes/health.ts";
import { supportRoutes } from "./routes/support.ts";
import { worldRoutes } from "./routes/worlds.ts";
import { sessionPlugin, sessionRoutes } from "./session/index.ts";
import { getFirebaseAdminInitError, isFirebaseAdminReady } from "./firebase.ts";
import { isSupportMailConfigured } from "./support/mail.ts";

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

  if (!isFirebaseAdminReady()) {
    app.log.warn(
      {
        reason: getFirebaseAdminInitError() ?? "FIREBASE_* missing in apps/api/.env"
      },
      "Firebase Admin not ready"
    );
  } else {
    app.log.info({ projectId: env.firebase!.projectId }, "Firebase Admin ready");
  }

  if (isSupportMailConfigured()) {
    app.log.info(
      { to: env.supportTo, from: env.supportFrom },
      "Resend support mail ready"
    );
  } else if (env.isDev) {
    app.log.warn(
      "RESEND_API_KEY missing — support reports are logged only (no email)"
    );
  } else {
    app.log.warn(
      "RESEND_API_KEY missing — POST /v1/support will return 503"
    );
  }

  if (env.adminEmails.size === 0) {
    app.log.warn(
      "ADMIN_EMAILS empty — /v1/admin/* is unreachable until configured"
    );
  } else {
    app.log.info(
      { count: env.adminEmails.size },
      "Admin access configured (Firebase + allowlist)"
    );
  }

  await app.register(healthRoutes);
  await app.register(sessionRoutes, { prefix: "/v1" });
  await app.register(contentRoutes, { prefix: "/v1" });
  await app.register(worldRoutes, { prefix: "/v1" });
  await app.register(supportRoutes, { prefix: "/v1" });
  await app.register(adminRoutes, { prefix: "/v1" });

  return app;
}
