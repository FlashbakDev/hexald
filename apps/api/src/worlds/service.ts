import type {
  AssignWorkersRequest,
  BiomeId,
  BuildRequest,
  BuildResult,
  ExpandRegionResult,
  HexCoord,
  PrimaryBiomeId,
  WorldEconomySnapshot,
  WorldSnapshot,
  WorldSummary
} from "@hexald/shared";
import {
  assignWoodcutters,
  countBuildings,
  createInitialEconomy,
  createStartingWorld,
  generateRegionTiles,
  isPrimaryBiome,
  LUMBER_CAMP_MAX_WORKERS,
  settleEconomy,
  validateBuildPlacement,
  WOOD_STOCK_CAP,
  type EconomyState
} from "@hexald/game-core";
import type { Database, PersistedWorld, WorldEconomyRow, WorldTileRow } from "@hexald/db";
import {
  appendRegion,
  fetchWorldForOwner,
  insertWorldWithTerrain,
  listWorldsByOwner,
  setTileBuilding,
  updateWorldEconomy
} from "@hexald/db";
import { hexKey } from "@hexald/shared";

const START_VILLAGE = { q: 0, r: 0 };

function isStartVillage(q: number, r: number) {
  return q === START_VILLAGE.q && r === START_VILLAGE.r;
}

function rowToEconomyState(
  row: WorldEconomyRow,
  hasLumberCamp: boolean
): EconomyState {
  return {
    population: row.populationTotal,
    populationCap: row.populationCap,
    woodcutters: row.woodcutters,
    wood: row.woodStock,
    woodLastCalculatedAt: row.woodLastCalculatedAt.getTime(),
    hasLumberCamp
  };
}

function economyStateToRow(state: EconomyState): WorldEconomyRow {
  return {
    populationTotal: state.population,
    populationCap: state.populationCap,
    woodcutters: state.woodcutters,
    woodStock: state.wood,
    woodLastCalculatedAt: new Date(state.woodLastCalculatedAt)
  };
}

function toEconomySnapshot(state: EconomyState): WorldEconomySnapshot {
  return {
    population: state.population,
    populationCap: state.populationCap,
    woodcutters: state.woodcutters,
    lumberCampMaxWorkers: LUMBER_CAMP_MAX_WORKERS,
    hasLumberCamp: state.hasLumberCamp,
    wood: state.wood,
    woodCap: WOOD_STOCK_CAP,
    woodLastCalculatedAt: new Date(state.woodLastCalculatedAt).toISOString()
  };
}

function hasLumberCampOnWorld(world: PersistedWorld) {
  return countBuildings(world.tiles, "lumber_camp") > 0;
}

function toSnapshot(world: PersistedWorld, economy: EconomyState): WorldSnapshot {
  return {
    id: world.id,
    ownerId: world.ownerId,
    createdAt: world.createdAt.toISOString(),
    updatedAt: world.updatedAt.toISOString(),
    tiles: world.tiles.map((tile) => ({
      q: tile.q,
      r: tile.r,
      biome: tile.biome,
      buildingId: tile.buildingId
    })),
    regions: world.regions.map((region) => ({
      center: { q: region.centerQ, r: region.centerR },
      biome: region.biome
    })),
    economy: toEconomySnapshot(economy)
  };
}

async function settleAndPersist(
  db: Database["db"],
  world: PersistedWorld,
  now = Date.now()
): Promise<{ world: PersistedWorld; economy: EconomyState }> {
  const hasCamp = hasLumberCampOnWorld(world);
  const before = rowToEconomyState(world.economy, hasCamp);
  const settled = settleEconomy(before, now);
  if (
    settled.wood !== before.wood ||
    settled.woodLastCalculatedAt !== before.woodLastCalculatedAt
  ) {
    const row = economyStateToRow(settled);
    await updateWorldEconomy(db, world.id, row);
    return {
      world: { ...world, economy: row, updatedAt: new Date() },
      economy: settled
    };
  }
  return { world, economy: settled };
}

export async function createWorldService(
  db: Database["db"],
  ownerId: string
): Promise<WorldSnapshot> {
  const start = createStartingWorld();
  const economy = createInitialEconomy();
  const tiles: WorldTileRow[] = [];
  for (const [key, biome] of start.tiles) {
    const [q, r] = key.split(",").map(Number);
    tiles.push({ q: q!, r: r!, biome, buildingId: null });
  }

  const persisted = await insertWorldWithTerrain(db, {
    ownerId,
    tiles,
    regions: start.regions.map((region) => ({
      centerQ: region.center.q,
      centerR: region.center.r,
      biome: region.biome
    })),
    economy: economyStateToRow(economy)
  });

  return toSnapshot(persisted, economy);
}

