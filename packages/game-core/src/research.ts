import type { TechId, WorldResearchSnapshot } from "@hexald/shared";
import {
  DEV_RESEARCH_DURATION_MS,
  getTechNode,
  isResearchableTechId,
  isTechId,
  LIBRARY_SCIENCE_PER_WORKER_PER_MINUTE,
  techScienceCost,
  TOWN_HALL_SCIENCE_INTERVAL_MS
} from "@hexald/content";

export type ResearchState = {
  researchTargetTechId: TechId | null;
  unlockedTechIds: TechId[];
  progress: Partial<Record<TechId, number>>;
  scienceLastSettledAt: number;
};

export type ResearchSettleOptions = {
  /** Mode debug : la tech cible se termine en DEV_RESEARCH_DURATION_MS. */
  accelerate?: boolean;
  /** Ouvriers actifs en bibliothèque (achevé + influencé). */
  libraryWorkers?: number;
};

export type SetResearchTargetResult =
  | { ok: true; state: ResearchState }
  | {
      ok: false;
      reason:
        | "unknown_tech"
        | "not_researchable"
        | "already_unlocked"
        | "prerequisites_not_met";
    };

export function createInitialResearchState(now = Date.now()): ResearchState {
  return {
    researchTargetTechId: null,
    unlockedTechIds: ["foundations"],
    progress: {},
    scienceLastSettledAt: now
  };
}

/** Prod HDV de base (sans bibliothèque). */
export function townHallScienceProductionPerMinute(): number {
  if (TOWN_HALL_SCIENCE_INTERVAL_MS <= 0) return 0;
  return 60_000 / TOWN_HALL_SCIENCE_INTERVAL_MS;
}

/** Prod science totale : HDV + ouvriers bibliothèque. */
export function scienceProductionPerMinute(libraryWorkers = 0): number {
  const workers = Math.max(0, Math.floor(libraryWorkers));
  return (
    townHallScienceProductionPerMinute() +
    workers * LIBRARY_SCIENCE_PER_WORKER_PER_MINUTE
  );
}

/** ms pour gagner 1 point de science au rythme courant. */
export function scienceTickIntervalMs(libraryWorkers = 0): number {
  const rate = scienceProductionPerMinute(libraryWorkers);
  if (rate <= 0) return Number.POSITIVE_INFINITY;
  return 60_000 / rate;
}

function hasUnlocked(state: ResearchState, techId: TechId): boolean {
  return state.unlockedTechIds.includes(techId);
}

function prerequisitesMet(state: ResearchState, techId: TechId): boolean {
  const node = getTechNode(techId);
  return node.prerequisites.every((id) => hasUnlocked(state, id));
}

export function isTechAvailable(state: ResearchState, techId: TechId): boolean {
  if (!isResearchableTechId(techId)) return false;
  if (hasUnlocked(state, techId)) return false;
  return prerequisitesMet(state, techId);
}

export function techProgressFor(state: ResearchState, techId: TechId): number {
  return Math.max(0, Math.floor(state.progress[techId] ?? 0));
}

function unlockTarget(
  state: ResearchState,
  target: TechId,
  now: number,
  cost: number
): ResearchState {
  const unlocked = hasUnlocked(state, target)
    ? state.unlockedTechIds
    : [...state.unlockedTechIds, target];
  return {
    ...state,
    unlockedTechIds: unlocked,
    progress: { ...state.progress, [target]: cost },
    researchTargetTechId: null,
    scienceLastSettledAt: now
  };
}

/**
 * Settle lazy : prod HDV (+ bibliothèques) → barre cible, ou perdue si pause.
 * Un unlock max par appel (offline inclus).
 * `accelerate` : progression linéaire sur DEV_RESEARCH_DURATION_MS (debug).
 */
