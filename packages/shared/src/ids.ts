export type PrimaryBiomeId = "forest" | "plains" | "mountain" | "water";

/** Fusions terre↔terre uniquement. Rivage terre↔eau = décor d’arête (style Civ). */
export type FusionBiomeId =
  | "forest_plains"
  | "plains_mountain"
  | "forest_mountain";

export type BiomeId = PrimaryBiomeId | FusionBiomeId;

export type ResourceId =
  | "wood"
  | "planks"
  | "wheat"
  | "flour"
  | "food"
  | "stone"
  | "stone_blocks"
  | "iron_ore"
  | "iron_ingot"
  | "tools";

export type BuildingId =
  | "village"
  | "lumber_camp"
  | "sawmill"
  | "mine"
  | "farm"
  | "mill"
  | "bakery"
  | "quarry"
  | "smelter"
  | "forge"
  | "monument";

export type WorkerJob =
  | "idle"
  | "woodcutter"
  | "miner"
  | "farmer"
  | "laborer"
  | "artisan"
  | "builder";
