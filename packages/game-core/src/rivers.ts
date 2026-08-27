import type { BiomeId, HexCoord, PoiId, RiverTip } from "@hexald/shared";
import {
  HEX_DIRECTIONS,
  cubeDistance,
  hexKey,
  hexNeighbors
} from "@hexald/shared";
import {
  RIVER_FROM_LAKE_CHANCE,
  RIVER_LAKE_BASE_CHANCE,
  RIVER_LAKE_DIST_SCALE
} from "@hexald/content";

const MAX_FLOW_STEPS = 48;
/** Bits 0–5 = arêtes ; bits 8–10 = sommet de sortie lac (1..6). */
const RIVER_EDGE_BITS = 0x3f;
const LAKE_VERTEX_SHIFT = 8;

function isLandBiome(biome: BiomeId) {
  return biome !== "water";
}

function oppositeDir(dir: number) {
  return (dir + 3) % 6;
}

function hasBit(mask: number, dir: number) {
  return (mask & (1 << dir)) !== 0;
}

export function riverEdgeBits(mask: number): number {
  return mask & RIVER_EDGE_BITS;
}

export function lakeOutflowVertexFromMask(mask: number): number | null {
  const stored = (mask >> LAKE_VERTEX_SHIFT) & 0x7;
  if (stored < 1 || stored > 6) return null;
  return stored - 1;
}

export function withLakeOutflowVertex(mask: number, vertex: number): number {
  const v = ((vertex % 6) + 6) % 6;
  return (mask & RIVER_EDGE_BITS) | ((v + 1) << LAKE_VERTEX_SHIFT);
}

function neighborKey(q: number, r: number, dir: number) {
  const d = HEX_DIRECTIONS[dir]!;
  return hexKey(q + d.q, r + d.r);
}

function touchesWater(
  biomes: ReadonlyMap<string, BiomeId>,
  q: number,
  r: number
) {
  for (const n of hexNeighbors({ q, r })) {
    if (biomes.get(hexKey(n.q, n.r)) === "water") return true;
  }
  return false;
}

/** Distance land → tuile adjacente à l’eau (0 = touche déjà la mer). */
function buildWaterDistance(
  biomes: ReadonlyMap<string, BiomeId>
): Map<string, number> {
  const dist = new Map<string, number>();
  const queue: HexCoord[] = [];

  for (const [key, biome] of biomes) {
    if (!isLandBiome(biome)) continue;
    const [q, r] = key.split(",").map(Number) as [number, number];
    if (touchesWater(biomes, q, r)) {
      dist.set(key, 0);
      queue.push({ q, r });
    }
  }

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const d = dist.get(hexKey(cur.q, cur.r))!;
    for (const n of hexNeighbors(cur)) {
      const nKey = hexKey(n.q, n.r);
      const nb = biomes.get(nKey);
      if (!nb || !isLandBiome(nb) || dist.has(nKey)) continue;
      dist.set(nKey, d + 1);
      queue.push(n);
    }
  }
  return dist;
}

function setEdge(
  masks: Map<string, number>,
  biomes: ReadonlyMap<string, BiomeId>,
  q: number,
  r: number,
  dir: number
): boolean {
  const d = HEX_DIRECTIONS[dir];
  if (!d) return false;
  const nq = q + d.q;
  const nr = r + d.r;
  const key = hexKey(q, r);
  const nKey = hexKey(nq, nr);
  const a = biomes.get(key);
  const b = biomes.get(nKey);
  if (!a || !b || !isLandBiome(a) || !isLandBiome(b)) return false;
  masks.set(key, (masks.get(key) ?? 0) | (1 << dir));
  masks.set(nKey, (masks.get(nKey) ?? 0) | (1 << oppositeDir(dir)));
  return true;
}

/**
 * Chance de lac : base × (1 − e^(−d/s)).
 * d = 0 → 0 ; pas de lac existant → base pleine.
 */
export function lakeSpawnChance(minDistToLake: number | null): number {
  if (minDistToLake == null || !Number.isFinite(minDistToLake)) {
    return RIVER_LAKE_BASE_CHANCE;
  }
  const d = Math.max(0, minDistToLake);
  return (
    RIVER_LAKE_BASE_CHANCE * (1 - Math.exp(-d / RIVER_LAKE_DIST_SCALE))
  );
}

