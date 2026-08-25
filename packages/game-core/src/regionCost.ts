import {
  REGION_EXPANSION_BASE_WOOD,
  REGION_EXPANSION_DISCOUNT_CAP,
  REGION_EXPANSION_DISCOUNT_D1,
  REGION_EXPANSION_DISCOUNT_D2,
  REGION_EXPANSION_DISTANCE_EXPONENT
} from "@hexald/content";
import type { BuildingId, HexCoord } from "@hexald/shared";
import { cubeDistance } from "@hexald/shared";
import { isBuildingComplete } from "./construction.ts";
import { REGION_STEP, START_REGION_CENTER } from "./world.ts";

export type RegionExpansionCost = {
  /** Distance en « hops » de régions depuis le centre (0,0). */
  hop: number;
  /** Coût avant remise. */
  baseWood: number;
  buildingsAtDistance1: number;
  buildingsAtDistance2: number;
  /** Remise appliquée (0…cap). */
  discount: number;
  /** Bois à payer. */
  wood: number;
};

export type DevelopmentSite = {
  q: number;
  r: number;
};

/**
 * Sites qui comptent pour la remise « civilisation ».
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

export function computeRegionExpansionCost(input: {
  center: HexCoord;
  tiles: readonly {
    q: number;
    r: number;
    buildingId?: BuildingId | null;
    constructionCompletesAt?: number | string | Date | null;
  }[];
  now?: number;
  origin?: HexCoord;
}): RegionExpansionCost {
  const now = input.now ?? Date.now();
  const origin = input.origin ?? START_REGION_CENTER;
  const hop = regionHopFromOrigin(input.center, origin);
  const baseWood = Math.floor(
    REGION_EXPANSION_BASE_WOOD *
      Math.pow(hop, REGION_EXPANSION_DISTANCE_EXPONENT)
  );

  let buildingsAtDistance1 = 0;
  let buildingsAtDistance2 = 0;
  for (const site of listDevelopmentSites(input.tiles, now, origin)) {
    const d = cubeDistance(site, input.center);
    if (d === 1) buildingsAtDistance1 += 1;
    else if (d === 2) buildingsAtDistance2 += 1;
  }

  const rawDiscount =
    buildingsAtDistance1 * REGION_EXPANSION_DISCOUNT_D1 +
    buildingsAtDistance2 * REGION_EXPANSION_DISCOUNT_D2;
  const discount = Math.min(REGION_EXPANSION_DISCOUNT_CAP, Math.max(0, rawDiscount));
  const wood = Math.max(0, Math.floor(baseWood * (1 - discount)));

  return {
    hop,
    baseWood,
    buildingsAtDistance1,
    buildingsAtDistance2,
    discount,
    wood
  };
}
