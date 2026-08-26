import {
  HOUSE_POPULATION_CAP_BONUS,
  TOWN_HALL_POPULATION_CAP,
  buildingPopulationCapBonus
} from "@hexald/content";
import type { BuildingId } from "@hexald/shared";
import { isBuildingComplete } from "./construction.ts";

export type HousingTile = {
  buildingId?: BuildingId | null;
  constructionCompletesAt?: number | string | Date | null;
};

/** Cap pop = HDV + bonus des logements achevés. */
export function computePopulationCap(
  tiles: readonly HousingTile[],
  now = Date.now()
): number {
  let bonus = 0;
  for (const tile of tiles) {
    if (!tile.buildingId) continue;
    if (!isBuildingComplete(tile.constructionCompletesAt, now)) continue;
    const fromCatalog = buildingPopulationCapBonus(tile.buildingId);
    if (fromCatalog > 0) {
      bonus += fromCatalog;
      continue;
    }
    // Filet si catalogue ancien sans champ.
    if (tile.buildingId === "house") bonus += HOUSE_POPULATION_CAP_BONUS;
  }
  return TOWN_HALL_POPULATION_CAP + bonus;
}

export { HOUSE_POPULATION_CAP_BONUS, TOWN_HALL_POPULATION_CAP };