function minDistToLakes(
  createdKeys: ReadonlySet<string>,
  lakes: readonly HexCoord[]
): number | null {
  if (lakes.length === 0) return null;
  let best = Infinity;
  for (const key of createdKeys) {
    const [q, r] = key.split(",").map(Number) as [number, number];
    for (const lake of lakes) {
      best = Math.min(best, cubeDistance({ q, r }, lake));
    }
  }
  return Number.isFinite(best) ? best : null;
}

/** La région créée contient ou touche de l’eau. */
function regionNearSea(
  biomes: ReadonlyMap<string, BiomeId>,
  createdKeys: ReadonlySet<string>
): boolean {
  for (const key of createdKeys) {
    const biome = biomes.get(key);
    if (biome === "water") return true;
    const [q, r] = key.split(",").map(Number) as [number, number];
    if (touchesWater(biomes, q, r)) return true;
  }
  return false;
}

function adjacentWaterTile(
  biomes: ReadonlyMap<string, BiomeId>,
  q: number,
  r: number
): HexCoord | null {
  for (const n of hexNeighbors({ q, r })) {
    if (biomes.get(hexKey(n.q, n.r)) === "water") return n;
  }
  return null;
}

type StepChoice = {
  dir: number;
  frontier: boolean;
  toWater: boolean;
  waterDist: number;
};

function chooseNextDir(
  biomes: ReadonlyMap<string, BiomeId>,
  masks: Map<string, number>,
  waterDist: Map<string, number>,
  q: number,
  r: number,
  forbidDir: number | null,
  random: () => number,
  confineTo: ReadonlySet<string> | null,
  preferSea: boolean
): StepChoice | null {
  const options: StepChoice[] = [];

  for (let dir = 0; dir < 6; dir += 1) {
    if (forbidDir != null && dir === forbidDir) continue;
    const d = HEX_DIRECTIONS[dir]!;
    const nq = q + d.q;
    const nr = r + d.r;
    const nKey = hexKey(nq, nr);
    const nb = biomes.get(nKey);

    if (nb == null) {
      if (preferSea) continue; // on cherche la mer, pas le vide
      options.push({
        dir,
        frontier: true,
        toWater: false,
        waterDist: 999
      });
      continue;
    }

    if (nb === "water") {
      if (preferSea) {
        options.push({
          dir,
          frontier: false,
          toWater: true,
          waterDist: -1
        });
      }
      continue;
    }

    if (!isLandBiome(nb)) continue;
    if (confineTo && !confineTo.has(nKey)) continue;
    if (hasBit(masks.get(hexKey(q, r)) ?? 0, dir)) continue;

    options.push({
      dir,
      frontier: false,
      toWater: false,
      waterDist: waterDist.get(nKey) ?? 999
    });
  }

  if (options.length === 0) return null;

  options.sort((a, b) => {
    if (preferSea) {
      if (a.toWater !== b.toWater) return a.toWater ? -1 : 1;
      if (a.waterDist !== b.waterDist) return a.waterDist - b.waterDist;
    } else {
      if (a.frontier !== b.frontier) return a.frontier ? -1 : 1;
      if (a.waterDist !== b.waterDist) return b.waterDist - a.waterDist;
    }
    return random() - 0.5;
  });

  return options[0]!;
}

type FlowResult = {
  tip: RiverTip | null;
  /** Tuile eau atteinte → estuaire. */
  estuary: HexCoord | null;
};

/**
 * Trace un seul cours. `preferSea` : vise la mer ; sinon vise une case vierge.
 */
