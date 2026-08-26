import type { BiomeId, BuildingId, PoiId, ResourceId, WorkerJob } from "@hexald/shared";

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
    placeable: false
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
    buildDurationMs: 60_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 5,
    workerJob: "woodcutter"
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
    placeable: false
  },
  {
    id: "mine",
    label: "Mine",
    terrain: "mountain",
    input: "workers",
    output: "iron_ore",
    hexSize: 1,
    status: "mvp",
    role: "extractor",
    // Pas encore branché runtime (job miner + mesh + prod fer).
    placeable: false,
    woodCost: 30,
    buildDurationMs: 60_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 5,
    workerJob: "miner",
    requiredPoiId: "iron_deposit"
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
    buildDurationMs: 60_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 5,
    workerJob: "farmer"
  },
  {
    id: "mill",
    label: "Moulin",
    terrain: "any",
    input: "wheat",
    output: "flour",
    hexSize: 1,
    status: "planned",
    role: "processor",
    placeable: false
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
    placeable: false
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
    buildDurationMs: 60_000,
    maxWorkers: 1,
    ratePerWorkerPerMinute: 5,
    workerJob: "quarrier"
  },
  {
    id: "fishing_hut",
    label: "Cabane de pêcheur",
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
    requiredPoiId: "fish_bank"
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
    populationCapBonus: 1
  },
  {
    id: "smelter",
    label: "Fonderie",
    terrain: "any",
    input: "iron_ore",
    output: "iron_ingot",
    hexSize: "multi",
    status: "mvp",
    role: "processor",
    placeable: false
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
    placeable: false
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
    placeable: false
  }
];

export function getBuildingDefinition(
  id: BuildingId
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
      building.buildDurationMs != null
  );
}

export type PlaceableBuildingId =
  | "lumber_camp"
  | "farm"
  | "quarry"
  | "fishing_hut"
  | "house";

export type PlaceableExtractorId =
  | "lumber_camp"
  | "farm"
  | "quarry"
  | "fishing_hut";

/** Dérivé du catalogue (`placeable: true`). */
export const PLACEABLE_BUILDINGS: readonly PlaceableBuildingId[] =
  listPlaceableBuildings().map((building) => building.id as PlaceableBuildingId);

export const PLACEABLE_EXTRACTORS: readonly PlaceableExtractorId[] =
  listPlaceableBuildings()
    .filter((building) => building.role === "extractor")
    .map((building) => building.id as PlaceableExtractorId);

const EXPECTED_PLACEABLES: readonly PlaceableBuildingId[] = [
  "lumber_camp",
  "farm",
  "quarry",
  "fishing_hut",
  "house"
];

for (const id of EXPECTED_PLACEABLES) {
  if (!PLACEABLE_BUILDINGS.includes(id)) {
    throw new Error(`catalog missing placeable building: ${id}`);
  }
}
for (const id of PLACEABLE_BUILDINGS) {
  if (!EXPECTED_PLACEABLES.includes(id)) {
    throw new Error(
      `catalog placeable "${id}" not in PlaceableBuildingId union — extend the type`
    );
  }
}

export function isPlaceableBuildingId(
  id: BuildingId
): id is PlaceableBuildingId {
  return PLACEABLE_BUILDINGS.includes(id as PlaceableBuildingId);
}

export function isPlaceableExtractorId(
  id: BuildingId
): id is PlaceableExtractorId {
  return PLACEABLE_EXTRACTORS.includes(id as PlaceableExtractorId);
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

/** Maps dérivés — compat API historique. */
export const BUILD_COST_WOOD: Record<PlaceableBuildingId, number> =
  Object.fromEntries(
    PLACEABLE_BUILDINGS.map((id) => [id, buildingWoodCostFromCatalog(id)])
  ) as Record<PlaceableBuildingId, number>;

export const BUILD_DURATION_MS: Record<PlaceableBuildingId, number> =
  Object.fromEntries(
    PLACEABLE_BUILDINGS.map((id) => [id, buildingDurationMsFromCatalog(id)])
  ) as Record<PlaceableBuildingId, number>;
