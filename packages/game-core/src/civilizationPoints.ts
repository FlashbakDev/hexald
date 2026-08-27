/**
 * Score dérivé PC (DEC-027).
 * PC = Science + Production + Population + Militaire.
 */

import {
  CIVILIZATION_POINTS_POP_MULTIPLIER,
  civilizationPointsForBuilding,
  techScienceCost,
  type CivilizationPointCategory
} from "@hexald/content";
import type { BuildingId, HexCoord, TechId } from "@hexald/shared";
import { isBuildingComplete } from "./construction.ts";
import {
  computeInfluencedTiles,
  isBuildingOrphan,
  type InfluenceTileInput
} from "./influence.ts";
import { START_REGION_CENTER } from "./world.ts";

export type CivilizationPointsTileInput = InfluenceTileInput & {
  assignedWorkers?: number;
};

export type CivilizationPointsInput = {
  population: number;
  unlockedTechIds: readonly TechId[];
  tiles: readonly CivilizationPointsTileInput[];
  now?: number;
  origin?: HexCoord;
};

export type CivilizationPointsBreakdown = {
  science: number;
  production: number;
  population: number;
  military: number;
  total: number;
};

function emptyBreakdown(): CivilizationPointsBreakdown {
  return {
    science: 0,
    production: 0,
    population: 0,
    military: 0,
    total: 0
  };
}

function addCategory(
  breakdown: CivilizationPointsBreakdown,
  category: CivilizationPointCategory,
  points: number
) {
  if (points <= 0) return;
  breakdown[category] += points;
}

/**
 * Recalcule le PC à partir de l’état monde (pas une ressource).
 */
export function computeCivilizationPoints(
  input: CivilizationPointsInput
): CivilizationPointsBreakdown {
  const now = input.now ?? Date.now();
  const origin = input.origin ?? START_REGION_CENTER;
  const result = emptyBreakdown();

  const pop = Math.max(0, Math.floor(input.population));
  addCategory(
    result,
    "population",
    pop * CIVILIZATION_POINTS_POP_MULTIPLIER
  );

  for (const techId of input.unlockedTechIds) {
    try {
      addCategory(result, "science", techScienceCost(techId));
    } catch {
      // tech inconnue / legacy — ignore
    }
  }

  const influenced = computeInfluencedTiles(input.tiles, now, origin);

  for (const tile of input.tiles) {
    const buildingId = tile.buildingId as BuildingId | null | undefined;
    if (!buildingId) continue;
    if (!isBuildingComplete(tile.constructionCompletesAt, now)) continue;
    if (isBuildingOrphan(tile, influenced, now)) continue;
    if ((tile.assignedWorkers ?? 0) < 1) continue;

    const entry = civilizationPointsForBuilding(buildingId);
    if (!entry) continue;
    addCategory(result, entry.category, entry.points);
  }

  result.total =
    result.science + result.production + result.population + result.military;
  return result;
}
