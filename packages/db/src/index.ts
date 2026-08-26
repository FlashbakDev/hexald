export { createDb, pingDb, type Database, type WorldDb } from "./client.ts";
export {
  players,
  worlds,
  worldInventory,
  worldTiles,
  worldRegions
} from "./schema/index.ts";
export {
  insertAnonymousPlayer,
  fetchPlayer,
  findPlayerByPseudo,
  findPlayerByFirebaseUid,
  insertFirebasePlayer,
  linkOrCreateFirebasePlayer,
  isPseudoAvailable,
  claimPlayerPseudo,
  type PersistedPlayer,
  type ClaimPseudoResult,
  type LinkFirebaseResult
} from "./players.ts";
export {
  insertWorldWithTerrain,
  fetchWorld,
  fetchWorldForOwner,
  listWorldsByOwner,
  appendRegion,
  updateWorldEconomy,
  setTileBuilding,
  setTileBiomeDev,
  clearTileBuilding,
  setTileWorkerState,
  setTileAssignedWorkers,
  deleteWorldForOwner,
  withWorldLock,
  WORLD_LOCK_TIMEOUT_MS,
  type PersistedWorld,
  type PersistedWorldSummary,
  type WorldTileRow,
  type WorldRegionRow,
  type WorldEconomyRow,
  type WorldInventoryRow,
  type WorldLockFailure,
  type WorldLockResult
} from "./worlds.ts";
export {
  fetchAdminDbStats,
  fetchPlayersByIds,
  type AdminDbStats,
  type AdminPlayerRow,
  type AdminWorldRow
} from "./admin.ts";
