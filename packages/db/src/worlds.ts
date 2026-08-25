import { and, desc, eq } from "drizzle-orm";
import type { BiomeId, BuildingId } from "@hexald/shared";
import type { Database } from "./client.ts";
import { worldRegions, worldTiles, worlds } from "./schema/index.ts";

export type WorldTileRow = {
  q: number;
  r: number;
  biome: BiomeId;
  buildingId: BuildingId | null;
};

export type WorldRegionRow = {
  centerQ: number;
  centerR: number;
  biome: BiomeId;
};

export type WorldEconomyRow = {
  populationTotal: number;
  populationCap: number;
  woodcutters: number;
  farmers: number;
  quarriers: number;
  woodStock: number;
  woodLastCalculatedAt: Date;
  wheatStock: number;
  wheatLastCalculatedAt: Date;
  stoneStock: number;
  stoneLastCalculatedAt: Date;
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

function economyFromRow(world: WorldEconomyRow): WorldEconomyRow {
  return {
    populationTotal: world.populationTotal,
    populationCap: world.populationCap,
    woodcutters: world.woodcutters,
    farmers: world.farmers,
    quarriers: world.quarriers,
    woodStock: world.woodStock,
    woodLastCalculatedAt: world.woodLastCalculatedAt,
    wheatStock: world.wheatStock,
    wheatLastCalculatedAt: world.wheatLastCalculatedAt,
    stoneStock: world.stoneStock,
    stoneLastCalculatedAt: world.stoneLastCalculatedAt
  };
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
        ...(input.economy?.woodcutters !== undefined
          ? { woodcutters: input.economy.woodcutters }
          : {}),
        ...(input.economy?.farmers !== undefined
          ? { farmers: input.economy.farmers }
          : {}),
        ...(input.economy?.quarriers !== undefined
          ? { quarriers: input.economy.quarriers }
          : {}),
        ...(input.economy?.woodStock !== undefined
          ? { woodStock: input.economy.woodStock }
          : {}),
        ...(input.economy?.woodLastCalculatedAt !== undefined
          ? { woodLastCalculatedAt: input.economy.woodLastCalculatedAt }
          : {}),
        ...(input.economy?.wheatStock !== undefined
          ? { wheatStock: input.economy.wheatStock }
          : {}),
        ...(input.economy?.wheatLastCalculatedAt !== undefined
          ? { wheatLastCalculatedAt: input.economy.wheatLastCalculatedAt }
          : {}),
        ...(input.economy?.stoneStock !== undefined
          ? { stoneStock: input.economy.stoneStock }
          : {}),
        ...(input.economy?.stoneLastCalculatedAt !== undefined
          ? { stoneLastCalculatedAt: input.economy.stoneLastCalculatedAt }
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
          buildingId: tile.buildingId
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

    return {
      id: world.id,
      ownerId: world.ownerId,
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
      economy: economyFromRow(world),
      tiles: input.tiles,
      regions: input.regions
    };
  });
}

export async function fetchWorld(
  db: Database["db"],
  worldId: string
): Promise<PersistedWorld | null> {
  const [world] = await db.select().from(worlds).where(eq(worlds.id, worldId)).limit(1);
  if (!world) return null;

  const tiles = await db
    .select({
      q: worldTiles.q,
      r: worldTiles.r,
      biome: worldTiles.biome,
      buildingId: worldTiles.buildingId
    })
    .from(worldTiles)
    .where(eq(worldTiles.worldId, worldId));

  const regions = await db
    .select({
      centerQ: worldRegions.centerQ,
      centerR: worldRegions.centerR,
      biome: worldRegions.biome
    })
    .from(worldRegions)
    .where(eq(worldRegions.worldId, worldId));

  return {
    id: world.id,
    ownerId: world.ownerId,
    createdAt: world.createdAt,
    updatedAt: world.updatedAt,
    economy: economyFromRow(world),
    tiles: tiles.map((tile) => ({
      q: tile.q,
      r: tile.r,
      biome: tile.biome as BiomeId,
      buildingId: (tile.buildingId as BuildingId | null) ?? null
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
  db: Database["db"],
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

export async function updateWorldEconomy(
  db: Database["db"],
  worldId: string,
  economy: WorldEconomyRow
): Promise<void> {
  await db
    .update(worlds)
    .set({
      populationTotal: economy.populationTotal,
      populationCap: economy.populationCap,
      woodcutters: economy.woodcutters,
      farmers: economy.farmers,
      quarriers: economy.quarriers,
      woodStock: economy.woodStock,
      woodLastCalculatedAt: economy.woodLastCalculatedAt,
      wheatStock: economy.wheatStock,
      wheatLastCalculatedAt: economy.wheatLastCalculatedAt,
      stoneStock: economy.stoneStock,
      stoneLastCalculatedAt: economy.stoneLastCalculatedAt,
      updatedAt: new Date()
    })
    .where(eq(worlds.id, worldId));
}

export async function setTileBuilding(
  db: Database["db"],
  worldId: string,
  tile: { q: number; r: number; buildingId: BuildingId }
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(worldTiles)
      .set({ buildingId: tile.buildingId })
      .where(
        and(
          eq(worldTiles.worldId, worldId),
          eq(worldTiles.q, tile.q),
          eq(worldTiles.r, tile.r)
        )
      );

    await tx
      .update(worlds)
      .set({ updatedAt: new Date() })
      .where(eq(worlds.id, worldId));
  });
}

export async function appendRegion(
  db: Database["db"],
  worldId: string,
  input: {
    center: { q: number; r: number };
    biome: BiomeId;
    tiles: WorldTileRow[];
  }
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(worldRegions).values({
      worldId,
      centerQ: input.center.q,
      centerR: input.center.r,
      biome: input.biome
    });

    if (input.tiles.length > 0) {
      await tx.insert(worldTiles).values(
        input.tiles.map((tile) => ({
          worldId,
          q: tile.q,
          r: tile.r,
          biome: tile.biome,
          buildingId: tile.buildingId
        }))
      );
    }

    await tx
      .update(worlds)
      .set({ updatedAt: new Date() })
      .where(eq(worlds.id, worldId));
  });
}
