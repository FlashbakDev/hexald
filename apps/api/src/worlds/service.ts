import type { BiomeId, WorldSnapshot, WorldSummary } from "@hexald/shared";
import { createStartingWorld } from "@hexald/game-core";
import type { Database, PersistedWorld, WorldTileRow } from "@hexald/db";
import {
  appendRegion,
  fetchWorldForOwner,
  insertWorldWithTerrain,
  listWorldsByOwner
} from "@hexald/db";
import { hexKey } from "@hexald/shared";

function toSnapshot(world: PersistedWorld): WorldSnapshot {
  return {
    id: world.id,
    ownerId: world.ownerId,
    createdAt: world.createdAt.toISOString(),
    updatedAt: world.updatedAt.toISOString(),
    tiles: world.tiles,
    regions: world.regions.map((region) => ({
      center: { q: region.centerQ, r: region.centerR },
      biome: region.biome
    }))
  };
}

export async function createWorldService(
  db: Database["db"],
  ownerId: string
): Promise<WorldSnapshot> {
  const start = createStartingWorld();
  const tiles: WorldTileRow[] = [];
  for (const [key, biome] of start.tiles) {
    const [q, r] = key.split(",").map(Number);
    tiles.push({ q: q!, r: r!, biome });
  }

  const persisted = await insertWorldWithTerrain(db, {
    ownerId,
    tiles,
    regions: start.regions.map((region) => ({
      centerQ: region.center.q,
      centerR: region.center.r,
      biome: region.biome
    }))
  });

  return toSnapshot(persisted);
}

export async function getWorldService(
  db: Database["db"],
  worldId: string,
  ownerId: string
): Promise<WorldSnapshot | null> {
  const world = await fetchWorldForOwner(db, worldId, ownerId);
  return world ? toSnapshot(world) : null;
}

export async function listWorldsService(
  db: Database["db"],
  ownerId: string
): Promise<WorldSummary[]> {
  const rows = await listWorldsByOwner(db, ownerId);
  return rows.map((world) => ({
    id: world.id,
    ownerId: world.ownerId,
    createdAt: world.createdAt.toISOString(),
    updatedAt: world.updatedAt.toISOString()
  }));
}

export async function appendRegionService(
  db: Database["db"],
  worldId: string,
  input: {
    center: { q: number; r: number };
    biome: BiomeId;
    tiles: Map<string, BiomeId> | WorldTileRow[];
  }
): Promise<void> {
  const tiles: WorldTileRow[] = Array.isArray(input.tiles)
    ? input.tiles
    : [...input.tiles.entries()].map(([key, biome]) => {
        const [q, r] = key.split(",").map(Number);
        return { q: q!, r: r!, biome };
      });

  await appendRegion(db, worldId, {
    center: input.center,
    biome: input.biome,
    tiles
  });
}

export function tilesToMap(tiles: WorldTileRow[]): Map<string, BiomeId> {
  const map = new Map<string, BiomeId>();
  for (const tile of tiles) {
    map.set(hexKey(tile.q, tile.r), tile.biome);
  }
  return map;
}
