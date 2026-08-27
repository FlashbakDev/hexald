import {
  FOOD_CONSUMPTION_PER_POP_PER_MINUTE,
  FUSION_TILE_PRODUCTION_BONUS,
  LUMBER_CAMP_MAX_WORKERS,
  POP_GROWTH_SURPLUS_FOOD_REQUIRED,
  POPULATION_CAP,
  FARM_MAX_WORKERS,
  QUARRY_MAX_WORKERS,
  FISHING_HUT_MAX_WORKERS,
  FISHING_HUT_FOOD_RATE_PER_WORKER_PER_MINUTE,
  STARTING_FOOD,
  STARTING_POPULATION,
  STARTING_STONE,
  STARTING_WHEAT,
  STARTING_WOOD,
  STARTING_WORLDSHARD,
  STONE_RATE_PER_WORKER_PER_MINUTE,
  STONE_STOCK_CAP,
  TOWN_HALL_FOOD_PRODUCTION_PER_MINUTE,
  TOWN_HALL_WORLDSHARD_INTERVAL_MS,
  WHEAT_RATE_PER_WORKER_PER_MINUTE,
  WHEAT_STOCK_CAP,
  WHEAT_TO_FOOD_EMERGENCY_RATIO,
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  WOOD_STOCK_CAP,
  WORLDSHARD_STOCK_CAP,
  buildingRateFromCatalog,
  lumberCampTechBonusPerMinute as lumberCampTechBonusFromUnlocks,
  quarryMasonryBonusPerMinute as quarryMasonryBonusFromUnlocks,
  pastureFoodBonusPerMinute,
  plantationFoodBonusPerMinute,
  getBuildingDefinition,
  resourceOutputForBuilding,
  getProcessorStepForBuilding,
  recipeInputCount,
  recipeOutputCount,
  stockCapFor,
  type PlaceableExtractorId,
  type PlaceableProcessorId
} from "@hexald/content";
import type { BiomeId, BuildingId, ExtractorJob, ResourceId, TechId } from "@hexald/shared";
import { hexKey } from "@hexald/shared";
import { applyOfflineProduction } from "./production.ts";
import { isBuildingComplete } from "./construction.ts";
import { isPlaceableExtractor, isPlaceableProcessor } from "./build.ts";
import { computeInfluencedTiles } from "./influence.ts";
import { isFusionBiome } from "./world.ts";

export type StockEntry = {
  amount: number;
  lastCalculatedAt: number;
};

/** Site extracteur pour rates avec bonus biome. */
export type ExtractorSite = {
  buildingId: PlaceableExtractorId;
  biome: BiomeId;
  workers: number;
  complete: boolean;
  /** False si hors emprise connectée (DEC-026). */
  influenced: boolean;
};

/** Site processor (craft) — workers requis pour opérer. */
export type ProcessorSite = {
  buildingId: PlaceableProcessorId;
  workers: number;
  complete: boolean;
  influenced: boolean;
};

export type EconomyState = {
  population: number;
  populationCap: number;
  woodcutters: number;
  farmers: number;
  quarriers: number;
  fishers: number;
  miners: number;
  /** Inventaire générique (resource_id → stock). */
  stocks: Partial<Record<ResourceId, StockEntry>>;
  unlockedTechIds: readonly TechId[];
  /** Tuiles pâturage (POI troupeau, sans ferme). */
  pastureTileCount: number;
  /** Sites posés (y compris en chantier). */
  lumberCampSites: number;
  farmSites: number;
  quarrySites: number;
  fishingHutSites: number;
  clayMineSites: number;
  /** Au moins un site achevé — requis pour produire. */
  hasLumberCamp: boolean;
  hasFarm: boolean;
  hasQuarry: boolean;
  hasFishingHut: boolean;
  hasClayMine: boolean;
  /** DEC-017 — surplus food cumulé vers le prochain habitant. */
  foodSurplusAccumulated: number;
  /** Sites extracteurs (biome + workers) pour bonus fusion. */
  extractorSites: ExtractorSite[];
  /** Sites processors (scierie, …). */
  processorSites: ProcessorSite[];
};

