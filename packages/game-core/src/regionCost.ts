import type { BuildingId, HexCoord } from "@hexald/shared";
import { cubeDistance } from "@hexald/shared";
import { isBuildingComplete } from "./construction.ts";
import { REGION_STEP, START_REGION_CENTER } from "./world.ts";

export type RegionExpansionCost = {
  /** Distance en « hops » de régions depuis le centre (0,0). */
  hop: number;
  /** Éclats de monde à payer (= hop au MVP). */
  worldshards: number;
};

export type DevelopmentSite = {
  q: number;
  r: number;
};

/**
 * Sites qui comptent pour la remise « civilisation » (future).
 * Village de départ (0,0) + bâtiments achevé sur la carte.
 */
export function listDevelopmentSites(
  tiles: readonly {
    q: number;
    r: number;
    buildingId?: BuildingId | null;
    constructionCompletesAt?: number | string | Date | null;
  }[],
  now: number,
  origin: HexCoord = START_REGION_CENTER
): DevelopmentSite[] {
  const sites: DevelopmentSite[] = [{ q: origin.q, r: origin.r }];

  for (const tile of tiles) {
    if (tile.q === origin.q && tile.r === origin.r) continue;
    if (!tile.buildingId) continue;
    if (!isBuildingComplete(tile.constructionCompletesAt, now)) continue;
    sites.push({ q: tile.q, r: tile.r });
  }

  return sites;
}

export function regionHopFromOrigin(
  center: HexCoord,
  origin: HexCoord = START_REGION_CENTER
): number {
  const distance = cubeDistance(center, origin);
  const hop = distance / REGION_STEP;
  if (!Number.isFinite(hop) || hop <= 0) return 1;
  return Math.max(1, Math.round(hop));
}

/** Coût d’expansion : 1 éclat pour hop 1, 2 pour hop 2, etc. */
export function computeRegionExpansionCost(input: {
  center: HexCoord;
  tiles?: readonly {
    q: number;
    r: number;
    buildingId?: BuildingId | null;
    constructionCompletesAt?: number | string | Date | null;
  }[];
  now?: number;
  origin?: HexCoord;
}): RegionExpansionCost {
  const origin = input.origin ?? START_REGION_CENTER;
  const hop = regionHopFromOrigin(input.center, origin);
  return {
    hop,
    worldshards: hop
  };
}
