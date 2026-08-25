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
  assignExtractorWorkers,
  countBuildings,
  createInitialEconomy,
  createStartingWorld,
  FARM_MAX_WORKERS,
  generateRegionTiles,
  hasCompletedBuilding,
  isPrimaryBiome,
  LUMBER_CAMP_MAX_WORKERS,
  QUARRY_MAX_WORKERS,
  settleEconomy,
  spendWood,
  startConstruction,
  STONE_STOCK_CAP,
  validateBuildPlacement,
  WHEAT_STOCK_CAP,
  WOOD_STOCK_CAP,
  computeRegionExpansionCost,
  reserveWorkerForConstruction,
  type EconomyState
} from "@hexald/game-core";
import type { Database, PersistedWorld, WorldEconomyRow, WorldTileRow } from "@hexald/db";
import {
  appendRegion,
  deleteWorldForOwner,
  fetchWorldForOwner,
  insertWorldWithTerrain,
  listWorldsByOwner,
  setTileBuilding,
  updateWorldEconomy
} from "@hexald/db";
import { hexKey } from "@hexald/shared";
import { env } from "../env.ts";

const START_VILLAGE = { q: 0, r: 0 };
const EXTRACTOR_JOBS = new Set(["woodcutter", "farmer", "quarrier"]);

function isStartVillage(q: number, r: number) {
  return q === START_VILLAGE.q && r === START_VILLAGE.r;
}

function buildingFlags(world: PersistedWorld, now = Date.now()) {
  return {
    hasLumberCamp: hasCompletedBuilding(world.tiles, "lumber_camp", now),
    hasFarm: hasCompletedBuilding(world.tiles, "farm", now),
    hasQuarry: hasCompletedBuilding(world.tiles, "quarry", now)
  };
}

function tileSnapshot(tile: WorldTileRow) {
  return {
    q: tile.q,
    r: tile.r,
    biome: tile.biome,
    buildingId: tile.buildingId,
    constructionCompletesAt: tile.constructionCompletesAt
      ? tile.constructionCompletesAt.toISOString()
      : null
  };
}

function rowToEconomyState(
  row: WorldEconomyRow,
  flags: ReturnType<typeof buildingFlags>
): EconomyState {
  return {
    population: row.populationTotal,
    populationCap: row.populationCap,
    woodcutters: row.woodcutters,
    farmers: row.farmers,
    quarriers: row.quarriers,
    wood: row.woodStock,
    woodLastCalculatedAt: row.woodLastCalculatedAt.getTime(),
    wheat: row.wheatStock,
    wheatLastCalculatedAt: row.wheatLastCalculatedAt.getTime(),
    stone: row.stoneStock,
    stoneLastCalculatedAt: row.stoneLastCalculatedAt.getTime(),
    ...flags
  };
}

function economyStateToRow(state: EconomyState): WorldEconomyRow {
  return {
    populationTotal: state.population,
    populationCap: state.populationCap,
    woodcutters: state.woodcutters,
    farmers: state.farmers,
    quarriers: state.quarriers,
    woodStock: state.wood,
    woodLastCalculatedAt: new Date(state.woodLastCalculatedAt),
    wheatStock: state.wheat,
    wheatLastCalculatedAt: new Date(state.wheatLastCalculatedAt),
    stoneStock: state.stone,
    stoneLastCalculatedAt: new Date(state.stoneLastCalculatedAt)
  };
}

function toEconomySnapshot(state: EconomyState): WorldEconomySnapshot {
  return {
    population: state.population,
    populationCap: state.populationCap,
    woodcutters: state.woodcutters,
    farmers: state.farmers,
    quarriers: state.quarriers,
    lumberCampMaxWorkers: LUMBER_CAMP_MAX_WORKERS,
    farmMaxWorkers: FARM_MAX_WORKERS,
    quarryMaxWorkers: QUARRY_MAX_WORKERS,
    hasLumberCamp: state.hasLumberCamp,
    hasFarm: state.hasFarm,
    hasQuarry: state.hasQuarry,
    wood: state.wood,
    woodCap: WOOD_STOCK_CAP,
    woodLastCalculatedAt: new Date(state.woodLastCalculatedAt).toISOString(),
    wheat: state.wheat,
    wheatCap: WHEAT_STOCK_CAP,
    wheatLastCalculatedAt: new Date(state.wheatLastCalculatedAt).toISOString(),
    stone: state.stone,
    stoneCap: STONE_STOCK_CAP,
    stoneLastCalculatedAt: new Date(state.stoneLastCalculatedAt).toISOString()
  };
}

