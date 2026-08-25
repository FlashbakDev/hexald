import type { BiomeId, HexCoord, PrimaryBiomeId, Region } from "@hexald/shared";
import {
  HEX_DIRECTIONS,
  cubeDistance,
  hexKey,
  hexNeighbors,
  regionCells
} from "@hexald/shared";

export const START_REGION_CENTER: HexCoord = { q: 0, r: 0 };
export const START_REGION_BIOME: PrimaryBiomeId = "forest";

/** Rayon d’une région (centre + anneau). Taille 1 → 7 hex. */
export const REGION_RADIUS = 1;

/**
 * Distance cube entre centres de régions voisines (rayon 1 → 3).
 * Offsets « coin » : dir + 2×dir_suivante → (-1,3), (-3,2), (-2,-1), …
 */
export const REGION_STEP = 2 * REGION_RADIUS + 1;

const FUSION_WEIGHT = 0.2;
const SIDE_WEIGHT = 0.4;

const fusionTable: Record<string, BiomeId> = {
  "forest|plains": "forest_plains",
  "forest|mountain": "forest_mountain",
  "mountain|plains": "plains_mountain"
  // terre↔eau : pas de biome hybride — rivage = décor d’arête (style Civ).
};

/**
 * Les 6 centres voisins : dir + 2×suivante (pas les axes).
 * Ex. depuis (0,0) : (3,-2), (1,-3), (-2,-1), (-3,2), (-1,3), (2,1).
 */
export const REGION_NEIGHBOR_OFFSETS: HexCoord[] = HEX_DIRECTIONS.map((dir, i) => {
  const next = HEX_DIRECTIONS[(i + 1) % HEX_DIRECTIONS.length];
  return { q: dir.q + 2 * next.q, r: dir.r + 2 * next.r };
});

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function createStartingWorld(): {
  tiles: Map<string, BiomeId>;
  regions: Region[];
} {
  const tiles = new Map<string, BiomeId>();
  for (const cell of regionCells(START_REGION_CENTER)) {
    tiles.set(hexKey(cell.q, cell.r), START_REGION_BIOME);
  }
  return {
    tiles,
    regions: [{ center: START_REGION_CENTER, biome: START_REGION_BIOME }]
  };
}

export function isPrimaryBiome(biome: BiomeId): biome is PrimaryBiomeId {
  return (
    biome === "forest" ||
    biome === "plains" ||
    biome === "mountain" ||
    biome === "water"
  );
}

/** Hex entièrement aquatique (pas de bâtiments terrestres). */
export function isWaterBiome(biome: BiomeId): boolean {
  return biome === "water";
}

/**
 * Ancien type « côte biome » — plus utilisé.
 * Le rivage est un décor d’arête entre terre et eau.
 */
export function isCoastBiome(_biome: BiomeId): boolean {
  return false;
}

/** Sol où l’on peut poser des bâtiments terrestres (toute terre ; pas l’eau pure). */
export function isBuildableBiome(biome: BiomeId): boolean {
  return !isWaterBiome(biome);
}

/** Décompose un biome (fusion → ses deux parents). */
export function biomeInfluences(biome: BiomeId): PrimaryBiomeId[] {
  if (biome === "forest_plains") return ["forest", "plains"];
  if (biome === "plains_mountain") return ["plains", "mountain"];
  if (biome === "forest_mountain") return ["forest", "mountain"];
  return [biome];
}

/**
 * Fusion table terre↔terre, sinon le biome de région (`a`).
 * terre↔eau : tire l’un des deux parents (pas de tuile hybride).
 */
export function fusionBiome(
  a: PrimaryBiomeId,
  b: PrimaryBiomeId,
  random: () => number = Math.random
): BiomeId {
  if (a === b) return a;
  if (a === "water" || b === "water") return random() < 0.5 ? a : b;
  const key = [a, b].sort().join("|");
  return fusionTable[key] ?? a;
}

/**
 * Réseau des centres engendré par (3,-2) et (1,-3) :
 * (r + 3q) ≡ 0 et (−2q − 3r) ≡ 0 mod 7.
 */
