import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  fetchPlayer,
  insertAnonymousPlayer,
  type PersistedPlayer
} from "@hexald/db";
import { env } from "../env.ts";

export const SESSION_COOKIE = "tw_sid";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400;

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function setSessionCookie(reply: FastifyReply, playerId: string) {
  reply.setCookie(SESSION_COOKIE, playerId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    signed: true,
    maxAge: COOKIE_MAX_AGE_SEC,
    secure: !env.isDev
  });
}

export async function resolvePlayerFromCookie(
  app: FastifyInstance,
  request: FastifyRequest
): Promise<PersistedPlayer | null> {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;

  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value || !uuidRe.test(unsigned.value)) {
    return null;
  }

  return fetchPlayer(app.db, unsigned.value);
}

export async function ensureAnonymousPlayer(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<PersistedPlayer> {
  const existing = await resolvePlayerFromCookie(app, request);
  if (existing) {
    request.player = { id: existing.id };
    setSessionCookie(reply, existing.id);
    return existing;
  }

  const player = await insertAnonymousPlayer(app.db);
  request.player = { id: player.id };
  setSessionCookie(reply, player.id);
  return player;
}

export async function requirePlayer(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<PersistedPlayer | null> {
  const player = await resolvePlayerFromCookie(app, request);
  if (!player) {
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  request.player = { id: player.id };
  return player;
}
