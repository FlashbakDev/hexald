export { applyOfflineProduction, type ProducerState } from "./production.ts";
export { validateAction, type ActionResult } from "./actions.ts";
export {
  assignWoodcutters,
  createInitialEconomy,
  idleWorkers,
  settleEconomy,
  woodProductionRatePerHour,
  LUMBER_CAMP_MAX_WORKERS,
  WOOD_STOCK_CAP,
  WOOD_RATE_PER_WORKER_PER_HOUR,
  type EconomyState,
  type AssignWorkersResult
} from "./economy.ts";
export {
  countBuildings,
  getBuildingDefinition,
  terrainAllowsBuilding,
  validateBuildPlacement,
  type BuildPlacementInput,
  type BuildPlacementResult
} from "./build.ts";
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
