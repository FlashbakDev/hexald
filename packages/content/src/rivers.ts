/**
 * Chance de base qu’un lac (source) apparaisse dans une nouvelle région
 * (si aucun fleuve n’y entre). Modulée par la distance au lac le plus proche.
 */
export const RIVER_LAKE_BASE_CHANCE = 0.35;

/**
 * Distance (cube) à laquelle la chance atteint ~63 % de la base
 * (1 − e^(−d/s)). Plus un lac est proche, moins un nouveau lac spawn.
 */
export const RIVER_LAKE_DIST_SCALE = 3;

/**
 * Chance qu’une nouvelle région collée à un lac sans fleuve
 * démarre un cours depuis ce lac.
 */
export const RIVER_FROM_LAKE_CHANCE = 0.55;

/** @deprecated */
export const RIVER_ARM_SPAWN_CHANCE = RIVER_LAKE_BASE_CHANCE;
/** @deprecated */
export const RIVER_SPAWN_CHANCE = RIVER_LAKE_BASE_CHANCE;
