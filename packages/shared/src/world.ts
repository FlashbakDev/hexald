import type { BiomeId, BuildingId, PrimaryBiomeId } from "./ids.ts";
import type { HexCoord } from "./hex.ts";

export type WorldTileSnapshot = {
  q: number;
  r: number;
  biome: BiomeId;
  /** Bâtiment sur la tuile ; le village de départ est géré côté client (0,0). */
  buildingId?: BuildingId | null;
};

export type WorldRegionSnapshot = {
  center: HexCoord;
  biome: BiomeId;
};

/** Économie monde — v0 pop + bois. */
export type WorldEconomySnapshot = {
  population: number;
  populationCap: number;
  /** Travailleurs assignés au camp de bûcherons. */
  woodcutters: number;
  lumberCampMaxWorkers: number;
  /** True si au moins un lumber_camp est posé. */
  hasLumberCamp: boolean;
  wood: number;
  woodCap: number;
  /** ISO — dernier recalcul lazy du stock bois. */
  woodLastCalculatedAt: string;
};

export type WorldSnapshot = {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  tiles: WorldTileSnapshot[];
  regions: WorldRegionSnapshot[];
  economy: WorldEconomySnapshot;
};

export type WorldSummary = {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

/** Body for POST /v1/worlds/:id/regions */
export type ExpandRegionRequest = {
  center: HexCoord;
  biome: PrimaryBiomeId;
};

/** Response from POST /v1/worlds/:id/regions */
export type ExpandRegionResult = {
  center: HexCoord;
  biome: PrimaryBiomeId;
  tiles: WorldTileSnapshot[];
};

/** Body for POST /v1/worlds/:id/workers */
export type AssignWorkersRequest = {
  job: "woodcutter";
  /** Effectif cible pour ce métier (absolu). */
  count: number;
};

/** Body for POST /v1/worlds/:id/buildings */
export type BuildRequest = {
  buildingId: "lumber_camp";
  origin: HexCoord;
};

/** Response from POST /v1/worlds/:id/buildings */
export type BuildResult = {
  tile: WorldTileSnapshot;
  world: WorldSnapshot;
};
