import {
  BUILD_COST_WOOD,
  BUILD_DESTROY_COMPLETED_REFUND_RATIO,
  PLACEABLE_EXTRACTORS,
  getBuildingDefinition,
  isPlaceableBuildingId,
  isPlaceableExtractorId,
  isPlaceableProcessorId,
  listPlaceableBuildings,
  buildingRequiredTech,
  type BuildingDefinition,
  type PlaceableBuildingId,
  type PlaceableExtractorId,
  type PlaceableProcessorId
} from "@hexald/content";
import type { BiomeId, BuildingId, HexCoord, PoiId, PrimaryBiomeId, TechId } from "@hexald/shared";
import { hexKey } from "@hexald/shared";
import {
  computeInfluencedTiles,
  type InfluenceTileInput
} from "./influence.ts";
import { biomeInfluences, isBuildableBiome, isWaterBiome } from "./world.ts";

export type BuildPlacementInput = {
  buildingId: BuildingId;
  origin: HexCoord;
  biome: BiomeId;
  hasVillage: boolean;
  existingBuildingId: BuildingId | null;
  poiId?: PoiId | null;
  /** Techs débloquées monde-wide (DEC-022). */
  unlockedTechIds?: readonly TechId[];
  /** Tuiles monde pour l’emprise (DEC-026). Absent = pas de gate influence. */
  tiles?: readonly InfluenceTileInput[];
  now?: number;
};

export type BuildPlacementResult =
  | { ok: true; buildingId: PlaceableBuildingId; origin: HexCoord }
  | {
      ok: false;
      reason:
        | "unknown_building"
        | "not_buildable"
        | "wrong_terrain"
        | "missing_poi"
        | "tile_occupied"
        | "has_village"
        | "tech_not_unlocked"
        | "outside_influence";
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

export function isPlaceableProcessor(
  id: BuildingId
): id is PlaceableProcessorId {
  return isPlaceableProcessorId(id);
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
  if (terrain === "water") return isWaterBiome(biome);
  if (!isBuildableBiome(biome)) return false;
  if (terrain === "any") return true;
  if (terrain === biome) return true;
  return biomeInfluences(biome).includes(terrain as PrimaryBiomeId);
}

function poiAllowsBuilding(
  definition: BuildingDefinition,
  poiId: PoiId | null | undefined
): boolean {
  if (!definition.requiredPoiId) return true;
  return poiId === definition.requiredPoiId;
}

export function isBuildingUnlocked(
  buildingId: BuildingId,
  unlockedTechIds: readonly TechId[]
): boolean {
  const required = buildingRequiredTech(buildingId);
  if (!required) return true;
  return unlockedTechIds.includes(required);
}

function tileIsInfluenced(input: {
  origin: HexCoord;
  tiles?: readonly InfluenceTileInput[];
  now?: number;
}): boolean {
  if (!input.tiles) return true;
  const now = input.now ?? Date.now();
  const influenced = computeInfluencedTiles(input.tiles, now);
  return influenced.has(hexKey(input.origin.q, input.origin.r));
}

/** Bâtiments posables sur ce biome (+ POI + tech + influence) — bois / pop libre : UI + spend côté API. */
export function listBuildOptionsForTile(input: {
  biome: BiomeId;
  hasVillage: boolean;
  existingBuildingId: BuildingId | null;
  poiId?: PoiId | null;
  unlockedTechIds?: readonly TechId[];
  origin?: HexCoord;
  tiles?: readonly InfluenceTileInput[];
  now?: number;
}): PlaceableBuildingId[] {
  const unlockedTechIds = input.unlockedTechIds ?? [];
  if (input.hasVillage || input.existingBuildingId) return [];
  if (
    input.origin &&
    !tileIsInfluenced({
      origin: input.origin,
      tiles: input.tiles,
      now: input.now
    })
  ) {
    return [];
  }

  return listPlaceableBuildings()
    .filter((definition) => {
      if (!isPlaceableBuildingId(definition.id)) return false;
      if (!isBuildingUnlocked(definition.id, unlockedTechIds)) return false;
      if (!terrainAllowsBuilding(definition.terrain, input.biome)) return false;
      if (!poiAllowsBuilding(definition, input.poiId)) return false;
      // Les bâtiments « terre » restent exclus de l’eau pure.
      if (isWaterBiome(input.biome) && definition.terrain !== "water") return false;
      return true;
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

  if (!terrainAllowsBuilding(definition.terrain, input.biome)) {
    return { ok: false, reason: "wrong_terrain" };
  }

  if (!poiAllowsBuilding(definition, input.poiId)) {
    return { ok: false, reason: "missing_poi" };
  }

  if (!isBuildingUnlocked(input.buildingId, input.unlockedTechIds ?? [])) {
    return { ok: false, reason: "tech_not_unlocked" };
  }

  // Eau : uniquement bâtiments terrain water (cabane de pêcheur).
  if (isWaterBiome(input.biome) && definition.terrain !== "water") {
    return { ok: false, reason: "not_buildable" };
  }

  // Terre : pas de bâtiment water.
  if (!isWaterBiome(input.biome) && definition.terrain === "water") {
    return { ok: false, reason: "wrong_terrain" };
  }

  if (!isWaterBiome(input.biome) && !isBuildableBiome(input.biome)) {
    return { ok: false, reason: "not_buildable" };
  }

  if (
    !tileIsInfluenced({
      origin: input.origin,
      tiles: input.tiles,
      now: input.now
    })
  ) {
    return { ok: false, reason: "outside_influence" };
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
