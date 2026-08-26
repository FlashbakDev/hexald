import {
  buildingMaxWorkersFromCatalog,
  type PlaceableExtractorId
} from "@hexald/content";
import type { BuildingId, HexCoord } from "@hexald/shared";
import { isBuildingComplete } from "./construction.ts";
import { isPlaceableBuilding, isPlaceableExtractor } from "./build.ts";

export type TileWorkerState = {
  q: number;
  r: number;
  buildingId?: BuildingId | null;
  assignedWorkers?: number;
  defaultWorkerSeeded?: boolean;
  constructionCompletesAt?: number | string | Date | null;
};

export const WORKERS_PER_EXTRACTOR_L1 = 1 as const;

export function maxWorkersForBuilding(buildingId: BuildingId): number {
  return buildingMaxWorkersFromCatalog(buildingId);
}

export function workerTotalsFromTiles(
  tiles: readonly TileWorkerState[],
  now: number
): { woodcutters: number; farmers: number; quarriers: number } {
  let woodcutters = 0;
  let farmers = 0;
  let quarriers = 0;

  for (const tile of tiles) {
    if (!tile.buildingId || !isPlaceableExtractor(tile.buildingId)) continue;
    if (!isBuildingComplete(tile.constructionCompletesAt, now)) continue;
    const workers = clampTileWorkers(tile.assignedWorkers ?? 0, tile.buildingId);
    if (tile.buildingId === "lumber_camp") woodcutters += workers;
    else if (tile.buildingId === "farm") farmers += workers;
    else quarriers += workers;
  }

  return { woodcutters, farmers, quarriers };
}

/** Workers engagés sur un site (chantier ou bâtiment achevé) — hors pool HDV. */
export function committedWorkersFromTiles(tiles: readonly TileWorkerState[]): number {
  let total = 0;
  for (const tile of tiles) {
    if (!tile.buildingId || !isPlaceableBuilding(tile.buildingId)) continue;
    if (isPlaceableExtractor(tile.buildingId)) {
      total += clampTileWorkers(tile.assignedWorkers ?? 0, tile.buildingId);
      continue;
    }
    // Maisons / logements : 1 ouvrier réservé pendant le chantier uniquement.
    total += Math.max(0, Math.floor(tile.assignedWorkers ?? 0));
  }
  return total;
}

/**
 * Libère l’ouvrier de chantier sur les logements achevés (pas d’affectation permanente).
 */
export function releaseHousingConstructionWorkers<T extends TileWorkerState>(
  tiles: readonly T[],
  now: number
): { tiles: T[]; changed: boolean } {
  let changed = false;
  const next = tiles.map((tile) => {
    if (!tile.buildingId || !isPlaceableBuilding(tile.buildingId)) return tile;
    if (isPlaceableExtractor(tile.buildingId)) return tile;
    if (!isBuildingComplete(tile.constructionCompletesAt, now)) return tile;
    if ((tile.assignedWorkers ?? 0) <= 0 && tile.defaultWorkerSeeded) return tile;
    changed = true;
    return {
      ...tile,
      assignedWorkers: 0,
      defaultWorkerSeeded: true
    };
  });
  return { tiles: next, changed };
}

export function totalAssignedWorkers(
  tiles: readonly TileWorkerState[],
  _now?: number
): number {
  return committedWorkersFromTiles(tiles);
}

function clampTileWorkers(value: number, buildingId: BuildingId): number {
  const max = maxWorkersForBuilding(buildingId);
  if (max <= 0) return 0;
  return Math.min(max, Math.max(0, Math.floor(value)));
}

export type AssignTileWorkersResult =
  | { ok: true; tiles: TileWorkerState[] }
  | {
      ok: false;
      reason:
        | "tile_not_found"
        | "no_building"
        | "under_construction"
        | "invalid_count"
        | "over_population";
    };

/** Assigne 0 ou 1 worker sur un extracteur (chantier ou achevé). */
export function assignWorkersAtTile(
  tiles: readonly TileWorkerState[],
  origin: HexCoord,
  count: number,
  population: number,
  _now = Date.now()
): AssignTileWorkersResult {
  const index = tiles.findIndex((tile) => tile.q === origin.q && tile.r === origin.r);
  if (index < 0) return { ok: false, reason: "tile_not_found" };

  const tile = tiles[index]!;
  if (!tile.buildingId || !isPlaceableExtractor(tile.buildingId)) {
    return { ok: false, reason: "no_building" };
  }

  const max = maxWorkersForBuilding(tile.buildingId);
  if (!Number.isInteger(count) || count < 0 || count > max) {
    return { ok: false, reason: "invalid_count" };
  }

  const current = clampTileWorkers(tile.assignedWorkers ?? 0, tile.buildingId);
  const others = committedWorkersFromTiles(tiles) - current;
  if (others + count > population) {
    return { ok: false, reason: "over_population" };
  }

  const next = tiles.map((entry, i) =>
    i === index ? { ...entry, assignedWorkers: count } : entry
  );
  return { ok: true, tiles: next };
}

export function extractorJobForBuildingId(
  buildingId: PlaceableExtractorId
): "woodcutter" | "farmer" | "quarrier" {
  if (buildingId === "lumber_camp") return "woodcutter";
  if (buildingId === "farm") return "farmer";
  return "quarrier";
}

/** Assigne 1 worker par défaut sur chaque extracteur achevé non encore « seedé ». */
export function seedDefaultWorkersForCompletedTiles<
  T extends TileWorkerState
>(tiles: readonly T[], population: number, now: number): { tiles: T[]; changed: boolean } {
  let current = tiles.map((tile) => ({ ...tile }));
  let changed = false;

  for (const tile of current) {
    if (tile.defaultWorkerSeeded) continue;
    if (!tile.buildingId || !isPlaceableExtractor(tile.buildingId)) continue;
    if (!isBuildingComplete(tile.constructionCompletesAt, now)) continue;

    const result = assignWorkersAtTile(
      current,
      { q: tile.q, r: tile.r },
      1,
      population,
      now
    );
    if (!result.ok) continue;

    current = result.tiles.map((entry) => {
      const prev = current.find((row) => row.q === entry.q && row.r === entry.r);
      const seeded =
        entry.q === tile.q && entry.r === tile.r
          ? true
          : (prev?.defaultWorkerSeeded ?? false);
      return { ...entry, defaultWorkerSeeded: seeded } as T;
    });
    changed = true;
  }

  return { tiles: current, changed };
}
