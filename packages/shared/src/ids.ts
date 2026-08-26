export type PrimaryBiomeId = "forest" | "plains" | "mountain" | "water";

/** Fusions terre↔terre uniquement. Rivage terre↔eau = décor d’arête (style Civ). */
export type FusionBiomeId =
  | "forest_plains"
  | "plains_mountain"
  | "forest_mountain";

export type BiomeId = PrimaryBiomeId | FusionBiomeId;

export type TechId =
  | "foundations"
  | "agriculture"
  | "sailing"
  | "animal_husbandry"
  | "pottery"
  | "writing"
  | "masonry"
  | "irrigation"
  | "wheel"
  | "currency"
  | "bronze_working"
  | "military_training"
  | "advanced_navigation"
  | "engineering"
  | "mining"
  | "metallurgy";

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
  | "brickworks"
  | "smelter"
  | "forge"
  | "monument"
  | "house"
  | "library"
  | "garden"
  | "barracks"
  | "market"
  | "baths";

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
