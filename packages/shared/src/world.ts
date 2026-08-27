import type { BiomeId, BuildingId, PoiId, PrimaryBiomeId, ResourceId, TechId } from "./ids.ts";
import type { HexCoord } from "./hex.ts";

export type WorldTileSnapshot = {
  q: number;
  r: number;
  biome: BiomeId;
  /** Bâtiment sur la tuile (`village` = HDV de départ). */
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
  /** Bits 0–5 : arêtes terre–terre avec rivière (HEX_DIRECTIONS). */
  riverMask?: number;
  /** Valve d’entrée processor (unités input / min depuis le stock village). */
  processorInputRatePerMinute?: number;
  /** Buffer d’input local du processor. */
  processorInputBuffer?: number;
  /** Horloge buffer (ISO). */
  processorInputSettledAt?: string | null;
  /** Fin du craft en cours (ISO) ; null = idle. */
  craftCompletesAt?: string | null;
};

/** Pointe de rivière (écoulement sortant vers dir). */
export type RiverTip = {
  q: number;
  r: number;
  /**
   * Index 0–5 : arête HEX_DIRECTIONS, ou sommet si `atVertex`.
   * Sommet `v` = jonction des arêtes `v` et `(v+1)%6`.
   */
  dir: number;
  /**
   * Tip lac en attente : `dir` est un sommet ; à la prochaine région,
   * une des deux arêtes incidentes poursuit le cours.
   */
  atVertex?: boolean;
};

export type WorldRegionSnapshot = {
  center: HexCoord;
  biome: BiomeId;
};

export type ExtractorJob =
  | "woodcutter"
  | "farmer"
  | "quarrier"
  | "fisher"
  | "miner";

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
  miners: number;

  lumberCampMaxWorkers: number;
  farmMaxWorkers: number;
  quarryMaxWorkers: number;
  fishingHutMaxWorkers: number;
  clayMineMaxWorkers: number;

  hasLumberCamp: boolean;
  hasFarm: boolean;
  hasQuarry: boolean;
  hasFishingHut: boolean;
  hasClayMine: boolean;

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

/** Progression d’une tech en cours (DEC-022). */
export type TechProgressSnapshot = {
  techId: TechId;
  progress: number;
  scienceCost: number;
};

/** État recherche monde-wide — pas de stock science. */
export type WorldResearchSnapshot = {
  researchTargetTechId: TechId | null;
  unlockedTechIds: TechId[];
  techProgress: TechProgressSnapshot[];
  /** Prod HDV : +1 science / 15 s au MVP (≈ 5 min pour la 1re recherche). */
  scienceProductionPerMinute: number;
  /** Horloge prod science (ISO) — projection client entre syncs. */
  scienceLastSettledAt: string;
};

/** Score dérivé PC (DEC-027) — pas une ressource. */
export type CivilizationPointsSnapshot = {
  science: number;
  production: number;
  population: number;
  military: number;
  total: number;
};

export type WorldSnapshot = {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  tiles: WorldTileSnapshot[];
  regions: WorldRegionSnapshot[];
  economy: WorldEconomySnapshot;
  research: WorldResearchSnapshot;
  /** Pointes de rivières à prolonger (serveur + reprise client). */
  riverTips?: RiverTip[];
  /** Points de civilisation (DEC-027). */
  civilizationPoints: CivilizationPointsSnapshot;
};

/** Entrée classement public (PC total). */
export type LeaderboardEntrySnapshot = {
  rank: number;
  pseudo: string;
  score: number;
  science: number;
  production: number;
  population: number;
  military: number;
};

export type LeaderboardSnapshot = {
  entries: LeaderboardEntrySnapshot[];
  /** Label UI (ex. « PC »). */
  scoreLabel: string;
  generatedAt: string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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
  | "house"
  | "sawmill"
  | "clay_mine";

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
