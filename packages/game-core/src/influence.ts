import { buildingInfluenceRadius } from "@hexald/content";
import type { BuildingId, HexCoord } from "@hexald/shared";
import { hexDisk, hexKey } from "@hexald/shared";
import { isBuildingComplete } from "./construction.ts";
import { START_REGION_CENTER } from "./world.ts";

/** Rayon d’ancre du village de départ (DEC-026). */
export const ORIGIN_INFLUENCE_RADIUS = 1;

export type InfluenceTileInput = {
  q: number;
  r: number;
  buildingId?: BuildingId | null;
  constructionCompletesAt?: number | string | Date | null;
};

export function influenceRadiusForBuilding(buildingId: BuildingId): number {
  return buildingInfluenceRadius(buildingId);
}

/**
 * Emprise connectée au village (DEC-026).
 * Seed : disque autour de l’origine. Puis chaque bâtiment achevé dont la tuile
 * est déjà influencée étend le disque. Les îlots isolés ne comptent pas.
 */
export function computeInfluencedTiles(
  tiles: readonly InfluenceTileInput[],
  now: number,
  origin: HexCoord = START_REGION_CENTER
): Set<string> {
  const influenced = new Set<string>();

  const addDisk = (center: HexCoord, radius: number) => {
    for (const cell of hexDisk(center, radius)) {
      influenced.add(hexKey(cell.q, cell.r));
    }
  };

  addDisk(origin, ORIGIN_INFLUENCE_RADIUS);

  type Site = { q: number; r: number; radius: number };
  const candidates: Site[] = [];
  for (const tile of tiles) {
    if (!tile.buildingId) continue;
    if (!isBuildingComplete(tile.constructionCompletesAt, now)) continue;
    candidates.push({
      q: tile.q,
      r: tile.r,
      radius: influenceRadiusForBuilding(tile.buildingId)
    });
  }

  const used = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const site of candidates) {
      const key = hexKey(site.q, site.r);
      if (used.has(key)) continue;
      if (!influenced.has(key)) continue;
      used.add(key);
      addDisk({ q: site.q, r: site.r }, site.radius);
      grew = true;
    }
  }

  return influenced;
}

export function isTileInfluenced(
  tiles: readonly InfluenceTileInput[],
  origin: HexCoord,
  now: number,
  worldOrigin: HexCoord = START_REGION_CENTER
): boolean {
  return computeInfluencedTiles(tiles, now, worldOrigin).has(
    hexKey(origin.q, origin.r)
  );
}

/**
 * Bâtiment achevé hors emprise connectée → orphelin (inutilisable).
 * Les chantiers hors emprise sont aussi « hors influence » mais pas orphelins.
 */
export function isBuildingOrphan(
  tile: InfluenceTileInput,
  influenced: ReadonlySet<string>,
  now: number
): boolean {
  if (!tile.buildingId) return false;
  if (!isBuildingComplete(tile.constructionCompletesAt, now)) return false;
  return !influenced.has(hexKey(tile.q, tile.r));
}

/** Tuile avec bâtiment (chantier ou achevé) hors emprise. */
export function isBuildingOutsideInfluence(
  tile: InfluenceTileInput,
  influenced: ReadonlySet<string>
): boolean {
  if (!tile.buildingId) return false;
  return !influenced.has(hexKey(tile.q, tile.r));
}

/**
 * Remet à 0 les ouvriers / craft des tuiles hors emprise (après démo, settle…).
 */
export function releaseWorkersOutsideInfluence<T extends InfluenceTileInput & {
  assignedWorkers?: number;
  processorInputBuffer?: number;
  craftCompletesAt?: number | null;
}>(
  tiles: readonly T[],
  now: number,
  worldOrigin: HexCoord = START_REGION_CENTER
): { tiles: T[]; changed: boolean; influenced: Set<string> } {
  const influenced = computeInfluencedTiles(tiles, now, worldOrigin);
  let changed = false;
  const next = tiles.map((tile) => {
    if (!isBuildingOutsideInfluence(tile, influenced)) return tile;
    const workers = tile.assignedWorkers ?? 0;
    const buffer = tile.processorInputBuffer ?? 0;
    const craft = tile.craftCompletesAt ?? null;
    if (workers <= 0 && buffer <= 0 && craft == null) return tile;
    changed = true;
    return {
      ...tile,
      assignedWorkers: 0,
      processorInputBuffer: 0,
      craftCompletesAt: null
    };
  });
  return { tiles: next, changed, influenced };
}
