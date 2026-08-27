import type {
  ApplyActionOutcome,
  AssignWorkersRequest,
  BiomeId,
  BuildingId,
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
  TechId,
  LeaderboardSnapshot,
  WorldEconomySnapshot,
  WorldResearchSnapshot,
  WorldSnapshot,
  WorldSummary
} from "@hexald/shared";
import { wantDevTimers } from "../devTimers.ts";
import {
  assignWorkersAtTile,
  buildingWoodCost,
  computeCivilizationPoints,
  countBuildingSites,
  createInitialEconomy,
  createStartingWorld,
  extractorSitesFromTiles,
  processorSitesFromTiles,
  countPastureTiles,
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
  isStartVillageCoord,
  isVillageBuildingId,
  maxAssignableWorkersForJob,
  POP_GROWTH_SURPLUS_FOOD_REQUIRED,
  researchStateChanged,
  scienceProductionPerMinute,
  settleEconomy,
  settleProcessorTiles,
  clampProcessorInputRate,
  isPlaceableProcessor,
  settleResearch,
  setResearchTarget,
  spendResource,
  spendWood,
  startConstruction,
  startingTileBuildingId,
  stockCapFor,
  techProgressFor,
  validateAction,
  validateBuildPlacement,
  woodRefundOnDestroy,
  workerTotalsFromTiles,
  committedWorkersFromTiles,
  seedDefaultWorkersForCompletedTiles,
  releaseHousingConstructionWorkers,
  releaseWorkersOutsideInfluence,
  computePopulationCap,
  computeRegionExpansionCost,
  assignRivers,
  clearRiverEdgesAt,
  filterTipsAwayFromTile,
  type EconomyState,
  type ResearchState,
  type StockEntry
} from "@hexald/game-core";
import { isResearchableTechId, isTechId, normalizeTechId, techScienceCost } from "@hexald/content";
import type {
  Database,
  PersistedWorld,
  WorldDb,
  WorldEconomyRow,
  WorldInventoryRow,
  WorldResearchRow,
  WorldTileRow
} from "@hexald/db";
import {
  appendRegion,
  deleteWorldForOwner,
  fetchWorldForOwner,
  insertWorldWithTerrain,
  listWorldsByOwner,
  listNamedWorldsForLeaderboard,
  fetchWorld,
  setTileBuilding,
  setTileBiomeDev,
  clearTileBuilding,
  setTileWorkerState,
  setTileProcessorState,
  setTileRiverMasks,
  setTilePoiId,
  updateWorldRiverTips,
  updateWorldEconomy,
  updateWorldResearch,
  withWorldLock
} from "@hexald/db";
import { hexKey, HEX_DIRECTIONS } from "@hexald/shared";
import type { RiverTip } from "@hexald/shared";
import { env } from "../env.ts";

function isStartVillage(q: number, r: number) {
  return isStartVillageCoord(q, r);
}

function tileHasVillage(tile: {
  q: number;
  r: number;
  buildingId?: BuildingId | null;
}) {
  return isVillageBuildingId(tile.buildingId) || isStartVillage(tile.q, tile.r);
}

function buildingFlags(world: PersistedWorld, now = Date.now()) {
  return {
    lumberCampSites: countBuildingSites(world.tiles, "lumber_camp"),
    farmSites: countBuildingSites(world.tiles, "farm"),
    quarrySites: countBuildingSites(world.tiles, "quarry"),
    fishingHutSites: countBuildingSites(world.tiles, "fishing_hut"),
    clayMineSites: countBuildingSites(world.tiles, "clay_mine"),
    hasLumberCamp: hasCompletedBuilding(world.tiles, "lumber_camp", now),
    hasFarm: hasCompletedBuilding(world.tiles, "farm", now),
    hasQuarry: hasCompletedBuilding(world.tiles, "quarry", now),
    hasFishingHut: hasCompletedBuilding(world.tiles, "fishing_hut", now),
    hasClayMine: hasCompletedBuilding(world.tiles, "clay_mine", now)
  };
}

function normalizeUnlockedTechIds(ids: readonly TechId[]): TechId[] {
  const set = new Set<TechId>(["foundations"]);
  for (const id of ids) {
    const normalized = normalizeTechId(id) ?? (isTechId(id) ? id : null);
    if (normalized) set.add(normalized);
  }
  return [...set];
}

function rowToResearchState(row: WorldResearchRow): ResearchState {
  const progress: Partial<Record<TechId, number>> = {};
  for (const entry of row.progress) {
    const techId =
      normalizeTechId(entry.techId) ??
      (isTechId(entry.techId) ? entry.techId : null);
    if (!techId) continue;
    progress[techId] = Math.max(progress[techId] ?? 0, entry.progress);
  }
  const targetRaw = row.researchTargetTechId;
  const researchTargetTechId = targetRaw
    ? normalizeTechId(targetRaw) ?? (isTechId(targetRaw) ? targetRaw : null)
    : null;
  return {
    researchTargetTechId,
    unlockedTechIds: normalizeUnlockedTechIds(row.unlockedTechIds),
    progress,
    scienceLastSettledAt: row.scienceLastSettledAt.getTime()
  };
}