export function tileProductionMultiplier(biome: BiomeId): number {
  return isFusionBiome(biome) ? 1 + FUSION_TILE_PRODUCTION_BONUS : 1;
}

/** Tuiles pâturage : troupeau présent, ferme non construite. */
export function countPastureTiles(
  tiles: readonly {
    poiId?: string | null;
    buildingId?: string | null;
  }[]
): number {
  return tiles.filter(
    (tile) => tile.poiId === "cow_herd" && tile.buildingId !== "farm"
  ).length;
}

export function extractorSitesFromTiles(
  tiles: readonly {
    q?: number;
    r?: number;
    buildingId?: BuildingId | string | null;
    biome: BiomeId;
    assignedWorkers?: number;
    constructionCompletesAt?: number | string | Date | null;
  }[],
  now: number
): ExtractorSite[] {
  const influenced = computeInfluencedTiles(
    tiles.flatMap((tile) =>
      tile.q == null || tile.r == null
        ? []
        : [
            {
              q: tile.q,
              r: tile.r,
              buildingId: (tile.buildingId as BuildingId | null | undefined) ?? null,
              constructionCompletesAt: tile.constructionCompletesAt
            }
          ]
    ),
    now
  );
  const sites: ExtractorSite[] = [];
  for (const tile of tiles) {
    const buildingId = tile.buildingId;
    if (!buildingId || !isPlaceableExtractor(buildingId as BuildingId)) continue;
    const complete = isBuildingComplete(tile.constructionCompletesAt, now);
    const onMap = tile.q != null && tile.r != null;
    sites.push({
      buildingId: buildingId as PlaceableExtractorId,
      biome: tile.biome,
      workers: Math.max(0, Math.floor(tile.assignedWorkers ?? 0)),
      complete,
      influenced: onMap ? influenced.has(hexKey(tile.q!, tile.r!)) : true
    });
  }
  return sites;
}

export function processorSitesFromTiles(
  tiles: readonly {
    q?: number;
    r?: number;
    buildingId?: BuildingId | string | null;
    assignedWorkers?: number;
    constructionCompletesAt?: number | string | Date | null;
  }[],
  now: number
): ProcessorSite[] {
  const influenced = computeInfluencedTiles(
    tiles.flatMap((tile) =>
      tile.q == null || tile.r == null
        ? []
        : [
            {
              q: tile.q,
              r: tile.r,
              buildingId: (tile.buildingId as BuildingId | null | undefined) ?? null,
              constructionCompletesAt: tile.constructionCompletesAt
            }
          ]
    ),
    now
  );
  const sites: ProcessorSite[] = [];
  for (const tile of tiles) {
    const buildingId = tile.buildingId;
    if (!buildingId || !isPlaceableProcessor(buildingId as BuildingId)) continue;
    const complete = isBuildingComplete(tile.constructionCompletesAt, now);
    const onMap = tile.q != null && tile.r != null;
    sites.push({
      buildingId: buildingId as PlaceableProcessorId,
      workers: Math.max(0, Math.floor(tile.assignedWorkers ?? 0)),
      complete,
      influenced: onMap ? influenced.has(hexKey(tile.q!, tile.r!)) : true
    });
  }
  return sites;
}

/** Cycles craft / min pour un processor (somme workers × rate catalogue). */
export function processorCraftRatePerMinute(
  state: EconomyState,
  buildingId: PlaceableProcessorId
): number {
  const base = buildingRateFromCatalog(buildingId);
  if (base <= 0) return 0;
  let total = 0;
  for (const site of state.processorSites) {
    if (site.buildingId !== buildingId || !site.complete || !site.influenced) {
      continue;
    }
    total += site.workers * base;
  }
  return total;
}

/**
 * @deprecated Prefer settleProcessorTiles (valve + buffer + durée).
 * Ancien settle instantané — no-op pour ne pas double-consommer.
 */
export function settleProcessors(state: EconomyState, _now: number): EconomyState {
  return state;
}