function carveFlow(
  biomes: ReadonlyMap<string, BiomeId>,
  masks: Map<string, number>,
  waterDist: Map<string, number>,
  startQ: number,
  startR: number,
  firstDir: number,
  random: () => number,
  confineTo: ReadonlySet<string> | null,
  preferSea: boolean
): FlowResult {
  let q = startQ;
  let r = startR;
  let dir = firstDir;

  for (let step = 0; step < MAX_FLOW_STEPS; step += 1) {
    // Déjà collé à la mer et on la vise → estuaire.
    if (preferSea) {
      const sea = adjacentWaterTile(biomes, q, r);
      if (sea) return { tip: null, estuary: sea };
    }

    const d = HEX_DIRECTIONS[dir];
    if (!d) return { tip: null, estuary: null };
    const nq = q + d.q;
    const nr = r + d.r;
    const nKey = hexKey(nq, nr);
    const nb = biomes.get(nKey);

    if (nb == null) {
      return preferSea
        ? { tip: null, estuary: null }
        : { tip: { q, r, dir }, estuary: null };
    }

    if (nb === "water") {
      return preferSea
        ? { tip: null, estuary: { q: nq, r: nr } }
        : { tip: null, estuary: null };
    }

    if (!isLandBiome(nb)) {
      return { tip: null, estuary: null };
    }

    if (confineTo && !confineTo.has(nKey)) {
      return preferSea
        ? { tip: null, estuary: null }
        : { tip: { q, r, dir }, estuary: null };
    }

    const already = hasBit(masks.get(hexKey(q, r)) ?? 0, dir);
    if (already) {
      // Suivre le cours existant.
      q = nq;
      r = nr;
    } else if (!setEdge(masks, biomes, q, r, dir)) {
      return { tip: null, estuary: null };
    } else {
      q = nq;
      r = nr;
    }

    if (preferSea) {
      const sea = adjacentWaterTile(biomes, q, r);
      if (sea) return { tip: null, estuary: sea };
    }

    const next = chooseNextDir(
      biomes,
      masks,
      waterDist,
      q,
      r,
      oppositeDir(dir),
      random,
      confineTo,
      preferSea
    );
    if (!next) {
      return preferSea
        ? { tip: null, estuary: null }
        : { tip: { q, r, dir }, estuary: null };
    }
    if (next.toWater) {
      const sea = adjacentWaterTile(biomes, q, r);
      return { tip: null, estuary: sea };
    }
    if (next.frontier) {
      return { tip: { q, r, dir: next.dir }, estuary: null };
    }
    dir = next.dir;
  }

  return { tip: { q, r, dir }, estuary: null };
}

function pickFrontierDir(
  biomes: ReadonlyMap<string, BiomeId>,
  q: number,
  r: number,
  random: () => number
): number | null {
  const dirs: number[] = [];
  for (let dir = 0; dir < 6; dir += 1) {
    if (!biomes.has(neighborKey(q, r, dir))) dirs.push(dir);
  }
  if (dirs.length === 0) return null;
  return dirs[Math.floor(random() * dirs.length)]!;
}

/**
 * Départ de fleuve depuis un lac : uniquement un sommet dont les DEUX hex
 * voisins viennent d’être générés (étaient vierges). Sinon pas de rivière.
 */
function listLakeStartsIntoCreated(
  biomes: ReadonlyMap<string, BiomeId>,
  createdKeys: ReadonlySet<string>,
  q: number,
  r: number
): { vertex: number; edge: number }[] {
  const options: { vertex: number; edge: number }[] = [];

  for (let v = 0; v < 6; v += 1) {
    const e0 = v;
    const e1 = (v + 1) % 6;
    const k0 = neighborKey(q, r, e0);
    const k1 = neighborKey(q, r, e1);
    // Les deux doivent être dans la nouvelle région (ex-vierges).
    if (!createdKeys.has(k0) || !createdKeys.has(k1)) continue;

    const b0 = biomes.get(k0);
    const b1 = biomes.get(k1);
    if (!b0 || !b1 || !isLandBiome(b0) || !isLandBiome(b1)) continue;

    // Les deux arêtes du coin sont valides ; le choix se fait au tirage.
    options.push({ vertex: v, edge: e0 });
    options.push({ vertex: v, edge: e1 });
  }

  return options;
}

function pickLakeStartIntoCreated(
  biomes: ReadonlyMap<string, BiomeId>,
  createdKeys: ReadonlySet<string>,
  q: number,
  r: number,
  random: () => number
): { vertex: number; edge: number } | null {
  const options = listLakeStartsIntoCreated(biomes, createdKeys, q, r);
  if (options.length === 0) return null;
  return options[Math.floor(random() * options.length)]!;
}

