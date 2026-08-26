import { and, desc, eq, sql } from "drizzle-orm";
import type { BiomeId, BuildingId, ResourceId } from "@hexald/shared";
import type { Database, WorldDb } from "./client.ts";
import {
  worldInventory,
  worldRegions,
  worldTiles,
  worlds
} from "./schema/index.ts";

export type WorldTileRow = {
  q: number;
  r: number;
  biome: BiomeId;
  buildingId: BuildingId | null;
  constructionCompletesAt: Date | null;
  assignedWorkers: number;
  defaultWorkerSeeded: boolean;
};

export type WorldRegionRow = {
  centerQ: number;
  centerR: number;
  biome: BiomeId;
};

export type WorldInventoryRow = {
  resourceId: ResourceId;
  amount: number;
  lastCalculatedAt: Date;
};

export type WorldEconomyRow = {
  populationTotal: number;
  populationCap: number;
  foodSurplusAccumulated: number;
  woodcutters: number;
  farmers: number;
  quarriers: number;
  inventory: WorldInventoryRow[];
};

export type PersistedWorld = {
  id: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  economy: WorldEconomyRow;
  tiles: WorldTileRow[];
  regions: WorldRegionRow[];
};

export type PersistedWorldSummary = {
  id: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Attente max avant `world_busy` (multi-onglets / bots). */
export const WORLD_LOCK_TIMEOUT_MS = 3_000;

export type WorldLockFailure = "world_not_found" | "world_busy";

export type WorldLockResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: WorldLockFailure };

function economyFromWorld(
  world: {
    populationTotal: number;
    populationCap: number;
    foodSurplusAccumulated: number;
    woodcutters: number;
    farmers: number;
    quarriers: number;
  },
  inventory: WorldInventoryRow[]
): WorldEconomyRow {
  return {
    populationTotal: world.populationTotal,
    populationCap: world.populationCap,
    foodSurplusAccumulated: world.foodSurplusAccumulated ?? 0,
    woodcutters: world.woodcutters,
    farmers: world.farmers,
    quarriers: world.quarriers,
    inventory
  };
}

function isLockTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  // 55P03 = lock_not_available ; 57014 = query_canceled (statement/lock timeout)
  return code === "55P03" || code === "57014";
}

async function loadInventory(
  db: WorldDb,
  worldId: string
): Promise<WorldInventoryRow[]> {
  const rows = await db
    .select({
      resourceId: worldInventory.resourceId,
      amount: worldInventory.amount,
      lastCalculatedAt: worldInventory.lastCalculatedAt
    })
    .from(worldInventory)
    .where(eq(worldInventory.worldId, worldId));

  return rows.map((row) => ({
    resourceId: row.resourceId as ResourceId,
    amount: row.amount,
    lastCalculatedAt: row.lastCalculatedAt
  }));
}

async function upsertInventory(
  tx: WorldDb,
  worldId: string,
  inventory: WorldInventoryRow[]
): Promise<void> {
  if (inventory.length === 0) return;

  for (const entry of inventory) {
    await tx
      .insert(worldInventory)
      .values({
        worldId,
        resourceId: entry.resourceId,
        amount: entry.amount,
        lastCalculatedAt: entry.lastCalculatedAt
      })
      .onConflictDoUpdate({
        target: [worldInventory.worldId, worldInventory.resourceId],
        set: {
          amount: entry.amount,
          lastCalculatedAt: entry.lastCalculatedAt
        }
      });
  }
}

/**
 * Sérialise les mutations d’un monde : `SELECT … FOR UPDATE` + transaction unique.
 * Évite double-spend / lost update entre onglets ou bots.
 */
