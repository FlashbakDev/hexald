export { createDb, pingDb, type Database, type WorldDb } from "./client.ts";
export {
  players,
  worlds,
  worldInventory,
  worldTiles,
  worldRegions,
  worldUnlockedTechs,
  worldTechProgress
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
  ensurePlayerAvatar,
  updatePlayerAvatar,
  renamePlayerPseudo,
  type PersistedPlayer,
  type ClaimPseudoResult,
  type LinkFirebaseResult,
  type UpdateAvatarResult,
  type RenamePseudoResult
} from "./players.ts";
export {
  insertWorldWithTerrain,
  fetchWorld,
  fetchWorldForOwner,
  listWorldsByOwner,
  listNamedWorldsForLeaderboard,
  appendRegion,
  updateWorldEconomy,
  updateWorldResearch,
  setTileBuilding,
  setTileBiomeDev,
  clearTileBuilding,
  setTileWorkerState,
  setTileProcessorState,
  setTileAssignedWorkers,
  setTilePoiId,
  deleteWorldForOwner,
  withWorldLock,
  WORLD_LOCK_TIMEOUT_MS,
  type PersistedWorld,
  type PersistedWorldSummary,
  type WorldTileRow,
  type WorldRegionRow,
  type WorldEconomyRow,
  type WorldInventoryRow,
  type WorldResearchRow,
  type WorldTechProgressRow,
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
