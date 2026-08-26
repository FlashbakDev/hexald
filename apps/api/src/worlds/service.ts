import type {
  ApplyActionOutcome,
  AssignWorkersRequest,
  BiomeId,
  BuildRequest,
  BuildResult,
  DestroyBuildingRequest,
  DestroyBuildingResult,
  ExpandRegionResult,
  GameAction,
  HexCoord,
  InventoryStockSnapshot,
  PrimaryBiomeId,
  ResourceId,
  WorldEconomySnapshot,
  WorldSnapshot,
  WorldSummary
} from "@hexald/shared";
import {
  assignWorkersAtTile,
  buildingWoodCost,
  countBuildingSites,
  createInitialEconomy,
  createStartingWorld,
  extractorSitesFromTiles,
  foodConsumptionPerMinute,
  foodNetRatePerMinute,
  foodProductionPerMinute,
  generateRegionTiles,
  getStock,
  getStockAmount,
  grantResource,
  hasCompletedBuilding,
  isBuildingUnderConstruction,
  isPrimaryBiome,
  isBiomeId,
  maxAssignableWorkersForJob,
  POP_GROWTH_SURPLUS_FOOD_REQUIRED,
  settleEconomy,
  spendResource,
  spendWood,
  startConstruction,
  stockCapFor,
  validateAction,
  validateBuildPlacement,
  woodRefundOnDestroy,
  workerTotalsFromTiles,
  committedWorkersFromTiles,
  seedDefaultWorkersForCompletedTiles,
  releaseHousingConstructionWorkers,
  computePopulationCap,
  computeRegionExpansionCost,
  type EconomyState,
  type StockEntry
} from "@hexald/game-core";
import type {
  Database,
  PersistedWorld,
  WorldDb,
  WorldEconomyRow,
  WorldInventoryRow,
  WorldTileRow
} from "@hexald/db";
import {
  appendRegion,
  deleteWorldForOwner,
  fetchWorldForOwner,
  insertWorldWithTerrain,
  listWorldsByOwner,
  setTileBuilding,
  setTileBiomeDev,
  clearTileBuilding,
  setTileWorkerState,
  updateWorldEconomy,
  withWorldLock
} from "@hexald/db";
import { hexKey } from "@hexald/shared";
import { env } from "../env.ts";

const START_VILLAGE = { q: 0, r: 0 };

function isStartVillage(q: number, r: number) {
  return q === START_VILLAGE.q && r === START_VILLAGE.r;
}

function buildingFlags(world: PersistedWorld, now = Date.now()) {
  return {
    lumberCampSites: countBuildingSites(world.tiles, "lumber_camp"),
    farmSites: countBuildingSites(world.tiles, "farm"),
    quarrySites: countBuildingSites(world.tiles, "quarry"),
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
      : null,
    assignedWorkers: tile.assignedWorkers ?? 0
  };
}

function inventoryToStocks(
  inventory: WorldInventoryRow[]
): Partial<Record<ResourceId, StockEntry>> {
  const stocks: Partial<Record<ResourceId, StockEntry>> = {};
  for (const entry of inventory) {
    stocks[entry.resourceId] = {
      amount: entry.amount,
      lastCalculatedAt: entry.lastCalculatedAt.getTime()
    };
  }
  return stocks;
}

function stocksToInventory(
  stocks: Partial<Record<ResourceId, StockEntry>>
): WorldInventoryRow[] {
  return (Object.entries(stocks) as [ResourceId, StockEntry][])
    .filter(([, entry]) => entry !== undefined)
    .map(([resourceId, entry]) => ({
      resourceId,
      amount: entry.amount,
      lastCalculatedAt: new Date(entry.lastCalculatedAt)
    }));
}

