import {
  FARM_MAX_WORKERS,
  LUMBER_CAMP_MAX_WORKERS,
  POPULATION_CAP,
  QUARRY_MAX_WORKERS,
  STARTING_POPULATION,
  STARTING_STONE,
  STARTING_WHEAT,
  STARTING_WOOD,
  STONE_RATE_PER_WORKER_PER_HOUR,
  STONE_STOCK_CAP,
  WHEAT_RATE_PER_WORKER_PER_HOUR,
  WHEAT_STOCK_CAP,
  WOOD_RATE_PER_WORKER_PER_HOUR,
  WOOD_STOCK_CAP
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
    hasLumberCamp: false,
    hasFarm: false,
    hasQuarry: false
  };
}

export function woodProductionRatePerHour(
  woodcutters: number,
  hasLumberCamp: boolean
): number {
  if (!hasLumberCamp) return 0;
  return Math.max(0, woodcutters) * WOOD_RATE_PER_WORKER_PER_HOUR;
}

export function wheatProductionRatePerHour(
  farmers: number,
  hasFarm: boolean
): number {
  if (!hasFarm) return 0;
  return Math.max(0, farmers) * WHEAT_RATE_PER_WORKER_PER_HOUR;
}

export function stoneProductionRatePerHour(
  quarriers: number,
  hasQuarry: boolean
): number {
  if (!hasQuarry) return 0;
  return Math.max(0, quarriers) * STONE_RATE_PER_WORKER_PER_HOUR;
}

/** DEC-006 — recalcul lazy de tous les stocks extracteurs. */
export function settleEconomy(state: EconomyState, now: number): EconomyState {
  const wood = applyOfflineProduction(
    {
      stock: state.wood,
      productionRatePerHour: woodProductionRatePerHour(
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
      productionRatePerHour: wheatProductionRatePerHour(
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
      productionRatePerHour: stoneProductionRatePerHour(
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
        | "over_building_cap"
        | "unsupported_job"
        | "no_building";
    };

function jobConfig(job: ExtractorJob, state: EconomyState) {
  if (job === "woodcutter") {
    return {
      hasBuilding: state.hasLumberCamp,
      maxWorkers: LUMBER_CAMP_MAX_WORKERS,
      current: state.woodcutters,
      key: "woodcutters" as const
    };
  }
  if (job === "farmer") {
    return {
      hasBuilding: state.hasFarm,
      maxWorkers: FARM_MAX_WORKERS,
      current: state.farmers,
      key: "farmers" as const
    };
  }
  return {
    hasBuilding: state.hasQuarry,
    maxWorkers: QUARRY_MAX_WORKERS,
    current: state.quarriers,
    key: "quarriers" as const
  };
}

export function assignedWorkers(state: EconomyState): number {
  return state.woodcutters + state.farmers + state.quarriers;
}

export function idleWorkers(state: EconomyState): number {
  return Math.max(0, state.population - assignedWorkers(state));
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
    return { ok: false, reason: "over_building_cap" };
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

export {
  LUMBER_CAMP_MAX_WORKERS,
  FARM_MAX_WORKERS,
  QUARRY_MAX_WORKERS,
  WOOD_STOCK_CAP,
  WHEAT_STOCK_CAP,
  STONE_STOCK_CAP,
  WOOD_RATE_PER_WORKER_PER_HOUR,
  WHEAT_RATE_PER_WORKER_PER_HOUR,
  STONE_RATE_PER_WORKER_PER_HOUR
};