export function isRegionLatticeCenter(cell: HexCoord): boolean {
  return mod(cell.r + 3 * cell.q, 7) === 0 && mod(-2 * cell.q - 3 * cell.r, 7) === 0;
}

/** Les 6 centres de régions voisines (±1 en coords de région). */
export function regionLatticeNeighbors(center: HexCoord): HexCoord[] {
  return REGION_NEIGHBOR_OFFSETS.map((offset) => ({
    q: center.q + offset.q,
    r: center.r + offset.r
  }));
}

/** Tous les centres candidats collés (±1) à au moins une région existante. */
export function adjacentRegionCenters(existingCenters: readonly HexCoord[]): HexCoord[] {
  const seen = new Set<string>();
  const out: HexCoord[] = [];
  for (const center of existingCenters) {
    for (const neighbor of regionLatticeNeighbors(center)) {
      const key = hexKey(neighbor.q, neighbor.r);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(neighbor);
    }
  }
  return out;
}

/**
 * Région rayon 1, centre sur le réseau modulo, voisin (±1) d’une région posée.
 * Le centre doit être vide. Les hex déjà créés dans l’empreinte sont ignorés
 * (jamais modifiés).
 */
export function canPlaceRegion(
  tiles: ReadonlyMap<string, BiomeId> | ReadonlySet<string>,
  center: HexCoord,
  existingCenters: readonly HexCoord[]
): boolean {
  if (!isRegionLatticeCenter(center)) return false;

  const has = (q: number, r: number) =>
    tiles instanceof Map ? tiles.has(hexKey(q, r)) : tiles.has(hexKey(q, r));

  if (has(center.q, center.r)) return false;

  if (!existingCenters.some((other) => cubeDistance(center, other) === REGION_STEP)) {
    return false;
  }

  let emptyCount = 0;
  for (const cell of regionCells(center)) {
    if (!has(cell.q, cell.r)) emptyCount += 1;
  }
  return emptyCount > 0;
}

/**
 * Sans voisin connu → biome de la région.
 * Avec voisins → 40 % région, 40 % autre influence, 20 % fusion.
 */
export function resolveCellBiome(
  regionBiome: PrimaryBiomeId,
  neighborBiomes: readonly BiomeId[],
  random: () => number = Math.random
): BiomeId {
  if (neighborBiomes.length === 0) return regionBiome;

  const influences = new Set<PrimaryBiomeId>();
  for (const biome of neighborBiomes) {
    for (const primary of biomeInfluences(biome)) influences.add(primary);
  }
  influences.add(regionBiome);

  if (influences.size === 1) return regionBiome;

  let other: PrimaryBiomeId | undefined;
  for (const biome of neighborBiomes) {
    for (const primary of biomeInfluences(biome)) {
      if (primary !== regionBiome) {
        other = primary;
        break;
      }
    }
    if (other) break;
  }
  if (!other) return regionBiome;

  const roll = random();
  if (roll < SIDE_WEIGHT) return regionBiome;
  if (roll < SIDE_WEIGHT * 2) return other;
  return fusionBiome(regionBiome, other, random);
}

export type GeneratedTile = HexCoord & { biome: BiomeId };

/** Crée uniquement les hex encore non révélés de l’empreinte. */
export function generateRegionTiles(
  tiles: ReadonlyMap<string, BiomeId>,
  center: HexCoord,
  regionBiome: PrimaryBiomeId,
  existingCenters: readonly HexCoord[],
  random: () => number = Math.random
): GeneratedTile[] {
  if (!canPlaceRegion(tiles, center, existingCenters)) return [];

  const created: GeneratedTile[] = [];
  for (const cell of regionCells(center)) {
    const key = hexKey(cell.q, cell.r);
    if (tiles.has(key)) continue;

    const neighborBiomes: BiomeId[] = [];
    for (const neighbor of hexNeighbors(cell)) {
      const biome = tiles.get(hexKey(neighbor.q, neighbor.r));
      if (biome) neighborBiomes.push(biome);
    }

    created.push({
      q: cell.q,
      r: cell.r,
      biome: resolveCellBiome(regionBiome, neighborBiomes, random)
    });
  }

  return created;
}