function toSnapshot(world: PersistedWorld, economy: EconomyState): WorldSnapshot {
  return {
    id: world.id,
    ownerId: world.ownerId,
    createdAt: world.createdAt.toISOString(),
    updatedAt: world.updatedAt.toISOString(),
    tiles: world.tiles.map(tileSnapshot),
    regions: world.regions.map((region) => ({
      center: { q: region.centerQ, r: region.centerR },
      biome: region.biome
    })),
    economy: toEconomySnapshot(economy)
  };
}

function stocksChanged(before: EconomyState, after: EconomyState) {
  return (
    after.wood !== before.wood ||
    after.woodLastCalculatedAt !== before.woodLastCalculatedAt ||
    after.wheat !== before.wheat ||
    after.wheatLastCalculatedAt !== before.wheatLastCalculatedAt ||
    after.stone !== before.stone ||
    after.stoneLastCalculatedAt !== before.stoneLastCalculatedAt
  );
}

async function settleAndPersist(
  db: Database["db"],
  world: PersistedWorld,
  now = Date.now()
): Promise<{ world: PersistedWorld; economy: EconomyState }> {
  const flags = buildingFlags(world, now);
  const before = rowToEconomyState(world.economy, flags);
  const settled = settleEconomy(before, now);
  if (stocksChanged(before, settled)) {
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
    tiles.push({
      q: q!,
      r: r!,
      biome,
      buildingId: null,
      constructionCompletesAt: null
    });
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

export type ResetWorldError = "world_not_found" | "not_available";

/** Dev only — supprime le monde et en crée un neuf pour le même joueur. */
export async function resetWorldService(
  db: Database["db"],
  worldId: string,
  ownerId: string
): Promise<
  { ok: true; world: WorldSnapshot } | { ok: false; error: ResetWorldError }
> {
  if (!env.isDev) {
    return { ok: false, error: "not_available" };
  }

  const existing = await fetchWorldForOwner(db, worldId, ownerId);
  if (!existing) {
    return { ok: false, error: "world_not_found" };
  }

  const deleted = await deleteWorldForOwner(db, worldId, ownerId);
  if (!deleted) {
    return { ok: false, error: "world_not_found" };
  }

  const world = await createWorldService(db, ownerId);
  return { ok: true, world };
}

const DEV_RESOURCE_GRANT = 100;

export type GrantDevResourcesError = "world_not_found" | "not_available";

/** Dev only — crédite bois / blé / pierre (plafonnés). */
export async function grantDevResourcesService(
  db: Database["db"],
  worldId: string,
  ownerId: string
): Promise<
  | { ok: true; world: WorldSnapshot }
  | { ok: false; error: GrantDevResourcesError }
> {
  if (!env.isDev) {
    return { ok: false, error: "not_available" };
  }

  const world = await fetchWorldForOwner(db, worldId, ownerId);
  if (!world) {
    return { ok: false, error: "world_not_found" };
  }

  const now = Date.now();
  const flags = buildingFlags(world, now);
  const settled = settleEconomy(rowToEconomyState(world.economy, flags), now);
  const next: EconomyState = {
    ...settled,
    wood: Math.min(WOOD_STOCK_CAP, settled.wood + DEV_RESOURCE_GRANT),
    wheat: Math.min(WHEAT_STOCK_CAP, settled.wheat + DEV_RESOURCE_GRANT),
    stone: Math.min(STONE_STOCK_CAP, settled.stone + DEV_RESOURCE_GRANT)
  };

  const row = economyStateToRow(next);
  await updateWorldEconomy(db, worldId, row);

  return {
    ok: true,
    world: toSnapshot({ ...world, economy: row, updatedAt: new Date() }, next)
  };
}

export type ExpandRegionError =
  | "world_not_found"
  | "invalid_biome"
  | "cannot_place_region"
  | "insufficient_resources";

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

  const now = Date.now();
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

  const cost = computeRegionExpansionCost({
    center: input.center,
    tiles: world.tiles,
    now
  });

  const flags = buildingFlags(world, now);
  const current = rowToEconomyState(world.economy, flags);
  const spent = spendWood(current, cost.wood, now);
  if (!spent.ok) {
    return { ok: false, error: "insufficient_resources" };
  }

  await appendRegion(db, worldId, {
    center: input.center,
    biome: input.biome,
    tiles: created.map((tile) => ({
      ...tile,
      buildingId: null,
      constructionCompletesAt: null
    }))
  });

  const economyRow = economyStateToRow(spent.state);
  await updateWorldEconomy(db, worldId, economyRow);

  const updatedTiles: WorldTileRow[] = [
    ...world.tiles,
    ...created.map((tile) => ({
      q: tile.q,
      r: tile.r,
      biome: tile.biome,
      buildingId: null,
      constructionCompletesAt: null
    }))
  ];
  const updatedWorld: PersistedWorld = {
    ...world,
    tiles: updatedTiles,
    regions: [
      ...world.regions,
      {
        centerQ: input.center.q,
        centerR: input.center.r,
        biome: input.biome
      }
    ],
    economy: economyRow,
    updatedAt: new Date()
  };

  return {
    ok: true,
    result: {
      center: input.center,
      biome: input.biome,
      tiles: created.map((tile) => ({
        ...tile,
        buildingId: null,
        constructionCompletesAt: null
      })),
      cost,
      world: toSnapshot(updatedWorld, spent.state)
    }
  };
}

export type AssignWorkersError =
  | "world_not_found"
  | "invalid_count"
  | "over_population"
  | "over_building_cap"
  | "unsupported_job"
  | "no_building";

export async function assignWorkersService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  input: AssignWorkersRequest
): Promise<
  | { ok: true; world: WorldSnapshot }
  | { ok: false; error: AssignWorkersError }
