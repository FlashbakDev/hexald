import type { FastifyInstance } from "fastify";
import type {
  DestroyBuildingRequest,
  GameAction,
  PrimaryBiomeId
} from "@hexald/shared";
import {
  isBiomeId,
  isPlaceableBuilding,
  isPrimaryBiome,
  validateAction
} from "@hexald/game-core";
import { ensureAnonymousPlayer, requirePlayer } from "../session/player.ts";
import {
  applyWorldAction,
  createWorldService,
  destroyBuildingService,
  getWorldService,
  grantDevResourcesService,
  listWorldsService,
  resetWorldService,
  setTileBiomeDevService
} from "../worlds/service.ts";
import { env } from "../env.ts";

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const actionTypes = new Set([
  "build",
  "assign_workers",
  "generate_region",
  "set_research_target"
]);

function isHexCoord(value: unknown): value is { q: number; r: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isInteger((value as { q?: unknown }).q) &&
    Number.isInteger((value as { r?: unknown }).r)
  );
}

function isGameAction(value: unknown): value is GameAction {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const body = value as Record<string, unknown>;
  if (!actionTypes.has(body.type as string)) return false;

  if (body.type === "assign_workers") {
    return isHexCoord(body.origin) && Number.isInteger(body.count);
  }
  if (body.type === "build") {
    return (
      typeof body.buildingId === "string" &&
      isPlaceableBuilding(body.buildingId as import("@hexald/shared").BuildingId) &&
      isHexCoord(body.origin)
    );
  }
  if (body.type === "generate_region") {
    return (
      isHexCoord(body.center) &&
      typeof body.biome === "string" &&
      isPrimaryBiome(body.biome as PrimaryBiomeId)
    );
  }
  if (body.type === "set_research_target") {
    return typeof body.techId === "string" && body.techId.length > 0;
  }
  return false;
}

function statusForActionError(error: string): number {
  if (error === "world_not_found" || error === "tile_not_found") return 404;
  if (error === "world_busy") return 429;
  if (
    error === "invalid_origin" ||
    error === "invalid_center" ||
    error === "invalid_count" ||
    error === "invalid_biome" ||
    error === "unknown_building" ||
    error === "unknown_tech" ||
    error === "invalid_tech" ||
    error === "not_researchable" ||
    error === "unknown_action" ||
    error === "under_construction"
  ) {
    return 400;
  }
  if (
    error === "already_unlocked" ||
    error === "prerequisites_not_met" ||
    error === "tech_not_unlocked"
  ) {
    return 409;
  }
  return 409;
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
        const status =
          outcome.error === "world_not_found"
            ? 404
            : outcome.error === "world_busy"
              ? 429
              : 403;
        return reply.code(status).send({ error: outcome.error });
      }

      return outcome.world;
    }
  );

  app.post<{
    Params: { id: string };
    Body: { q?: unknown; r?: unknown; biome?: unknown };
  }>("/worlds/:id/dev/set-tile-biome", async (request, reply) => {
    if (!env.isDev) {
      return reply.code(404).send({ error: "not_found" });
    }

    const player = await requirePlayer(app, request, reply);
    if (!player) return;

    const { id } = request.params;
    if (!uuidRe.test(id)) {
      return reply.code(400).send({ error: "invalid_world_id" });
    }

    const body = request.body;
    const biome =
      body && typeof body.biome === "string" && isBiomeId(body.biome)
        ? body.biome
        : null;
    if (
      !body ||
      !Number.isInteger(body.q) ||
      !Number.isInteger(body.r) ||
      !biome
    ) {
      return reply.code(400).send({ error: "invalid_body" });
    }

    const outcome = await setTileBiomeDevService(app.db, id, player.id, {
      q: body.q as number,
      r: body.r as number,
      biome
    });

    if (!outcome.ok) {
      const status =
        outcome.error === "world_not_found" || outcome.error === "tile_not_found"
          ? 404
          : outcome.error === "world_busy"
            ? 429
            : outcome.error === "not_available"
              ? 404
              : 400;
      return reply.code(status).send({ error: outcome.error });
    }

    return outcome.world;
  });

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

  app.post<{ Params: { id: string }; Body: GameAction }>(
    "/worlds/:id/actions",
    async (request, reply) => {
      const player = await requirePlayer(app, request, reply);
      if (!player) return;

      const { id } = request.params;
      if (!uuidRe.test(id)) {
        return reply.code(400).send({ error: "invalid_world_id" });
      }

      if (!isGameAction(request.body)) {
        return reply.code(400).send({ error: "invalid_action" });
      }

      const shape = validateAction(request.body);
      if (!shape.ok) {
        return reply.code(400).send({ error: shape.reason });
      }

      const outcome = await applyWorldAction(app.db, id, player.id, request.body);
      if (!outcome.ok) {
        return reply
          .code(statusForActionError(outcome.error))
          .send({ error: outcome.error });
      }

      if (outcome.type === "build") {
        return reply.code(201).send(outcome);
      }
      return outcome;
    }
  );

  app.post<{ Params: { id: string }; Body: DestroyBuildingRequest }>(
    "/worlds/:id/buildings/destroy",
    async (request, reply) => {
      const player = await requirePlayer(app, request, reply);
      if (!player) return;

      const { id } = request.params;
      if (!uuidRe.test(id)) {
        return reply.code(400).send({ error: "invalid_world_id" });
      }

      const body = request.body;
      if (!body || !isHexCoord(body.origin)) {
        return reply.code(400).send({ error: "invalid_body" });
      }

      const outcome = await destroyBuildingService(app.db, id, player.id, {
        origin: body.origin
      });

      if (!outcome.ok) {
        const status =
          outcome.error === "world_not_found" || outcome.error === "tile_not_found"
            ? 404
            : outcome.error === "world_busy"
              ? 429
              : outcome.error === "no_building" || outcome.error === "has_village"
                ? 409
                : 400;
        return reply.code(status).send({ error: outcome.error });
      }

      return outcome.result;
    }
  );
}
