import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";
import type { FusionBiomeId } from "@hexald/shared";

function disableRaycast(mesh: Mesh) {
  mesh.raycast = () => {};
}

function tileHash(q: number, r: number, salt = 0) {
  let n = Math.imul(q | 0, 1597334677) ^ Math.imul(r | 0, 3812015801) ^ salt;
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  n ^= n >>> 16;
  return n >>> 0;
}

const EDGE_SPOTS: readonly { x: number; z: number }[] = [
  { x: -0.28, z: 0.18 },
  { x: 0.26, z: -0.2 },
  { x: 0.12, z: 0.3 },
  { x: -0.2, z: -0.28 },
  { x: 0.32, z: 0.1 },
  { x: -0.08, z: 0.04 }
];

/** Layouts haute forêt : arbres écartés sur le pourtour. */
const HIGH_FOREST_TREE_SPOTS: readonly {
  x: number;
  z: number;
  scale: number;
  yaw: number;
  pine: boolean;
}[][] = [
  [
    { x: -0.38, z: 0.2, scale: 1.35, yaw: 0.25, pine: true },
    { x: 0.36, z: -0.22, scale: 1.25, yaw: -0.45, pine: true },
    { x: 0.3, z: 0.34, scale: 1.15, yaw: 0.7, pine: false },
    { x: -0.28, z: -0.36, scale: 1.2, yaw: -0.15, pine: true },
    { x: 0.02, z: 0.4, scale: 0.95, yaw: 1.0, pine: false }
  ],
  [
    { x: 0.34, z: 0.26, scale: 1.4, yaw: -0.2, pine: true },
    { x: -0.36, z: -0.18, scale: 1.28, yaw: 0.55, pine: true },
    { x: -0.12, z: 0.38, scale: 1.1, yaw: 0.9, pine: false },
    { x: 0.22, z: -0.38, scale: 1.18, yaw: -0.65, pine: true },
    { x: -0.38, z: 0.28, scale: 1.0, yaw: -0.85, pine: false }
  ],
  [
    { x: -0.34, z: 0.05, scale: 1.38, yaw: 0.1, pine: true },
    { x: 0.38, z: 0.14, scale: 1.22, yaw: -0.35, pine: false },
    { x: 0.08, z: -0.38, scale: 1.3, yaw: 0.85, pine: true },
    { x: -0.22, z: 0.36, scale: 1.12, yaw: -0.95, pine: true },
    { x: 0.32, z: -0.28, scale: 1.05, yaw: 0.4, pine: false }
  ]
];

const HIGH_FOREST_ROCK_SPOTS: readonly {
  x: number;
  z: number;
  size: "peak" | "big" | "mid" | "low";
}[][] = [
  [
    { x: 0.0, z: -0.02, size: "peak" },
    { x: 0.18, z: 0.12, size: "big" },
    { x: -0.16, z: 0.1, size: "mid" },
    { x: 0.12, z: -0.2, size: "mid" },
    { x: -0.2, z: -0.16, size: "low" },
    { x: 0.26, z: -0.06, size: "low" }
  ],
  [
    { x: -0.04, z: 0.0, size: "peak" },
    { x: 0.16, z: 0.16, size: "big" },
    { x: -0.22, z: 0.08, size: "mid" },
    { x: 0.1, z: -0.2, size: "mid" },
    { x: -0.1, z: -0.18, size: "low" },
    { x: 0.24, z: 0.02, size: "low" }
  ],
  [
    { x: 0.02, z: -0.04, size: "peak" },
    { x: -0.18, z: -0.08, size: "big" },
    { x: 0.2, z: -0.1, size: "mid" },
    { x: -0.08, z: 0.18, size: "mid" },
    { x: 0.14, z: 0.16, size: "low" },
    { x: -0.24, z: 0.12, size: "low" }
  ]
];

/**
 * Décor des fusions — tuile spéciale mélange des deux parents
 * (pas de demi-split : un hex a 6 voisins possibles).
 * Lisière · Piémont · Haute forêt.
 */