function researchStateToRow(state: ResearchState): WorldResearchRow {
  const progress = Object.entries(state.progress)
    .map(([techId, value]) => ({
      techId: techId as TechId,
      progress: Math.max(0, Math.floor(value ?? 0))
    }))
    .filter((entry) => entry.progress > 0);

  return {
    researchTargetTechId: state.researchTargetTechId,
    scienceLastSettledAt: new Date(state.scienceLastSettledAt),
    unlockedTechIds: state.unlockedTechIds,
    progress
  };
}

function toResearchSnapshot(state: ResearchState): WorldResearchSnapshot {
  const ids = new Set<TechId>();
  for (const key of Object.keys(state.progress)) {
    if (isTechId(key) && isResearchableTechId(key)) ids.add(key);
  }
  if (state.researchTargetTechId) {
    ids.add(state.researchTargetTechId);
  }

  return {
    researchTargetTechId: state.researchTargetTechId,
    unlockedTechIds: state.unlockedTechIds,
    techProgress: [...ids].map((techId) => ({
      techId,
      progress: techProgressFor(state, techId),
      scienceCost: techScienceCost(techId)
    })),
    scienceProductionPerMinute: scienceProductionPerMinute(),
    scienceLastSettledAt: new Date(state.scienceLastSettledAt).toISOString()
  };
}

function tileSnapshot(tile: WorldTileRow) {
  const buildingId =
    tile.buildingId ??
    (isStartVillage(tile.q, tile.r) ? startingTileBuildingId(tile.q, tile.r) : null);
  return {
    q: tile.q,
    r: tile.r,
    biome: tile.biome,
    buildingId,
    constructionCompletesAt: tile.constructionCompletesAt
      ? tile.constructionCompletesAt.toISOString()
      : null,
    assignedWorkers: tile.assignedWorkers ?? 0,
    poiId: tile.poiId ?? null,
    riverMask: tile.riverMask ?? 0,
    processorInputRatePerMinute: tile.processorInputRate ?? 0,
    processorInputBuffer: tile.processorInputBuffer ?? 0,
    processorInputSettledAt: tile.processorInputSettledAt
      ? tile.processorInputSettledAt.toISOString()
      : null,
    craftCompletesAt: tile.craftCompletesAt
      ? tile.craftCompletesAt.toISOString()
      : null
  };
}

function toProcessorTile(tile: WorldTileRow) {
  return {
    ...tile,
    processorInputRatePerMinute: tile.processorInputRate ?? 0,
    processorInputBuffer: tile.processorInputBuffer ?? 0,
    processorInputSettledAt: tile.processorInputSettledAt?.getTime() ?? null,
    craftCompletesAt: tile.craftCompletesAt?.getTime() ?? null
  };
}

function applyProcessorSettleToRows(
  tiles: WorldTileRow[],
  settledTiles: ReturnType<typeof toProcessorTile>[]
): WorldTileRow[] {
  return tiles.map((tile, i) => {
    const next = settledTiles[i];
    if (!next) return tile;
    return {
      ...tile,
      processorInputRate: next.processorInputRatePerMinute ?? 0,
      processorInputBuffer: next.processorInputBuffer ?? 0,
      processorInputSettledAt:
        next.processorInputSettledAt != null
          ? new Date(next.processorInputSettledAt)
          : null,
      craftCompletesAt:
        next.craftCompletesAt != null ? new Date(next.craftCompletesAt) : null
    };
  });
}

function processorTileChanged(before: WorldTileRow, after: WorldTileRow) {
  return (
    (before.processorInputRate ?? 0) !== (after.processorInputRate ?? 0) ||
    Math.abs((before.processorInputBuffer ?? 0) - (after.processorInputBuffer ?? 0)) >
      1e-9 ||
    (before.processorInputSettledAt?.getTime() ?? null) !==
      (after.processorInputSettledAt?.getTime() ?? null) ||
    (before.craftCompletesAt?.getTime() ?? null) !==
      (after.craftCompletesAt?.getTime() ?? null)
  );
}

async function persistProcessorTileChanges(
  db: WorldDb,
  worldId: string,
  before: WorldTileRow[],
  after: WorldTileRow[]
) {
  for (const tile of after) {
    const prev = before.find((entry) => entry.q === tile.q && entry.r === tile.r);
    if (!prev || !processorTileChanged(prev, tile)) continue;
    await setTileProcessorState(db, worldId, { q: tile.q, r: tile.r }, {
      processorInputRate: tile.processorInputRate,
      processorInputBuffer: tile.processorInputBuffer,
      processorInputSettledAt: tile.processorInputSettledAt,
      craftCompletesAt: tile.craftCompletesAt
    });
  }
}