export async function getWorldService(
  db: Database["db"],
  worldId: string,
  ownerId: string
): Promise<WorldSnapshot | null> {
  const world = await fetchWorldForOwner(db, worldId, ownerId);
  if (!world) return null;
  const { world: settledWorld, economy } = await settleAndPersist(db, world);
  return toSnapshot(settledWorld, economy);
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

export type ExpandRegionError =
  | "world_not_found"
  | "invalid_biome"
  | "cannot_place_region";

export async function expandRegionService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  input: { center: HexCoord; biome: PrimaryBiomeId }
): Promise<{ ok: true; result: ExpandRegionResult } | { ok: false; error: ExpandRegionError }> {
  if (!isPrimaryBiome(input.biome)) {
    return { ok: false, error: "invalid_biome" };
  }

  const world = await fetchWorldForOwner(db, worldId, ownerId);
  if (!world) {
    return { ok: false, error: "world_not_found" };
  }

  const tilesMap = tilesToMap(world.tiles);
  const centers = world.regions.map((region) => ({
    q: region.centerQ,
    r: region.centerR
  }));

  const created = generateRegionTiles(
    tilesMap,
    input.center,
    input.biome,
    centers
  );
  if (created.length === 0) {
    return { ok: false, error: "cannot_place_region" };
  }

  await appendRegion(db, worldId, {
    center: input.center,
    biome: input.biome,
    tiles: created.map((tile) => ({ ...tile, buildingId: null }))
  });

  return {
    ok: true,
    result: {
      center: input.center,
      biome: input.biome,
      tiles: created.map((tile) => ({ ...tile, buildingId: null }))
    }
  };
}

export type AssignWorkersError =
  | "world_not_found"
  | "invalid_count"
  | "over_population"
  | "over_building_cap"
  | "unsupported_job"
  | "no_lumber_camp";

export async function assignWorkersService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  input: AssignWorkersRequest
): Promise<
  | { ok: true; world: WorldSnapshot }
  | { ok: false; error: AssignWorkersError }
> {
  if (input.job !== "woodcutter") {
    return { ok: false, error: "unsupported_job" };
  }

  const world = await fetchWorldForOwner(db, worldId, ownerId);
  if (!world) {
    return { ok: false, error: "world_not_found" };
  }

  const now = Date.now();
  const current = rowToEconomyState(world.economy, hasLumberCampOnWorld(world));
  const result = assignWoodcutters(current, input.count, now);
  if (!result.ok) {
    return { ok: false, error: result.reason };
  }

  const row = economyStateToRow(result.state);
  await updateWorldEconomy(db, worldId, row);

  return {
    ok: true,
    world: toSnapshot({ ...world, economy: row, updatedAt: new Date() }, result.state)
  };
}

export type BuildError =
  | "world_not_found"
  | "tile_not_found"
  | "unknown_building"
  | "not_buildable"
  | "wrong_terrain"
  | "tile_occupied"
  | "has_village"
  | "lumber_camp_limit";

export async function buildService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  input: BuildRequest
): Promise<{ ok: true; result: BuildResult } | { ok: false; error: BuildError }> {
  const world = await fetchWorldForOwner(db, worldId, ownerId);
  if (!world) {
    return { ok: false, error: "world_not_found" };
  }

  const tile = world.tiles.find(
    (entry) => entry.q === input.origin.q && entry.r === input.origin.r
  );
  if (!tile) {
    return { ok: false, error: "tile_not_found" };
  }

  const placement = validateBuildPlacement({
    buildingId: input.buildingId,
    origin: input.origin,
    biome: tile.biome,
    hasVillage: isStartVillage(tile.q, tile.r),
    existingBuildingId: tile.buildingId,
    lumberCampCount: countBuildings(world.tiles, "lumber_camp")
  });

  if (!placement.ok) {
    return { ok: false, error: placement.reason };
  }

  await setTileBuilding(db, worldId, {
    q: tile.q,
    r: tile.r,
    buildingId: placement.buildingId
  });

  const updatedTiles = world.tiles.map((entry) =>
    entry.q === tile.q && entry.r === tile.r
      ? { ...entry, buildingId: placement.buildingId }
      : entry
  );
  const updatedWorld: PersistedWorld = {
    ...world,
    tiles: updatedTiles,
    updatedAt: new Date()
  };

  const { world: settledWorld, economy } = await settleAndPersist(db, updatedWorld);

  return {
    ok: true,
    result: {
      tile: {
        q: tile.q,
        r: tile.r,
        biome: tile.biome,
        buildingId: placement.buildingId
      },
      world: toSnapshot(settledWorld, economy)
    }
  };
}

export function tilesToMap(tiles: WorldTileRow[]): Map<string, BiomeId> {
  const map = new Map<string, BiomeId>();
  for (const tile of tiles) {
    map.set(hexKey(tile.q, tile.r), tile.biome);
  }
  return map;
}