function completedSiteCount(
  state: EconomyState,
  buildingId: PlaceableExtractorId
): number {
  const sites = state.extractorSites.filter(
    (site) => site.buildingId === buildingId && site.complete && site.influenced
  );
  if (sites.length > 0) return sites.length;
  if (buildingId === "lumber_camp") return state.hasLumberCamp ? 1 : 0;
  if (buildingId === "farm") return state.hasFarm ? 1 : 0;
  if (buildingId === "fishing_hut") return state.hasFishingHut ? 1 : 0;
  if (buildingId === "clay_mine") return state.hasClayMine ? 1 : 0;
  return state.hasQuarry ? 1 : 0;
}

function lumberCampTechBonusForState(state: EconomyState): number {
  return lumberCampTechBonusFromUnlocks(
    state.unlockedTechIds,
    completedSiteCount(state, "lumber_camp")
  );
}

function quarryMasonryBonusForState(state: EconomyState): number {
  return quarryMasonryBonusFromUnlocks(
    state.unlockedTechIds,
    completedSiteCount(state, "quarry")
  );
}

function rateFromSites(
  state: EconomyState,
  buildingId: PlaceableExtractorId
): number {
  const base = buildingRateFromCatalog(buildingId);
  if (base <= 0) return 0;
  const sites = state.extractorSites.filter(
    (site) => site.buildingId === buildingId && site.complete && site.influenced
  );
  if (sites.length === 0) {
    const { workers, active } = workersAndActiveForBuilding(buildingId, state);
    if (!active) return 0;
    let rate = Math.max(0, workers) * base;
    if (buildingId === "lumber_camp") rate += lumberCampTechBonusForState(state);
    if (buildingId === "quarry") rate += quarryMasonryBonusForState(state);
    return rate;
  }
  let total = 0;
  for (const site of sites) {
    total += site.workers * base * tileProductionMultiplier(site.biome);
  }
  if (buildingId === "lumber_camp") total += lumberCampTechBonusForState(state);
  if (buildingId === "quarry") total += quarryMasonryBonusForState(state);
  return total;
}

type ExtractorProducer = {
  resourceId: ResourceId;
  buildingId: PlaceableExtractorId;
  ratePerMinute: (state: EconomyState) => number;
  cap: number;
};

function workersAndActiveForBuilding(
  buildingId: PlaceableExtractorId,
  state: EconomyState
): { workers: number; active: boolean } {
  if (buildingId === "lumber_camp") {
    return { workers: state.woodcutters, active: state.hasLumberCamp };
  }
  if (buildingId === "farm") {
    return { workers: state.farmers, active: state.hasFarm };
  }
  if (buildingId === "fishing_hut") {
    return { workers: state.fishers, active: state.hasFishingHut };
  }
  if (buildingId === "clay_mine") {
    return { workers: state.miners, active: state.hasClayMine };
  }
  return { workers: state.quarriers, active: state.hasQuarry };
}

function buildExtractorProducers(): ExtractorProducer[] {
  const ids: PlaceableExtractorId[] = [
    "lumber_camp",
    "farm",
    "quarry",
    "fishing_hut",
    "clay_mine"
  ];
  const producers: ExtractorProducer[] = [];
  for (const buildingId of ids) {
    const output = resourceOutputForBuilding(buildingId);
    // Food : settle via settleFoodAndGrowth (HDV + pêche), pas extracteur stock brut.
    if (!output || output === "food") continue;
    producers.push({
      buildingId,
      resourceId: output,
      cap: stockCapFor(output),
      ratePerMinute: (state) => rateFromSites(state, buildingId)
    });
  }
  return producers;
}

const EXTRACTOR_PRODUCERS: ExtractorProducer[] = buildExtractorProducers();

export function emptyStock(now = Date.now()): StockEntry {
  return { amount: 0, lastCalculatedAt: now };
}

export function getStock(state: EconomyState, resourceId: ResourceId): StockEntry {
  return state.stocks[resourceId] ?? emptyStock();
}

export function getStockAmount(state: EconomyState, resourceId: ResourceId): number {
  return getStock(state, resourceId).amount;
}

export function setStock(
  state: EconomyState,
  resourceId: ResourceId,
  entry: StockEntry
): EconomyState {
  return {
    ...state,
    stocks: {
      ...state.stocks,
      [resourceId]: entry
    }
  };
}

