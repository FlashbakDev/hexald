import {
  FARM_MAX_WORKERS,
  LUMBER_CAMP_MAX_WORKERS,
  POPULATION_CAP,
  QUARRY_MAX_WORKERS,
  STARTING_POPULATION,
  STARTING_STONE,
  STARTING_WHEAT,
  STARTING_WOOD,
  STONE_RATE_PER_WORKER_PER_MINUTE,
  STONE_STOCK_CAP,
  WHEAT_RATE_PER_WORKER_PER_MINUTE,
  WHEAT_STOCK_CAP,
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  WOOD_STOCK_CAP,
  type PlaceableExtractorId
} from "@hexald/content";
import type { ExtractorJob } from "@hexald/shared";
import { applyOfflineProduction } from "./production.ts";

export type EconomyState = {
  population: number;
  populationCap: number;
  woodcutters: number;
  farmers: number;
  quarriers: number;
  wood: number;
  woodLastCalculatedAt: number;
  wheat: number;
  wheatLastCalculatedAt: number;
  stone: number;
  stoneLastCalculatedAt: number;
  /** Sites posés (y compris en chantier). */
  lumberCampSites: number;
  farmSites: number;
  quarrySites: number;
  /** Au moins un site achevé — requis pour produire. */
  hasLumberCamp: boolean;
  hasFarm: boolean;
  hasQuarry: boolean;
};

export function createInitialEconomy(now = Date.now()): EconomyState {
  return {
    population: STARTING_POPULATION,
    populationCap: POPULATION_CAP,
    woodcutters: 0,
    farmers: 0,
    quarriers: 0,
    wood: STARTING_WOOD,
    woodLastCalculatedAt: now,
    wheat: STARTING_WHEAT,
    wheatLastCalculatedAt: now,
    stone: STARTING_STONE,
    stoneLastCalculatedAt: now,
    lumberCampSites: 0,
    farmSites: 0,
    quarrySites: 0,
    hasLumberCamp: false,
    hasFarm: false,
    hasQuarry: false
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

/** DEC-006 — recalcul lazy de tous les stocks extracteurs. */
export function settleEconomy(state: EconomyState, now: number): EconomyState {
  const wood = applyOfflineProduction(
    {
      stock: state.wood,
      productionRatePerMinute: woodProductionRatePerMinute(
        state.woodcutters,
        state.hasLumberCamp
      ),
      lastCalculatedAt: state.woodLastCalculatedAt,
      cap: WOOD_STOCK_CAP
    },
    now
  );
  const wheat = applyOfflineProduction(
    {
      stock: state.wheat,
      productionRatePerMinute: wheatProductionRatePerMinute(
        state.farmers,
        state.hasFarm
      ),
      lastCalculatedAt: state.wheatLastCalculatedAt,
      cap: WHEAT_STOCK_CAP
    },
    now
  );
  const stone = applyOfflineProduction(
    {
      stock: state.stone,
      productionRatePerMinute: stoneProductionRatePerMinute(
        state.quarriers,
        state.hasQuarry
      ),
      lastCalculatedAt: state.stoneLastCalculatedAt,
      cap: STONE_STOCK_CAP
    },
    now
  );

  return {
    ...state,
    wood: wood.stock,
    woodLastCalculatedAt: wood.lastCalculatedAt,
    wheat: wheat.stock,
    wheatLastCalculatedAt: wheat.lastCalculatedAt,
    stone: stone.stock,
    stoneLastCalculatedAt: stone.lastCalculatedAt
  };
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
  return state.quarrySites;
}

function currentWorkersForJob(state: EconomyState, job: ExtractorJob): number {
  if (job === "woodcutter") return state.woodcutters;
  if (job === "farmer") return state.farmers;
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
    job === "woodcutter" ? "woodcutters" : job === "farmer" ? "farmers" : "quarriers";
  return {
    hasBuilding: sites > 0,
    maxWorkers: maxAssignableWorkersForJob(job, state),
    current: currentWorkersForJob(state, job),
    key: key as "woodcutters" | "farmers" | "quarriers"
  };
}

export function assignedWorkers(state: EconomyState): number {
  return state.woodcutters + state.farmers + state.quarriers;
}

export function idleWorkers(state: EconomyState): number {
  return Math.max(0, state.population - assignedWorkers(state));
}

export function extractorJobForBuilding(
  buildingId: PlaceableExtractorId
): ExtractorJob {
  if (buildingId === "lumber_camp") return "woodcutter";
  if (buildingId === "farm") return "farmer";
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

export type SpendWoodResult =
  | { ok: true; state: EconomyState }
  | { ok: false; reason: "insufficient_resources" };

/** Settle puis débit bois (expansion, constructions, …). */
export function spendWood(
  state: EconomyState,
  amount: number,
  now = Date.now()
): SpendWoodResult {
  const settled = settleEconomy(state, now);
  if (amount < 0 || !Number.isFinite(amount)) {
    return { ok: false, reason: "insufficient_resources" };
  }
  if (settled.wood + 1e-9 < amount) {
    return { ok: false, reason: "insufficient_resources" };
  }
  return {
    ok: true,
    state: {
      ...settled,
      wood: Math.max(0, settled.wood - amount)
    }
  };
}


export {
  LUMBER_CAMP_MAX_WORKERS,
  FARM_MAX_WORKERS,
  QUARRY_MAX_WORKERS,
  WOOD_STOCK_CAP,
  WHEAT_STOCK_CAP,
  STONE_STOCK_CAP,
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  WHEAT_RATE_PER_WORKER_PER_MINUTE,
  STONE_RATE_PER_WORKER_PER_MINUTE
};
