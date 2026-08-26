import {
  BUILD_COST_WOOD,
  BUILD_DESTROY_COMPLETED_REFUND_RATIO,
  PLACEABLE_EXTRACTORS,
  getBuildingDefinition,
  isPlaceableBuildingId,
  isPlaceableExtractorId,
  listPlaceableBuildings,
  type BuildingDefinition,
  type PlaceableBuildingId,
  type PlaceableExtractorId
} from "@hexald/content";
import type { BiomeId, BuildingId, HexCoord, PrimaryBiomeId } from "@hexald/shared";
import { biomeInfluences, isBuildableBiome } from "./world.ts";

export type BuildPlacementInput = {
  buildingId: BuildingId;
  origin: HexCoord;
  biome: BiomeId;
  hasVillage: boolean;
  existingBuildingId: BuildingId | null;
};

export type BuildPlacementResult =
  | { ok: true; buildingId: PlaceableBuildingId; origin: HexCoord }
  | {
      ok: false;
      reason:
        | "unknown_building"
        | "not_buildable"
        | "wrong_terrain"
        | "tile_occupied"
        | "has_village";
    };

export { getBuildingDefinition };

export function isPlaceableBuilding(id: BuildingId): id is PlaceableBuildingId {
  return isPlaceableBuildingId(id);
}

export function isPlaceableExtractor(
  id: BuildingId
): id is PlaceableExtractorId {
  return isPlaceableExtractorId(id);
}

export function buildingWoodCost(buildingId: PlaceableBuildingId): number {
  return BUILD_COST_WOOD[buildingId] ?? getBuildingDefinition(buildingId)?.woodCost ?? 0;
}

/**
 * Bois récupéré à la démolition.
 * Chantier en cours → coût plein ; achevé → ratio content (50 %).
 */
export function woodRefundOnDestroy(
  buildingId: BuildingId,
  underConstruction: boolean
): number {
  const cost = isPlaceableBuildingId(buildingId)
    ? buildingWoodCost(buildingId)
    : (getBuildingDefinition(buildingId)?.woodCost ?? 0);
  if (cost <= 0) return 0;
  if (underConstruction) return cost;
  return Math.floor(cost * BUILD_DESTROY_COMPLETED_REFUND_RATIO);
}

export function terrainAllowsBuilding(
  terrain: BuildingDefinition["terrain"],
  biome: BiomeId
): boolean {
  if (!isBuildableBiome(biome)) return false;
  if (terrain === "any") return true;
  if (terrain === biome) return true;
  return biomeInfluences(biome).includes(terrain as PrimaryBiomeId);
}

/** Bâtiments posables sur ce biome (bois / pop libre : UI + spend côté API). */
export function listBuildOptionsForTile(input: {
  biome: BiomeId;
  hasVillage: boolean;
  existingBuildingId: BuildingId | null;
}): PlaceableBuildingId[] {
  if (input.hasVillage || input.existingBuildingId) return [];
  if (!isBuildableBiome(input.biome)) return [];

  return listPlaceableBuildings()
    .filter((definition) => {
      if (!isPlaceableBuildingId(definition.id)) return false;
      return terrainAllowsBuilding(definition.terrain, input.biome);
    })
    .map((definition) => definition.id as PlaceableBuildingId);
}

export function validateBuildPlacement(
  input: BuildPlacementInput
): BuildPlacementResult {
  if (!isPlaceableBuilding(input.buildingId)) {
    return { ok: false, reason: "unknown_building" };
  }

  const definition = getBuildingDefinition(input.buildingId);
  if (!definition || !definition.placeable || definition.status === "later") {
    return { ok: false, reason: "unknown_building" };
  }

  if (input.hasVillage) {
    return { ok: false, reason: "has_village" };
  }

  if (input.existingBuildingId) {
    return { ok: false, reason: "tile_occupied" };
  }

  if (!isBuildableBiome(input.biome)) {
    return { ok: false, reason: "not_buildable" };
  }

  if (!terrainAllowsBuilding(definition.terrain, input.biome)) {
    return { ok: false, reason: "wrong_terrain" };
  }

  return {
    ok: true,
    buildingId: input.buildingId,
    origin: input.origin
  };
}

export function countBuildings(
  tiles: readonly { buildingId?: BuildingId | null }[],
  buildingId: BuildingId
): number {
  return tiles.filter((tile) => tile.buildingId === buildingId).length;
}

/** @deprecated Prefer listPlaceableBuildings from content */
export { PLACEABLE_EXTRACTORS };