function rowToEconomyState(
  row: WorldEconomyRow,
  flags: ReturnType<typeof buildingFlags>,
  tiles: WorldTileRow[],
  now: number
): EconomyState {
  const totals = workerTotalsFromTiles(tiles, now);
  const stocks = inventoryToStocks(row.inventory);
  if (!stocks.food) {
    stocks.food = { amount: 0, lastCalculatedAt: now };
  }
  if (!stocks.worldshard) {
    // Soft-migration : 1 éclat pour pouvoir étendre une fois (comme un nouveau monde).
    stocks.worldshard = { amount: 1, lastCalculatedAt: now };
  }
  return {
    population: row.populationTotal,
    populationCap: computePopulationCap(tiles, now),
    woodcutters: totals.woodcutters,
    farmers: totals.farmers,
    quarriers: totals.quarriers,
    stocks,
    foodSurplusAccumulated: row.foodSurplusAccumulated ?? 0,
    extractorSites: extractorSitesFromTiles(tiles, now),
    ...flags
  };
}

function economyStateToRow(state: EconomyState): WorldEconomyRow {
  return {
    populationTotal: state.population,
    populationCap: state.populationCap,
    foodSurplusAccumulated: state.foodSurplusAccumulated,
    woodcutters: state.woodcutters,
    farmers: state.farmers,
    quarriers: state.quarriers,
    inventory: stocksToInventory(state.stocks)
  };
}

function stockSnapshot(
  state: EconomyState,
  resourceId: ResourceId
): InventoryStockSnapshot {
  const entry = getStock(state, resourceId);
  return {
    resourceId,
    amount: entry.amount,
    cap: stockCapFor(resourceId),
    lastCalculatedAt: new Date(entry.lastCalculatedAt).toISOString()
  };
}