export function createFusionDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const trunk = new MeshStandardMaterial({
    color: 0x6a4528,
    roughness: 0.93,
    metalness: 0.01
  });
  const foliage = new MeshStandardMaterial({
    color: 0x3a7656,
    roughness: 0.85,
    metalness: 0.02
  });
  const foliageSoft = new MeshStandardMaterial({
    color: 0x4a8a68,
    roughness: 0.86,
    metalness: 0.02
  });
  const foliageDeep = new MeshStandardMaterial({
    color: 0x2f6450,
    roughness: 0.88,
    metalness: 0.02
  });
  const grassA = new MeshStandardMaterial({
    color: 0x6e9a68,
    roughness: 0.9,
    metalness: 0
  });
  const grassB = new MeshStandardMaterial({
    color: 0x82ae78,
    roughness: 0.88,
    metalness: 0
  });
  const rock = new MeshStandardMaterial({
    color: 0x7a848e,
    roughness: 0.95,
    metalness: 0.03
  });
  const rockWarm = new MeshStandardMaterial({
    color: 0x8a7e6e,
    roughness: 0.94,
    metalness: 0.02
  });
  const rockDark = new MeshStandardMaterial({
    color: 0x5c6570,
    roughness: 0.96,
    metalness: 0.04
  });
  const moss = new MeshStandardMaterial({
    color: 0x4a7a5e,
    roughness: 0.92,
    metalness: 0.02
  });
  const bush = new MeshStandardMaterial({
    color: 0x427a58,
    roughness: 0.9,
    metalness: 0.01
  });
  materials.push(
    trunk,
    foliage,
    foliageSoft,
    foliageDeep,
    grassA,
    grassB,
    rock,
    rockWarm,
    rockDark,
    moss,
    bush
  );

  const trunkThin = new CylinderGeometry(0.016, 0.024, 0.1, 5);
  const trunkThick = new CylinderGeometry(0.024, 0.036, 0.14, 6);
  const leafWide = new ConeGeometry(0.14, 0.2, 6);
  const leafMid = new ConeGeometry(0.1, 0.16, 6);
  const leafTip = new ConeGeometry(0.065, 0.12, 5);
  const leafRound = new ConeGeometry(0.11, 0.14, 7);
  const bladeGeom = new ConeGeometry(0.026, 0.065, 4);
  const rockGeom = new CylinderGeometry(0.055, 0.07, 0.045, 5);
  const rockLow = new ConeGeometry(0.14, 0.1, 5);
  const rockBig = new ConeGeometry(0.2, 0.16, 5);
  const outcropBody = new ConeGeometry(0.32, 0.28, 6);
  const outcropBase = new CylinderGeometry(0.3, 0.36, 0.1, 6);
  const outcropPeak = new ConeGeometry(0.16, 0.18, 5);
  const bushGeom = new ConeGeometry(0.07, 0.08, 5);
  geometries.push(
    trunkThin,
    trunkThick,
    leafWide,
    leafMid,
    leafTip,
    leafRound,
    bladeGeom,
    rockGeom,
    rockLow,
    rockBig,
    outcropBody,
    outcropBase,
    outcropPeak,
    bushGeom
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

  function sapling(group: Group, scale: number, yaw: number, soft: boolean) {
    const tree = new Group();
    tree.rotation.y = yaw;
    const leaf = soft ? foliageSoft : foliage;
    addMesh(tree, trunkThin, trunk, 0, 0.045 * scale, 0, scale, scale, scale, 0);
    addMesh(tree, leafMid, leaf, 0, 0.14 * scale, 0, scale * 0.9, scale * 0.95, scale * 0.9, 0.2);
    addMesh(tree, leafTip, leaf, 0, 0.22 * scale, 0, scale * 0.75, scale, scale * 0.75, 0.5);
    group.add(tree);
  }

  function smallBroadleaf(group: Group, scale: number, yaw: number) {
    const tree = new Group();
    tree.rotation.y = yaw;
    addMesh(tree, trunkThin, trunk, 0, 0.05 * scale, 0, scale * 1.05, scale, scale * 1.05, 0);
    addMesh(
      tree,
      leafRound,
      foliageSoft,
      0,
      0.16 * scale,
      0,
      scale * 1.1,
      scale * 0.9,
      scale * 1.1,
      0.15
    );
    addMesh(
      tree,
      leafTip,
      foliage,
      0.02 * scale,
      0.24 * scale,
      -0.015 * scale,
      scale * 0.7,
      scale * 0.85,
      scale * 0.7,
      0.8
    );
    group.add(tree);
  }

  function grassTuft(
    group: Group,
    x: number,
    z: number,
    scale: number,
    yaw: number,
    dark: boolean
  ) {
    const bunch = new Group();
    bunch.position.set(x, 0, z);
    bunch.rotation.y = yaw;
    const mat = dark ? grassA : grassB;
    const count = 2 + (dark ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      addMesh(
        bunch,
        bladeGeom,
        mat,
        (i - 1) * 0.02,
        0.03 * scale,
        (i % 2) * 0.016,
        scale * 0.85,
        scale,
        scale * 0.85,
        (i - 1) * 0.2
      );
    }
    group.add(bunch);
  }

  function placeGrass(group: Group, hash: number, count: number, start = 0) {
    for (let i = 0; i < count; i += 1) {
      const spot = EDGE_SPOTS[(hash + start + i * 2) % EDGE_SPOTS.length]!;
      const jx = (((hash >>> (i * 3)) & 7) / 7 - 0.5) * 0.07;
      const jz = (((hash >>> (i * 3 + 2)) & 7) / 7 - 0.5) * 0.07;
      const scale = 0.7 + (((hash >>> (i + 1)) & 3) / 3) * 0.35;
      const yaw = ((hash >>> (i * 4)) & 15) / 15 * Math.PI * 2;
      grassTuft(group, spot.x + jx, spot.z + jz, scale, yaw, ((hash >>> i) & 1) === 1);
    }
  }

  /** Lisière : herbe + 2–3 arbres + 1–2 rochers plus gros. */
  function forestPlains(q: number, r: number) {
    const hash = tileHash(q, r, 11);
    const h1 = tileHash(q, r, 41);
    const group = new Group();
    placeGrass(group, hash, 3 + (hash % 2));

    const treeCount = 2 + ((hash >>> 4) % 2);
    for (let i = 0; i < treeCount; i += 1) {
      const spot = EDGE_SPOTS[(hash + 3 + i * 2) % EDGE_SPOTS.length]!;
      const scale = 0.9 + ((hash >>> (i + 2)) & 3) * 0.12;
      const yaw = ((hash >>> (i * 5)) & 15) / 15 * Math.PI * 2;
      if (((hash >>> i) & 1) === 0) sapling(group, scale, yaw, true);
      else smallBroadleaf(group, scale * 0.95, yaw);
      const last = group.children[group.children.length - 1] as Group;
      last.position.set(spot.x * 0.82, 0, spot.z * 0.82);
    }

    const rockCount = 1 + ((h1 >>> 2) % 2);
    for (let i = 0; i < rockCount; i += 1) {
      const spot = EDGE_SPOTS[(h1 + i * 3) % EDGE_SPOTS.length]!;
      const mat = ((h1 >>> i) & 1) === 1 ? rockWarm : rock;
      const big = i === 0;
      addMesh(
        group,
        big ? rockBig : rockLow,
        mat,
        spot.x * 0.72,
        big ? 0.06 : 0.045,
        spot.z * 0.72,
        big ? 1.15 : 1,
        big ? 1.25 : 1.05,
        big ? 1.1 : 1,
        (h1 + i) * 0.7
      );
    }

    const spot = EDGE_SPOTS[(hash + 5) % EDGE_SPOTS.length]!;
    addMesh(group, bushGeom, bush, spot.x * 0.65, 0.035, spot.z * 0.65, 1.05, 0.95, 1.05, hash * 0.01);

    return group;
  }

  /** Piémont : herbe + arbres + buissons (plus de collines / cailloux). */
  function plainsMountain(q: number, r: number) {
    const hash = tileHash(q, r, 29);
    const h1 = tileHash(q, r, 71);
    const group = new Group();

    placeGrass(group, hash, 3 + (h1 % 2), 1);

    const treeCount = 2 + ((hash >>> 3) % 2);
    for (let i = 0; i < treeCount; i += 1) {
      const spot = EDGE_SPOTS[(hash + i * 2) % EDGE_SPOTS.length]!;
      const scale = 0.95 + ((hash >>> (i + 1)) & 3) * 0.1;
      const yaw = ((hash >>> (i * 4)) & 15) / 15 * Math.PI * 2;
      if (((hash >>> i) & 1) === 0) sapling(group, scale, yaw, true);
      else smallBroadleaf(group, scale * 0.95, yaw);
      const last = group.children[group.children.length - 1] as Group;
      last.position.set(spot.x * 0.8, 0, spot.z * 0.8);
    }

    const bushCount = 4 + (h1 % 3);
    for (let i = 0; i < bushCount; i += 1) {
      const spot = EDGE_SPOTS[(h1 + i * 2) % EDGE_SPOTS.length]!;
      const jx = (((hash >>> (i * 2)) & 7) / 7 - 0.5) * 0.08;
      const jz = (((h1 >>> (i * 2)) & 7) / 7 - 0.5) * 0.08;
      const sx = 1 + ((h1 >>> i) & 3) * 0.12;
      addMesh(
        group,
        bushGeom,
        bush,
        spot.x * 0.55 + jx,
        0.04 * sx,
        spot.z * 0.55 + jz,
        sx,
        sx * 0.95,
        sx,
        (hash + i) * 0.4
      );
    }

    return group;
  }

  /**
   * Haute forêt : tuile premium — pic rocheux + rochers + 5 arbres espacés.
   */
  function forestMountain(q: number, r: number) {
    const hash = tileHash(q, r, 53);
    const h1 = tileHash(q, r, 101);
    const group = new Group();
    const layoutIdx = hash % HIGH_FOREST_TREE_SPOTS.length;
    const trees = HIGH_FOREST_TREE_SPOTS[layoutIdx]!;
    const rocks = HIGH_FOREST_ROCK_SPOTS[layoutIdx]!;

    for (let i = 0; i < rocks.length; i += 1) {
      const spot = rocks[i]!;
      const mat = i % 3 === 0 ? rockDark : ((h1 >>> i) & 1) === 1 ? rockWarm : rock;
      const yaw = ((hash >>> (i * 3)) & 15) / 15 * Math.PI * 2;
      if (spot.size === "peak") {
        addMesh(group, outcropBase, rockDark, spot.x, 0.05, spot.z, 1.15, 1.1, 1.15, yaw);
        addMesh(
          group,
          outcropBody,
          mat,
          spot.x + 0.01,
          0.18,
          spot.z - 0.01,
          1.15,
          1.25,
          1.05,
          yaw + 0.2
        );
        addMesh(group, outcropPeak, moss, spot.x - 0.02, 0.32, spot.z, 1.05, 1.1, 1, yaw + 0.5);
        addMesh(group, rockLow, moss, spot.x + 0.1, 0.16, spot.z + 0.06, 0.7, 0.55, 0.7, yaw);
      } else if (spot.size === "big") {
        addMesh(group, rockBig, mat, spot.x, 0.08, spot.z, 1.25, 1.35, 1.2, yaw);
        addMesh(group, rockLow, moss, spot.x + 0.04, 0.12, spot.z - 0.03, 0.65, 0.5, 0.65, yaw + 0.4);
      } else if (spot.size === "mid") {
        addMesh(group, rockBig, mat, spot.x, 0.06, spot.z, 1.05, 1.1, 1, yaw);
      } else {
        addMesh(group, rockLow, mat, spot.x, 0.045, spot.z, 1.05, 1.1, 1, yaw);
      }
    }

    for (let i = 0; i < trees.length; i += 1) {
      const spot = trees[i]!;
      const scale = spot.scale * (0.98 + ((hash >>> (i + 2)) & 3) * 0.05);
      const leaf = i % 2 === 0 ? foliageDeep : foliage;
      if (spot.pine) {
        const pine = new Group();
        pine.rotation.y = spot.yaw;
        pine.position.set(spot.x, 0, spot.z);
        addMesh(pine, trunkThick, trunk, 0, 0.08 * scale, 0, scale, scale * 1.15, scale, 0);
        addMesh(pine, leafWide, leaf, 0, 0.24 * scale, 0, scale * 1.15, scale, scale * 1.15, 0.15);
        addMesh(pine, leafMid, leaf, 0, 0.38 * scale, 0, scale * 1.05, scale, scale * 1.05, 0.4);
        addMesh(pine, leafTip, leaf, 0, 0.5 * scale, 0, scale * 0.95, scale * 1.05, scale * 0.95, 0.7);
        group.add(pine);
      } else {
        smallBroadleaf(group, scale, spot.yaw);
        const last = group.children[group.children.length - 1] as Group;
        last.position.set(spot.x, 0, spot.z);
      }
    }

    const bushCount = 6 + (h1 % 3);
    for (let i = 0; i < bushCount; i += 1) {
      const spot = EDGE_SPOTS[(h1 + i * 2) % EDGE_SPOTS.length]!;
      const ang = (h1 + i * 2.1) % (Math.PI * 2);
      const dist = 0.16 + ((hash >>> (i * 2)) % 4) * 0.06;
      const useRing = (i & 1) === 0;
      const x = useRing ? Math.cos(ang) * dist : spot.x * 0.45;
      const z = useRing ? Math.sin(ang) * dist : spot.z * 0.45;
      const sx = 1.1 + ((h1 >>> i) & 3) * 0.1;
      addMesh(group, bushGeom, bush, x, 0.04 * sx, z, sx, sx * 0.95, sx, ang);
    }

    return group;
  }

  function createForTile(q: number, r: number, biome: FusionBiomeId) {
    if (biome === "forest_plains") return forestPlains(q, r);
    if (biome === "plains_mountain") return plainsMountain(q, r);
    return forestMountain(q, r);
  }

  return {
    createForTile,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