export async function withWorldLock<T>(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  fn: (tx: WorldDb, world: PersistedWorld) => Promise<T>
): Promise<WorldLockResult<T>> {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('lock_timeout', '3s', true)`);

      const [locked] = await tx
        .select({ id: worlds.id })
        .from(worlds)
        .where(and(eq(worlds.id, worldId), eq(worlds.ownerId, ownerId)))
        .for("update")
        .limit(1);

      if (!locked) {
        return { ok: false, error: "world_not_found" as const };
      }

      const world = await fetchWorld(tx, worldId);
      if (!world) {
        return { ok: false, error: "world_not_found" as const };
      }

      const value = await fn(tx, world);
      return { ok: true as const, value };
    });
  } catch (err) {
    if (isLockTimeoutError(err)) {
      return { ok: false, error: "world_busy" };
    }
    throw err;
  }
}

export async function insertWorldWithTerrain(
  db: Database["db"],
  input: {
    ownerId: string;
    tiles: WorldTileRow[];
    regions: WorldRegionRow[];
    economy?: Partial<WorldEconomyRow>;
  }
): Promise<PersistedWorld> {
  return db.transaction(async (tx) => {
    const [world] = await tx
      .insert(worlds)
      .values({
        ownerId: input.ownerId,
        ...(input.economy?.populationTotal !== undefined
          ? { populationTotal: input.economy.populationTotal }
          : {}),
        ...(input.economy?.populationCap !== undefined
          ? { populationCap: input.economy.populationCap }
          : {}),
        ...(input.economy?.foodSurplusAccumulated !== undefined
          ? { foodSurplusAccumulated: input.economy.foodSurplusAccumulated }
          : {}),
        ...(input.economy?.woodcutters !== undefined
          ? { woodcutters: input.economy.woodcutters }
          : {}),
        ...(input.economy?.farmers !== undefined
          ? { farmers: input.economy.farmers }
          : {}),
        ...(input.economy?.quarriers !== undefined
          ? { quarriers: input.economy.quarriers }
          : {})
      })
      .returning();
    if (!world) throw new Error("failed_to_create_world");

    if (input.tiles.length > 0) {
      await tx.insert(worldTiles).values(
        input.tiles.map((tile) => ({
          worldId: world.id,
          q: tile.q,
          r: tile.r,
          biome: tile.biome,
          buildingId: tile.buildingId,
          constructionCompletesAt: tile.constructionCompletesAt,
          assignedWorkers: tile.assignedWorkers ?? 0,
          defaultWorkerSeeded: tile.defaultWorkerSeeded ?? false
        }))
      );
    }

    if (input.regions.length > 0) {
      await tx.insert(worldRegions).values(
        input.regions.map((region) => ({
          worldId: world.id,
          centerQ: region.centerQ,
          centerR: region.centerR,
          biome: region.biome
        }))
      );
    }

    const inventory = input.economy?.inventory ?? [];
    await upsertInventory(tx, world.id, inventory);

    return {
      id: world.id,
      ownerId: world.ownerId,
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
      economy: economyFromWorld(world, inventory),
      tiles: input.tiles,
      regions: input.regions
    };
  });
}

export async function fetchWorld(
  db: WorldDb,
  worldId: string
): Promise<PersistedWorld | null> {
  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!world) return null;

  const [tiles, regions, inventory] = await Promise.all([
    db
      .select({
        q: worldTiles.q,
        r: worldTiles.r,
        biome: worldTiles.biome,
        buildingId: worldTiles.buildingId,
        constructionCompletesAt: worldTiles.constructionCompletesAt,
        assignedWorkers: worldTiles.assignedWorkers,
        defaultWorkerSeeded: worldTiles.defaultWorkerSeeded
      })
      .from(worldTiles)
      .where(eq(worldTiles.worldId, worldId)),
    db
      .select({
        centerQ: worldRegions.centerQ,
        centerR: worldRegions.centerR,
        biome: worldRegions.biome
      })
      .from(worldRegions)
      .where(eq(worldRegions.worldId, worldId)),
    loadInventory(db, worldId)
  ]);

  return {
    id: world.id,
    ownerId: world.ownerId,
    createdAt: world.createdAt,
    updatedAt: world.updatedAt,
    economy: economyFromWorld(world, inventory),
    tiles: tiles.map((tile) => ({
      q: tile.q,
      r: tile.r,
      biome: tile.biome as BiomeId,
      buildingId: (tile.buildingId as BuildingId | null) ?? null,
      constructionCompletesAt: tile.constructionCompletesAt ?? null,
      assignedWorkers: tile.assignedWorkers ?? 0,
      defaultWorkerSeeded: tile.defaultWorkerSeeded ?? false
    })),
    regions: regions.map((region) => ({
      centerQ: region.centerQ,
      centerR: region.centerR,
      biome: region.biome as BiomeId
    }))
  };
}

export async function listWorldsByOwner(
  db: Database["db"],
  ownerId: string
): Promise<PersistedWorldSummary[]> {
  const rows = await db
    .select({
      id: worlds.id,
      ownerId: worlds.ownerId,
      createdAt: worlds.createdAt,
      updatedAt: worlds.updatedAt
    })
    .from(worlds)
    .where(eq(worlds.ownerId, ownerId))
    .orderBy(desc(worlds.updatedAt));

  return rows;
}

export async function fetchWorldForOwner(
  db: WorldDb,
  worldId: string,
  ownerId: string
): Promise<PersistedWorld | null> {
  const [world] = await db
    .select()
    .from(worlds)
    .where(and(eq(worlds.id, worldId), eq(worlds.ownerId, ownerId)))
    .limit(1);
  if (!world) return null;
  return fetchWorld(db, worldId);
}

export async function deleteWorldForOwner(
  db: Database["db"],
  worldId: string,
  ownerId: string
): Promise<boolean> {
  const deleted = await db
    .delete(worlds)
    .where(and(eq(worlds.id, worldId), eq(worlds.ownerId, ownerId)))
    .returning({ id: worlds.id });
  return deleted.length > 0;
}

export async function updateWorldEconomy(
  db: WorldDb,
  worldId: string,
  economy: WorldEconomyRow
): Promise<void> {
  await db
    .update(worlds)
    .set({
      populationTotal: economy.populationTotal,
      populationCap: economy.populationCap,
      foodSurplusAccumulated: economy.foodSurplusAccumulated,
      woodcutters: economy.woodcutters,
      farmers: economy.farmers,
      quarriers: economy.quarriers,
      updatedAt: new Date()
    })
    .where(eq(worlds.id, worldId));

  await upsertInventory(db, worldId, economy.inventory);
}

export async function setTileWorkerState(
  db: WorldDb,
  worldId: string,
  origin: { q: number; r: number },
  state: { assignedWorkers: number; defaultWorkerSeeded: boolean }
): Promise<void> {
  await db
    .update(worldTiles)
    .set({
      assignedWorkers: state.assignedWorkers,
      defaultWorkerSeeded: state.defaultWorkerSeeded
    })
    .where(
      and(
        eq(worldTiles.worldId, worldId),
        eq(worldTiles.q, origin.q),
        eq(worldTiles.r, origin.r)
      )
    );

  await db
    .update(worlds)
    .set({ updatedAt: new Date() })
    .where(eq(worlds.id, worldId));
}

/** @deprecated Prefer setTileWorkerState */
export async function setTileAssignedWorkers(
  db: WorldDb,
  worldId: string,
  origin: { q: number; r: number },
  assignedWorkers: number
): Promise<void> {
  await setTileWorkerState(db, worldId, origin, {
    assignedWorkers,
    defaultWorkerSeeded: true
  });
}

export async function setTileBuilding(
  db: WorldDb,
  worldId: string,
  tile: {
    q: number;
    r: number;
    buildingId: BuildingId;
    constructionCompletesAt: Date | null;
    assignedWorkers?: number;
    defaultWorkerSeeded?: boolean;
  }
): Promise<void> {
  await db
    .update(worldTiles)
    .set({
      buildingId: tile.buildingId,
      constructionCompletesAt: tile.constructionCompletesAt,
      assignedWorkers: tile.assignedWorkers ?? 0,
      defaultWorkerSeeded: tile.defaultWorkerSeeded ?? false
    })
    .where(
      and(
        eq(worldTiles.worldId, worldId),
        eq(worldTiles.q, tile.q),
        eq(worldTiles.r, tile.r)
      )
    );

  await db
    .update(worlds)
    .set({ updatedAt: new Date() })
    .where(eq(worlds.id, worldId));
}

/** Retire le bâtiment (et workers) d’une tuile. */
export async function clearTileBuilding(
  db: WorldDb,
  worldId: string,
  origin: { q: number; r: number }
): Promise<void> {
  await db
    .update(worldTiles)
    .set({
      buildingId: null,
      constructionCompletesAt: null,
      assignedWorkers: 0,
      defaultWorkerSeeded: false
    })
    .where(
      and(
        eq(worldTiles.worldId, worldId),
        eq(worldTiles.q, origin.q),
        eq(worldTiles.r, origin.r)
      )
    );

  await db
    .update(worlds)
    .set({ updatedAt: new Date() })
    .where(eq(worlds.id, worldId));
}

/** Dev — change le biome et retire bâtiment / workers de la tuile. */
export async function setTileBiomeDev(
  db: WorldDb,
  worldId: string,
  tile: { q: number; r: number; biome: BiomeId }
): Promise<void> {
  await db
    .update(worldTiles)
    .set({
      biome: tile.biome,
      buildingId: null,
      constructionCompletesAt: null,
      assignedWorkers: 0,
      defaultWorkerSeeded: false
    })
    .where(
      and(
        eq(worldTiles.worldId, worldId),
        eq(worldTiles.q, tile.q),
        eq(worldTiles.r, tile.r)
      )
    );

  await db
    .update(worlds)
    .set({ updatedAt: new Date() })
    .where(eq(worlds.id, worldId));
}

export async function appendRegion(
  db: WorldDb,
  worldId: string,
  input: {
    center: { q: number; r: number };
    biome: BiomeId;
    tiles: WorldTileRow[];
  }
): Promise<void> {
  await db.insert(worldRegions).values({
    worldId,
    centerQ: input.center.q,
    centerR: input.center.r,
    biome: input.biome
  });

  if (input.tiles.length > 0) {
    await db.insert(worldTiles).values(
      input.tiles.map((tile) => ({
        worldId,
        q: tile.q,
        r: tile.r,
        biome: tile.biome,
        buildingId: tile.buildingId,
        constructionCompletesAt: tile.constructionCompletesAt,
        assignedWorkers: tile.assignedWorkers ?? 0,
        defaultWorkerSeeded: tile.defaultWorkerSeeded ?? false
      }))
    );
  }

  await db
    .update(worlds)
    .set({ updatedAt: new Date() })
    .where(eq(worlds.id, worldId));
}

/** Utilitaire tests / debug — compte les lignes inventaire. */
export async function countInventoryRows(
  db: WorldDb,
  worldId: string
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(worldInventory)
    .where(eq(worldInventory.worldId, worldId));
  return row?.count ?? 0;
}