function lakeHasRiver(
  masks: ReadonlyMap<string, number>,
  tips: readonly RiverTip[],
  q: number,
  r: number
): boolean {
  if (riverEdgeBits(masks.get(hexKey(q, r)) ?? 0) !== 0) return true;
  return tips.some((tip) => tip.q === q && tip.r === r);
}

/** Lacs sans fleuve qui ont un coin à 2 hex nouvellement générés (ex-vierges). */
function lakesAdjacentToCreated(
  biomes: ReadonlyMap<string, BiomeId>,
  createdKeys: ReadonlySet<string>,
  lakes: readonly HexCoord[],
  masks: ReadonlyMap<string, number>,
  tips: readonly RiverTip[]
): HexCoord[] {
  const out: HexCoord[] = [];
  for (const lake of lakes) {
    if (lakeHasRiver(masks, tips, lake.q, lake.r)) continue;
    if (biomes.get(hexKey(lake.q, lake.r)) == null) continue;
    if (listLakeStartsIntoCreated(biomes, createdKeys, lake.q, lake.r).length === 0) {
      continue;
    }
    out.push(lake);
  }
  return out;
}

function pickSeaDir(
  biomes: ReadonlyMap<string, BiomeId>,
  waterDist: Map<string, number>,
  q: number,
  r: number,
  random: () => number
): number | null {
  const choice = chooseNextDir(
    biomes,
    new Map(),
    waterDist,
    q,
    r,
    null,
    random,
    null,
    true
  );
  return choice?.dir ?? null;
}

/** Arête incidente au sommet pour démarrer / prolonger le cours. */
function pickEdgeFromVertex(
  biomes: ReadonlyMap<string, BiomeId>,
  waterDist: Map<string, number>,
  q: number,
  r: number,
  vertex: number,
  random: () => number,
  preferSea: boolean,
  preferCreated: ReadonlySet<string> | null
): { dir: number; frontier: boolean; toWater: boolean } | null {
  const options: {
    dir: number;
    frontier: boolean;
    toWater: boolean;
    score: number;
  }[] = [];

  for (const dir of [vertex, (vertex + 1) % 6]) {
    const nKey = neighborKey(q, r, dir);
    const nb = biomes.get(nKey);
    if (nb == null) {
      if (preferSea) continue;
      options.push({ dir, frontier: true, toWater: false, score: 0 });
      continue;
    }
    if (nb === "water") {
      if (preferSea) {
        options.push({ dir, frontier: false, toWater: true, score: -1 });
      }
      continue;
    }
    if (!isLandBiome(nb)) continue;
    if (preferCreated && !preferCreated.has(nKey)) continue;
    options.push({
      dir,
      frontier: false,
      toWater: false,
      score: preferSea ? (waterDist.get(nKey) ?? 999) : -2
    });
  }

  if (options.length === 0) return null;
  options.sort((a, b) => {
    if (preferSea) {
      if (a.toWater !== b.toWater) return a.toWater ? -1 : 1;
      return a.score - b.score || random() - 0.5;
    }
    if (a.frontier !== b.frontier) return a.frontier ? -1 : 1;
    return a.score - b.score || random() - 0.5;
  });
  const best = options[0]!;
  return { dir: best.dir, frontier: best.frontier, toWater: best.toWater };
}

export type AssignRiversInput = {
  biomes: ReadonlyMap<string, BiomeId>;
  existingMasks: ReadonlyMap<string, number>;
  tips: readonly RiverTip[];
  createdKeys: ReadonlySet<string>;
  /** Lacs déjà présents sur la carte. */
  existingLakes: readonly HexCoord[];
  random?: () => number;
};

export type AssignRiversResult = {
  tileMasks: Map<string, number>;
  tips: RiverTip[];
  poiByKey: Map<string, PoiId>;
};

/**
 * Génération rivière (1 fleuve ou 0) :
 * - Si un tip entre dans la région → continuer (pas de nouveau lac).
 * - Sinon, si la région touche un lac sans fleuve → chance de démarrer un cours.
 * - Sinon chance de lac seul (sans sortie ; le fleuve se décide plus tard).
 */