/**
 * Ramène chaque stock au plafond content (sans toucher lastCalculatedAt).
 * Sert de soft-migration au settle : un inventaire legacy au-dessus du cap
 * est tronqué, puis persisté via settleAndPersist.
 */
export function clampStocksToCaps(state: EconomyState): EconomyState {
  let next = state;
  for (const resourceId of Object.keys(state.stocks) as ResourceId[]) {
    const entry = state.stocks[resourceId];
    if (!entry) continue;
    const cap = stockCapFor(resourceId);
    const amount = Math.max(0, Math.min(cap, entry.amount));
    if (amount === entry.amount) continue;
    next = setStock(next, resourceId, {
      amount,
      lastCalculatedAt: entry.lastCalculatedAt
    });
  }
  return next;
}

export function createInitialEconomy(now = Date.now()): EconomyState {
  return {
    population: STARTING_POPULATION,
    populationCap: POPULATION_CAP,
    woodcutters: 0,
    farmers: 0,
    quarriers: 0,
    fishers: 0,
    miners: 0,
    stocks: {
      wood: { amount: STARTING_WOOD, lastCalculatedAt: now },
      wheat: { amount: STARTING_WHEAT, lastCalculatedAt: now },
      stone: { amount: STARTING_STONE, lastCalculatedAt: now },
      food: { amount: STARTING_FOOD, lastCalculatedAt: now },
      worldshard: { amount: STARTING_WORLDSHARD, lastCalculatedAt: now }
    },
    lumberCampSites: 0,
    farmSites: 0,
    quarrySites: 0,
    fishingHutSites: 0,
    clayMineSites: 0,
    hasLumberCamp: false,
    hasFarm: false,
    hasQuarry: false,
    hasFishingHut: false,
    hasClayMine: false,
    foodSurplusAccumulated: 0,
    extractorSites: [],
    processorSites: [],
    unlockedTechIds: ["foundations"],
    pastureTileCount: 0
  };
}

export function woodProductionRatePerMinute(
  woodcutters: number,
  hasLumberCamp: boolean
): number {
  if (!hasLumberCamp) return 0;
  return Math.max(0, woodcutters) * WOOD_RATE_PER_WORKER_PER_MINUTE;
}

export function wheatProductionRatePerMinute(
  farmers: number,
  hasFarm: boolean
): number {
  if (!hasFarm) return 0;
  return Math.max(0, farmers) * WHEAT_RATE_PER_WORKER_PER_MINUTE;
}

export function stoneProductionRatePerMinute(
  quarriers: number,
  hasQuarry: boolean
): number {
  if (!hasQuarry) return 0;
  return Math.max(0, quarriers) * STONE_RATE_PER_WORKER_PER_MINUTE;
}

/** Rates effectifs (sites + bonus fusion si présents). */
export function woodRateFromState(state: EconomyState): number {
  return rateFromSites(state, "lumber_camp");
}

export function wheatRateFromState(state: EconomyState): number {
  return rateFromSites(state, "farm");
}

export function stoneRateFromState(state: EconomyState): number {
  return rateFromSites(state, "quarry");
}

export function fishingFoodRateFromState(state: EconomyState): number {
  return rateFromSites(state, "fishing_hut");
}

export function clayRateFromState(state: EconomyState): number {
  return rateFromSites(state, "clay_mine");
}

export function wheatFoodEquivalentPerMinute(state: EconomyState): number {
  const wheatRate = wheatRateFromState(state);
  if (wheatRate <= 0 || WHEAT_TO_FOOD_EMERGENCY_RATIO <= 0) return 0;
  return Math.floor(wheatRate / WHEAT_TO_FOOD_EMERGENCY_RATIO);
}

function techFoodBonusPerMinute(state: EconomyState): number {
  return (
    pastureFoodBonusPerMinute(state.unlockedTechIds, state.pastureTileCount) +
    plantationFoodBonusPerMinute(
      state.unlockedTechIds,
      completedSiteCount(state, "farm")
    )
  );
}

