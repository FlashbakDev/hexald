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

/**
 * Rivage terre↔eau (style Civ) : décor d’arête selon le biome terrestre.
 */
export function createShoreEdgeDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const sandDry = new MeshStandardMaterial({
    color: 0xe8d9b0,
    roughness: 0.95,
    metalness: 0.01
  });
  const sandMid = new MeshStandardMaterial({
    color: 0xd4c08a,
    roughness: 0.93,
    metalness: 0.02
  });
  const sandWet = new MeshStandardMaterial({
    color: 0xb8a474,
    roughness: 0.78,
    metalness: 0.04
  });
  const foam = new MeshStandardMaterial({
    color: 0xf2fafc,
    roughness: 0.45,
    metalness: 0.05,
    transparent: true,
    opacity: 0.88
  });
  const foamSoft = new MeshStandardMaterial({
    color: 0xd8eef4,
    roughness: 0.55,
    metalness: 0.04,
    transparent: true,
    opacity: 0.55
  });
  const driftwood = new MeshStandardMaterial({
    color: 0x8a6e4e,
    roughness: 0.92,
    metalness: 0.02
  });
  const shell = new MeshStandardMaterial({
    color: 0xf0e6d8,
    roughness: 0.7,
    metalness: 0.08
  });
  const rock = new MeshStandardMaterial({
    color: 0x6a7380,
    roughness: 0.96,
    metalness: 0.04
  });
  const rockDark = new MeshStandardMaterial({
    color: 0x4a5560,
    roughness: 0.97,
    metalness: 0.03
  });
  const reed = new MeshStandardMaterial({
    color: 0x6a9a58,
    roughness: 0.9,
    metalness: 0.01
  });
  const trunk = new MeshStandardMaterial({
    color: 0x5a3d28,
    roughness: 0.95,
    metalness: 0.02
  });
  const foliage = new MeshStandardMaterial({
    color: 0x3d8a52,
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

  const duneWide = new BoxGeometry(0.92, 0.028, 0.2);
  const sandBand = new BoxGeometry(0.88, 0.018, 0.14);
  const wetBand = new BoxGeometry(0.82, 0.012, 0.09);
  const foamBand = new BoxGeometry(0.72, 0.01, 0.055);
  const foamCurl = new CylinderGeometry(0.05, 0.06, 0.014, 6);
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
    yaw: number
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.y = yaw;
    disableRaycast(mesh);
    group.add(mesh);
  }

  function addBeachEdge(group: Group, dirIndex: number) {
    const { x: ux, z: uz, yaw } = unitToward(dirIndex);
    const tx = -uz;
    const tz = ux;
    const h = edgeHash(dirIndex, 11);
    const wobble = ((h % 7) - 3) * 0.012;

    addMesh(group, duneWide, sandDry, ux * (0.58 + wobble), 0.016, uz * (0.58 + wobble), 0.95, 1, 1.05, yaw);
    addMesh(group, sandBand, sandMid, ux * (0.72 + wobble * 0.5), 0.012, uz * (0.72 + wobble * 0.5), 1, 1, 1.1, yaw);
    addMesh(group, wetBand, sandWet, ux * 0.84, 0.008, uz * 0.84, 0.95, 1, 0.95, yaw);

    for (let i = 0; i < 3; i++) {
      const along = (i - 1) * 0.22 + (((h >>> (i * 3)) % 5) - 2) * 0.02;
      addMesh(
        group,
        pebble,
        i === 1 ? sandWet : sandMid,
        ux * (0.7 + (i % 2) * 0.08) + tx * along,
        0.018,
        uz * (0.7 + (i % 2) * 0.08) + tz * along,
        1.1 + (i % 2) * 0.3,
        0.8,
        1.2,
        yaw + i * 0.4
      );
    }

    if ((h & 3) !== 0) {
      const along = (((h >>> 4) % 9) - 4) * 0.06;
      addMesh(group, shellGeom, shell, ux * 0.68 + tx * along, 0.02, uz * 0.68 + tz * along, 1.2, 1, 1.2, yaw + 0.8);
    }
    if ((h & 5) === 1) {
      addMesh(group, stick, driftwood, ux * 0.62 + tx * 0.2, 0.016, uz * 0.62 + tz * 0.2, 1, 1, 1, yaw + 0.4);
    }
  }

  function addForestEdge(group: Group, dirIndex: number) {
    const { x: ux, z: uz, yaw } = unitToward(dirIndex);
    const tx = -uz;
    const tz = ux;
    const h = edgeHash(dirIndex, 29);

    addMesh(group, sandBand, sandMid, ux * 0.78, 0.01, uz * 0.78, 0.9, 1, 0.85, yaw);
    addMesh(group, wetBand, sandWet, ux * 0.86, 0.007, uz * 0.86, 0.8, 1, 0.7, yaw);

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

    const treeAlong = (((h % 7) - 3) * 0.08);
    addMesh(group, trunkGeom, trunk, ux * 0.48 + tx * treeAlong, 0.09, uz * 0.48 + tz * treeAlong, 0.85, 1, 0.85, yaw);
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
    addMesh(group, cliffBlock, rockDark, ux * 0.62 + tx * 0.12, 0.12, uz * 0.62 + tz * 0.12, 0.7, 1.2, 0.75, yaw + 0.15);
    addMesh(group, rockChunk, rockDark, ux * 0.8 + tx * -0.15, 0.06, uz * 0.8 + tz * -0.15, 1.1, 1, 1.1, yaw);

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

  /** Rivage côté terre, stylé selon le biome. */
  function createLandEdges(dirIndices: readonly number[], kind: ShoreKind) {
    const group = new Group();
    for (const dirIndex of dirIndices) {
      if (kind === "beach") addBeachEdge(group, dirIndex);
      else if (kind === "forest") addForestEdge(group, dirIndex);
      else addCliffEdge(group, dirIndex);
    }
    return group;
  }

  /** Écume côté mer (toute terre adjacente). */
  function createWaterEdges(dirIndices: readonly number[]) {
    const group = new Group();
    for (const dirIndex of dirIndices) {
      const { x: ux, z: uz, yaw } = unitToward(dirIndex);
      const tx = -uz;
      const tz = ux;
      const h = edgeHash(dirIndex, 71);

      addMesh(group, foamBand, foam, ux * 0.7, 0.006, uz * 0.7, 1, 1, 1, yaw);
      addMesh(group, foamBand, foamSoft, ux * 0.62, 0.004, uz * 0.62, 0.85, 1, 1.3, yaw);

      for (let i = 0; i < 4; i++) {
        const along = (i - 1.5) * 0.14 + (((h >>> (i * 2)) % 5) - 2) * 0.015;
        const out = 0.66 + (i % 2) * 0.05;
        addMesh(
          group,
          foamCurl,
          i % 2 === 0 ? foam : foamSoft,
          ux * out + tx * along,
          0.007,
          uz * out + tz * along,
          0.9 + (i % 3) * 0.15,
          1,
          0.9 + (i % 2) * 0.2,
          yaw + i * 0.5
        );
      }
    }
    return group;
  }

  return {
    createLandEdges,
    createWaterEdges,
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    }
  };
}
