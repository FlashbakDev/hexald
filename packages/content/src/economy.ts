/** Population + extracteurs v0 (DEC-013 / DEC-014). */

export const STARTING_POPULATION = 4;
/**
 * Cap pop de l’hôtel de ville seul (DEC-017).
 * = pop de départ : pas de place libre tant qu’on n’a pas de maisons / niveaux.
 * Monter le cap = maisons (+1 / niveau 1) et futurs bâtiments de logement.
 */
export const TOWN_HALL_POPULATION_CAP = STARTING_POPULATION;
/** Alias historique — même valeur que TOWN_HALL_POPULATION_CAP. */
export const POPULATION_CAP = TOWN_HALL_POPULATION_CAP;
/** Bonus de plafond pop par maison niveau 1 achevé. */
export const HOUSE_POPULATION_CAP_BONUS = 1;

/**
 * Hôtel de ville / village de départ (DEC-016).
 * Même logique que la pop de base : le bâtiment central ancre stockage + food.
 * Tous les taux économiques sont en **entiers par minute** (pas de fractions).
 */
/** Capacité de stockage de base par ressource (entrepôts / niveaux plus tard). */
export const TOWN_HALL_BASE_STORAGE = 80;
/** Consommation food par habitant et par minute. */
export const FOOD_CONSUMPTION_PER_POP_PER_MINUTE = 1;
/**
 * Prod food de subsistance de l’hôtel de ville (entiers / min).
 * Équilibre exact à la pop de départ (4 × 1/min).
 */
export const TOWN_HALL_FOOD_PRODUCTION_PER_MINUTE =
  STARTING_POPULATION * FOOD_CONSUMPTION_PER_POP_PER_MINUTE;
/**
 * Blé brut compte pour la croissance (DEC-017) sans moulin :
 * `WHEAT_TO_FOOD_EMERGENCY_RATIO` blé ≈ 1 food (prod + secours déficit).
 * Aligné sur la prod ferme (5 blé/min/worker) → +1 food-équivalent / min.
 */
export const WHEAT_TO_FOOD_EMERGENCY_RATIO = 5;

/**
 * Croissance de population (DEC-017) — Civ-light + Travian.
 * Surplus food net cumulé (entiers) jusqu’au seuil → +1 pop si sous le cap.
 */
/** Food de surplus cumulé requis pour +1 habitant. */
export const POP_GROWTH_SURPLUS_FOOD_REQUIRED = 60;

/**
 * Bonus de production pour un extracteur posé sur un biome de fusion (lisière, etc.).
 * Rate finale = rate × (1 + bonus).
 */
export const FUSION_TILE_PRODUCTION_BONUS = 0.2;

/** Prod par worker assigné (niveau 1) — dérivé du catalogue bâtiments. */
import {
  buildingMaxWorkersFromCatalog,
  buildingRateFromCatalog
} from "./buildings.ts";

export const LUMBER_CAMP_MAX_WORKERS = buildingMaxWorkersFromCatalog("lumber_camp") || 1;
export const FARM_MAX_WORKERS = buildingMaxWorkersFromCatalog("farm") || 1;
export const QUARRY_MAX_WORKERS = buildingMaxWorkersFromCatalog("quarry") || 1;
export const FISHING_HUT_MAX_WORKERS = buildingMaxWorkersFromCatalog("fishing_hut") || 1;

export const WOOD_RATE_PER_WORKER_PER_MINUTE =
  buildingRateFromCatalog("lumber_camp") || 5;
export const WHEAT_RATE_PER_WORKER_PER_MINUTE =
  buildingRateFromCatalog("farm") || 5;
export const STONE_RATE_PER_WORKER_PER_MINUTE =
  buildingRateFromCatalog("quarry") || 5;
export const FISHING_HUT_FOOD_RATE_PER_WORKER_PER_MINUTE =
  buildingRateFromCatalog("fishing_hut") || 2;


/** @deprecated Préférer TOWN_HALL_BASE_STORAGE (+ bonus bâtiments). Placeholders v0. */
export const WOOD_STOCK_CAP = 200;
export const WHEAT_STOCK_CAP = 200;
export const STONE_STOCK_CAP = 150;
export const FOOD_STOCK_CAP = TOWN_HALL_BASE_STORAGE;

/**
 * Éclats de monde — révélation de région.
 * Coût = hop (1 pour voisin du départ, 2 au rang suivant, …).
 * Prod MVP : hôtel de ville seul, 1 éclat / intervalle.
 */
export const WORLDSHARD_STOCK_CAP = 5;
/** Intervalle de prod HDV (15 min) — volontairement lent. */
export const TOWN_HALL_WORLDSHARD_INTERVAL_MS = 15 * 60_000;

/** Caps par resource_id — inventaire générique / craft. */
export const STOCK_CAP_BY_RESOURCE: Record<string, number> = {
  wood: WOOD_STOCK_CAP,
  wheat: WHEAT_STOCK_CAP,
  stone: STONE_STOCK_CAP,
  food: FOOD_STOCK_CAP,
  worldshard: WORLDSHARD_STOCK_CAP,
  planks: TOWN_HALL_BASE_STORAGE,
  flour: TOWN_HALL_BASE_STORAGE,
  stone_blocks: TOWN_HALL_BASE_STORAGE,
  iron_ore: TOWN_HALL_BASE_STORAGE,
  iron_ingot: TOWN_HALL_BASE_STORAGE,
  tools: TOWN_HALL_BASE_STORAGE
};

export function stockCapFor(resourceId: string): number {
  return STOCK_CAP_BY_RESOURCE[resourceId] ?? TOWN_HALL_BASE_STORAGE;
}

/** Assez pour poser un premier camp (plus d’expansion payée en bois). */
export const STARTING_WOOD = 30;
export const STARTING_WHEAT = 0;
export const STARTING_STONE = 0;
export const STARTING_FOOD = 0;
/** Un éclat pour la première région voisine ; ensuite prod HDV lente. */
export const STARTING_WORLDSHARD = 1;

/** Pop libre requise pour lancer un chantier (réservée sur le site). */
export const BUILD_IDLE_POP_REQUIREMENT = 1;

/**
 * Remboursement bois à la démolition d’un bâtiment achevé (DEC-style).
 * Chantier en cours → 100 % du coût (voir `woodRefundOnDestroy`).
 */
export const BUILD_DESTROY_COMPLETED_REFUND_RATIO = 0.5;

/** En `NODE_ENV !== "production"`, tous les chantiers durent 5 s. */
export const DEV_BUILD_DURATION_MS = 5_000;

/** @deprecated Expansion payée en éclats (worldshard), plus en bois. */
export const REGION_EXPANSION_BASE_WOOD = 30;
/** @deprecated */
export const REGION_EXPANSION_DISTANCE_EXPONENT = 1;
/** @deprecated */
export const REGION_EXPANSION_DISCOUNT_D1 = 0.2;
/** @deprecated */
export const REGION_EXPANSION_DISCOUNT_D2 = 0.05;
/** @deprecated */
export const REGION_EXPANSION_DISCOUNT_CAP = 0.5;
