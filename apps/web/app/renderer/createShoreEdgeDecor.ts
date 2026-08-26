import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";
import type { BiomeId } from "@hexald/shared";
import { HEX_DIRECTIONS } from "@hexald/shared";

function disableRaycast(mesh: Mesh) {
  mesh.raycast = () => {};
}

function unitToward(dirIndex: number) {
  const dir = HEX_DIRECTIONS[dirIndex]!;
  const x = Math.sqrt(3) * (dir.q + dir.r / 2);
  const z = 1.5 * dir.r;
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len, yaw: Math.atan2(x, z) };
}

/** Sommet hex entre deux arêtes consécutives (dir et dir+1). */
function vertexBetween(dirA: number, dirB: number) {
  const a = unitToward(dirA);
  const b = unitToward(dirB);
  let x = a.x + b.x;
  let z = a.z + b.z;
  const len = Math.hypot(x, z) || 1;
  x /= len;
  z /= len;
  return { x, z, yaw: Math.atan2(x, z) };
}

function edgeHash(dirIndex: number, salt = 0) {
  let n = Math.imul(dirIndex + 1, 9973) ^ Math.imul(salt | 0, 1597334677);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n ^= n >>> 16;
  return n >>> 0;
}

/** Style de rivage selon le biome terrestre adjacent à l’eau. */
export type ShoreKind = "beach" | "forest" | "cliff";

export function shoreKindForBiome(biome: BiomeId): ShoreKind | null {
  if (biome === "water") return null;
  if (biome === "plains" || biome === "forest_plains") return "beach";
  if (biome === "forest" || biome === "forest_mountain") return "forest";
  if (biome === "mountain" || biome === "plains_mountain") return "cliff";
  return null;
}

type EdgeContinuity = {
  /** Arête précédente (dir−1) aussi rivage. */
  hasPrev: boolean;
  /** Arête suivante (dir+1) aussi rivage. */
  hasNext: boolean;
};

/**
 * Rivage terre↔eau (style Civ) : décor d’arête selon le biome terrestre.
 * Les plages se connectent aux coins (bandes prolongées + pastilles de sommet).
 */
