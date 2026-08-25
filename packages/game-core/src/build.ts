import { buildings, type BuildingDefinition } from "@hexald/content";
import type { BiomeId, BuildingId, HexCoord, PrimaryBiomeId } from "@hexald/shared";
import { biomeInfluences, isBuildableBiome } from "./world.ts";

export type BuildPlacementInput = {
  buildingId: BuildingId;
  origin: HexCoord;
  biome: BiomeId;
  hasVillage: boolean;
  existingBuildingId: BuildingId | null;
  lumberCampCount: number;
};

export type BuildPlacementResult =
  | { ok: true; buildingId: BuildingId; origin: HexCoord }
  | {
      ok: false;
      reason:
        | "unknown_building"
        | "not_buildable"
        | "wrong_terrain"
        | "tile_occupied"
        | "has_village"
        | "lumber_camp_limit";
    };

export function getBuildingDefinition(
  id: BuildingId
): BuildingDefinition | undefined {
  return buildings.find((building) => building.id === id);
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

export function validateBuildPlacement(
  input: BuildPlacementInput
): BuildPlacementResult {
  const definition = getBuildingDefinition(input.buildingId);
  if (!definition || definition.status === "later") {
    return { ok: false, reason: "unknown_building" };
  }

  if (input.buildingId !== "lumber_camp") {
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

  if (input.lumberCampCount >= 1) {
    return { ok: false, reason: "lumber_camp_limit" };
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