function toEconomySnapshot(state: EconomyState): WorldEconomySnapshot {
  const wood = stockSnapshot(state, "wood");
  const wheat = stockSnapshot(state, "wheat");
  const stone = stockSnapshot(state, "stone");
  const food = stockSnapshot(state, "food");
  const worldshard = stockSnapshot(state, "worldshard");
  const known: ResourceId[] = ["wood", "wheat", "stone", "food", "worldshard"];
  const extras = (Object.keys(state.stocks) as ResourceId[]).filter(
    (id) => !known.includes(id)
  );

  return {
    population: state.population,
    populationCap: state.populationCap,
    woodcutters: state.woodcutters,
    farmers: state.farmers,
    quarriers: state.quarriers,
    lumberCampMaxWorkers: maxAssignableWorkersForJob("woodcutter", state),
    farmMaxWorkers: maxAssignableWorkersForJob("farmer", state),
    quarryMaxWorkers: maxAssignableWorkersForJob("quarrier", state),
    hasLumberCamp: state.hasLumberCamp,
    hasFarm: state.hasFarm,
    hasQuarry: state.hasQuarry,
    stocks: [
      wood,
      wheat,
      stone,
      food,
      worldshard,
      ...extras.map((id) => stockSnapshot(state, id))
    ],
    wood: wood.amount,
    woodCap: wood.cap,
    woodLastCalculatedAt: wood.lastCalculatedAt,
    wheat: wheat.amount,
    wheatCap: wheat.cap,
    wheatLastCalculatedAt: wheat.lastCalculatedAt,
    stone: stone.amount,
    stoneCap: stone.cap,
    stoneLastCalculatedAt: stone.lastCalculatedAt,
    food: food.amount,
    foodCap: food.cap,
    foodLastCalculatedAt: food.lastCalculatedAt,
    foodProductionPerMinute: foodProductionPerMinute(state),
    foodConsumptionPerMinute: foodConsumptionPerMinute(state),
    foodNetPerMinute: foodNetRatePerMinute(state),
    foodSurplusAccumulated: state.foodSurplusAccumulated,
    popGrowthSurplusRequired: POP_GROWTH_SURPLUS_FOOD_REQUIRED
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
  if (
    before.population !== after.population ||
    before.populationCap !== after.populationCap ||
    before.foodSurplusAccumulated !== after.foodSurplusAccumulated
  ) {
    return true;
  }
  const ids = new Set([
    ...(Object.keys(before.stocks) as ResourceId[]),
    ...(Object.keys(after.stocks) as ResourceId[])
  ]);
  for (const id of ids) {
    const a = getStock(before, id);
    const b = getStock(after, id);
    if (a.amount !== b.amount || a.lastCalculatedAt !== b.lastCalculatedAt) {
      return true;
    }
  }
  return false;
}

function tileWorkerStateChanged(before: WorldTileRow, after: WorldTileRow) {
  return (
    before.assignedWorkers !== after.assignedWorkers ||
    before.defaultWorkerSeeded !== after.defaultWorkerSeeded
  );
}

async function persistTileWorkerChanges(
  db: WorldDb,
  worldId: string,
  before: WorldTileRow[],
  after: WorldTileRow[]
) {
  for (const tile of after) {
    const prev = before.find((entry) => entry.q === tile.q && entry.r === tile.r);
    if (!prev || !tileWorkerStateChanged(prev, tile)) continue;
    await setTileWorkerState(db, worldId, { q: tile.q, r: tile.r }, {
      assignedWorkers: tile.assignedWorkers,
      defaultWorkerSeeded: tile.defaultWorkerSeeded
    });
  }
}

async function settleAndPersist(
  db: WorldDb,
  world: PersistedWorld,
  now = Date.now()
): Promise<{ world: PersistedWorld; economy: EconomyState }> {
  const population = world.economy.populationTotal;
  const released = releaseHousingConstructionWorkers(world.tiles, now);
  let tiles = released.changed ? released.tiles : world.tiles;

  const seeded = seedDefaultWorkersForCompletedTiles(tiles, population, now);
  if (seeded.changed) {
    tiles = seeded.tiles;
  }

  if (released.changed || seeded.changed) {
    await persistTileWorkerChanges(db, world.id, world.tiles, tiles);
  }

  const flags = buildingFlags({ ...world, tiles }, now);
  const before = rowToEconomyState(world.economy, flags, tiles, now);
  const settled = settleEconomy(before, now);
  const capChanged = world.economy.populationCap !== settled.populationCap;

  if (
    stocksChanged(before, settled) ||
    released.changed ||
    seeded.changed ||
    capChanged
  ) {
    const row = economyStateToRow(settled);
    await updateWorldEconomy(db, world.id, row);
    return {
      world: { ...world, tiles, economy: row, updatedAt: new Date() },
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
      constructionCompletesAt: null,
      assignedWorkers: 0,
      defaultWorkerSeeded: false
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
  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
    const { world: settledWorld, economy } = await settleAndPersist(tx, world);
    return toSnapshot(settledWorld, economy);
  });

  if (locked.ok) return locked.value;

  if (locked.error === "world_busy") {
    // Lecture sans persist si un autre onglet tient le verrou.
    const world = await fetchWorldForOwner(db, worldId, ownerId);
    if (!world) return null;
    const now = Date.now();
    const flags = buildingFlags(world, now);
    const economy = settleEconomy(
      rowToEconomyState(world.economy, flags, world.tiles, now),
      now
    );
    return toSnapshot(world, economy);
  }

  return null;
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

export type GrantDevResourcesError =
  | "world_not_found"
  | "world_busy"
  | "not_available";

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

  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
    const now = Date.now();
    const flags = buildingFlags(world, now);
    const settled = settleEconomy(
      rowToEconomyState(world.economy, flags, world.tiles, now),
      now
    );
    let next = grantResource(settled, "wood", DEV_RESOURCE_GRANT, now, stockCapFor("wood"));
    next = grantResource(next, "wheat", DEV_RESOURCE_GRANT, now, stockCapFor("wheat"));
    next = grantResource(next, "stone", DEV_RESOURCE_GRANT, now, stockCapFor("stone"));
    next = grantResource(next, "food", DEV_RESOURCE_GRANT, now, stockCapFor("food"));
    next = grantResource(next, "worldshard", stockCapFor("worldshard"), now, stockCapFor("worldshard"));

    const row = economyStateToRow(next);
    await updateWorldEconomy(tx, worldId, row);

    return toSnapshot({ ...world, economy: row, updatedAt: new Date() }, next);
  });

  if (!locked.ok) return { ok: false, error: locked.error };
  return { ok: true, world: locked.value };
}

export type SetTileBiomeDevError =
  | "world_not_found"
  | "world_busy"
  | "tile_not_found"
  | "invalid_biome"
  | "not_available";

