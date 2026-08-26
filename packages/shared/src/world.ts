import type { BiomeId, BuildingId, PoiId, PrimaryBiomeId, ResourceId } from "./ids.ts";
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
  /** POI naturel / landmark (ex. banc de poisson). */
  poiId?: PoiId | null;
};

export type WorldRegionSnapshot = {
  center: HexCoord;
  biome: BiomeId;
};

export type ExtractorJob = "woodcutter" | "farmer" | "quarrier" | "fisher";

/** Ligne d’inventaire générique (API / client). */
export type InventoryStockSnapshot = {
  resourceId: ResourceId;
  amount: number;
  cap: number;
  lastCalculatedAt: string;
};

/** Économie monde — pop + inventaire générique (+ champs extracteurs). */
export type WorldEconomySnapshot = {
  population: number;
  populationCap: number;

  woodcutters: number;
  farmers: number;
  quarriers: number;
  fishers: number;

  lumberCampMaxWorkers: number;
  farmMaxWorkers: number;
  quarryMaxWorkers: number;
  fishingHutMaxWorkers: number;

  hasLumberCamp: boolean;
  hasFarm: boolean;
  hasQuarry: boolean;
  hasFishingHut: boolean;

  /** Inventaire générique — source de vérité pour craft / nouvelles ressources. */
  stocks: InventoryStockSnapshot[];

  /** Raccourcis extracteurs (dérivés de `stocks`) — UI legacy. */
  wood: number;
  woodCap: number;
  woodLastCalculatedAt: string;

  wheat: number;
  wheatCap: number;
  wheatLastCalculatedAt: string;

  stone: number;
  stoneCap: number;
  stoneLastCalculatedAt: string;

  /** DEC-016 — food hôtel de ville. */
  food: number;
  foodCap: number;
  foodLastCalculatedAt: string;
  foodProductionPerMinute: number;
  foodConsumptionPerMinute: number;
  foodNetPerMinute: number;

  /** DEC-017 — barre croissance. */
  foodSurplusAccumulated: number;
  popGrowthSurplusRequired: number;
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

/** Détail du coût d’expansion (éclats de monde). */
export type RegionExpansionCostSnapshot = {
  /** Distance en hops de régions depuis le village (1 = voisin). */
  hop: number;
  /** Éclats à payer (= hop au MVP). */
  worldshards: number;
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

/** Bâtiments posables — aligné sur le catalogue content. */
export type PlaceableBuildingId =
  | "lumber_camp"
  | "farm"
  | "quarry"
  | "fishing_hut"
  | "house";

export type BuildRequest = {
  buildingId: PlaceableBuildingId;
  origin: HexCoord;
};

export type BuildResult = {
  tile: WorldTileSnapshot;
  world: WorldSnapshot;
};

export type DestroyBuildingRequest = {
  origin: HexCoord;
};

export type DestroyBuildingResult = {
  tile: WorldTileSnapshot;
  world: WorldSnapshot;
  /** Ressources / pop libérées (pour feedback UI). */
  refunds: {
    wood: number;
    workers: number;
  };
};