export function assignRivers(input: AssignRiversInput): AssignRiversResult {
  const random = input.random ?? Math.random;
  const biomes = input.biomes;
  const masks = new Map<string, number>();
  for (const [key, mask] of input.existingMasks) {
    if (mask) masks.set(key, mask);
  }

  const waterDist = buildWaterDistance(biomes);
  const preferSea = regionNearSea(biomes, input.createdKeys);
  const nextTips: RiverTip[] = [];
  const tipSeen = new Set<string>();
  const poiByKey = new Map<string, PoiId>();

  const pushTip = (tip: RiverTip | null) => {
    if (!tip) return;
    const id = `${tip.q},${tip.r},${tip.dir},${tip.atVertex ? "v" : "e"}`;
    if (tipSeen.has(id)) return;
    tipSeen.add(id);
    nextTips.push(tip);
  };

  const runFlow = (
    startQ: number,
    startR: number,
    startDir: number
  ): FlowResult => {
    if (preferSea) {
      const toSea = carveFlow(
        biomes,
        masks,
        waterDist,
        startQ,
        startR,
        startDir,
        random,
        input.createdKeys,
        true
      );
      if (toSea.estuary) return toSea;
      // Mer inatteignable dans la région → retomber vers une case vierge.
    }
    return carveFlow(
      biomes,
      masks,
      waterDist,
      startQ,
      startR,
      startDir,
      random,
      input.createdKeys,
      false
    );
  };

  const applyEstuary = (sea: HexCoord | null) => {
    if (!sea) return;
    poiByKey.set(hexKey(sea.q, sea.r), "estuary");
  };

  // Tips qui aboutissent dans / vers la région créée.
  const incoming: RiverTip[] = [];
  for (const tip of input.tips) {
    if (tip.dir < 0 || tip.dir > 5) continue;

    if (tip.atVertex) {
      const e0 = tip.dir;
      const e1 = (tip.dir + 1) % 6;
      const k0 = neighborKey(tip.q, tip.r, e0);
      const k1 = neighborKey(tip.q, tip.r, e1);
      const touchesCreated =
        input.createdKeys.has(k0) || input.createdKeys.has(k1);
      if (touchesCreated) {
        incoming.push(tip);
      } else if (!biomes.has(k0) || !biomes.has(k1)) {
        pushTip(tip); // encore en attente sur le vide
      } else {
        // Voisins déjà là hors de cet expand : tenter de résoudre.
        incoming.push(tip);
      }
      continue;
    }

    const nKey = neighborKey(tip.q, tip.r, tip.dir);
    if (input.createdKeys.has(nKey)) incoming.push(tip);
    else if (!biomes.has(nKey)) pushTip(tip); // encore vierge
  }

  const hasIncoming = incoming.length > 0;

  // ——— A. Continuer les fleuves qui entrent ———
  for (const tip of incoming) {
    if (tip.atVertex) {
      const edge = pickEdgeFromVertex(
        biomes,
        waterDist,
        tip.q,
        tip.r,
        tip.dir,
        random,
        preferSea,
        preferSea ? null : input.createdKeys
      );
      // Si preferSea n’a rien trouvé via created, réessayer sans filtre.
      const choice =
        edge ??
        pickEdgeFromVertex(
          biomes,
          waterDist,
          tip.q,
          tip.r,
          tip.dir,
          random,
          preferSea,
          null
        );
      if (!choice) {
        pushTip(tip);
        continue;
      }
      if (choice.frontier) {
        // Une arête du sommet mène encore au vide → tip d’arête classique.
        pushTip({ q: tip.q, r: tip.r, dir: choice.dir });
        continue;
      }
      if (choice.toWater) {
        const d = HEX_DIRECTIONS[choice.dir]!;
        applyEstuary({ q: tip.q + d.q, r: tip.r + d.r });
        continue;
      }
      const result = runFlow(tip.q, tip.r, choice.dir);
      pushTip(result.tip);
      applyEstuary(result.estuary);
      continue;
    }

    const biome = biomes.get(hexKey(tip.q, tip.r));
    const nKey = neighborKey(tip.q, tip.r, tip.dir);
    const neighbor = biomes.get(nKey);
    if (!neighbor) {
      pushTip(tip);
      continue;
    }

    if (biome === "water") {
      if (!isLandBiome(neighbor)) continue;
      const landQ = tip.q + HEX_DIRECTIONS[tip.dir]!.q;
      const landR = tip.r + HEX_DIRECTIONS[tip.dir]!.r;
      const startDir =
        (preferSea
          ? pickSeaDir(biomes, waterDist, landQ, landR, random)
          : null) ?? pickFrontierDir(biomes, landQ, landR, random);
      if (startDir == null) continue;
      const result = runFlow(landQ, landR, startDir);
      pushTip(result.tip);
      applyEstuary(result.estuary);
      continue;
    }

    if (!isLandBiome(biome ?? "water")) continue;
    if (neighbor === "water") {
      applyEstuary({
        q: tip.q + HEX_DIRECTIONS[tip.dir]!.q,
        r: tip.r + HEX_DIRECTIONS[tip.dir]!.r
      });
      continue;
    }
    if (!isLandBiome(neighbor)) continue;

    const result = runFlow(tip.q, tip.r, tip.dir);
    pushTip(result.tip);
    applyEstuary(result.estuary);
  }

  // ——— B. Pas de tip entrant : fleuve depuis lac adjacent, ou nouveau lac seul ———
  if (!hasIncoming) {
    const adjacentLakes = lakesAdjacentToCreated(
      biomes,
      input.createdKeys,
      input.existingLakes,
      masks,
      input.tips
    );

    let startedFromLake = false;
    if (adjacentLakes.length > 0 && random() < RIVER_FROM_LAKE_CHANCE) {
      const lake =
        adjacentLakes[Math.floor(random() * adjacentLakes.length)]!;
      const start = pickLakeStartIntoCreated(
        biomes,
        input.createdKeys,
        lake.q,
        lake.r,
        random
      );
      if (start) {
        const lakeKey = hexKey(lake.q, lake.r);
        masks.set(
          lakeKey,
          withLakeOutflowVertex(masks.get(lakeKey) ?? 0, start.vertex)
        );
        const result = runFlow(lake.q, lake.r, start.edge);
        masks.set(
          lakeKey,
          withLakeOutflowVertex(masks.get(lakeKey) ?? 0, start.vertex)
        );
        pushTip(result.tip);
        applyEstuary(result.estuary);
        startedFromLake = true;
      }
    }

    if (!startedFromLake) {
      const dist = minDistToLakes(input.createdKeys, input.existingLakes);
      const chance = lakeSpawnChance(dist);
      if (random() < chance) {
        const landCandidates: HexCoord[] = [];
        for (const key of input.createdKeys) {
          const biome = biomes.get(key);
          if (!biome || !isLandBiome(biome)) continue;
          const [q, r] = key.split(",").map(Number) as [number, number];
          landCandidates.push({ q, r });
        }
        if (landCandidates.length > 0) {
          const lake =
            landCandidates[Math.floor(random() * landCandidates.length)]!;
          // Lac seul : pas de tip, pas de sortie — le fleuve se joue à l’expand suivant.
          poiByKey.set(hexKey(lake.q, lake.r), "lake");
        }
      }
    }
  }

  return { tileMasks: masks, tips: nextTips, poiByKey };
}

export function clearRiverEdgesAt(
  masks: Map<string, number>,
  q: number,
  r: number
): void {
  const key = hexKey(q, r);
  const mask = masks.get(key) ?? 0;
  if (mask === 0) {
    masks.delete(key);
    return;
  }
  for (let dir = 0; dir < 6; dir += 1) {
    if (!hasBit(mask, dir)) continue;
    const d = HEX_DIRECTIONS[dir]!;
    const nKey = hexKey(q + d.q, r + d.r);
    const nMask = masks.get(nKey) ?? 0;
    const cleared = nMask & ~(1 << oppositeDir(dir));
    if (cleared) masks.set(nKey, cleared);
    else masks.delete(nKey);
  }
  masks.delete(key);
}

export function filterTipsAwayFromTile(
  tips: readonly RiverTip[],
  q: number,
  r: number
): RiverTip[] {
  return tips.filter((tip) => tip.q !== q || tip.r !== r);
}

export function terrainHeight(biome: BiomeId): number {
  if (biome === "water") return 0;
  if (biome === "mountain" || biome === "forest_mountain") return 3;
  if (biome === "plains_mountain") return 2;
  return 1;
}