/** Dev only — force le biome d’une tuile et retire tout bâtiment dessus. */
export async function setTileBiomeDevService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  input: { q: number; r: number; biome: BiomeId }
): Promise<
  | { ok: true; world: WorldSnapshot }
  | { ok: false; error: SetTileBiomeDevError }
> {
  if (!env.isDev) {
    return { ok: false, error: "not_available" };
  }
  if (!isBiomeId(input.biome)) {
    return { ok: false, error: "invalid_biome" };
  }

  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
    const tile = world.tiles.find(
      (entry) => entry.q === input.q && entry.r === input.r
    );
    if (!tile) {
      return { ok: false as const, error: "tile_not_found" as const };
    }

    const now = Date.now();
    const flags = buildingFlags(world, now);
    const settled = settleEconomy(
      rowToEconomyState(world.economy, flags, world.tiles, now),
      now
    );

    await setTileBiomeDev(tx, worldId, {
      q: input.q,
      r: input.r,
      biome: input.biome
    });

    const updatedTile: WorldTileRow = {
      ...tile,
      biome: input.biome,
      buildingId: null,
      constructionCompletesAt: null,
      assignedWorkers: 0,
      defaultWorkerSeeded: false
    };
    const updatedTiles = world.tiles.map((entry) =>
      entry.q === tile.q && entry.r === tile.r ? updatedTile : entry
    );
    const after = rowToEconomyState(
      economyStateToRow(settled),
      buildingFlags({ ...world, tiles: updatedTiles }, now),
      updatedTiles,
      now
    );
    const row = economyStateToRow(after);
    await updateWorldEconomy(tx, worldId, row);

    return {
      ok: true as const,
      world: toSnapshot(
        { ...world, tiles: updatedTiles, economy: row, updatedAt: new Date() },
        after
      )
    };
  });

  if (!locked.ok) return { ok: false, error: locked.error };
  return locked.value;
}

export type ExpandRegionError =
  | "world_not_found"
  | "world_busy"
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

  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
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
      return { ok: false as const, error: "cannot_place_region" as const };
    }

    const cost = computeRegionExpansionCost({
      center: input.center,
      tiles: world.tiles,
      now
    });

    const flags = buildingFlags(world, now);
    const current = rowToEconomyState(world.economy, flags, world.tiles, now);
    const spent = spendResource(current, "worldshard", cost.worldshards, now);
    if (!spent.ok) {
      return { ok: false as const, error: "insufficient_resources" as const };
    }

    await appendRegion(tx, worldId, {
      center: input.center,
      biome: input.biome,
      tiles: created.map((tile) => ({
        ...tile,
        buildingId: null,
        constructionCompletesAt: null,
        assignedWorkers: 0,
        defaultWorkerSeeded: false
      }))
    });

    const economyRow = economyStateToRow(spent.state);
    await updateWorldEconomy(tx, worldId, economyRow);

    const updatedTiles: WorldTileRow[] = [
      ...world.tiles,
      ...created.map((tile) => ({
        q: tile.q,
        r: tile.r,
        biome: tile.biome,
        buildingId: null,
        constructionCompletesAt: null,
        assignedWorkers: 0,
        defaultWorkerSeeded: false
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
      ok: true as const,
      result: {
        center: input.center,
        biome: input.biome,
        tiles: created.map((tile) => ({
          ...tile,
          buildingId: null,
          constructionCompletesAt: null,
          assignedWorkers: 0,
          defaultWorkerSeeded: false
        })),
        cost,
        world: toSnapshot(updatedWorld, spent.state)
      }
    };
  });

  if (!locked.ok) return { ok: false, error: locked.error };
  return locked.value;
}

export type AssignWorkersError =
  | "world_not_found"
  | "world_busy"
  | "tile_not_found"
  | "invalid_count"
  | "over_population"
  | "no_building"
  | "under_construction";

export async function assignWorkersService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  input: AssignWorkersRequest
): Promise<
  | { ok: true; world: WorldSnapshot }
  | { ok: false; error: AssignWorkersError }
