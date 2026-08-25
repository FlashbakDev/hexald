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

export type ExtractorJob = "woodcutter" | "farmer" | "quarrier";

/** Économie monde — extracteurs bois / blé / pierre. */
export type WorldEconomySnapshot = {
  population: number;
  populationCap: number;

  woodcutters: number;
  farmers: number;
  quarriers: number;

  lumberCampMaxWorkers: number;
  farmMaxWorkers: number;
  quarryMaxWorkers: number;

  hasLumberCamp: boolean;
  hasFarm: boolean;
  hasQuarry: boolean;

  wood: number;
  woodCap: number;
  woodLastCalculatedAt: string;

  wheat: number;
  wheatCap: number;
  wheatLastCalculatedAt: string;

  stone: number;
  stoneCap: number;
  stoneLastCalculatedAt: string;
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

export type ExpandRegionRequest = {
  center: HexCoord;
  biome: PrimaryBiomeId;
};

export type ExpandRegionResult = {
  center: HexCoord;
  biome: PrimaryBiomeId;
  tiles: WorldTileSnapshot[];
};

export type AssignWorkersRequest = {
  job: ExtractorJob;
  /** Effectif cible pour ce métier (absolu). */
  count: number;
};

export type BuildRequest = {
  buildingId: "lumber_camp" | "farm" | "quarry";
  origin: HexCoord;
};

export type BuildResult = {
  tile: WorldTileSnapshot;
  world: WorldSnapshot;
};
