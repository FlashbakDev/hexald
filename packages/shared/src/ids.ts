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
  | "tools"
  /** Éclat de monde — ancrage / révélation de région. */
  | "worldshard";

/** Points d’intérêt naturels / landmarks (couche sur la tuile). */
export type PoiId = "fish_bank" | "cow_herd" | "iron_deposit";

export type BuildingId =
  | "village"
  | "lumber_camp"
  | "sawmill"
  | "mine"
  | "farm"
  | "mill"
  | "bakery"
  | "quarry"
  | "fishing_hut"
  | "smelter"
  | "forge"
  | "monument"
  | "house";

export type WorkerJob =
  | "idle"
  | "woodcutter"
  | "miner"
  | "quarrier"
  | "farmer"
  | "fisher"
  | "laborer"
  | "artisan"
  | "builder";
