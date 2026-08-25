import { and, desc, eq } from "drizzle-orm";
import type { BiomeId } from "@hexald/shared";
import type { Database } from "./client.ts";
import { worldRegions, worldTiles, worlds } from "./schema/index.ts";

export type WorldTileRow = {
  q: number;
  r: number;
  biome: BiomeId;
};

export type WorldRegionRow = {
  centerQ: number;
  centerR: number;
  biome: BiomeId;
};

export type PersistedWorld = {
  id: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  tiles: WorldTileRow[];
  regions: WorldRegionRow[];
};

export type PersistedWorldSummary = {
  id: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function insertWorldWithTerrain(
  db: Database["db"],
  input: {
    ownerId: string;
    tiles: WorldTileRow[];
    regions: WorldRegionRow[];
  }
): Promise<PersistedWorld> {
  return db.transaction(async (tx) => {
    const [world] = await tx
      .insert(worlds)
      .values({ ownerId: input.ownerId })
      .returning();
    if (!world) throw new Error("failed_to_create_world");

    if (input.tiles.length > 0) {
      await tx.insert(worldTiles).values(
        input.tiles.map((tile) => ({
          worldId: world.id,
          q: tile.q,
          r: tile.r,
          biome: tile.biome
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
      biome: worldTiles.biome
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
    tiles: tiles.map((tile) => ({
      q: tile.q,
      r: tile.r,
      biome: tile.biome as BiomeId
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
          biome: tile.biome
        }))
      );
    }

    await tx
      .update(worlds)
      .set({ updatedAt: new Date() })
      .where(eq(worlds.id, worldId));
  });
}
