import type { BiomeId, BuildingId, PrimaryBiomeId } from "./ids.ts";
import type { HexCoord } from "./hex.ts";

export type WorldTileSnapshot = {
  q: number;
  r: number;
  biome: BiomeId;
  /** Bâtiment sur la tuile ; le village de départ est géré côté client (0,0). */
  buildingId?: BuildingId | null;
  /**
   * Fin de chantier (ISO). Absent / null = achevé (legacy ou déjà opérationnel).
   * Si dans le futur → en construction.
   */
  constructionCompletesAt?: string | null;
  /** Workers assignés (0–1 par extracteur niveau 1). */
  assignedWorkers?: number;
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

/** Détail du coût d’expansion (DEC-015). */
export type RegionExpansionCostSnapshot = {
  hop: number;
  baseWood: number;
  buildingsAtDistance1: number;
  buildingsAtDistance2: number;
  discount: number;
  wood: number;
};

export type ExpandRegionResult = {
  center: HexCoord;
  biome: PrimaryBiomeId;
  tiles: WorldTileSnapshot[];
  cost: RegionExpansionCostSnapshot;
  world: WorldSnapshot;
};

export type AssignWorkersRequest = {
  origin: HexCoord;
  /** 0 ou 1 pour un extracteur niveau 1. */
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