/** Prod food : HDV + cabanes + bonus tech pâturage / plantation + équivalent blé. */
export function foodProductionPerMinute(state: EconomyState): number {
  return (
    TOWN_HALL_FOOD_PRODUCTION_PER_MINUTE +
    fishingFoodRateFromState(state) +
    techFoodBonusPerMinute(state) +
    wheatFoodEquivalentPerMinute(state)
  );
}

export function foodConsumptionPerMinute(state: EconomyState): number {
  return Math.max(0, state.population) * FOOD_CONSUMPTION_PER_POP_PER_MINUTE;
}

/** Prod totale − conso pop (peut être négatif). */
export function foodNetRatePerMinute(state: EconomyState): number {
  return foodProductionPerMinute(state) - foodConsumptionPerMinute(state);
}

export function popGrowthProgress(state: EconomyState): {
  accumulated: number;
  required: number;
} {
  return {
    accumulated: Math.max(0, Math.floor(state.foodSurplusAccumulated)),
    required: POP_GROWTH_SURPLUS_FOOD_REQUIRED
  };
}

/** Applique une conso nette (rate ≥ 0 = unités consommées / min). */
function applyOfflineConsumption(
  stock: number,
  consumptionRatePerMinute: number,
  lastCalculatedAt: number,
  now: number
): { stock: number; lastCalculatedAt: number; shortfall: number } {
  const elapsedMinutes = Math.max(0, (now - lastCalculatedAt) / 60_000);
  const needed = elapsedMinutes * Math.max(0, consumptionRatePerMinute);
  const available = Math.max(0, stock);
  const consumed = Math.min(available, needed);
  return {
    stock: available - consumed,
    lastCalculatedAt: now,
    shortfall: needed - consumed
  };
}

/**
 * Convertit du blé en food d’urgence (ratio entier).
 * Retourne l’état mis à jour (wheat ↓, food ↑ plafonné).
 */
function convertWheatEmergency(
  state: EconomyState,
  foodNeeded: number,
  now: number
): EconomyState {
  if (foodNeeded <= 0) return state;
  const wheat = getStock(state, "wheat");
  const food = getStock(state, "food");
  const foodCap = stockCapFor("food");
  const room = Math.max(0, foodCap - food.amount);
  const maxFromNeed = Math.ceil(foodNeeded);
  const maxFood = Math.min(room, maxFromNeed);
  if (maxFood <= 0) return state;

  const wheatNeeded = maxFood * WHEAT_TO_FOOD_EMERGENCY_RATIO;
  const wheatAvailable = Math.floor(wheat.amount);
  const batches = Math.floor(wheatAvailable / WHEAT_TO_FOOD_EMERGENCY_RATIO);
  const foodGained = Math.min(maxFood, batches);
  if (foodGained <= 0) return state;

  let next = setStock(state, "wheat", {
    amount: wheat.amount - foodGained * WHEAT_TO_FOOD_EMERGENCY_RATIO,
    lastCalculatedAt: now
  });
  next = setStock(next, "food", {
    amount: food.amount + foodGained,
    lastCalculatedAt: now
  });
  return next;
}

/**
 * Hôtel de ville : +1 éclat de monde tous les `TOWN_HALL_WORLDSHARD_INTERVAL_MS`.
 * Au cap : horloge gelée (pas d’accumulation hors plafond).
 */
export function settleWorldshard(state: EconomyState, now: number): EconomyState {
  const cap = stockCapFor("worldshard");
  const current = state.stocks.worldshard ?? {
    amount: 0,
    lastCalculatedAt: now
  };
  let amount = Math.max(0, current.amount);
  let last = current.lastCalculatedAt;

  if (amount >= cap) {
    return setStock(state, "worldshard", {
      amount: Math.min(cap, amount),
      lastCalculatedAt: now
    });
  }

  if (TOWN_HALL_WORLDSHARD_INTERVAL_MS <= 0) {
    return setStock(state, "worldshard", { amount, lastCalculatedAt: now });
  }

  const elapsed = Math.max(0, now - last);
  const gained = Math.floor(elapsed / TOWN_HALL_WORLDSHARD_INTERVAL_MS);
  if (gained <= 0) {
    return setStock(state, "worldshard", { amount, lastCalculatedAt: last });
  }

  const room = Math.max(0, cap - amount);
  const applied = Math.min(room, gained);
  amount += applied;
  last += applied * TOWN_HALL_WORLDSHARD_INTERVAL_MS;
  if (amount >= cap) {
    last = now;
  }

  return setStock(state, "worldshard", {
    amount,
    lastCalculatedAt: last
  });
}

