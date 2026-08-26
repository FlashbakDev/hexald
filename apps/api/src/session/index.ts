import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";
import {
  claimPlayerPseudo,
  isPseudoAvailable,
  linkOrCreateFirebasePlayer
} from "@hexald/db";
import type {
  FirebaseSessionResult,
  SessionSnapshot
} from "@hexald/shared";
import { validatePseudo } from "@hexald/shared";
import { env } from "../env.ts";
import {
  isFirebaseAdminReady,
  verifyFirebaseIdToken
} from "../firebase.ts";
import { isAdminPlayer } from "../admin/access.ts";
import {
  clearSessionCookie,
  ensureAnonymousPlayer,
  requirePlayer,
  resolvePlayerFromCookie,
  setSessionCookie
} from "./player.ts";
import { touchPresence } from "../presence.ts";

export type PseudoAvailability = {
  available: boolean;
  reason?: string;
};

function toSession(player: {
  id: string;
  pseudo: string | null;
  kind: string;
  email: string | null;
}): SessionSnapshot {
  return {
    playerId: player.id,
    pseudo: player.pseudo,
    kind: player.kind,
    email: player.email,
    isAdmin: isAdminPlayer(player)
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

  app.delete("/session", async (request, reply) => {
    clearSessionCookie(reply);
    return { ok: true as const };
  });

  app.post("/session/firebase", async (request, reply) => {
    if (!isFirebaseAdminReady()) {
      return reply.code(503).send({ error: "firebase_not_configured" });
    }

    const body = request.body as { idToken?: unknown } | null;
    const idToken = typeof body?.idToken === "string" ? body.idToken : "";
    if (!idToken) {
      return reply.code(400).send({ error: "missing_id_token" });
    }

    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified) {
      return reply.code(401).send({ error: "invalid_token" });
    }

    const guest = await resolvePlayerFromCookie(app, request);
    const result = await linkOrCreateFirebasePlayer(app.db, {
      firebaseUid: verified.uid,
      email: verified.email,
      guestPlayerId: guest && !guest.firebaseUid ? guest.id : null
    });

    if (!result.ok) {
      return reply.code(409).send({ error: result.reason });
    }

    setSessionCookie(reply, result.player.id);
    request.player = { id: result.player.id };
    touchPresence(result.player.id);

    return {
      ...toSession(result.player),
      outcome: result.outcome
    } satisfies FirebaseSessionResult;
  });

  app.get("/session/pseudo/available", async (request, reply) => {
    const query = request.query as { pseudo?: unknown };
    const validation = validatePseudo(query.pseudo);

    if (!validation.ok) {
      return {
        available: false,
        reason: validation.reason
      } satisfies PseudoAvailability;
    }

    const player = await resolvePlayerFromCookie(app, request);
    if (
      player?.pseudo &&
      player.pseudo.toLowerCase() === validation.pseudo.toLowerCase()
    ) {
      return { available: true } satisfies PseudoAvailability;
    }

    const available = await isPseudoAvailable(
      app.db,
      validation.pseudo,
      player?.id
    );

    if (!available) {
      return {
        available: false,
        reason: "pseudo_taken"
      } satisfies PseudoAvailability;
    }

    return { available: true } satisfies PseudoAvailability;
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