export function settleResearch(
  state: ResearchState,
  now: number,
  options: ResearchSettleOptions = {}
): ResearchState {
  const target = state.researchTargetTechId;

  if (!target) {
    return { ...state, scienceLastSettledAt: now };
  }

  const cost = techScienceCost(target);
  const current = techProgressFor(state, target);
  if (
    current >= cost ||
    !isTechAvailable({ ...state, unlockedTechIds: state.unlockedTechIds }, target)
  ) {
    return { ...state, researchTargetTechId: null, scienceLastSettledAt: now };
  }

  if (options.accelerate) {
    const started = state.scienceLastSettledAt;
    const elapsed = Math.max(0, now - started);
    if (DEV_RESEARCH_DURATION_MS <= 0 || elapsed >= DEV_RESEARCH_DURATION_MS) {
      return unlockTarget(state, target, now, cost);
    }
    const progress =
      cost <= 0
        ? 0
        : Math.min(cost, Math.floor((cost * elapsed) / DEV_RESEARCH_DURATION_MS));
    return {
      ...state,
      progress: { ...state.progress, [target]: progress },
      // Conserve l’ancre de début pour la projection 0→100 % sur 5 s.
      scienceLastSettledAt: started
    };
  }

  const intervalMs = scienceTickIntervalMs(options.libraryWorkers ?? 0);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return state;
  }

  let last = state.scienceLastSettledAt;
  const elapsed = Math.max(0, now - last);
  const gained = Math.floor(elapsed / intervalMs);
  if (gained <= 0) {
    return state;
  }

  const progress = current + gained;
  last += gained * intervalMs;

  if (progress >= cost) {
    return unlockTarget(state, target, now, cost);
  }

  return {
    ...state,
    progress: { ...state.progress, [target]: progress },
    scienceLastSettledAt: last
  };
}

export function setResearchTarget(
  state: ResearchState,
  techId: TechId,
  now: number
): SetResearchTargetResult {
  if (!isTechId(techId)) {
    return { ok: false, reason: "unknown_tech" };
  }
  if (!isResearchableTechId(techId)) {
    return { ok: false, reason: "not_researchable" };
  }
  if (hasUnlocked(state, techId)) {
    return { ok: false, reason: "already_unlocked" };
  }
  if (!prerequisitesMet(state, techId)) {
    return { ok: false, reason: "prerequisites_not_met" };
  }

  return {
    ok: true,
    state: {
      ...state,
      researchTargetTechId: techId,
      scienceLastSettledAt: now
    }
  };
}

export function researchStateChanged(before: ResearchState, after: ResearchState): boolean {
  if (before.researchTargetTechId !== after.researchTargetTechId) return true;
  if (before.scienceLastSettledAt !== after.scienceLastSettledAt) return true;
  if (before.unlockedTechIds.length !== after.unlockedTechIds.length) return true;
  const unlockedBefore = [...before.unlockedTechIds].sort().join(",");
  const unlockedAfter = [...after.unlockedTechIds].sort().join(",");
  if (unlockedBefore !== unlockedAfter) return true;

  const progressIds = new Set([
    ...Object.keys(before.progress),
    ...Object.keys(after.progress)
  ] as TechId[]);

  for (const id of progressIds) {
    if (techProgressFor(before, id) !== techProgressFor(after, id)) {
      return true;
    }
  }
  return false;
}

function techProgressFromSnapshot(
  research: WorldResearchSnapshot,
  techId: TechId
): number {
  const entry = research.techProgress.find((row) => row.techId === techId);
  return Math.max(0, Math.floor(entry?.progress ?? 0));
}

/** Projection client entre syncs serveur (unlock tranché côté API). */
export function projectResearchSnapshot(
  research: WorldResearchSnapshot,
  now: number,
  options: ResearchSettleOptions = {}
): WorldResearchSnapshot {
  const target = research.researchTargetTechId;
  if (!target) return research;

  const last = Date.parse(research.scienceLastSettledAt);
  if (Number.isNaN(last)) return research;

  const cost = techScienceCost(target);
  const current = techProgressFromSnapshot(research, target);
  if (current >= cost) return research;

  let progress = current;

  if (options.accelerate) {
    if (DEV_RESEARCH_DURATION_MS <= 0) {
      progress = cost;
    } else {
      const elapsed = Math.max(0, now - last);
      progress =
        cost <= 0
          ? 0
          : Math.min(cost, Math.floor((cost * elapsed) / DEV_RESEARCH_DURATION_MS));
    }
  } else {
    const rate =
      options.libraryWorkers != null
        ? scienceProductionPerMinute(options.libraryWorkers)
        : research.scienceProductionPerMinute;
    if (rate <= 0) return research;
    const intervalMs = 60_000 / rate;
    const elapsed = Math.max(0, now - last);
    const gained = Math.floor(elapsed / intervalMs);
    if (gained <= 0) return research;
    progress = Math.min(cost, current + gained);
  }

  if (progress === current) return research;

  const techProgress = research.techProgress.map((row) =>
    row.techId === target ? { ...row, progress } : row
  );
  if (!techProgress.some((row) => row.techId === target)) {
    techProgress.push({ techId: target, progress, scienceCost: cost });
  }

  return { ...research, techProgress };
}