> {
  if (!EXTRACTOR_JOBS.has(input.job)) {
    return { ok: false, error: "unsupported_job" };
  }

  const world = await fetchWorldForOwner(db, worldId, ownerId);
  if (!world) {
    return { ok: false, error: "world_not_found" };
  }

  const now = Date.now();
  const current = rowToEconomyState(world.economy, buildingFlags(world, now));
  const result = assignExtractorWorkers(current, input.job, input.count, now);
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
  | "building_limit"
  | "no_idle_workers";

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
    buildingCount: countBuildings(world.tiles, input.buildingId)
  });

  if (!placement.ok) {
    return { ok: false, error: placement.reason };
  }

  const now = Date.now();
  const flags = buildingFlags(world, now);
  const current = rowToEconomyState(world.economy, flags);
  const reserved = reserveWorkerForConstruction(
    current,
    placement.buildingId,
    now
  );
  if (!reserved.ok) {
    return { ok: false, error: "no_idle_workers" };
  }

  const construction = startConstruction(placement.buildingId, now, {
    isDev: env.isDev
  });
  const completesAt = new Date(construction.constructionCompletesAt);

  await setTileBuilding(db, worldId, {
    q: tile.q,
    r: tile.r,
    buildingId: placement.buildingId,
    constructionCompletesAt: completesAt
  });

  const economyRow = economyStateToRow(reserved.state);
  await updateWorldEconomy(db, worldId, economyRow);

  const updatedTile: WorldTileRow = {
    ...tile,
    buildingId: placement.buildingId,
    constructionCompletesAt: completesAt
  };
  const updatedTiles = world.tiles.map((entry) =>
    entry.q === tile.q && entry.r === tile.r ? updatedTile : entry
  );
  const updatedWorld: PersistedWorld = {
    ...world,
    tiles: updatedTiles,
    economy: economyRow,
    updatedAt: new Date()
  };

  // Chantier : worker réservé, pas encore de prod (flags incomplets).
  const economy = rowToEconomyState(economyRow, buildingFlags(updatedWorld, now));

  return {
    ok: true,
    result: {
      tile: tileSnapshot(updatedTile),
      world: toSnapshot(updatedWorld, economy)
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