/** Minutes restantes avant le prochain éclat (null si plein). */
export function worldshardMinutesUntilNext(state: EconomyState, now = Date.now()): number | null {
  const cap = stockCapFor("worldshard");
  const current = state.stocks.worldshard;
  if (!current || current.amount >= cap) return null;
  if (TOWN_HALL_WORLDSHARD_INTERVAL_MS <= 0) return 0;
  const elapsed = Math.max(0, now - current.lastCalculatedAt);
  const remainingMs = TOWN_HALL_WORLDSHARD_INTERVAL_MS - (elapsed % TOWN_HALL_WORLDSHARD_INTERVAL_MS);
  return remainingMs / 60_000;
}

function settleFoodAndGrowth(state: EconomyState, now: number): EconomyState {
  const foodCap = stockCapFor("food");
  const current = state.stocks.food ?? { amount: 0, lastCalculatedAt: now };
  const elapsedMinutes = Math.max(0, (now - current.lastCalculatedAt) / 60_000);

  let next = state;
  let population = state.population;
  let surplus = Math.max(0, Math.floor(state.foodSurplusAccumulated));

  // Stock food : HDV + cabane de pêcheur (le blé reste du blé jusqu’à conversion).
  const fishingRate = fishingFoodRateFromState(next);
  const techFoodRate = techFoodBonusPerMinute(next);
  const foodNet =
    TOWN_HALL_FOOD_PRODUCTION_PER_MINUTE +
    fishingRate +
    techFoodRate -
    population * FOOD_CONSUMPTION_PER_POP_PER_MINUTE;
  const wheatRate = wheatRateFromState(next);
  const wheatFoodRate = wheatFoodEquivalentPerMinute(next);

  if (foodNet >= 0) {
    const settled = applyOfflineProduction(
      {
        stock: current.amount,
        productionRatePerMinute: foodNet,
        lastCalculatedAt: current.lastCalculatedAt,
        cap: foodCap
      },
      now
    );
    next = setStock(next, "food", {
      amount: settled.stock,
      lastCalculatedAt: settled.lastCalculatedAt
    });
  } else {
    const result = applyOfflineConsumption(
      current.amount,
      -foodNet,
      current.lastCalculatedAt,
      now
    );
    next = setStock(next, "food", {
      amount: result.stock,
      lastCalculatedAt: result.lastCalculatedAt
    });

    if (result.shortfall > 0) {
      next = convertWheatEmergency(next, result.shortfall, now);
    }
  }

  // Croissance : surplus food (HDV + pêche) + blé brut (5 blé ≈ 1 food).
  // On accumule même au cap (barre visible) ; le +1 pop attend une place libre.
  if (elapsedMinutes > 0) {
    let growthFood = 0;
    if (foodNet > 0) {
      growthFood += Math.floor(foodNet * elapsedMinutes);
    }

    if (wheatFoodRate > 0) {
      const wheat = getStock(next, "wheat");
      const fromRate = Math.floor(
        (wheatRate * elapsedMinutes) / WHEAT_TO_FOOD_EMERGENCY_RATIO
      );
      const fromStock = Math.floor(
        Math.max(0, wheat.amount) / WHEAT_TO_FOOD_EMERGENCY_RATIO
      );
      const fromWheat = Math.min(fromRate, fromStock);
      if (fromWheat > 0) {
        growthFood += fromWheat;
        next = setStock(next, "wheat", {
          amount: wheat.amount - fromWheat * WHEAT_TO_FOOD_EMERGENCY_RATIO,
          lastCalculatedAt: now
        });
      }
    }

    surplus += growthFood;
  }

  // Convertit le surplus déjà accumulé (ex. barre pleine au cap logements)
  // dès qu’une place se libère — sans attendre elapsedMinutes > 0.
  while (
    surplus >= POP_GROWTH_SURPLUS_FOOD_REQUIRED &&
    population < state.populationCap
  ) {
    surplus -= POP_GROWTH_SURPLUS_FOOD_REQUIRED;
    population += 1;
  }
  // Au plafond logements : on garde la barre remplie, sans stocker l’infini.
  if (population >= state.populationCap) {
    surplus = Math.min(surplus, POP_GROWTH_SURPLUS_FOOD_REQUIRED);
  }

  return {
    ...next,
    population,
    foodSurplusAccumulated: surplus
  };
}

