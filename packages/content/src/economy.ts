/** Population + extracteurs v0 (DEC-013 / DEC-014). */

export const STARTING_POPULATION = 8;
export const POPULATION_CAP = 12;

export const LUMBER_CAMP_MAX_WORKERS = 4;
export const FARM_MAX_WORKERS = 4;
export const QUARRY_MAX_WORKERS = 4;

export const WOOD_RATE_PER_WORKER_PER_HOUR = 12;
export const WHEAT_RATE_PER_WORKER_PER_HOUR = 10;
export const STONE_RATE_PER_WORKER_PER_HOUR = 8;

export const WOOD_STOCK_CAP = 200;
export const WHEAT_STOCK_CAP = 200;
export const STONE_STOCK_CAP = 150;

export const STARTING_WOOD = 30;
export const STARTING_WHEAT = 0;
export const STARTING_STONE = 0;

/** Bâtiments extracteurs posables (1 max chacun). */
export const PLACEABLE_EXTRACTORS = ["lumber_camp", "farm", "quarry"] as const;
export type PlaceableExtractorId = (typeof PLACEABLE_EXTRACTORS)[number];
