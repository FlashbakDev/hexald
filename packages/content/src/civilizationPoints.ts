/** Points de civilisation (PC) — DEC-027. Constantes calibrables. */

import type { BuildingId } from "@hexald/shared";

export type CivilizationPointCategory =
  | "science"
  | "production"
  | "population"
  | "military";

/** Population : `pop × N`. */
export const CIVILIZATION_POINTS_POP_MULTIPLIER = 10;

/**
 * Points par bâtiment *actif* (achevé, ≥ 1 worker, pas orphelin).
 * Absents = 0 PC (maison, village, jardin/bonheur…).
 */
export const CIVILIZATION_POINTS_BY_BUILDING: Readonly<
  Partial<
    Record<
      BuildingId,
      { category: Exclude<CivilizationPointCategory, "population">; points: number }
    >
  >
> = {
  lumber_camp: { category: "production", points: 8 },
  farm: { category: "production", points: 8 },
  quarry: { category: "production", points: 8 },
  fishing_hut: { category: "production", points: 8 },
  clay_mine: { category: "production", points: 8 },
  mine: { category: "production", points: 8 },
  sawmill: { category: "production", points: 12 },
  mill: { category: "production", points: 12 },
  bakery: { category: "production", points: 12 },
  brickworks: { category: "production", points: 12 },
  smelter: { category: "production", points: 12 },
  forge: { category: "production", points: 12 },
  market: { category: "production", points: 10 },
  library: { category: "science", points: 15 },
  barracks: { category: "military", points: 15 }
};

export function civilizationPointsForBuilding(
  buildingId: BuildingId
): { category: Exclude<CivilizationPointCategory, "population">; points: number } | null {
  return CIVILIZATION_POINTS_BY_BUILDING[buildingId] ?? null;
}
