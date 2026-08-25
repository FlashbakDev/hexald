import {
  PLACEABLE_EXTRACTORS,
  buildings,
  type BuildingDefinition,
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
  /** Compteur actuel de ce type de bâtiment dans le monde. */
  buildingCount: number;
};

export type BuildPlacementResult =
  | { ok: true; buildingId: PlaceableExtractorId; origin: HexCoord }
  | {
      ok: false;
      reason:
        | "unknown_building"
        | "not_buildable"
        | "wrong_terrain"
        | "tile_occupied"
        | "has_village"
        | "building_limit";
    };

export function getBuildingDefinition(
  id: BuildingId
): BuildingDefinition | undefined {
  return buildings.find((building) => building.id === id);
}

export function isPlaceableExtractor(
  id: BuildingId
): id is PlaceableExtractorId {
  return (PLACEABLE_EXTRACTORS as readonly string[]).includes(id);
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

/** Extracteurs posables sur ce biome, pas encore présents (compteurs fournis). */
export function listBuildOptionsForTile(input: {
  biome: BiomeId;
  hasVillage: boolean;
  existingBuildingId: BuildingId | null;
  counts: Partial<Record<PlaceableExtractorId, number>>;
}): PlaceableExtractorId[] {
  if (input.hasVillage || input.existingBuildingId) return [];
  if (!isBuildableBiome(input.biome)) return [];

  return PLACEABLE_EXTRACTORS.filter((id) => {
    if ((input.counts[id] ?? 0) >= 1) return false;
    const definition = getBuildingDefinition(id);
    if (!definition) return false;
    return terrainAllowsBuilding(definition.terrain, input.biome);
  });
}

export function validateBuildPlacement(
  input: BuildPlacementInput
): BuildPlacementResult {
  if (!isPlaceableExtractor(input.buildingId)) {
    return { ok: false, reason: "unknown_building" };
  }

  const definition = getBuildingDefinition(input.buildingId);
  if (!definition || definition.status === "later") {
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

  if (input.buildingCount >= 1) {
    return { ok: false, reason: "building_limit" };
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
