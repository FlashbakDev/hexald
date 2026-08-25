import { count, desc, eq, inArray, isNotNull } from "drizzle-orm";
import type { Database } from "./client.ts";
import { players, worlds } from "./schema/index.ts";

export type AdminPlayerRow = {
  id: string;
  kind: string;
  pseudo: string | null;
  createdAt: Date;
};

export type AdminWorldRow = {
  id: string;
  ownerId: string;
  ownerPseudo: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminDbStats = {
  playersTotal: number;
  playersNamed: number;
  worldsTotal: number;
  recentPlayers: AdminPlayerRow[];
  recentWorlds: AdminWorldRow[];
};

export async function fetchAdminDbStats(
  db: Database["db"]
): Promise<AdminDbStats> {
  const [[playersTotal], [playersNamed], [worldsTotal], recentPlayers, recentWorlds] =
    await Promise.all([
      db.select({ value: count() }).from(players),
      db
        .select({ value: count() })
        .from(players)
        .where(isNotNull(players.pseudo)),
      db.select({ value: count() }).from(worlds),
      db
        .select({
          id: players.id,
          kind: players.kind,
          pseudo: players.pseudo,
          createdAt: players.createdAt
        })
        .from(players)
        .where(isNotNull(players.pseudo))
        .orderBy(desc(players.createdAt))
        .limit(25),
      db
        .select({
          id: worlds.id,
          ownerId: worlds.ownerId,
          ownerPseudo: players.pseudo,
          createdAt: worlds.createdAt,
          updatedAt: worlds.updatedAt
        })
        .from(worlds)
        .leftJoin(players, eq(worlds.ownerId, players.id))
        .orderBy(desc(worlds.updatedAt))
        .limit(25)
    ]);

  return {
    playersTotal: playersTotal?.value ?? 0,
    playersNamed: playersNamed?.value ?? 0,
    worldsTotal: worldsTotal?.value ?? 0,
    recentPlayers,
    recentWorlds
  };
}

export async function fetchPlayersByIds(
  db: Database["db"],
  ids: string[]
): Promise<AdminPlayerRow[]> {
  if (ids.length === 0) return [];

  return db
    .select({
      id: players.id,
      kind: players.kind,
      pseudo: players.pseudo,
      createdAt: players.createdAt
    })
    .from(players)
    .where(inArray(players.id, ids));
}
