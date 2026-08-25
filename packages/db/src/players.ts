import { eq, sql } from "drizzle-orm";
import type { Database } from "./client.ts";
import { players } from "./schema/index.ts";

export type PersistedPlayer = {
  id: string;
  kind: string;
  pseudo: string | null;
  createdAt: Date;
};

function toPlayer(row: {
  id: string;
  kind: string;
  pseudo: string | null;
  createdAt: Date;
}): PersistedPlayer {
  return {
    id: row.id,
    kind: row.kind,
    pseudo: row.pseudo,
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

  const taken = await findPlayerByPseudo(db, pseudo);
  if (taken && taken.id !== playerId) {
    return { ok: false, reason: "pseudo_taken" };
  }

  try {
    const [updated] = await db
      .update(players)
      .set({ pseudo })
      .where(eq(players.id, playerId))
      .returning();
    if (!updated) throw new Error("failed_to_claim_pseudo");
    return { ok: true, player: toPlayer(updated) };
  } catch (error) {
    const takenAgain = await findPlayerByPseudo(db, pseudo);
    if (takenAgain && takenAgain.id !== playerId) {
      return { ok: false, reason: "pseudo_taken" };
    }
    throw error;
  }
}