export function createShoreEdgeDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const sandDry = new MeshStandardMaterial({
    color: 0xffe9b8,
    roughness: 0.95,
    metalness: 0.01
  });
  const sandMid = new MeshStandardMaterial({
    color: 0xf5d78a,
    roughness: 0.93,
    metalness: 0.02
  });
  const sandWet = new MeshStandardMaterial({
    color: 0xe8c878,
    roughness: 0.78,
    metalness: 0.04
  });
  const foam = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.04,
    transparent: true,
    opacity: 0.62
  });
  const foamSoft = new MeshStandardMaterial({
    color: 0xe8f8ff,
    roughness: 0.5,
    metalness: 0.03,
    transparent: true,
    opacity: 0.38
  });
  const driftwood = new MeshStandardMaterial({
    color: 0xc49a6c,
    roughness: 0.92,
    metalness: 0.02
  });
  const shell = new MeshStandardMaterial({
    color: 0xfff0e4,
    roughness: 0.7,
    metalness: 0.08
  });
  const rock = new MeshStandardMaterial({
    color: 0xa8b4c4,
    roughness: 0.96,
    metalness: 0.04
  });
  const rockDark = new MeshStandardMaterial({
    color: 0x7a8898,
    roughness: 0.97,
    metalness: 0.03
  });
  const reed = new MeshStandardMaterial({
    color: 0x5a9a68,
    roughness: 0.9,
    metalness: 0.01
  });
  const trunk = new MeshStandardMaterial({
    color: 0xa86a42,
    roughness: 0.95,
    metalness: 0.02
  });
  const foliage = new MeshStandardMaterial({
    color: 0x4a9a68,
    roughness: 0.88,
    metalness: 0.02
  });
  materials.push(
    sandDry,
    sandMid,
    sandWet,
    foam,
    foamSoft,
    driftwood,
    shell,
    rock,
    rockDark,
    reed,
    trunk,
    foliage
  );

  // Largeur ≈ longueur d’arête hex (1.0) + léger débord pour chevaucher les sommets.
  const duneWide = new BoxGeometry(1.08, 0.028, 0.22);
  const sandBand = new BoxGeometry(1.06, 0.018, 0.16);
  const wetBand = new BoxGeometry(1.04, 0.012, 0.1);
  const foamBand = new BoxGeometry(1.05, 0.01, 0.06);
  const foamCurl = new CylinderGeometry(0.05, 0.06, 0.014, 6);
  const cornerPad = new CylinderGeometry(0.16, 0.18, 0.016, 6);
  const cornerPadSm = new CylinderGeometry(0.11, 0.13, 0.012, 6);
  const pebble = new CylinderGeometry(0.028, 0.038, 0.022, 5);
  const rockChunk = new CylinderGeometry(0.08, 0.11, 0.1, 5);
  const cliffBlock = new BoxGeometry(0.55, 0.16, 0.22);
  const shellGeom = new ConeGeometry(0.03, 0.022, 4);
  const stick = new BoxGeometry(0.14, 0.018, 0.022);
  const reedGeom = new CylinderGeometry(0.01, 0.014, 0.14, 4);
  const trunkGeom = new CylinderGeometry(0.03, 0.04, 0.16, 5);
  const crownGeom = new ConeGeometry(0.11, 0.18, 5);
  geometries.push(
    duneWide,
    sandBand,
    wetBand,
    foamBand,
    foamCurl,
    cornerPad,
    cornerPadSm,
    pebble,
    rockChunk,
    cliffBlock,
    shellGeom,
    stick,
    reedGeom,
    trunkGeom,
    crownGeom
  );

  function addMesh(
    group: Group,
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number,
    wave?: { phase: number }
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.y = yaw;
    disableRaycast(mesh);
    if (wave) {
      mesh.userData.isWave = true;
      mesh.userData.baseY = y;
      mesh.userData.baseSx = sx;
      mesh.userData.baseSz = sz;
      mesh.userData.phase = wave.phase;
    }
    group.add(mesh);
  }

  function addBeachEdge(
    group: Group,
    dirIndex: number,
    continuity: EdgeContinuity
  ) {
    const { x: ux, z: uz, yaw } = unitToward(dirIndex);
    const tx = -uz;
    const tz = ux;
    const h = edgeHash(dirIndex, 11);
    // Moins de wobble si l’arête est liée — jointures plus propres.
    const wobble = continuity.hasPrev || continuity.hasNext
      ? ((h % 5) - 2) * 0.006
      : ((h % 7) - 3) * 0.012;

    // Prolonge vers les coins connectés pour absorber le joint.
    const along =
      1 +
      (continuity.hasPrev ? 0.1 : 0.04) +
      (continuity.hasNext ? 0.1 : 0.04);

    addMesh(
      group,
      duneWide,
      sandDry,
      ux * (0.56 + wobble),
      0.016,
      uz * (0.56 + wobble),
      along,
      1,
      1.05,
      yaw
    );
    addMesh(
      group,
      sandBand,
      sandMid,
      ux * (0.7 + wobble * 0.5),
      0.012,
      uz * (0.7 + wobble * 0.5),
      along * 0.98,
      1,
      1.08,
      yaw
    );
    addMesh(
      group,
      wetBand,
      sandWet,
      ux * 0.82,
      0.008,
      uz * 0.82,
      along * 0.96,
      1,
      0.98,
      yaw
    );

    // Décor léger seulement au milieu d’une arête « libre » (évite le bruit aux joints).
    if (!continuity.hasPrev || !continuity.hasNext) {
      for (let i = 0; i < 3; i++) {
        const alongPos = (i - 1) * 0.2 + (((h >>> (i * 3)) % 5) - 2) * 0.015;
        if (continuity.hasPrev && alongPos < -0.12) continue;
        if (continuity.hasNext && alongPos > 0.12) continue;
        addMesh(
          group,
          pebble,
          i === 1 ? sandWet : sandMid,
          ux * (0.68 + (i % 2) * 0.08) + tx * alongPos,
          0.018,
          uz * (0.68 + (i % 2) * 0.08) + tz * alongPos,
          1.1 + (i % 2) * 0.3,
          0.8,
          1.2,
          yaw + i * 0.4
        );
      }

      if ((h & 3) !== 0) {
        const alongPos = (((h >>> 4) % 9) - 4) * 0.05;
        addMesh(
          group,
          shellGeom,
          shell,
          ux * 0.66 + tx * alongPos,
          0.02,
          uz * 0.66 + tz * alongPos,
          1.2,
          1,
          1.2,
          yaw + 0.8
        );
      }
      if ((h & 5) === 1 && !continuity.hasPrev && !continuity.hasNext) {
        addMesh(
          group,
          stick,
          driftwood,
          ux * 0.6 + tx * 0.18,
          0.016,
          uz * 0.6 + tz * 0.18,
          1,
          1,
          1,
          yaw + 0.4
        );
      }
    }
  }

  /** Pastille de sable au sommet entre deux arêtes plage consécutives. */
  function addBeachCorner(group: Group, dirA: number, dirB: number) {
    const { x: vx, z: vz, yaw } = vertexBetween(dirA, dirB);

    addMesh(group, cornerPad, sandWet, vx * 0.9, 0.007, vz * 0.9, 1.05, 1, 1.05, yaw);
    addMesh(group, cornerPad, sandMid, vx * 0.78, 0.011, vz * 0.78, 1.15, 1, 1.15, yaw);
    addMesh(group, cornerPadSm, sandDry, vx * 0.66, 0.015, vz * 0.66, 1.2, 1, 1.2, yaw);
    // Petite langue vers l’intérieur pour fondre avec la dune.
    addMesh(group, cornerPadSm, sandDry, vx * 0.54, 0.014, vz * 0.54, 0.85, 1, 0.85, yaw + 0.2);
  }

  function addForestEdge(group: Group, dirIndex: number) {
    const { x: ux, z: uz, yaw } = unitToward(dirIndex);
    const tx = -uz;
    const tz = ux;
    const h = edgeHash(dirIndex, 29);

    addMesh(group, sandBand, sandMid, ux * 0.78, 0.01, uz * 0.78, 0.95, 1, 0.85, yaw);
    addMesh(group, wetBand, sandWet, ux * 0.86, 0.007, uz * 0.86, 0.9, 1, 0.7, yaw);

    for (let i = 0; i < 4; i++) {
      const along = (i - 1.5) * 0.16;
      addMesh(
        group,
        reedGeom,
        reed,
        ux * 0.62 + tx * along,
        0.08,
        uz * 0.62 + tz * along,
        0.9 + (i % 2) * 0.25,
        1,
        0.9,
        yaw + i * 0.3
      );
    }

    const treeAlong = ((h % 7) - 3) * 0.08;
    addMesh(
      group,
      trunkGeom,
      trunk,
      ux * 0.48 + tx * treeAlong,
      0.09,
      uz * 0.48 + tz * treeAlong,
      0.85,
      1,
      0.85,
      yaw
    );
    addMesh(
      group,
      crownGeom,
      foliage,
      ux * 0.48 + tx * treeAlong,
      0.22,
      uz * 0.48 + tz * treeAlong,
      0.9,
      1,
      0.9,
      yaw + 0.2
    );
  }

  function addCliffEdge(group: Group, dirIndex: number) {
    const { x: ux, z: uz, yaw } = unitToward(dirIndex);
    const tx = -uz;
    const tz = ux;
    const h = edgeHash(dirIndex, 47);

    addMesh(group, cliffBlock, rock, ux * 0.72, 0.09, uz * 0.72, 1, 1, 1, yaw);
    addMesh(
      group,
      cliffBlock,
      rockDark,
      ux * 0.62 + tx * 0.12,
      0.12,
      uz * 0.62 + tz * 0.12,
      0.7,
      1.2,
      0.75,
      yaw + 0.15
    );
    addMesh(
      group,
      rockChunk,
      rockDark,
      ux * 0.8 + tx * -0.15,
      0.06,
      uz * 0.8 + tz * -0.15,
      1.1,
      1,
      1.1,
      yaw
    );

    for (let i = 0; i < 2; i++) {
      const along = (i === 0 ? -0.2 : 0.22) + ((h % 3) - 1) * 0.03;
      addMesh(
        group,
        rockChunk,
        i === 0 ? rock : rockDark,
        ux * 0.7 + tx * along,
        0.05,
        uz * 0.7 + tz * along,
        0.7 + i * 0.2,
        0.8,
        0.7,
        yaw + i
      );
    }
  }

  function continuityFor(dirIndex: number, set: Set<number>): EdgeContinuity {
    return {
      hasPrev: set.has((dirIndex + 5) % 6),
      hasNext: set.has((dirIndex + 1) % 6)
    };
  }

  /** Rivage côté terre, stylé selon le biome. */
  function createLandEdges(dirIndices: readonly number[], kind: ShoreKind) {
    const group = new Group();
    const set = new Set(dirIndices);

    for (const dirIndex of dirIndices) {
      const continuity = continuityFor(dirIndex, set);
      if (kind === "beach") addBeachEdge(group, dirIndex, continuity);
      else if (kind === "forest") addForestEdge(group, dirIndex);
      else addCliffEdge(group, dirIndex);
    }

    if (kind === "beach") {
      for (const dirIndex of dirIndices) {
        const next = (dirIndex + 1) % 6;
        if (set.has(next)) addBeachCorner(group, dirIndex, next);
      }
    }

    return group;
  }

  function addFoamEdge(
    group: Group,
    dirIndex: number,
    continuity: EdgeContinuity
  ) {
    const { x: ux, z: uz, yaw } = unitToward(dirIndex);
    const tx = -uz;
    const tz = ux;
    const h = edgeHash(dirIndex, 71);
    const along =
      1 +
      (continuity.hasPrev ? 0.1 : 0.04) +
      (continuity.hasNext ? 0.1 : 0.04);

    addMesh(group, foamBand, foam, ux * 0.7, 0.006, uz * 0.7, along, 1, 1, yaw, {
      phase: (h % 1000) * 0.01
    });
    addMesh(
      group,
      foamBand,
      foamSoft,
      ux * 0.62,
      0.004,
      uz * 0.62,
      along * 0.9,
      1,
      1.25,
      yaw,
      { phase: (h % 1000) * 0.01 + 0.8 }
    );

    for (let i = 0; i < 4; i++) {
      const alongPos = (i - 1.5) * 0.14 + (((h >>> (i * 2)) % 5) - 2) * 0.012;
      if (continuity.hasPrev && alongPos < -0.18) continue;
      if (continuity.hasNext && alongPos > 0.18) continue;
      const out = 0.66 + (i % 2) * 0.05;
      addMesh(
        group,
        foamCurl,
        i % 2 === 0 ? foam : foamSoft,
        ux * out + tx * alongPos,
        0.007,
        uz * out + tz * alongPos,
        0.9 + (i % 3) * 0.15,
        1,
        0.9 + (i % 2) * 0.2,
        yaw + i * 0.5,
        { phase: ((h >>> (i * 3)) % 64) * 0.1 + i }
      );
    }
  }

  function addFoamCorner(group: Group, dirA: number, dirB: number) {
    const { x: vx, z: vz, yaw } = vertexBetween(dirA, dirB);
    addMesh(
      group,
      cornerPadSm,
      foam,
      vx * 0.72,
      0.006,
      vz * 0.72,
      1.1,
      1,
      1.1,
      yaw,
      { phase: dirA * 0.7 }
    );
    addMesh(
      group,
      foamCurl,
      foamSoft,
      vx * 0.64,
      0.007,
      vz * 0.64,
      1.2,
      1,
      1.2,
      yaw + 0.4,
      { phase: dirB * 0.9 + 1.2 }
    );
  }

  /** Écume côté mer (toute terre adjacente). */
  function createWaterEdges(dirIndices: readonly number[]) {
    const group = new Group();
    group.userData.hasShoreWaves = true;
    const set = new Set(dirIndices);

    for (const dirIndex of dirIndices) {
      addFoamEdge(group, dirIndex, continuityFor(dirIndex, set));
    }

    for (const dirIndex of dirIndices) {
      const next = (dirIndex + 1) % 6;
      if (set.has(next)) addFoamCorner(group, dirIndex, next);
    }

    return group;
  }

  const animate = (root: Group, nowMs: number) => {
    const t = nowMs * 0.001;
    root.traverse((obj) => {
      if (!obj.userData.isWave || !(obj instanceof Mesh)) return;
      const phase = (obj.userData.phase as number) ?? 0;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + phase);
      const baseY = (obj.userData.baseY as number) ?? 0;
      const baseSx = (obj.userData.baseSx as number) ?? 1;
      const baseSz = (obj.userData.baseSz as number) ?? 1;
      obj.position.y = baseY + pulse * 0.012;
      obj.scale.x = baseSx * (0.88 + pulse * 0.24);
      obj.scale.z = baseSz * (0.82 + pulse * 0.32);
    });
  };

  return {
    createLandEdges,
    createWaterEdges,
    animate,
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    }
  };
}