/** DEC-006 — recalcul lazy extracteurs + food / croissance (DEC-016 / 017) + éclats. */
export function settleEconomy(state: EconomyState, now: number): EconomyState {
  // Soft-migration : stocks déjà au-dessus du cap (avant caps / grant hors plafond)
  // sont ramenés au max au premier settle après déploiement.
  let next = clampStocksToCaps(state);
  for (const producer of EXTRACTOR_PRODUCERS) {
    const current =
      next.stocks[producer.resourceId] ?? { amount: 0, lastCalculatedAt: now };
    const settled = applyOfflineProduction(
      {
        stock: current.amount,
        productionRatePerMinute: producer.ratePerMinute(next),
        lastCalculatedAt: current.lastCalculatedAt,
        cap: producer.cap
      },
      now
    );
    next = setStock(next, producer.resourceId, {
      amount: settled.stock,
      lastCalculatedAt: settled.lastCalculatedAt
    });
  }
  next = settleWorldshard(next, now);
  next = settleProcessors(next, now);
  return settleFoodAndGrowth(next, now);
}

export type AssignWorkersResult =
  | { ok: true; state: EconomyState }
  | {
      ok: false;
      reason:
        | "invalid_count"
        | "over_population"
        | "unsupported_job"
        | "no_building";
    };

function siteCountForJob(job: ExtractorJob, state: EconomyState): number {
  if (job === "woodcutter") return state.lumberCampSites;
  if (job === "farmer") return state.farmSites;
  if (job === "fisher") return state.fishingHutSites;
  if (job === "miner") return state.clayMineSites;
  return state.quarrySites;
}

function currentWorkersForJob(state: EconomyState, job: ExtractorJob): number {
  if (job === "woodcutter") return state.woodcutters;
  if (job === "farmer") return state.farmers;
  if (job === "fisher") return state.fishers;
  if (job === "miner") return state.miners;
  return state.quarriers;
}

/** Plafond d’assignation : population du village, partagée entre métiers. */
export function maxAssignableWorkersForJob(
  job: ExtractorJob,
  state: EconomyState
): number {
  if (siteCountForJob(job, state) === 0) return 0;
  const current = currentWorkersForJob(state, job);
  const others = assignedWorkers(state) - current;
  return Math.max(0, state.population - others);
}

function jobConfig(job: ExtractorJob, state: EconomyState) {
  const sites = siteCountForJob(job, state);
  const key =
    job === "woodcutter"
      ? "woodcutters"
      : job === "farmer"
        ? "farmers"
        : job === "fisher"
          ? "fishers"
          : job === "miner"
            ? "miners"
            : "quarriers";
  return {
    hasBuilding: sites > 0,
    maxWorkers: maxAssignableWorkersForJob(job, state),
    current: currentWorkersForJob(state, job),
    key: key as "woodcutters" | "farmers" | "quarriers" | "fishers" | "miners"
  };
}

export function assignedWorkers(state: EconomyState): number {
  return (
    state.woodcutters +
    state.farmers +
    state.quarriers +
    state.fishers +
    state.miners
  );
}

export function idleWorkers(state: EconomyState): number {
  return Math.max(0, state.population - assignedWorkers(state));
}

export function extractorJobForBuilding(
  buildingId: PlaceableExtractorId
): ExtractorJob {
  const definition = getBuildingDefinition(buildingId);
  if (
    definition?.workerJob === "woodcutter" ||
    definition?.workerJob === "farmer" ||
    definition?.workerJob === "quarrier" ||
    definition?.workerJob === "fisher" ||
    definition?.workerJob === "miner"
  ) {
    return definition.workerJob;
  }
  const output = resourceOutputForBuilding(buildingId);
  if (output === "wood") return "woodcutter";
  if (output === "wheat") return "farmer";
  if (output === "food") return "fisher";
  if (output === "clay") return "miner";
  return "quarrier";
}

