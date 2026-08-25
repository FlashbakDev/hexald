export { createDb, pingDb, type Database } from "./client.ts";
export { players, worlds, worldTiles, worldRegions } from "./schema/index.ts";
export {
  insertAnonymousPlayer,
  fetchPlayer,
  findPlayerByPseudo,
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
  type PersistedWorld,
  type PersistedWorldSummary,
  type WorldTileRow,
  type WorldRegionRow
} from "./worlds.ts";
