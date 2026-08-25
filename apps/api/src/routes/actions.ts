import type { FastifyInstance } from "fastify";
import { validateAction } from "@hexald/game-core";
import type { GameAction } from "@hexald/shared";
import { requirePlayer } from "../session/player.ts";

const actionTypes = new Set(["build", "assign_workers", "generate_region"]);

function isGameAction(value: unknown): value is GameAction {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return false;
  }

  return actionTypes.has((value as { type: unknown }).type as string);
}

export async function actionRoutes(app: FastifyInstance) {
  app.post("/actions", async (request, reply) => {
    const player = await requirePlayer(app, request, reply);
    if (!player) return;

    if (!isGameAction(request.body)) {
      return reply.code(400).send({
        ok: false,
        reason: "invalid_action"
      });
    }

    const result = validateAction(request.body);

    if (!result.ok) {
      return reply.code(422).send(result);
    }

    return result;
  });
}
