import type { FastifyInstance } from "fastify";
import { ensureAnonymousPlayer, requirePlayer } from "../session/player.ts";
import {
  createWorldService,
  getWorldService,
  listWorldsService
} from "../worlds/service.ts";

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
}
