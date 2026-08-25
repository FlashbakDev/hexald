import {
  BUILD_DURATION_MS,
  DEV_BUILD_DURATION_MS,
  type PlaceableExtractorId
} from "@hexald/content";
import type { BuildingId } from "@hexald/shared";

export type ConstructionTimeInput = {
  /** `true` en environnement de développement (override 5 s). */
  isDev?: boolean;
};

export function resolveBuildDurationMs(
  buildingId: PlaceableExtractorId,
  options: ConstructionTimeInput = {}
): number {
  if (options.isDev) return DEV_BUILD_DURATION_MS;
  return BUILD_DURATION_MS[buildingId];
}

/**
 * `null` / absent = déjà achevé (tuiles legacy ou chantier terminé nettoyé).
 * Sinon terminé dès que `now >= completesAt`.
 */
export function isBuildingComplete(
  constructionCompletesAt: number | string | Date | null | undefined,
  now: number
): boolean {
  if (constructionCompletesAt == null) return true;
  const endsAt =
    typeof constructionCompletesAt === "number"
      ? constructionCompletesAt
      : new Date(constructionCompletesAt).getTime();
  if (Number.isNaN(endsAt)) return true;
  return now >= endsAt;
}

export function isBuildingUnderConstruction(
  constructionCompletesAt: number | string | Date | null | undefined,
  now: number
): boolean {
  return !isBuildingComplete(constructionCompletesAt, now);
}

export function startConstruction(
  buildingId: PlaceableExtractorId,
  now: number,
  options: ConstructionTimeInput = {}
): { buildingId: PlaceableExtractorId; constructionCompletesAt: number } {
  const durationMs = resolveBuildDurationMs(buildingId, options);
  return {
    buildingId,
    constructionCompletesAt: now + durationMs
  };
}

export function hasCompletedBuilding(
  tiles: readonly {
    buildingId?: BuildingId | null;
    constructionCompletesAt?: number | string | Date | null;
  }[],
  buildingId: BuildingId,
  now: number
): boolean {
  return tiles.some(
    (tile) =>
      tile.buildingId === buildingId &&
      isBuildingComplete(tile.constructionCompletesAt, now)
  );
}

export function countBuildingSites(
  tiles: readonly { buildingId?: BuildingId | null }[],
  buildingId: BuildingId
): number {
  return tiles.filter((tile) => tile.buildingId === buildingId).length;
}