> {
  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
    const now = Date.now();
    const flags = buildingFlags(world, now);
    const before = rowToEconomyState(world.economy, flags, world.tiles, now);
    const settled = settleEconomy(before, now);

    const result = assignWorkersAtTile(
      world.tiles,
      input.origin,
      input.count,
      settled.population,
      now
    );
    if (!result.ok) {
      return { ok: false as const, error: result.reason };
    }

    const updatedTiles: WorldTileRow[] = world.tiles.map((entry) => {
      const next = result.tiles.find((tile) => tile.q === entry.q && tile.r === entry.r);
      if (!next) return entry;
      return {
        ...entry,
        assignedWorkers: next.assignedWorkers ?? 0,
        defaultWorkerSeeded: true
      };
    });

    await setTileWorkerState(tx, worldId, input.origin, {
      assignedWorkers: input.count,
      defaultWorkerSeeded: true
    });

    const updatedWorld: PersistedWorld = {
      ...world,
      tiles: updatedTiles,
      updatedAt: new Date()
    };
    const after = rowToEconomyState(
      economyStateToRow(settled),
      buildingFlags(updatedWorld, now),
      updatedTiles,
      now
    );
    const row = economyStateToRow(after);
    await updateWorldEconomy(tx, worldId, row);

    return {
      ok: true as const,
      world: toSnapshot({ ...updatedWorld, economy: row }, after)
    };
  });

  if (!locked.ok) return { ok: false, error: locked.error };
  return locked.value;
}

export type BuildError =
  | "world_not_found"
  | "world_busy"
  | "tile_not_found"
  | "unknown_building"
  | "not_buildable"
  | "wrong_terrain"
  | "tile_occupied"
  | "has_village"
  | "insufficient_resources"
  | "insufficient_population";

export async function buildService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  input: BuildRequest
): Promise<{ ok: true; result: BuildResult } | { ok: false; error: BuildError }> {
  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
    const tile = world.tiles.find(
      (entry) => entry.q === input.origin.q && entry.r === input.origin.r
    );
    if (!tile) {
      return { ok: false as const, error: "tile_not_found" as const };
    }

    const placement = validateBuildPlacement({
      buildingId: input.buildingId,
      origin: input.origin,
      biome: tile.biome,
      hasVillage: isStartVillage(tile.q, tile.r),
      existingBuildingId: tile.buildingId
    });

    if (!placement.ok) {
      return { ok: false as const, error: placement.reason };
    }

    const now = Date.now();
    const flags = buildingFlags(world, now);
    const current = rowToEconomyState(world.economy, flags, world.tiles, now);
    const committed = committedWorkersFromTiles(world.tiles);
    const idlePopulation = current.population - committed;
    if (idlePopulation < 1) {
      return { ok: false as const, error: "insufficient_population" as const };
    }

    const spent = spendWood(current, buildingWoodCost(placement.buildingId), now);
    if (!spent.ok) {
      return { ok: false as const, error: "insufficient_resources" as const };
    }

    const construction = startConstruction(placement.buildingId, now, {
      isDev: env.isDev
    });
    const completesAt = new Date(construction.constructionCompletesAt);
    const reserveWorker = 1;

    await setTileBuilding(tx, worldId, {
      q: tile.q,
      r: tile.r,
      buildingId: placement.buildingId,
      constructionCompletesAt: completesAt,
      assignedWorkers: reserveWorker,
      defaultWorkerSeeded: reserveWorker > 0
    });

    const economyRow = economyStateToRow(spent.state);
    await updateWorldEconomy(tx, worldId, economyRow);

    const updatedTile: WorldTileRow = {
      ...tile,
      buildingId: placement.buildingId,
      constructionCompletesAt: completesAt,
      assignedWorkers: reserveWorker,
      defaultWorkerSeeded: reserveWorker > 0
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

    const economy = rowToEconomyState(
      economyRow,
      buildingFlags(updatedWorld, now),
      updatedTiles,
      now
    );

    return {
      ok: true as const,
      result: {
        tile: tileSnapshot(updatedTile),
        world: toSnapshot(updatedWorld, economy)
      }
    };
  });

  if (!locked.ok) return { ok: false, error: locked.error };
  return locked.value;
}

