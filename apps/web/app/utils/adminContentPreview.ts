import type {
  BiomeId,
  BuildingId,
  PoiId,
  WorldRegionSnapshot,
  WorldTileSnapshot
} from "@hexald/shared";
import { HEX_DIRECTIONS, regionCells } from "@hexald/shared";
import {
  getBuildingDefinition,
  getPoiDefinition,
  type BuildingDefinition
} from "@hexald/content";

/** Focus hors (0,0) pour un cadrage admin propre (caméra lookAt). */
export const ADMIN_PREVIEW_FOCUS = { q: 3, r: -1 } as const;

/** Bâtiments avec mesh Three.js dans createHexScene. */
export const BUILDINGS_WITH_MESH = new Set<BuildingId>([
  "lumber_camp",
  "farm",
  "quarry",
  "fishing_hut",
  "house",
  "sawmill",
  "mill",
  "smelter",
  "clay_mine",
  "mine",
  "brickworks",
  "library",
  "barracks",
  "market"
]);

export type AdminPreviewWorld = {
  tiles: WorldTileSnapshot[];
  regions: WorldRegionSnapshot[];
};

function tile(
  q: number,
  r: number,
  biome: BiomeId,
  extras: Partial<WorldTileSnapshot> = {}
): WorldTileSnapshot {
  return { q, r, biome, ...extras };
}

function regionFor(biome: BiomeId): WorldRegionSnapshot {
  return {
    center: { q: ADMIN_PREVIEW_FOCUS.q, r: ADMIN_PREVIEW_FOCUS.r },
    biome
  };
}

const FUSION_NEIGHBORS: Partial<Record<BiomeId, [BiomeId, BiomeId]>> = {
  forest_plains: ["forest", "plains"],
  plains_mountain: ["plains", "mountain"],
  forest_mountain: ["forest", "mountain"]
};

function isFusionBiome(biome: BiomeId): boolean {
  return biome in FUSION_NEIGHBORS;
}

/** Région rayon 1 (centre + 6) — variations décor / teinte par tuile. */
function withFullRegion(biome: BiomeId): AdminPreviewWorld {
  const center = {
    q: ADMIN_PREVIEW_FOCUS.q,
    r: ADMIN_PREVIEW_FOCUS.r
  };
  return {
    tiles: regionCells(center).map((cell) => tile(cell.q, cell.r, biome)),
    regions: [regionFor(biome)]
  };
}

function withLandNeighbor(
  focusBiome: BiomeId,
  focusExtras: Partial<WorldTileSnapshot> = {}
): AdminPreviewWorld {
  const { q, r } = ADMIN_PREVIEW_FOCUS;
  const dir = HEX_DIRECTIONS[0]!;
  const nq = q + dir.q;
  const nr = r + dir.r;
  return {
    tiles: [tile(q, r, focusBiome, focusExtras), tile(nq, nr, "plains")],
    regions: [regionFor(focusBiome)]
  };
}

function withFusionContext(fusion: BiomeId): AdminPreviewWorld {
  const parents = FUSION_NEIGHBORS[fusion];
  const { q, r } = ADMIN_PREVIEW_FOCUS;
  const tiles: WorldTileSnapshot[] = [tile(q, r, fusion)];
  if (parents) {
    const d0 = HEX_DIRECTIONS[0]!;
    const d1 = HEX_DIRECTIONS[3]!;
    tiles.push(tile(q + d0.q, r + d0.r, parents[0]));
    tiles.push(tile(q + d1.q, r + d1.r, parents[1]));
  }
  return { tiles, regions: [regionFor(fusion)] };
}

export function previewWorldForBiome(biome: BiomeId): AdminPreviewWorld {
  // Fusions : tuile seule + voisins parents (contexte lisière), pas une région mono-biome.
  if (isFusionBiome(biome)) return withFusionContext(biome);
  return withFullRegion(biome);
}

function terrainBiomeForBuilding(def: BuildingDefinition): BiomeId {
  if (def.terrain === "any") return "plains";
  if (def.terrain === "water") return "water";
  return def.terrain;
}

export function previewWorldForBuilding(buildingId: BuildingId): AdminPreviewWorld {
  const def = getBuildingDefinition(buildingId);
  if (!def) {
    return withFullRegion("plains");
  }
  const biome = terrainBiomeForBuilding(def);
  const extras: Partial<WorldTileSnapshot> = {
    buildingId,
    constructionCompletesAt: null
  };
  if (def.requiredPoiId) {
    extras.poiId = def.requiredPoiId;
  }
  if (biome === "water" || def.requiredPoiId === "fish_bank") {
    return withLandNeighbor(biome, extras);
  }
  const { q, r } = ADMIN_PREVIEW_FOCUS;
  return {
    tiles: [tile(q, r, biome, extras)],
    regions: [regionFor(biome)]
  };
}

export function previewWorldForPoi(poiId: PoiId): AdminPreviewWorld {
  const def = getPoiDefinition(poiId);
  const biome = def?.biomes[0] ?? "plains";
  if (def?.coastalWaterOnly || biome === "water") {
    return withLandNeighbor(biome, { poiId });
  }
  const { q, r } = ADMIN_PREVIEW_FOCUS;
  return {
    tiles: [tile(q, r, biome, { poiId })],
    regions: [regionFor(biome)]
  };
}

export function buildingHasMesh(id: BuildingId): boolean {
  return BUILDINGS_WITH_MESH.has(id);
}

/** Zoom un peu plus large pour une région 7 hex (biomes non-fusion). */
export function previewViewSize(tab: string, biomeId?: string): number {
  if (tab === "biomes" && biomeId && !isFusionBiome(biomeId as BiomeId)) {
    return 5.6;
  }
  return 4.2;
}