function settleEconomyWithProcessors(
  state: EconomyState,
  tiles: WorldTileRow[],
  now: number
): { state: EconomyState; tiles: WorldTileRow[]; changed: boolean } {
  const settled = settleEconomy(state, now);
  const proc = settleProcessorTiles(
    settled,
    tiles.map(toProcessorTile),
    now,
    { accelerate: wantDevTimers() }
  );
  return {
    state: proc.state,
    tiles: applyProcessorSettleToRows(tiles, proc.tiles),
    changed: proc.changed
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
  now: number,
  unlockedTechIds: TechId[] = ["foundations"]
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
    fishers: totals.fishers,
    miners: totals.miners,
    stocks,
    foodSurplusAccumulated: row.foodSurplusAccumulated ?? 0,
    extractorSites: extractorSitesFromTiles(tiles, now),
    processorSites: processorSitesFromTiles(tiles, now),
    unlockedTechIds,
    pastureTileCount: countPastureTiles(tiles),
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
  const planks = stockSnapshot(state, "planks");
  const clay = stockSnapshot(state, "clay");
  const known: ResourceId[] = [
    "wood",
    "wheat",
    "stone",
    "food",
    "worldshard",
    "planks",
    "clay"
  ];
  const extras = (Object.keys(state.stocks) as ResourceId[]).filter(
    (id) => !known.includes(id)
  );

  return {
    population: state.population,
    populationCap: state.populationCap,
    woodcutters: state.woodcutters,
    farmers: state.farmers,
    quarriers: state.quarriers,
    fishers: state.fishers,
    miners: state.miners,
    lumberCampMaxWorkers: maxAssignableWorkersForJob("woodcutter", state),
    farmMaxWorkers: maxAssignableWorkersForJob("farmer", state),
    quarryMaxWorkers: maxAssignableWorkersForJob("quarrier", state),
    fishingHutMaxWorkers: maxAssignableWorkersForJob("fisher", state),
    clayMineMaxWorkers: maxAssignableWorkersForJob("miner", state),
    hasLumberCamp: state.hasLumberCamp,
    hasFarm: state.hasFarm,
    hasQuarry: state.hasQuarry,
    hasFishingHut: state.hasFishingHut,
    hasClayMine: state.hasClayMine,
    stocks: [
      wood,
      wheat,
      stone,
      food,
      worldshard,
      planks,
      clay,
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

function toSnapshot(
  world: PersistedWorld,
  economy: EconomyState,
  research: ResearchState,
  now = Date.now()
): WorldSnapshot {
  const civilizationPoints = computeCivilizationPoints({
    population: economy.population,
    unlockedTechIds: research.unlockedTechIds,
    tiles: world.tiles,
    now
  });
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
    economy: toEconomySnapshot(economy),
    research: toResearchSnapshot(research),
    riverTips: world.riverTips ?? [],
    civilizationPoints
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
): Promise<{ world: PersistedWorld; economy: EconomyState; research: ResearchState }> {
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
  const before = rowToEconomyState(
    world.economy,
    flags,
    tiles,
    now,
    world.research.unlockedTechIds
  );
  const settledFull = settleEconomyWithProcessors(before, tiles, now);
  const settled = settledFull.state;
  const tilesBeforeProc = tiles;
  tiles = settledFull.tiles;
  if (settledFull.changed) {
    await persistProcessorTileChanges(db, world.id, tilesBeforeProc, tiles);
  }
  const capChanged = world.economy.populationCap !== settled.populationCap;

  const researchBefore = rowToResearchState(world.research);
  const researchAfter = settleResearch(researchBefore, now, {
    accelerate: wantDevTimers()
  });

  const economyChanged =
    stocksChanged(before, settled) ||
    released.changed ||
    seeded.changed ||
    settledFull.changed ||
    capChanged;
  const researchChanged = researchStateChanged(researchBefore, researchAfter);

  if (economyChanged || researchChanged) {
    const row = economyChanged ? economyStateToRow(settled) : world.economy;
    if (economyChanged) {
      await updateWorldEconomy(db, world.id, row);
    }
    if (researchChanged) {
      await updateWorldResearch(db, world.id, researchStateToRow(researchAfter));
    }
    return {
      world: {
        ...world,
        tiles,
        economy: row,
        research: researchChanged
          ? researchStateToRow(researchAfter)
          : world.research,
        updatedAt: new Date()
      },
      economy: settled,
      research: researchAfter
    };
  }

  return {
    world: tiles === world.tiles ? world : { ...world, tiles },
    economy: settled,
    research: researchAfter
  };
}

async function settleResearchAndPersist(
  db: WorldDb,
  worldId: string,
  world: PersistedWorld,
  now: number
): Promise<{ world: PersistedWorld; research: ResearchState }> {
  const before = rowToResearchState(world.research);
  const after = settleResearch(before, now, { accelerate: wantDevTimers() });
  if (!researchStateChanged(before, after)) {
    return { world, research: after };
  }
  const row = researchStateToRow(after);
  await updateWorldResearch(db, worldId, row);
  return {
    world: { ...world, research: row, updatedAt: new Date() },
    research: after
  };
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
      buildingId: startingTileBuildingId(q!, r!),
      constructionCompletesAt: null,
      assignedWorkers: 0,
      defaultWorkerSeeded: false,
      poiId: null,
      riverMask: 0,
      processorInputRate: 0,
      processorInputBuffer: 0,
      processorInputSettledAt: null,
      craftCompletesAt: null
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

  const research = rowToResearchState(persisted.research);
  return toSnapshot(persisted, economy, research);
}

export async function getWorldService(
  db: Database["db"],
  worldId: string,
  ownerId: string
): Promise<WorldSnapshot | null> {
  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
    const { world: settledWorld, economy, research } = await settleAndPersist(tx, world);
    return toSnapshot(settledWorld, economy, research);
  });

  if (locked.ok) return locked.value;

  if (locked.error === "world_busy") {
    // Lecture sans persist si un autre onglet tient le verrou.
    const world = await fetchWorldForOwner(db, worldId, ownerId);
    if (!world) return null;
    const now = Date.now();
    const flags = buildingFlags(world, now);
    const economy = settleEconomy(
      rowToEconomyState(
        world.economy,
        flags,
        world.tiles,
        now,
        world.research.unlockedTechIds
      ),
      now
    );
    const research = settleResearch(rowToResearchState(world.research), now, {
      accelerate: wantDevTimers()
    });
    return toSnapshot(world, economy, research);
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

export const LEADERBOARD_PAGE_SIZE = 20;

/** Classement public par PC — comptes Firebase uniquement (pas les guests). */
export async function getLeaderboardService(
  db: Database["db"],
  options: { page?: number; pageSize?: number } = {}
): Promise<LeaderboardSnapshot> {
  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(options.pageSize ?? LEADERBOARD_PAGE_SIZE))
  );
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const now = Date.now();
  const candidates = await listNamedWorldsForLeaderboard(db);
  const bestByOwner = new Map<
    string,
    {
      pseudo: string;
      science: number;
      production: number;
      population: number;
      military: number;
      total: number;
    }
  >();

  for (const candidate of candidates) {
    const world = await fetchWorld(db, candidate.worldId);
    if (!world) continue;
    const points = computeCivilizationPoints({
      population: world.economy.populationTotal,
      unlockedTechIds: world.research.unlockedTechIds,
      tiles: world.tiles,
      now
    });
    const prev = bestByOwner.get(candidate.ownerId);
    if (!prev || points.total > prev.total) {
      bestByOwner.set(candidate.ownerId, {
        pseudo: candidate.pseudo,
        science: points.science,
        production: points.production,
        population: points.population,
        military: points.military,
        total: points.total
      });
    }
  }

  const ranked = [...bestByOwner.values()].sort(
    (a, b) => b.total - a.total || a.pseudo.localeCompare(b.pseudo, "fr")
  );

  const total = ranked.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  const entries = ranked.slice(start, start + pageSize).map((row, index) => ({
    rank: start + index + 1,
    pseudo: row.pseudo,
    score: row.total,
    science: row.science,
    production: row.production,
    population: row.population,
    military: row.military
  }));

  return {
    entries,
    scoreLabel: "PC",
    generatedAt: new Date(now).toISOString(),
    page: safePage,
    pageSize,
    total,
    totalPages
  };
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
      rowToEconomyState(
        world.economy,
        flags,
        world.tiles,
        now,
        world.research.unlockedTechIds
      ),
      now
    );
    let next = grantResource(settled, "wood", DEV_RESOURCE_GRANT, now, stockCapFor("wood"));
    next = grantResource(next, "wheat", DEV_RESOURCE_GRANT, now, stockCapFor("wheat"));
    next = grantResource(next, "stone", DEV_RESOURCE_GRANT, now, stockCapFor("stone"));
    next = grantResource(next, "food", DEV_RESOURCE_GRANT, now, stockCapFor("food"));
    next = grantResource(next, "worldshard", stockCapFor("worldshard"), now, stockCapFor("worldshard"));

    const row = economyStateToRow(next);
    await updateWorldEconomy(tx, worldId, row);
    const { world: withResearch, research } = await settleResearchAndPersist(
      tx,
      worldId,
      { ...world, economy: row, updatedAt: new Date() },
      now
    );

    return toSnapshot(withResearch, next, research);
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
    if (tileHasVillage(tile)) {
      return { ok: false as const, error: "invalid_biome" as const };
    }

    const now = Date.now();
    const flags = buildingFlags(world, now);
    const settled = settleEconomy(
      rowToEconomyState(
        world.economy,
        flags,
        world.tiles,
        now,
        world.research.unlockedTechIds
      ),
      now
    );

    const nextPoiId =
      tile.poiId === "fish_bank" && input.biome !== "water"
        ? null
        : tile.poiId === "cow_herd" && input.biome !== "plains"
          ? null
          : tile.poiId === "clay_deposit" && input.biome !== "plains"
            ? null
            : tile.poiId === "iron_deposit" && input.biome !== "mountain"
              ? null
              : tile.poiId === "lake" && input.biome === "water"
                ? null
                : tile.poiId === "estuary" && input.biome !== "water"
                  ? null
                  : tile.poiId;

    // Si → water (ou plus land), retirer les arêtes rivière locales.
    const masks = new Map<string, number>();
    for (const entry of world.tiles) {
      if (entry.riverMask) masks.set(hexKey(entry.q, entry.r), entry.riverMask);
    }
    let nextRiverMask = tile.riverMask ?? 0;
    let nextTips: RiverTip[] = world.riverTips ?? [];
    if (input.biome === "water" || (tile.riverMask ?? 0) !== 0) {
      clearRiverEdgesAt(masks, input.q, input.r);
      nextRiverMask = masks.get(hexKey(input.q, input.r)) ?? 0;
      nextTips = filterTipsAwayFromTile(nextTips, input.q, input.r);
    }

    await setTileBiomeDev(tx, worldId, {
      q: input.q,
      r: input.r,
      biome: input.biome,
      poiId: nextPoiId,
      riverMask: nextRiverMask
    });

    const neighborRiverUpdates: { q: number; r: number; riverMask: number }[] =
      [];
    for (const dir of HEX_DIRECTIONS) {
      const nq = input.q + dir.q;
      const nr = input.r + dir.r;
      const nKey = hexKey(nq, nr);
      const prev = world.tiles.find((entry) => entry.q === nq && entry.r === nr);
      if (!prev) continue;
      const nextMask = masks.get(nKey) ?? 0;
      if (nextMask !== (prev.riverMask ?? 0)) {
        neighborRiverUpdates.push({ q: nq, r: nr, riverMask: nextMask });
      }
    }
    if (neighborRiverUpdates.length > 0) {
      await setTileRiverMasks(tx, worldId, neighborRiverUpdates);
    }
    await updateWorldRiverTips(tx, worldId, nextTips);

    const updatedTile: WorldTileRow = {
      ...tile,
      biome: input.biome,
      buildingId: null,
      constructionCompletesAt: null,
      assignedWorkers: 0,
      defaultWorkerSeeded: false,
      poiId: nextPoiId,
      riverMask: nextRiverMask,
      processorInputRate: 0,
      processorInputBuffer: 0,
      processorInputSettledAt: null,
      craftCompletesAt: null
    };
    const updatedTiles = world.tiles.map((entry) => {
      if (entry.q === tile.q && entry.r === tile.r) return updatedTile;
      const upd = neighborRiverUpdates.find(
        (u) => u.q === entry.q && u.r === entry.r
      );
      return upd ? { ...entry, riverMask: upd.riverMask } : entry;
    });
    const after = rowToEconomyState(
      economyStateToRow(settled),
      buildingFlags({ ...world, tiles: updatedTiles }, now),
      updatedTiles,
      now,
      world.research.unlockedTechIds
    );
    const row = economyStateToRow(after);
    await updateWorldEconomy(tx, worldId, row);
    const { world: withResearch, research } = await settleResearchAndPersist(
      tx,
      worldId,
      {
        ...world,
        tiles: updatedTiles,
        economy: row,
        riverTips: nextTips,
        updatedAt: new Date()
      },
      now
    );

    return {
      ok: true as const,
      world: toSnapshot(withResearch, after, research)
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
    const current = rowToEconomyState(
      world.economy,
      flags,
      world.tiles,
      now,
      world.research.unlockedTechIds
    );
    const spent = spendResource(current, "worldshard", cost.worldshards, now);
    if (!spent.ok) {
      return { ok: false as const, error: "insufficient_resources" as const };
    }

    // Carte biomes complète + assignation rivières (tips + nouvelles sources).
    const fullBiomes = new Map(tilesMap);
    for (const tile of created) {
      fullBiomes.set(hexKey(tile.q, tile.r), tile.biome);
    }
    const existingMasks = new Map<string, number>();
    for (const tile of world.tiles) {
      if (tile.riverMask) {
        existingMasks.set(hexKey(tile.q, tile.r), tile.riverMask);
      }
    }
    const createdKeys = new Set(created.map((tile) => hexKey(tile.q, tile.r)));
    const existingLakes = world.tiles
      .filter((tile) => tile.poiId === "lake")
      .map((tile) => ({ q: tile.q, r: tile.r }));
    const riverResult = assignRivers({
      biomes: fullBiomes,
      existingMasks,
      tips: world.riverTips ?? [],
      createdKeys,
      existingLakes
    });

    const riverMaskFor = (q: number, r: number) =>
      riverResult.tileMasks.get(hexKey(q, r)) ?? 0;

    const createdRows: WorldTileRow[] = created.map((tile) => {
      const key = hexKey(tile.q, tile.r);
      const riverPoi = riverResult.poiByKey.get(key);
      return {
        q: tile.q,
        r: tile.r,
        biome: tile.biome,
        buildingId: null,
        constructionCompletesAt: null,
        assignedWorkers: 0,
        defaultWorkerSeeded: false,
        poiId: riverPoi ?? tile.poiId ?? null,
        riverMask: riverMaskFor(tile.q, tile.r),
        processorInputRate: 0,
        processorInputBuffer: 0,
        processorInputSettledAt: null,
        craftCompletesAt: null
      };
    });

    await appendRegion(tx, worldId, {
      center: input.center,
      biome: input.biome,
      tiles: createdRows
    });

    // Tuiles déjà révélées dont le mask a changé (arêtes partagées).
    const existingUpdates: { q: number; r: number; riverMask: number }[] = [];
    for (const tile of world.tiles) {
      const nextMask = riverMaskFor(tile.q, tile.r);
      const prev = tile.riverMask ?? 0;
      if (nextMask !== prev) {
        existingUpdates.push({ q: tile.q, r: tile.r, riverMask: nextMask });
      }
    }
    if (existingUpdates.length > 0) {
      await setTileRiverMasks(tx, worldId, existingUpdates);
    }

    // Estuaire éventuellement sur une mer déjà révélée collée à la région.
    for (const [key, poi] of riverResult.poiByKey) {
      if (createdKeys.has(key)) continue;
      const [q, r] = key.split(",").map(Number) as [number, number];
      const prev = world.tiles.find((t) => t.q === q && t.r === r);
      if (!prev || prev.poiId === poi) continue;
      await setTilePoiId(tx, worldId, { q, r, poiId: poi });
    }

    await updateWorldRiverTips(tx, worldId, riverResult.tips);

    const updatedTiles: WorldTileRow[] = [
      ...world.tiles.map((tile) => {
        const key = hexKey(tile.q, tile.r);
        const poi = riverResult.poiByKey.get(key);
        return {
          ...tile,
          riverMask: riverMaskFor(tile.q, tile.r),
          ...(poi ? { poiId: poi } : {})
        };
      }),
      ...createdRows
    ];
    const afterExpand = {
      ...spent.state,
      extractorSites: extractorSitesFromTiles(updatedTiles, now),
      processorSites: processorSitesFromTiles(updatedTiles, now)
    };
    const economyRow = economyStateToRow(afterExpand);
    await updateWorldEconomy(tx, worldId, economyRow);

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
      riverTips: riverResult.tips,
      updatedAt: new Date()
    };
    const { world: withResearch, research } = await settleResearchAndPersist(
      tx,
      worldId,
      updatedWorld,
      now
    );

    return {
      ok: true as const,
      result: {
        center: input.center,
        biome: input.biome,
        tiles: createdRows.map(tileSnapshot),
        cost,
        world: toSnapshot(withResearch, afterExpand, research)
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
  | "under_construction"
  | "outside_influence";

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
    const before = rowToEconomyState(
      world.economy,
      flags,
      world.tiles,
      now,
      world.research.unlockedTechIds
    );
    const settledFull = settleEconomyWithProcessors(before, world.tiles, now);
    let tiles = settledFull.tiles;
    if (settledFull.changed) {
      await persistProcessorTileChanges(tx, worldId, world.tiles, tiles);
    }

    const result = assignWorkersAtTile(
      tiles,
      input.origin,
      input.count,
      settledFull.state.population,
      now
    );
    if (!result.ok) {
      return { ok: false as const, error: result.reason };
    }

    const updatedTiles: WorldTileRow[] = tiles.map((entry) => {
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
      economyStateToRow(settledFull.state),
      buildingFlags(updatedWorld, now),
      updatedTiles,
      now,
      world.research.unlockedTechIds
    );
    const row = economyStateToRow(after);
    await updateWorldEconomy(tx, worldId, row);
    const { world: withResearch, research } = await settleResearchAndPersist(
      tx,
      worldId,
      { ...updatedWorld, economy: row },
      now
    );

    return {
      ok: true as const,
      world: toSnapshot(withResearch, after, research)
    };
  });

  if (!locked.ok) return { ok: false, error: locked.error };
  return locked.value;
}

export type SetProcessorInputRateError =
  | "world_not_found"
  | "world_busy"
  | "tile_not_found"
  | "invalid_rate"
  | "no_building"
  | "under_construction";

export async function setProcessorInputRateService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  input: { origin: HexCoord; ratePerMinute: number }
): Promise<
  | { ok: true; world: WorldSnapshot }
  | { ok: false; error: SetProcessorInputRateError }
> {
  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
    const now = Date.now();
    const tile = world.tiles.find(
      (entry) => entry.q === input.origin.q && entry.r === input.origin.r
    );
    if (!tile) return { ok: false as const, error: "tile_not_found" as const };
    if (!tile.buildingId || !isPlaceableProcessor(tile.buildingId)) {
      return { ok: false as const, error: "no_building" as const };
    }
    if (isBuildingUnderConstruction(tile.constructionCompletesAt, now)) {
      return { ok: false as const, error: "under_construction" as const };
    }
    if (!Number.isInteger(input.ratePerMinute) || input.ratePerMinute < 0) {
      return { ok: false as const, error: "invalid_rate" as const };
    }

    const rate = clampProcessorInputRate(tile.buildingId, input.ratePerMinute);

    const flags = buildingFlags(world, now);
    const before = rowToEconomyState(
      world.economy,
      flags,
      world.tiles,
      now,
      world.research.unlockedTechIds
    );
    const settledFull = settleEconomyWithProcessors(before, world.tiles, now);
    let tiles = settledFull.tiles;
    if (settledFull.changed) {
      await persistProcessorTileChanges(tx, worldId, world.tiles, tiles);
    }

    tiles = tiles.map((entry) =>
      entry.q === input.origin.q && entry.r === input.origin.r
        ? {
            ...entry,
            processorInputRate: rate,
            processorInputSettledAt:
              entry.processorInputSettledAt ?? new Date(now)
          }
        : entry
    );

    await setTileProcessorState(tx, worldId, input.origin, {
      processorInputRate: rate,
      processorInputSettledAt:
        tiles.find(
          (entry) => entry.q === input.origin.q && entry.r === input.origin.r
        )?.processorInputSettledAt ?? new Date(now)
    });

    const updatedWorld: PersistedWorld = {
      ...world,
      tiles,
      economy: economyStateToRow(settledFull.state),
      updatedAt: new Date()
    };
    await updateWorldEconomy(tx, worldId, updatedWorld.economy);
    const { world: withResearch, research } = await settleResearchAndPersist(
      tx,
      worldId,
      updatedWorld,
      now
    );
    const after = rowToEconomyState(
      withResearch.economy,
      buildingFlags(withResearch, now),
      withResearch.tiles,
      now,
      withResearch.research.unlockedTechIds
    );

    return {
      ok: true as const,
      world: toSnapshot(withResearch, after, research)
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
  | "missing_poi"
  | "tile_occupied"
  | "has_village"
  | "insufficient_resources"
  | "insufficient_population"
  | "tech_not_unlocked"
  | "outside_influence";

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

    const now = Date.now();
    const placement = validateBuildPlacement({
      buildingId: input.buildingId,
      origin: input.origin,
      biome: tile.biome,
      hasVillage: tileHasVillage(tile),
      existingBuildingId: tile.buildingId,
      poiId: tile.poiId ?? null,
      unlockedTechIds: world.research.unlockedTechIds,
      tiles: world.tiles,
      now
    });

    if (!placement.ok) {
      return { ok: false as const, error: placement.reason };
    }

    const flags = buildingFlags(world, now);
    const current = rowToEconomyState(
      world.economy,
      flags,
      world.tiles,
      now,
      world.research.unlockedTechIds
    );
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
      isDev: wantDevTimers()
    });
    const completesAt = new Date(construction.constructionCompletesAt);
    const reserveWorker = 1;
    // Troupeau / gisement fer : effacés par ferme / carrière.
    // Gisement argile : conservé pour la mine d’argile (comme le banc pour la pêche).
    const clearTransientPoi =
      tile.poiId === "cow_herd" ||
      tile.poiId === "iron_deposit" ||
      (tile.poiId === "clay_deposit" && placement.buildingId !== "clay_mine");
    const nextPoiId = clearTransientPoi ? null : (tile.poiId ?? null);

    await setTileBuilding(tx, worldId, {
      q: tile.q,
      r: tile.r,
      buildingId: placement.buildingId,
      constructionCompletesAt: completesAt,
      assignedWorkers: reserveWorker,
      defaultWorkerSeeded: reserveWorker > 0,
      ...(clearTransientPoi ? { poiId: null } : {})
    });

    const economyRow = economyStateToRow(spent.state);
    await updateWorldEconomy(tx, worldId, economyRow);

    const updatedTile: WorldTileRow = {
      ...tile,
      buildingId: placement.buildingId,
      constructionCompletesAt: completesAt,
      assignedWorkers: reserveWorker,
      defaultWorkerSeeded: reserveWorker > 0,
      poiId: nextPoiId,
      processorInputRate: 0,
      processorInputBuffer: 0,
      processorInputSettledAt: null,
      craftCompletesAt: null
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
      now,
      world.research.unlockedTechIds
    );
    const { world: withResearch, research } = await settleResearchAndPersist(
      tx,
      worldId,
      updatedWorld,
      now
    );

    return {
      ok: true as const,
      result: {
        tile: tileSnapshot(updatedTile),
        world: toSnapshot(withResearch, economy, research)
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
    if (tileHasVillage(tile)) {
      return { ok: false as const, error: "has_village" as const };
    }
    if (!tile.buildingId) {
      return { ok: false as const, error: "no_building" as const };
    }

    const now = Date.now();
    const flags = buildingFlags(world, now);
    const settled = settleEconomy(
      rowToEconomyState(
        world.economy,
        flags,
        world.tiles,
        now,
        world.research.unlockedTechIds
      ),
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

    const clearedTile: WorldTileRow = {
      ...tile,
      buildingId: null,
      constructionCompletesAt: null,
      assignedWorkers: 0,
      defaultWorkerSeeded: false,
      processorInputRate: 0,
      processorInputBuffer: 0,
      processorInputSettledAt: null,
      craftCompletesAt: null
    };
    let updatedTiles = world.tiles.map((entry) =>
      entry.q === tile.q && entry.r === tile.r ? clearedTile : entry
    );

    const orphanRelease = releaseWorkersOutsideInfluence(updatedTiles, now);
    if (orphanRelease.changed) {
      const nextTiles: WorldTileRow[] = [];
      for (const entry of orphanRelease.tiles) {
        const prev =
          updatedTiles.find((row) => row.q === entry.q && row.r === entry.r) ??
          clearedTile;
        const next: WorldTileRow = {
          ...prev,
          assignedWorkers: entry.assignedWorkers ?? 0,
          processorInputBuffer: entry.processorInputBuffer ?? 0,
          craftCompletesAt:
            entry.craftCompletesAt == null
              ? null
              : entry.craftCompletesAt instanceof Date
                ? entry.craftCompletesAt
                : new Date(entry.craftCompletesAt)
        };
        nextTiles.push(next);
        if (prev.q === tile.q && prev.r === tile.r) continue;
        if (prev.assignedWorkers !== next.assignedWorkers) {
          await setTileWorkerState(tx, worldId, { q: next.q, r: next.r }, {
            assignedWorkers: next.assignedWorkers,
            defaultWorkerSeeded: prev.defaultWorkerSeeded
          });
        }
        if (
          prev.processorInputBuffer !== next.processorInputBuffer ||
          (prev.craftCompletesAt?.getTime() ?? null) !==
            (next.craftCompletesAt?.getTime() ?? null)
        ) {
          await setTileProcessorState(tx, worldId, { q: next.q, r: next.r }, {
            processorInputBuffer: next.processorInputBuffer,
            craftCompletesAt: next.craftCompletesAt
          });
        }
      }
      updatedTiles = nextTiles;
    }

    const updatedTile =
      updatedTiles.find((entry) => entry.q === tile.q && entry.r === tile.r) ??
      clearedTile;
    const after = rowToEconomyState(
      economyStateToRow(afterGrant),
      buildingFlags({ ...world, tiles: updatedTiles }, now),
      updatedTiles,
      now,
      world.research.unlockedTechIds
    );
    const row = economyStateToRow(after);
    await updateWorldEconomy(tx, worldId, row);

    const updatedWorld: PersistedWorld = {
      ...world,
      tiles: updatedTiles,
      economy: row,
      updatedAt: new Date()
    };
    const { world: withResearch, research } = await settleResearchAndPersist(
      tx,
      worldId,
      updatedWorld,
      now
    );

    return {
      ok: true as const,
      result: {
        tile: tileSnapshot(updatedTile),
        world: toSnapshot(withResearch, after, research),
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

export type SetResearchTargetError =
  | "world_not_found"
  | "world_busy"
  | "unknown_tech"
  | "not_researchable"
  | "already_unlocked"
  | "prerequisites_not_met";

export async function setResearchTargetService(
  db: Database["db"],
  worldId: string,
  ownerId: string,
  techId: TechId
): Promise<
  { ok: true; world: WorldSnapshot } | { ok: false; error: SetResearchTargetError }
> {
  const locked = await withWorldLock(db, worldId, ownerId, async (tx, world) => {
    const now = Date.now();
    const flags = buildingFlags(world, now);
    const economy = settleEconomy(
      rowToEconomyState(
        world.economy,
        flags,
        world.tiles,
        now,
        world.research.unlockedTechIds
      ),
      now
    );
    const researchBefore = rowToResearchState(world.research);
    const settledResearch = settleResearch(researchBefore, now, {
      accelerate: wantDevTimers()
    });
    const outcome = setResearchTarget(settledResearch, techId, now);
    if (!outcome.ok) {
      if (researchStateChanged(researchBefore, settledResearch)) {
        await updateWorldResearch(tx, worldId, researchStateToRow(settledResearch));
      }
      return { ok: false as const, error: outcome.reason };
    }

    if (researchStateChanged(researchBefore, outcome.state)) {
      await updateWorldResearch(tx, worldId, researchStateToRow(outcome.state));
    }

    const economyRow = economyStateToRow(economy);
    if (
      stocksChanged(
        rowToEconomyState(
          world.economy,
          flags,
          world.tiles,
          now,
          world.research.unlockedTechIds
        ),
        economy
      )
    ) {
      await updateWorldEconomy(tx, worldId, economyRow);
    }

    return {
      ok: true as const,
      world: toSnapshot(
        {
          ...world,
          economy: economyRow,
          research: researchStateToRow(outcome.state),
          updatedAt: new Date()
        },
        economy,
        outcome.state
      )
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

  if (action.type === "set_processor_input_rate") {
    const outcome = await setProcessorInputRateService(db, worldId, ownerId, {
      origin: action.origin,
      ratePerMinute: action.ratePerMinute
    });
    if (!outcome.ok) return { ok: false, error: outcome.error };
    return { ok: true, type: "set_processor_input_rate", world: outcome.world };
  }

  if (action.type === "generate_region") {
    const outcome = await expandRegionService(db, worldId, ownerId, {
      center: action.center,
      biome: action.biome
    });
    if (!outcome.ok) return { ok: false, error: outcome.error };
    return { ok: true, type: "generate_region", result: outcome.result };
  }

  if (action.type === "set_research_target") {
    const outcome = await setResearchTargetService(db, worldId, ownerId, action.techId);
    if (!outcome.ok) return { ok: false, error: outcome.error };
    return { ok: true, type: "set_research_target", world: outcome.world };
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