/**
 * Assignation absolue pour un métier extracteur.
 * Settle d’abord pour ne pas perdre la prod avant le changement de rate.
 */
export function assignExtractorWorkers(
  state: EconomyState,
  job: ExtractorJob,
  count: number,
  now = Date.now()
): AssignWorkersResult {
  const config = jobConfig(job, state);
  if (!config.hasBuilding) {
    return { ok: false, reason: "no_building" };
  }
  if (!Number.isInteger(count) || count < 0) {
    return { ok: false, reason: "invalid_count" };
  }
  if (count > config.maxWorkers) {
    return { ok: false, reason: "over_population" };
  }

  const others = assignedWorkers(state) - config.current;
  if (others + count > state.population) {
    return { ok: false, reason: "over_population" };
  }

  const settled = settleEconomy(state, now);
  return {
    ok: true,
    state: {
      ...settled,
      [config.key]: count
    }
  };
}

/** @deprecated Prefer assignExtractorWorkers */
export function assignWoodcutters(
  state: EconomyState,
  count: number,
  now = Date.now()
): AssignWorkersResult {
  return assignExtractorWorkers(state, "woodcutter", count, now);
}

export type SpendResourceResult =
  | { ok: true; state: EconomyState }
  | { ok: false; reason: "insufficient_resources" };

/** Settle puis débit d’une ressource (craft, expansion, constructions, …). */
export function spendResource(
  state: EconomyState,
  resourceId: ResourceId,
  amount: number,
  now = Date.now()
): SpendResourceResult {
  const settled = settleEconomy(state, now);
  if (amount < 0 || !Number.isFinite(amount)) {
    return { ok: false, reason: "insufficient_resources" };
  }
  const current = getStockAmount(settled, resourceId);
  if (current + 1e-9 < amount) {
    return { ok: false, reason: "insufficient_resources" };
  }
  return {
    ok: true,
    state: setStock(settled, resourceId, {
      amount: Math.max(0, current - amount),
      lastCalculatedAt: now
    })
  };
}

/** @deprecated Prefer spendResource('wood', …) */
export type SpendWoodResult = SpendResourceResult;

export function spendWood(
  state: EconomyState,
  amount: number,
  now = Date.now()
): SpendWoodResult {
  return spendResource(state, "wood", amount, now);
}

/** Crédite une ressource (plafonnée) après settle. */
export function grantResource(
  state: EconomyState,
  resourceId: ResourceId,
  amount: number,
  now = Date.now(),
  cap = stockCapFor(resourceId)
): EconomyState {
  const settled = settleEconomy(state, now);
  const current = getStock(settled, resourceId);
  return setStock(settled, resourceId, {
    amount: Math.min(cap, current.amount + amount),
    lastCalculatedAt: now
  });
}

export {
  LUMBER_CAMP_MAX_WORKERS,
  FARM_MAX_WORKERS,
  QUARRY_MAX_WORKERS,
  FISHING_HUT_MAX_WORKERS,
  WOOD_STOCK_CAP,
  WHEAT_STOCK_CAP,
  STONE_STOCK_CAP,
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  WHEAT_RATE_PER_WORKER_PER_MINUTE,
  STONE_RATE_PER_WORKER_PER_MINUTE,
  FISHING_HUT_FOOD_RATE_PER_WORKER_PER_MINUTE,
  FOOD_CONSUMPTION_PER_POP_PER_MINUTE,
  TOWN_HALL_FOOD_PRODUCTION_PER_MINUTE,
  POP_GROWTH_SURPLUS_FOOD_REQUIRED,
  FUSION_TILE_PRODUCTION_BONUS,
  WHEAT_TO_FOOD_EMERGENCY_RATIO,
  WORLDSHARD_STOCK_CAP,
  TOWN_HALL_WORLDSHARD_INTERVAL_MS,
  stockCapFor
};
