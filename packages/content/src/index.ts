export { biomes, primaryBiomes, type BiomeDefinition, type BiomeKind } from "./biomes.ts";
export { resources, type ResourceDefinition } from "./resources.ts";
export { buildings, type BuildingDefinition } from "./buildings.ts";
export { chains, type ProductionChain, type RecipeStep } from "./recipes.ts";
export {
  STARTING_POPULATION,
  POPULATION_CAP,
  LUMBER_CAMP_MAX_WORKERS,
  FARM_MAX_WORKERS,
  QUARRY_MAX_WORKERS,
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  WHEAT_RATE_PER_WORKER_PER_MINUTE,
  STONE_RATE_PER_WORKER_PER_MINUTE,
  WOOD_STOCK_CAP,
  WHEAT_STOCK_CAP,
  STONE_STOCK_CAP,
  STARTING_WOOD,
  STARTING_WHEAT,
  STARTING_STONE,
  PLACEABLE_EXTRACTORS,
  BUILD_COST_WOOD,
  BUILD_IDLE_POP_REQUIREMENT,
  BUILD_DURATION_MS,
  DEV_BUILD_DURATION_MS,
  REGION_EXPANSION_BASE_WOOD,
  REGION_EXPANSION_DISTANCE_EXPONENT,
  REGION_EXPANSION_DISCOUNT_D1,
  REGION_EXPANSION_DISCOUNT_D2,
  REGION_EXPANSION_DISCOUNT_CAP,
  type PlaceableExtractorId
} from "./economy.ts";
