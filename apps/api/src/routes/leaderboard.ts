import type { FastifyInstance } from "fastify";
import {
  getLeaderboardService,
  LEADERBOARD_PAGE_SIZE
} from "../worlds/service.ts";

function parsePositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get<{
    Querystring: { page?: string; pageSize?: string };
  }>("/leaderboard", async (request) => {
    const page = parsePositiveInt(request.query.page, 1);
    const pageSize = parsePositiveInt(
      request.query.pageSize,
      LEADERBOARD_PAGE_SIZE
    );
    return getLeaderboardService(app.db, { page, pageSize });
  });
}
