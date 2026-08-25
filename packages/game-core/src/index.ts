export { applyOfflineProduction, type ProducerState } from "./production.ts";
export { validateAction, type ActionResult } from "./actions.ts";
export {
  assignWorkersAtTile,
  committedWorkersFromTiles,
  extractorJobForBuildingId,
  maxWorkersForBuilding,
  totalAssignedWorkers,
  workerTotalsFromTiles,
  WORKERS_PER_EXTRACTOR_L1,
  seedDefaultWorkersForCompletedTiles,
  type AssignTileWorkersResult,
  type TileWorkerState
} from "./tileWorkers.ts";
export {
  assignExtractorWorkers,
  assignWoodcutters,
  assignedWorkers,
  createInitialEconomy,
  extractorJobForBuilding,
  idleWorkers,
  maxAssignableWorkersForJob,
  settleEconomy,
  spendWood,
  woodProductionRatePerMinute,
  wheatProductionRatePerMinute,
  stoneProductionRatePerMinute,
  LUMBER_CAMP_MAX_WORKERS,
  FARM_MAX_WORKERS,
  QUARRY_MAX_WORKERS,
  WOOD_STOCK_CAP,
  WHEAT_STOCK_CAP,
  STONE_STOCK_CAP,
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  WHEAT_RATE_PER_WORKER_PER_MINUTE,
  STONE_RATE_PER_WORKER_PER_MINUTE,
  type EconomyState,
  type AssignWorkersResult,
  type SpendWoodResult
} from "./economy.ts";
export {
  buildingWoodCost,
  countBuildings,
  getBuildingDefinition,
  isPlaceableExtractor,
  listBuildOptionsForTile,
  terrainAllowsBuilding,
  validateBuildPlacement,
  type BuildPlacementInput,
  type BuildPlacementResult
} from "./build.ts";
export {
  countBuildingSites,
  hasCompletedBuilding,
  isBuildingComplete,
  isBuildingUnderConstruction,
  resolveBuildDurationMs,
  startConstruction,
  type ConstructionTimeInput
} from "./construction.ts";
export {
  REGION_NEIGHBOR_OFFSETS,
  REGION_RADIUS,
  REGION_STEP,
  START_REGION_BIOME,
  START_REGION_CENTER,
  adjacentRegionCenters,
  biomeInfluences,
  canPlaceRegion,
  createStartingWorld,
  fusionBiome,
  generateRegionTiles,
  isBuildableBiome,
  isCoastBiome,
  isPrimaryBiome,
  isRegionLatticeCenter,
  isWaterBiome,
  regionLatticeNeighbors,
  resolveCellBiome,
  type GeneratedTile
} from "./world.ts";
export {
  computeRegionExpansionCost,
  listDevelopmentSites,
  regionHopFromOrigin,
  type DevelopmentSite,
  type RegionExpansionCost
} from "./regionCost.ts";
