import type { FastifyInstance } from "fastify";
import { pingDb } from "@hexald/db";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => ({
    service: "hexald-api",
    health: "/health",
    content: "/v1/content",
    worlds: "POST /v1/worlds, GET /v1/worlds/:id",
    actions: "POST /v1/actions"
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
