import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import { claimPlayerPseudo } from "@hexald/db";
import type { SessionSnapshot } from "@hexald/shared";
import { validatePseudo } from "@hexald/shared";
import { env } from "../env.ts";
import {
  ensureAnonymousPlayer,
  requirePlayer
} from "./player.ts";

function toSession(player: { id: string; pseudo: string | null }): SessionSnapshot {
  return {
    playerId: player.id,
    pseudo: player.pseudo
  };
}

export async function sessionPlugin(app: FastifyInstance) {
  await app.register(cookie, {
    secret: env.sessionSecret,
    hook: "onRequest",
    parseOptions: {}
  });
}

export async function sessionRoutes(app: FastifyInstance) {
  app.post("/session", async (request, reply) => {
    const player = await ensureAnonymousPlayer(app, request, reply);
    return toSession(player);
  });

  app.get("/session", async (request, reply) => {
    const player = await requirePlayer(app, request, reply);
    if (!player) return;
    return toSession(player);
  });

  app.post("/session/pseudo", async (request, reply) => {
    const player = await ensureAnonymousPlayer(app, request, reply);
    const body = request.body as { pseudo?: unknown } | null;
    const validation = validatePseudo(body?.pseudo);

    if (!validation.ok) {
      return reply.code(400).send({ error: validation.reason });
    }

    const result = await claimPlayerPseudo(app.db, player.id, validation.pseudo);
    if (!result.ok) {
      return reply.code(409).send({ error: result.reason });
    }

    return toSession(result.player);
  });
}
