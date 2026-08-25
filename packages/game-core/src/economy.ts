import {
  LUMBER_CAMP_MAX_WORKERS,
  POPULATION_CAP,
  STARTING_POPULATION,
  STARTING_WOOD,
  WOOD_RATE_PER_WORKER_PER_HOUR,
  WOOD_STOCK_CAP
} from "@hexald/content";
import { applyOfflineProduction } from "./production.ts";

export type EconomyState = {
  population: number;
  populationCap: number;
  woodcutters: number;
  wood: number;
  woodLastCalculatedAt: number;
  /** Au moins un camp posé sur la carte. */
  hasLumberCamp: boolean;
};

export function createInitialEconomy(now = Date.now()): EconomyState {
  return {
    population: STARTING_POPULATION,
    populationCap: POPULATION_CAP,
    woodcutters: 0,
    wood: STARTING_WOOD,
    woodLastCalculatedAt: now,
    hasLumberCamp: false
  };
}

export function woodProductionRatePerHour(
  woodcutters: number,
  hasLumberCamp: boolean
): number {
  if (!hasLumberCamp) return 0;
  return Math.max(0, woodcutters) * WOOD_RATE_PER_WORKER_PER_HOUR;
}

/** DEC-006 — recalcul lazy du stock bois. */
export function settleEconomy(state: EconomyState, now: number): EconomyState {
  const settled = applyOfflineProduction(
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

  return {
    ...state,
    wood: settled.stock,
    woodLastCalculatedAt: settled.lastCalculatedAt
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
        | "no_lumber_camp";
    };

/**
 * Assignation absolue pour le métier woodcutter (v0).
 * Settle d’abord pour ne pas perdre la prod avant le changement de rate.
 */
export function assignWoodcutters(
  state: EconomyState,
  count: number,
  now = Date.now()
): AssignWorkersResult {
  if (!state.hasLumberCamp) {
    return { ok: false, reason: "no_lumber_camp" };
  }
  if (!Number.isInteger(count) || count < 0) {
    return { ok: false, reason: "invalid_count" };
  }
  if (count > LUMBER_CAMP_MAX_WORKERS) {
    return { ok: false, reason: "over_building_cap" };
  }
  if (count > state.population) {
    return { ok: false, reason: "over_population" };
  }

  const settled = settleEconomy(state, now);
  return {
    ok: true,
    state: {
      ...settled,
      woodcutters: count
    }
  };
}

export function idleWorkers(state: EconomyState): number {
  return Math.max(0, state.population - state.woodcutters);
}

export {
  LUMBER_CAMP_MAX_WORKERS,
  WOOD_STOCK_CAP,
  WOOD_RATE_PER_WORKER_PER_HOUR
};
