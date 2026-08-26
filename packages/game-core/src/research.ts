import type { TechId, WorldResearchSnapshot } from "@hexald/shared";
import {
  getTechNode,
  isResearchableTechId,
  isTechId,
  techScienceCost,
  TOWN_HALL_SCIENCE_INTERVAL_MS
} from "@hexald/content";

export type ResearchState = {
  researchTargetTechId: TechId | null;
  unlockedTechIds: TechId[];
  progress: Partial<Record<TechId, number>>;
  scienceLastSettledAt: number;
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

/** Prod HDV au MVP : entiers / intervalle → fraction / minute. */
export function scienceProductionPerMinute(): number {
  if (TOWN_HALL_SCIENCE_INTERVAL_MS <= 0) return 0;
  return 60_000 / TOWN_HALL_SCIENCE_INTERVAL_MS;
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

/**
 * Settle lazy : prod HDV → barre cible, ou perdue si pause.
 * Un unlock max par appel (offline inclus).
 */
export function settleResearch(state: ResearchState, now: number): ResearchState {
  const target = state.researchTargetTechId;

  if (!target) {
    return { ...state, scienceLastSettledAt: now };
  }

  const cost = techScienceCost(target);
  const current = techProgressFor(state, target);
  if (current >= cost || !isTechAvailable({ ...state, unlockedTechIds: state.unlockedTechIds }, target)) {
    return { ...state, researchTargetTechId: null, scienceLastSettledAt: now };
  }

  if (TOWN_HALL_SCIENCE_INTERVAL_MS <= 0) {
    return state;
  }

  let last = state.scienceLastSettledAt;
  const elapsed = Math.max(0, now - last);
  const gained = Math.floor(elapsed / TOWN_HALL_SCIENCE_INTERVAL_MS);
  if (gained <= 0) {
    return state;
  }

  let progress = current + gained;
  last += gained * TOWN_HALL_SCIENCE_INTERVAL_MS;

  if (progress >= cost) {
    const unlocked =
      hasUnlocked(state, target) ? state.unlockedTechIds : [...state.unlockedTechIds, target];
    return {
      ...state,
      unlockedTechIds: unlocked,
      progress: { ...state.progress, [target]: cost },
      researchTargetTechId: null,
      scienceLastSettledAt: now
    };
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
  now: number
): WorldResearchSnapshot {
  const target = research.researchTargetTechId;
  if (!target) return research;

  const last = Date.parse(research.scienceLastSettledAt);
  if (Number.isNaN(last)) return research;

  const cost = techScienceCost(target);
  const current = techProgressFromSnapshot(research, target);
  if (current >= cost || TOWN_HALL_SCIENCE_INTERVAL_MS <= 0) return research;

  const elapsed = Math.max(0, now - last);
  const gained = Math.floor(elapsed / TOWN_HALL_SCIENCE_INTERVAL_MS);
  if (gained <= 0) return research;

  const progress = Math.min(cost, current + gained);
  const techProgress = research.techProgress.map((row) =>
    row.techId === target ? { ...row, progress } : row
  );
  if (!techProgress.some((row) => row.techId === target)) {
    techProgress.push({ techId: target, progress, scienceCost: cost });
  }

  return { ...research, techProgress };
}
