import type {
  BiomeId,
  BuildingId,
  PoiId,
  ResourceId,
  TechId,
  WorkerJob,
} from "@hexald/shared";

export type BuildingStatus = "mvp" | "planned" | "later";

export type BuildingRole = "extractor" | "processor" | "settlement" | "special";

export type BuildingDefinition = {
  id: BuildingId;
  label: string;
  /** Biome requis ; `"any"` = toute tuile constructible (pas l’eau pure, sauf terrain water). */
  terrain: BiomeId | "any";
  input: ResourceId | "workers" | null;
  output: ResourceId | "population" | "prestige" | null;
  hexSize: number | "multi";
  status: BuildingStatus;
  role: BuildingRole;
  /**
   * Posable via la roue build / `POST …/actions` (build).
   * Les processors restent `false` tant que le craft runtime n’existe pas.
   */
  placeable: boolean;
  /** Coût bois niveau 1 (requis si placeable). */
  woodCost?: number;
  /** Durée de chantier de base en ms (requis si placeable). */
  buildDurationMs?: number;
  /** Cap workers niveau 1 (extracteurs). */
  maxWorkers?: number;
  /** Prod / worker / minute (extracteurs). */
  ratePerWorkerPerMinute?: number;
  /** Métier assigné (runtime workers). */
  workerJob?: WorkerJob;
  /** Bonus de plafond pop une fois le bâtiment achevé (ex. maison +1). */
  populationCapBonus?: number;
  /** POI requis sur la tuile (ex. banc de poisson). */
  requiredPoiId?: PoiId;
  /** Tech requise pour poser le bâtiment (DEC-022). Absent = hors gate. */
  requiredTechId?: TechId;
  /**
   * Rayon d’emprise une fois achevé (DEC-026). Absent = 1.
   * Avant-poste futur = 2 ; route = 1.
   */
  influenceRadius?: number;
};
export const buildings: BuildingDefinition[] = [
  {
    id: "village",
    label: "Village",
    terrain: "any",
    input: null,
    output: "population",
    hexSize: "multi",
    status: "planned",
    role: "settlement",
    placeable: false,
  },
  {
    id: "lumber_camp",
    label: "Camp de bûcherons",
    terrain: "forest",
    input: "workers",
    output: "wood",
    hexSize: 1,
    status: "mvp",
    role: "extractor",
    placeable: true,
    woodCost: 15,
    buildDurationMs: 30_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 5,
    workerJob: "woodcutter",
  },
  {
    id: "sawmill",
    label: "Scierie",
    terrain: "any",
    input: "wood",
    output: "planks",
    hexSize: 1,
    status: "mvp",
    role: "processor",
    placeable: true,
    woodCost: 25,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    /** Legacy ; craft scierie = durée fixe, output = ouvriers. */
    ratePerWorkerPerMinute: 1,
    workerJob: "artisan",
    requiredTechId: "animal_husbandry",
  },
  {
    id: "mine",
    label: "Mine de fer",
    terrain: "mountain",
    input: "workers",
    output: "iron_ore",
    hexSize: 1,
    status: "mvp",
    role: "extractor",
    placeable: true,
    woodCost: 30,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 5,
    workerJob: "miner",
    requiredPoiId: "iron_deposit",
    requiredTechId: "mining",
  },
  {
    id: "clay_mine",
    label: "Mine d’argile",
    terrain: "plains",
    input: "workers",
    output: "clay",
    hexSize: 1,
    status: "mvp",
    role: "extractor",
    placeable: true,
    woodCost: 30,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 5,
    workerJob: "miner",
    requiredPoiId: "clay_deposit",
    requiredTechId: "pottery",
  },
  {
    id: "farm",
    label: "Ferme",
    terrain: "plains",
    input: "workers",
    output: "wheat",
    hexSize: 1,
    status: "mvp",
    role: "extractor",
    placeable: true,
    woodCost: 20,
    buildDurationMs: 30_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 5,
    workerJob: "farmer",
  },
  {
    id: "mill",
    label: "Moulin",
    terrain: "any",
    input: "wheat",
    output: "flour",
    hexSize: 1,
    status: "mvp",
    role: "processor",
    placeable: true,
    woodCost: 25,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    /** Legacy ; craft = durée fixe, output = ouvriers. */
    ratePerWorkerPerMinute: 1,
    workerJob: "artisan",
    requiredTechId: "pottery",
  },
  {
    id: "bakery",
    label: "Boulangerie",
    terrain: "any",
    input: "flour",
    output: "food",
    hexSize: 1,
    status: "planned",
    role: "processor",
    placeable: false,
    requiredTechId: "pottery",
  },
  {
    id: "quarry",
    label: "Carrière",
    terrain: "mountain",
    input: "workers",
    output: "stone",
    hexSize: 1,
    status: "mvp",
    role: "extractor",
    placeable: true,
    woodCost: 25,
    buildDurationMs: 30_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 5,
    workerJob: "quarrier",
  },
  {
    id: "fishing_hut",
    label: "Quai de pêche",
    terrain: "water",
    input: "workers",
    output: "food",
    hexSize: 1,
    status: "mvp",
    role: "extractor",
    placeable: true,
    woodCost: 20,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 2,
    workerJob: "fisher",
    requiredPoiId: "fish_bank",
    requiredTechId: "sailing",
  },
  {
    id: "brickworks",
    label: "Briqueterie",
    terrain: "any",
    input: "clay",
    output: "stone_blocks",
    hexSize: 1,
    status: "mvp",
    role: "processor",
    placeable: true,
    woodCost: 30,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    /** Legacy ; craft = durée fixe, output = ouvriers. */
    ratePerWorkerPerMinute: 1,
    workerJob: "artisan",
    requiredTechId: "pottery",
  },
  {
    id: "house",
    label: "Maison",
    terrain: "any",
    input: null,
    output: "population",
    hexSize: 1,
    status: "mvp",
    role: "settlement",
    placeable: true,
    woodCost: 30,
    buildDurationMs: 60_000,
    populationCapBonus: 1,
  },
  {
    id: "smelter",
    label: "Fonderie",
    terrain: "any",
    input: "iron_ore",
    output: "iron_ingot",
    hexSize: 1,
    status: "mvp",
    role: "processor",
    placeable: true,
    woodCost: 40,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    /** Legacy ; craft = durée fixe, output = ouvriers. */
    ratePerWorkerPerMinute: 1,
    workerJob: "artisan",
    requiredTechId: "metallurgy",
  },
  {
    id: "forge",
    label: "Forge",
    terrain: "any",
    input: "iron_ingot",
    output: "tools",
    hexSize: 1,
    status: "mvp",
    role: "processor",
    placeable: false,
    requiredTechId: "metallurgy",
  },
  {
    id: "library",
    label: "Bibliothèque",
    terrain: "any",
    input: "workers",
    output: "prestige",
    hexSize: 1,
    status: "mvp",
    role: "special",
    placeable: true,
    woodCost: 35,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 4,
    workerJob: "artisan",
    requiredTechId: "writing",
  },
  {
    id: "garden",
    label: "Jardin",
    terrain: "plains",
    input: "workers",
    output: "food",
    hexSize: 1,
    status: "planned",
    role: "extractor",
    placeable: false,
    woodCost: 25,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 3,
    workerJob: "farmer",
    requiredTechId: "irrigation",
  },
  {
    id: "barracks",
    label: "Caserne",
    terrain: "any",
    input: null,
    output: null,
    hexSize: 1,
    status: "mvp",
    role: "special",
    placeable: true,
    woodCost: 40,
    buildDurationMs: 60_000,
    requiredTechId: "bronze_working",
  },
  {
    id: "market",
    label: "Marché",
    terrain: "any",
    input: "workers",
    output: "gold",
    hexSize: 1,
    status: "mvp",
    role: "extractor",
    placeable: true,
    woodCost: 35,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    /** MVP : 1 or / 5 min, sans consommer de ressources. */
    ratePerWorkerPerMinute: 0.2,
    workerJob: "merchant",
    requiredTechId: "currency",
  },
  {
    id: "baths",
    label: "Bains",
    terrain: "any",
    input: null,
    output: "prestige",
    hexSize: 1,
    status: "planned",
    role: "special",
    placeable: false,
    requiredTechId: "currency",
  },
  {
    id: "monument",
    label: "Monument",
    terrain: "any",
    input: null,
    output: "prestige",
    hexSize: "multi",
    status: "later",
    role: "special",
    placeable: false,
  },
];

