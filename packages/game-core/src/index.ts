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
  releaseHousingConstructionWorkers,
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
  settleWorldshard,
  worldshardMinutesUntilNext,
  spendWood,
  spendResource,
  grantResource,
  getStock,
  getStockAmount,
  setStock,
  emptyStock,
  clampStocksToCaps,
  woodProductionRatePerMinute,
  wheatProductionRatePerMinute,
  stoneProductionRatePerMinute,
  woodRateFromState,
  wheatRateFromState,
  stoneRateFromState,
  foodProductionPerMinute,
  fishingFoodRateFromState,
  clayRateFromState,
  wheatFoodEquivalentPerMinute,
  foodConsumptionPerMinute,
  foodNetRatePerMinute,
  popGrowthProgress,
  tileProductionMultiplier,
  countPastureTiles,
  extractorSitesFromTiles,
  processorSitesFromTiles,
  processorCraftRatePerMinute,
  settleProcessors,
  LUMBER_CAMP_MAX_WORKERS,
  FARM_MAX_WORKERS,
  QUARRY_MAX_WORKERS,
  FISHING_HUT_MAX_WORKERS,
  WOOD_STOCK_CAP,
  WHEAT_STOCK_CAP,
  STONE_STOCK_CAP,
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  WHEAT_RATE_PER_WORKER_PER_MINUTE,
  STONE_RATE_PER_WORKER_PER_MINUTE,
  FISHING_HUT_FOOD_RATE_PER_WORKER_PER_MINUTE,
  FOOD_CONSUMPTION_PER_POP_PER_MINUTE,
  TOWN_HALL_FOOD_PRODUCTION_PER_MINUTE,
  POP_GROWTH_SURPLUS_FOOD_REQUIRED,
  FUSION_TILE_PRODUCTION_BONUS,
  WORLDSHARD_STOCK_CAP,
  TOWN_HALL_WORLDSHARD_INTERVAL_MS,
  stockCapFor,
  type EconomyState,
  type ExtractorSite,
  type StockEntry,
  type AssignWorkersResult,
  type SpendWoodResult,
  type SpendResourceResult
} from "./economy.ts";
export {
  settleProcessorTiles,
  clampProcessorInputRate,
  maxProcessorInputRate,
  type ProcessorTileState,
  type SettleProcessorsOptions
} from "./processorCraft.ts";
export {
  buildingWoodCost,
  woodRefundOnDestroy,
  countBuildings,
  getBuildingDefinition,
  isPlaceableBuilding,
  isPlaceableExtractor,
  isPlaceableProcessor,
  listBuildOptionsForTile,
  terrainAllowsBuilding,
  validateBuildPlacement,
  isBuildingUnlocked,
  type BuildPlacementInput,
  type BuildPlacementResult
} from "./build.ts";
export {
  computeInfluencedTiles,
  influenceRadiusForBuilding,
  isBuildingOrphan,
  isBuildingOutsideInfluence,
  isTileInfluenced,
  releaseWorkersOutsideInfluence,
  ORIGIN_INFLUENCE_RADIUS,
  type InfluenceTileInput
} from "./influence.ts";
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
  computePopulationCap,
  HOUSE_POPULATION_CAP_BONUS,
  TOWN_HALL_POPULATION_CAP
} from "./housing.ts";
export {
  REGION_NEIGHBOR_OFFSETS,
  REGION_RADIUS,
  REGION_STEP,
  START_REGION_BIOME,
  START_REGION_CENTER,
  START_VILLAGE_BUILDING_ID,
  adjacentRegionCenters,
  biomeInfluences,
  canPlaceRegion,
  createStartingWorld,
  fusionBiome,
  generateRegionTiles,
  assignCoastalFishBanks,
  assignPlainsCowHerds,
  assignMountainIronDeposits,
  assignPlainsClayDeposits,
  isStartVillageCoord,
  isVillageBuildingId,
  startingTileBuildingId,
  tileTouchesLand,
  isBuildableBiome,
  isBiomeId,
  isCoastBiome,
  isFusionBiome,
  isPrimaryBiome,
  isRegionLatticeCenter,
  isWaterBiome,
  regionLatticeNeighbors,
  resolveCellBiome,
  type GeneratedTile
} from "./world.ts";
export {
  assignRivers,
  clearRiverEdgesAt,
  filterTipsAwayFromTile,
  lakeOutflowVertexFromMask,
  lakeSpawnChance,
  riverEdgeBits,
  terrainHeight,
  withLakeOutflowVertex,
  type AssignRiversInput,
  type AssignRiversResult
} from "./rivers.ts";
export {
  computeRegionExpansionCost,
  listDevelopmentSites,
  regionHopFromOrigin,
  type DevelopmentSite,
  type RegionExpansionCost
} from "./regionCost.ts";
export {
  createInitialResearchState,
  isTechAvailable,
  projectResearchSnapshot,
  researchStateChanged,
  scienceProductionPerMinute,
  setResearchTarget,
  settleResearch,
  techProgressFor,
  type ResearchSettleOptions,
  type ResearchState,
  type SetResearchTargetResult
} from "./research.ts";
export {
  computeCivilizationPoints,
  type CivilizationPointsBreakdown,
  type CivilizationPointsInput,
  type CivilizationPointsTileInput
} from "./civilizationPoints.ts";