export type DestroyBuildingError =
  | "world_not_found"
  | "world_busy"
  | "tile_not_found"
  | "no_building"
  | "has_village";

export async function destroyBuildingService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  input: DestroyBuildingRequest
): Promise<
  { ok: true; result: DestroyBuildingResult } | { ok: false; error: DestroyBuildingError }
> {
  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
    const tile = world.tiles.find(
      (entry) => entry.q === input.origin.q && entry.r === input.origin.r
    );
    if (!tile) {
      return { ok: false as const, error: "tile_not_found" as const };
    }
    if (isStartVillage(tile.q, tile.r)) {
      return { ok: false as const, error: "has_village" as const };
    }
    if (!tile.buildingId) {
      return { ok: false as const, error: "no_building" as const };
    }

    const now = Date.now();
    const flags = buildingFlags(world, now);
    const settled = settleEconomy(
      rowToEconomyState(world.economy, flags, world.tiles, now),
      now
    );

    const underConstruction = isBuildingUnderConstruction(
      tile.constructionCompletesAt,
      now
    );
    const woodRefund = woodRefundOnDestroy(tile.buildingId, underConstruction);
    const freedWorkers = tile.assignedWorkers ?? 0;
    const woodBefore = getStockAmount(settled, "wood");
    const afterGrant =
      woodRefund > 0
        ? grantResource(settled, "wood", woodRefund, now, stockCapFor("wood"))
        : settled;
    const woodGranted = Math.max(
      0,
      getStockAmount(afterGrant, "wood") - woodBefore
    );

    await clearTileBuilding(tx, worldId, input.origin);

    const updatedTile: WorldTileRow = {
      ...tile,
      buildingId: null,
      constructionCompletesAt: null,
      assignedWorkers: 0,
      defaultWorkerSeeded: false
    };
    const updatedTiles = world.tiles.map((entry) =>
      entry.q === tile.q && entry.r === tile.r ? updatedTile : entry
    );
    const after = rowToEconomyState(
      economyStateToRow(afterGrant),
      buildingFlags({ ...world, tiles: updatedTiles }, now),
      updatedTiles,
      now
    );
    const row = economyStateToRow(after);
    await updateWorldEconomy(tx, worldId, row);

    const updatedWorld: PersistedWorld = {
      ...world,
      tiles: updatedTiles,
      economy: row,
      updatedAt: new Date()
    };

    return {
      ok: true as const,
      result: {
        tile: tileSnapshot(updatedTile),
        world: toSnapshot(updatedWorld, after),
        refunds: {
          wood: woodGranted,
          workers: freedWorkers
        }
      }
    };
  });

  if (!locked.ok) return { ok: false, error: locked.error };
  return locked.value;
}

/** Point d’entrée unique — dispatch GameAction vers les services métier. */
export async function applyWorldAction(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  action: GameAction
): Promise<ApplyActionOutcome> {
  const shape = validateAction(action);
  if (!shape.ok) {
    return { ok: false, error: shape.reason };
  }

  if (action.type === "build") {
    const outcome = await buildService(db, worldId, ownerId, {
      buildingId: action.buildingId,
      origin: action.origin
    });
    if (!outcome.ok) return { ok: false, error: outcome.error };
    return { ok: true, type: "build", result: outcome.result };
  }

  if (action.type === "assign_workers") {
    const outcome = await assignWorkersService(db, worldId, ownerId, {
      origin: action.origin,
      count: action.count
    });
    if (!outcome.ok) return { ok: false, error: outcome.error };
    return { ok: true, type: "assign_workers", world: outcome.world };
  }

  if (action.type === "generate_region") {
    const outcome = await expandRegionService(db, worldId, ownerId, {
      center: action.center,
      biome: action.biome
    });
    if (!outcome.ok) return { ok: false, error: outcome.error };
    return { ok: true, type: "generate_region", result: outcome.result };
  }

  return { ok: false, error: "unknown_action" };
}

export function tilesToMap(tiles: WorldTileRow[]): Map<string, BiomeId> {
  const map = new Map<string, BiomeId>();
  for (const tile of tiles) {
    map.set(hexKey(tile.q, tile.r), tile.biome);
  }
  return map;
}