export function getBuildingDefinition(
  id: BuildingId,
): BuildingDefinition | undefined {
  return buildings.find((building) => building.id === id);
}

/** Bâtiments réellement posables en jeu (catalogue → runtime). */
export function listPlaceableBuildings(): BuildingDefinition[] {
  return buildings.filter(
    (building) =>
      building.placeable &&
      building.status !== "later" &&
      building.woodCost != null &&
      building.buildDurationMs != null,
  );
}

export type PlaceableBuildingId =
  | "lumber_camp"
  | "farm"
  | "quarry"
  | "fishing_hut"
  | "house"
  | "sawmill"
  | "clay_mine"
  | "mine"
  | "brickworks"
  | "mill"
  | "smelter"
  | "library"
  | "barracks"
  | "market";

export type PlaceableExtractorId =
  | "lumber_camp"
  | "farm"
  | "quarry"
  | "fishing_hut"
  | "clay_mine"
  | "mine"
  | "market";

export type PlaceableProcessorId =
  | "sawmill"
  | "brickworks"
  | "mill"
  | "smelter";

/** Bâtiments spéciaux posables (hors extracteur / processor). */
export type PlaceableSpecialId = "library" | "barracks";

/** Dérivé du catalogue (`placeable: true`). */
export const PLACEABLE_BUILDINGS: readonly PlaceableBuildingId[] =
  listPlaceableBuildings().map(
    (building) => building.id as PlaceableBuildingId,
  );

