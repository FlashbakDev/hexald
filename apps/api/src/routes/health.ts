import type { FastifyInstance } from "fastify";
import { pingDb } from "@hexald/db";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => ({
    service: "hexald-api",
    health: "/health",
    content: "/v1/content",
    worlds: "GET|POST /v1/worlds, GET /v1/worlds/:id, POST /v1/worlds/:id/regions, POST /v1/worlds/:id/workers",
    actions: "POST /v1/actions",
    session: "POST /v1/session, POST /v1/session/pseudo, GET /v1/session/pseudo/available",
    admin: "GET /v1/admin/overview"
  }));

  app.get("/health", async () => {
    let db: "ok" | "down" = "down";
    try {
      await pingDb(app.db);
      db = "ok";
    } catch {
      db = "down";
    }

    return {
      status: "ok",
      service: "hexald-api",
      db
    };
  });
}
