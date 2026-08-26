import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PersistedPlayer } from "@hexald/db";
import { env } from "../env.ts";
import { requirePlayer } from "../session/player.ts";

export function normalizeAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAdminPlayer(player: Pick<PersistedPlayer, "kind" | "email">): boolean {
  if (player.kind !== "firebase" || !player.email) return false;
  const normalized = normalizeAdminEmail(player.email);
  return env.adminEmails.has(normalized);
}

/**
 * Session Firebase + email dans ADMIN_EMAILS (liste serveur).
 */
export async function requireAdmin(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<PersistedPlayer | null> {
  const player = await requirePlayer(app, request, reply);
  if (!player) return null;

  if (player.kind !== "firebase" || !player.email) {
    await reply.code(403).send({ error: "admin_firebase_required" });
    return null;
  }

  if (!isAdminPlayer(player)) {
    await reply.code(403).send({ error: "admin_forbidden" });
    return null;
  }

  return player;
}
