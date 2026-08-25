export { createDb, pingDb, type Database } from "./client.ts";
export { players, worlds, worldTiles, worldRegions } from "./schema/index.ts";
export {
  insertAnonymousPlayer,
  fetchPlayer,
  findPlayerByPseudo,
  isPseudoAvailable,
  claimPlayerPseudo,
  type PersistedPlayer,
  type ClaimPseudoResult
} from "./players.ts";
export {
  insertWorldWithTerrain,
  fetchWorld,
  fetchWorldForOwner,
  listWorldsByOwner,
  appendRegion,
  updateWorldEconomy,
  setTileBuilding,
  setTileWorkerState,
  setTileAssignedWorkers,
  deleteWorldForOwner,
  type PersistedWorld,
  type PersistedWorldSummary,
  type WorldTileRow,
  type WorldRegionRow,
  type WorldEconomyRow
} from "./worlds.ts";
export {
  fetchAdminDbStats,
  fetchPlayersByIds,
  type AdminDbStats,
  type AdminPlayerRow,
  type AdminWorldRow
} from "./admin.ts";
