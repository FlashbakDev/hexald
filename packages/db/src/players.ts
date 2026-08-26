import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import { players } from "./schema/index.ts";

export type PersistedPlayer = {
  id: string;
  kind: string;
  pseudo: string | null;
  firebaseUid: string | null;
  email: string | null;
  createdAt: Date;
};

function toPlayer(row: {
  id: string;
  kind: string;
  pseudo: string | null;
  firebaseUid: string | null;
  email: string | null;
  createdAt: Date;
}): PersistedPlayer {
  return {
    id: row.id,
    kind: row.kind,
    pseudo: row.pseudo,
    firebaseUid: row.firebaseUid,
    email: row.email,
    createdAt: row.createdAt
  };
}

export async function insertAnonymousPlayer(
  db: Database["db"]
): Promise<PersistedPlayer> {
  const [player] = await db
    .insert(players)
    .values({ kind: "anonymous" })
    .returning();
  if (!player) throw new Error("failed_to_create_player");
  return toPlayer(player);
}

export async function fetchPlayer(
  db: Database["db"],
  playerId: string
): Promise<PersistedPlayer | null> {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1);
  if (!player) return null;
  return toPlayer(player);
}

export async function findPlayerByFirebaseUid(
  db: Database["db"],
  firebaseUid: string
): Promise<PersistedPlayer | null> {
  const [player] = await db
    .select()
    .from(players)
    .where(eq(players.firebaseUid, firebaseUid))
    .limit(1);
  if (!player) return null;
  return toPlayer(player);
}

export async function insertFirebasePlayer(
  db: Database["db"],
  input: { firebaseUid: string; email: string | null }
): Promise<PersistedPlayer> {
  const [player] = await db
    .insert(players)
    .values({
      kind: "firebase",
      firebaseUid: input.firebaseUid,
      email: input.email
    })
    .returning();
  if (!player) throw new Error("failed_to_create_firebase_player");
  return toPlayer(player);
}

export type LinkFirebaseResult =
  | { ok: true; player: PersistedPlayer; outcome: "linked_guest" | "existing" | "created" }
  | { ok: false; reason: "already_linked_other" };

/**
 * Associe un UID Firebase à un player.
 * - UID déjà connu → ce player
 * - Guest cookie sans firebase → lie le guest
 * - Sinon → crée un player firebase
 */
export async function linkOrCreateFirebasePlayer(
  db: Database["db"],
  input: {
    firebaseUid: string;
    email: string | null;
    guestPlayerId: string | null;
  }
): Promise<LinkFirebaseResult> {
  const existing = await findPlayerByFirebaseUid(db, input.firebaseUid);
  if (existing) {
    if (input.email && existing.email !== input.email) {
      const [updated] = await db
        .update(players)
        .set({ email: input.email })
        .where(eq(players.id, existing.id))
        .returning();
      return {
        ok: true,
        player: updated ? toPlayer(updated) : existing,
        outcome: "existing"
      };
    }
    return { ok: true, player: existing, outcome: "existing" };
  }

  if (input.guestPlayerId) {
    const guest = await fetchPlayer(db, input.guestPlayerId);
    if (guest && !guest.firebaseUid) {
      const [updated] = await db
        .update(players)
        .set({
          kind: "firebase",
          firebaseUid: input.firebaseUid,
          email: input.email
        })
        .where(and(eq(players.id, guest.id), isNull(players.firebaseUid)))
        .returning();
      if (updated) {
        return { ok: true, player: toPlayer(updated), outcome: "linked_guest" };
      }
      // Course : un autre lien a gagné — retombe sur lookup.
      const raced = await findPlayerByFirebaseUid(db, input.firebaseUid);
      if (raced) return { ok: true, player: raced, outcome: "existing" };
    }
  }

  const created = await insertFirebasePlayer(db, {
    firebaseUid: input.firebaseUid,
    email: input.email
  });
  return { ok: true, player: created, outcome: "created" };
}

export async function findPlayerByPseudo(
  db: Database["db"],
  pseudo: string
): Promise<PersistedPlayer | null> {
  const [player] = await db
    .select()
    .from(players)
    .where(sql`lower(${players.pseudo}) = lower(${pseudo})`)
    .limit(1);
  if (!player) return null;
  return toPlayer(player);
}

/** True if no other player owns this account name (case-insensitive). */
export async function isPseudoAvailable(
  db: Database["db"],
  pseudo: string,
  exceptPlayerId?: string
): Promise<boolean> {
  const taken = await findPlayerByPseudo(db, pseudo);
  if (!taken) return true;
  return exceptPlayerId != null && taken.id === exceptPlayerId;
}

export type ClaimPseudoResult =
  | { ok: true; player: PersistedPlayer }
  | { ok: false; reason: "pseudo_taken" | "pseudo_locked" };

export async function claimPlayerPseudo(
  db: Database["db"],
  playerId: string,
  pseudo: string
): Promise<ClaimPseudoResult> {
  const current = await fetchPlayer(db, playerId);
  if (!current) throw new Error("player_not_found");

  if (current.pseudo) {
    if (current.pseudo.toLowerCase() === pseudo.toLowerCase()) {
      return { ok: true, player: current };
    }
    return { ok: false, reason: "pseudo_locked" };
  }

  const available = await isPseudoAvailable(db, pseudo, playerId);
  if (!available) {
    return { ok: false, reason: "pseudo_taken" };
  }

  try {
    const [updated] = await db
      .update(players)
      .set({ pseudo })
      .where(and(eq(players.id, playerId), isNull(players.pseudo)))
      .returning();
    if (!updated) {
      const refreshed = await fetchPlayer(db, playerId);
      if (refreshed?.pseudo) {
        if (refreshed.pseudo.toLowerCase() === pseudo.toLowerCase()) {
          return { ok: true, player: refreshed };
        }
        return { ok: false, reason: "pseudo_locked" };
      }
      throw new Error("failed_to_claim_pseudo");
    }
    return { ok: true, player: toPlayer(updated) };
  } catch (error) {
    const availableAgain = await isPseudoAvailable(db, pseudo, playerId);
    if (!availableAgain) {
      return { ok: false, reason: "pseudo_taken" };
    }
    throw error;
  }
}
