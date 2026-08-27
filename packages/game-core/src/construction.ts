import {
  DEV_BUILD_DURATION_MS,
  buildingDurationMsFromCatalog,
  isPlaceableBuildingId,
  type PlaceableBuildingId
} from "@hexald/content";
import type { BuildingId } from "@hexald/shared";

export type ConstructionTimeInput = {
  /** `true` = accélération debug (5 s), pas seulement NODE_ENV. */
  isDev?: boolean;
};

export function resolveBuildDurationMs(
  buildingId: PlaceableBuildingId,
  options: ConstructionTimeInput = {}
): number {
  if (options.isDev) return DEV_BUILD_DURATION_MS;
  return buildingDurationMsFromCatalog(buildingId);
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
  buildingId: PlaceableBuildingId,
  now: number,
  options: ConstructionTimeInput = {}
): { buildingId: PlaceableBuildingId; constructionCompletesAt: number } {
  if (!isPlaceableBuildingId(buildingId)) {
    throw new Error(`not_placeable:${buildingId}`);
  }
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
