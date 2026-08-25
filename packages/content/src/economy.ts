/** Population + extracteurs v0 (DEC-013 / DEC-014). */

export const STARTING_POPULATION = 4;
export const POPULATION_CAP = 4;

/** Prod par worker assigné (niveau 1). */
export const LUMBER_CAMP_MAX_WORKERS = 1;
export const FARM_MAX_WORKERS = 1;
export const QUARRY_MAX_WORKERS = 1;

export const WOOD_RATE_PER_WORKER_PER_MINUTE = 5;
export const WHEAT_RATE_PER_WORKER_PER_MINUTE = 5;
export const STONE_RATE_PER_WORKER_PER_MINUTE = 5;

export const WOOD_STOCK_CAP = 200;
export const WHEAT_STOCK_CAP = 200;
export const STONE_STOCK_CAP = 150;

/** Assez pour 1 camp de bûcherons + 1 expansion adjacente (15 + 30). */
export const STARTING_WOOD = 45;
export const STARTING_WHEAT = 0;
export const STARTING_STONE = 0;

/** Bâtiments extracteurs posables (extracteurs niveau 1). */
export const PLACEABLE_EXTRACTORS = ["lumber_camp", "farm", "quarry"] as const;
export type PlaceableExtractorId = (typeof PLACEABLE_EXTRACTORS)[number];

/** Pop libre requise pour lancer un chantier (réservée sur le site). */
export const BUILD_IDLE_POP_REQUIREMENT = 1;

/** Coût de construction niveau 1 — bois uniquement, fixe par type. */
export const BUILD_COST_WOOD: Record<PlaceableExtractorId, number> = {
  lumber_camp: 15,
  farm: 20,
  quarry: 25
};

/** Durées de construction de base (ms) — hors override dev. */
export const BUILD_DURATION_MS: Record<PlaceableExtractorId, number> = {
  lumber_camp: 60_000,
  farm: 60_000,
  quarry: 60_000
};

/** En `NODE_ENV !== "production"`, tous les chantiers durent 5 s. */
export const DEV_BUILD_DURATION_MS = 5_000;

/**
 * Coût d’expansion de région v1 (DEC-015).
 * `base = BASE × hop^k` (hop = distance cube au centre / REGION_STEP),
 * puis remise bâtiments proches (d1 / d2), plafond.
 */
export const REGION_EXPANSION_BASE_WOOD = 30;
/** Exposant distance ; 1 = linéaire en hops. */
export const REGION_EXPANSION_DISTANCE_EXPONENT = 1;
export const REGION_EXPANSION_DISCOUNT_D1 = 0.2;
export const REGION_EXPANSION_DISCOUNT_D2 = 0.05;
export const REGION_EXPANSION_DISCOUNT_CAP = 0.5;