export const PLACEABLE_EXTRACTORS: readonly PlaceableExtractorId[] =
  listPlaceableBuildings()
    .filter((building) => building.role === "extractor")
    .map((building) => building.id as PlaceableExtractorId);

export const PLACEABLE_PROCESSORS: readonly PlaceableProcessorId[] =
  listPlaceableBuildings()
    .filter((building) => building.role === "processor")
    .map((building) => building.id as PlaceableProcessorId);

const EXPECTED_PLACEABLES: readonly PlaceableBuildingId[] = [
  "lumber_camp",
  "farm",
  "quarry",
  "fishing_hut",
  "house",
  "sawmill",
  "clay_mine",
  "mine",
  "brickworks",
  "mill",
  "smelter",
  "library",
  "barracks",
  "market",
];

for (const id of EXPECTED_PLACEABLES) {
  if (!PLACEABLE_BUILDINGS.includes(id)) {
    throw new Error(`catalog missing placeable building: ${id}`);
  }
}
for (const id of PLACEABLE_BUILDINGS) {
  if (!EXPECTED_PLACEABLES.includes(id)) {
    throw new Error(
      `catalog placeable "${id}" not in PlaceableBuildingId union — extend the type`,
    );
  }
}

export function isPlaceableBuildingId(
  id: BuildingId,
): id is PlaceableBuildingId {
  return PLACEABLE_BUILDINGS.includes(id as PlaceableBuildingId);
}

export function isPlaceableExtractorId(
  id: BuildingId,
): id is PlaceableExtractorId {
  return PLACEABLE_EXTRACTORS.includes(id as PlaceableExtractorId);
}

export function isPlaceableProcessorId(
  id: BuildingId,
): id is PlaceableProcessorId {
  return PLACEABLE_PROCESSORS.includes(id as PlaceableProcessorId);
}

export function buildingWoodCostFromCatalog(id: BuildingId): number {
  return getBuildingDefinition(id)?.woodCost ?? 0;
}

export function buildingDurationMsFromCatalog(id: BuildingId): number {
  return getBuildingDefinition(id)?.buildDurationMs ?? 60_000;
}

export function buildingMaxWorkersFromCatalog(id: BuildingId): number {
  return getBuildingDefinition(id)?.maxWorkers ?? 0;
}

export function buildingRateFromCatalog(id: BuildingId): number {
  return getBuildingDefinition(id)?.ratePerWorkerPerMinute ?? 0;
}

export function buildingPopulationCapBonus(id: BuildingId): number {
  return getBuildingDefinition(id)?.populationCapBonus ?? 0;
}

export function buildingRequiredTech(id: BuildingId): TechId | null {
  return getBuildingDefinition(id)?.requiredTechId ?? null;
}

/** Rayon d’emprise une fois achevé (DEC-026). Défaut 1. */
export function buildingInfluenceRadius(id: BuildingId): number {
  const value = getBuildingDefinition(id)?.influenceRadius;
  if (value == null || !Number.isFinite(value) || value < 0) return 1;
  return Math.floor(value);
}

/** Maps dérivés — compat API historique. */
export const BUILD_COST_WOOD: Record<PlaceableBuildingId, number> =
  Object.fromEntries(
    PLACEABLE_BUILDINGS.map((id) => [id, buildingWoodCostFromCatalog(id)]),
  ) as Record<PlaceableBuildingId, number>;

export const BUILD_DURATION_MS: Record<PlaceableBuildingId, number> =
  Object.fromEntries(
    PLACEABLE_BUILDINGS.map((id) => [id, buildingDurationMsFromCatalog(id)]),
  ) as Record<PlaceableBuildingId, number>;
