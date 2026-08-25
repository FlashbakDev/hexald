import type { FastifyInstance } from "fastify";
import type {
  AssignWorkersRequest,
  BuildRequest,
  ExpandRegionRequest,
  PrimaryBiomeId
} from "@hexald/shared";
import { isPrimaryBiome } from "@hexald/game-core";
import { ensureAnonymousPlayer, requirePlayer } from "../session/player.ts";
import {
  assignWorkersService,
  buildService,
  createWorldService,
  expandRegionService,
  getWorldService,
  grantDevResourcesService,
  listWorldsService,
  resetWorldService
} from "../worlds/service.ts";
import { env } from "../env.ts";

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isHexCoord(value: unknown): value is { q: number; r: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isInteger((value as { q?: unknown }).q) &&
    Number.isInteger((value as { r?: unknown }).r)
  );
}

const EXTRACTOR_JOBS = new Set(["woodcutter", "farmer", "quarrier"]);
const PLACEABLE_BUILDINGS = new Set(["lumber_camp", "farm", "quarry"]);

function isAssignWorkersBody(value: unknown): value is AssignWorkersRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as { job?: unknown; count?: unknown };
  return (
    typeof body.job === "string" &&
    EXTRACTOR_JOBS.has(body.job) &&
    Number.isInteger(body.count)
  );
}

function isBuildBody(value: unknown): value is BuildRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as { buildingId?: unknown; origin?: unknown };
  return (
    typeof body.buildingId === "string" &&
    PLACEABLE_BUILDINGS.has(body.buildingId) &&
    isHexCoord(body.origin)
  );
}

export async function worldRoutes(app: FastifyInstance) {
  app.get("/worlds", async (request, reply) => {
    const player = await requirePlayer(app, request, reply);
    if (!player) return;
    return listWorldsService(app.db, player.id);
  });

  app.post("/worlds", async (request, reply) => {
    const player = await ensureAnonymousPlayer(app, request, reply);
    const world = await createWorldService(app.db, player.id);
    return reply.code(201).send(world);
  });

  app.post<{ Params: { id: string } }>(
    "/worlds/:id/reset",
    async (request, reply) => {
      if (!env.isDev) {
        return reply.code(404).send({ error: "not_found" });
      }

      const player = await requirePlayer(app, request, reply);
      if (!player) return;

      const { id } = request.params;
      if (!uuidRe.test(id)) {
        return reply.code(400).send({ error: "invalid_world_id" });
      }

      const outcome = await resetWorldService(app.db, id, player.id);
      if (!outcome.ok) {
        const status = outcome.error === "world_not_found" ? 404 : 403;
        return reply.code(status).send({ error: outcome.error });
      }

      return outcome.world;
    }
  );

  app.post<{ Params: { id: string } }>(
    "/worlds/:id/dev/grant-resources",
    async (request, reply) => {
      if (!env.isDev) {
        return reply.code(404).send({ error: "not_found" });
      }

      const player = await requirePlayer(app, request, reply);
      if (!player) return;

      const { id } = request.params;
      if (!uuidRe.test(id)) {
        return reply.code(400).send({ error: "invalid_world_id" });
      }

      const outcome = await grantDevResourcesService(app.db, id, player.id);
      if (!outcome.ok) {
        const status = outcome.error === "world_not_found" ? 404 : 403;
        return reply.code(status).send({ error: outcome.error });
      }

      return outcome.world;
    }
  );

  app.get<{ Params: { id: string } }>("/worlds/:id", async (request, reply) => {
    const player = await requirePlayer(app, request, reply);
    if (!player) return;

    const { id } = request.params;
    if (!uuidRe.test(id)) {
      return reply.code(400).send({ error: "invalid_world_id" });
    }

    const world = await getWorldService(app.db, id, player.id);
    if (!world) {
      return reply.code(404).send({ error: "world_not_found" });
    }

    return world;
  });

  app.post<{ Params: { id: string }; Body: ExpandRegionRequest }>(
    "/worlds/:id/regions",
    async (request, reply) => {
      const player = await requirePlayer(app, request, reply);
      if (!player) return;

      const { id } = request.params;
      if (!uuidRe.test(id)) {
        return reply.code(400).send({ error: "invalid_world_id" });
      }

      const body = request.body;
      if (!body || !isHexCoord(body.center) || !isPrimaryBiome(body.biome as PrimaryBiomeId)) {
        return reply.code(400).send({ error: "invalid_body" });
      }

      const outcome = await expandRegionService(app.db, id, player.id, {
        center: body.center,
        biome: body.biome
      });

      if (!outcome.ok) {
        const status =
          outcome.error === "world_not_found"
            ? 404
            : outcome.error === "cannot_place_region" ||
                outcome.error === "insufficient_resources"
              ? 409
              : 400;
        return reply.code(status).send({ error: outcome.error });
      }

      return outcome.result;
    }
  );

  app.post<{ Params: { id: string }; Body: AssignWorkersRequest }>(
    "/worlds/:id/workers",
    async (request, reply) => {
      const player = await requirePlayer(app, request, reply);
      if (!player) return;

      const { id } = request.params;
      if (!uuidRe.test(id)) {
        return reply.code(400).send({ error: "invalid_world_id" });
      }

      if (!isAssignWorkersBody(request.body)) {
        return reply.code(400).send({ error: "invalid_body" });
      }

      const outcome = await assignWorkersService(app.db, id, player.id, {
        job: request.body.job,
        count: request.body.count
      });

      if (!outcome.ok) {
        const status =
          outcome.error === "world_not_found"
            ? 404
            : outcome.error === "unsupported_job"
              ? 400
              : 409;
        return reply.code(status).send({ error: outcome.error });
      }

      return outcome.world;
    }
  );

  app.post<{ Params: { id: string }; Body: BuildRequest }>(
    "/worlds/:id/buildings",
    async (request, reply) => {
      const player = await requirePlayer(app, request, reply);
      if (!player) return;

      const { id } = request.params;
      if (!uuidRe.test(id)) {
        return reply.code(400).send({ error: "invalid_world_id" });
      }

      if (!isBuildBody(request.body)) {
        return reply.code(400).send({ error: "invalid_body" });
      }

      const outcome = await buildService(app.db, id, player.id, {
        buildingId: request.body.buildingId,
        origin: request.body.origin
      });

      if (!outcome.ok) {
        const status =
          outcome.error === "world_not_found" || outcome.error === "tile_not_found"
            ? 404
            : 409;
        return reply.code(status).send({ error: outcome.error });
      }

      return reply.code(201).send(outcome.result);
    }
  );
}
