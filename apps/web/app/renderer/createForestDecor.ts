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

function disableRaycast(mesh: Mesh) {
  mesh.raycast = () => {};
}

export type ForestDecorDensity = "normal" | "high";

type TreeSpot = { x: number; z: number; scale: number; yaw: number; kind: 0 | 1 | 2 };

/** Layouts : kind 0 = pin, 1 = feuillu large, 2 = jeune pousse. */
const TREE_LAYOUTS_NORMAL: readonly (readonly TreeSpot[])[] = [
  [
    { x: -0.3, z: 0.2, scale: 0.95, yaw: 0.25, kind: 0 },
    { x: 0.28, z: -0.2, scale: 1.05, yaw: -0.4, kind: 1 },
    { x: 0.06, z: 0.32, scale: 0.72, yaw: 0.7, kind: 2 }
  ],
  [
    { x: 0.3, z: 0.18, scale: 1.0, yaw: -0.15, kind: 1 },
    { x: -0.26, z: -0.26, scale: 0.88, yaw: 0.55, kind: 0 },
    { x: -0.08, z: 0.3, scale: 0.7, yaw: -0.8, kind: 2 },
    { x: 0.18, z: -0.34, scale: 0.78, yaw: 1.1, kind: 0 }
  ],
  [
    { x: -0.32, z: -0.08, scale: 0.92, yaw: 0.3, kind: 0 },
    { x: 0.22, z: 0.28, scale: 1.08, yaw: -0.25, kind: 1 },
    { x: 0.3, z: -0.28, scale: 0.68, yaw: 1.0, kind: 2 }
  ],
  [
    { x: -0.22, z: 0.28, scale: 1.02, yaw: -0.5, kind: 1 },
    { x: 0.32, z: 0.05, scale: 0.9, yaw: 0.4, kind: 0 },
    { x: -0.05, z: -0.32, scale: 0.82, yaw: 0.9, kind: 0 },
    { x: 0.12, z: 0.22, scale: 0.65, yaw: -1.0, kind: 2 }
  ]
];

const TREE_LAYOUTS_HIGH: readonly (readonly TreeSpot[])[] = [
  [
    { x: -0.28, z: 0.22, scale: 1.35, yaw: 0.15, kind: 0 },
    { x: 0.3, z: -0.18, scale: 1.45, yaw: -0.35, kind: 1 },
    { x: 0.05, z: 0.32, scale: 1.2, yaw: 0.6, kind: 0 },
    { x: -0.32, z: -0.26, scale: 1.38, yaw: -0.7, kind: 1 },
    { x: 0.34, z: 0.28, scale: 1.15, yaw: 0.4, kind: 0 },
    { x: -0.05, z: -0.34, scale: 0.85, yaw: 1.0, kind: 2 }
  ],
  [
    { x: 0.22, z: 0.3, scale: 1.4, yaw: -0.2, kind: 1 },
    { x: -0.3, z: 0.12, scale: 1.5, yaw: 0.5, kind: 0 },
    { x: 0.32, z: -0.28, scale: 1.25, yaw: -0.55, kind: 0 },
    { x: -0.18, z: -0.3, scale: 1.35, yaw: 0.85, kind: 1 },
    { x: 0.08, z: 0.05, scale: 1.55, yaw: 0.1, kind: 0 },
    { x: -0.35, z: 0.32, scale: 0.9, yaw: -0.9, kind: 2 }
  ],
  [
    { x: -0.25, z: -0.2, scale: 1.45, yaw: 0.25, kind: 0 },
    { x: 0.28, z: 0.24, scale: 1.3, yaw: -0.4, kind: 1 },
    { x: 0.12, z: -0.32, scale: 1.48, yaw: 0.7, kind: 0 },
    { x: -0.34, z: 0.2, scale: 1.22, yaw: -0.15, kind: 1 },
    { x: 0.35, z: 0.02, scale: 1.4, yaw: 0.95, kind: 0 },
    { x: -0.02, z: 0.36, scale: 0.88, yaw: -0.65, kind: 2 }
  ]
];

const UNDERGROWTH_SPOTS: readonly { x: number; z: number }[] = [
  { x: -0.38, z: 0.05 },
  { x: 0.36, z: -0.08 },
  { x: -0.12, z: -0.38 },
  { x: 0.15, z: 0.38 },
  { x: -0.34, z: 0.32 },
  { x: 0.38, z: 0.3 },
  { x: 0.02, z: -0.12 },
  { x: -0.2, z: 0.08 }
];

function tileHash(q: number, r: number, salt = 0) {
  let n = Math.imul(q | 0, 1597334677) ^ Math.imul(r | 0, 3812015801) ^ salt;
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  n ^= n >>> 16;
  return n >>> 0;
}

/**
 * Décor forêt enrichi : pins / feuillus multi-étages, sous-bois, rochers, souches.
 */
export function createForestDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const trunk = new MeshStandardMaterial({
    color: 0x5c3a22,
    roughness: 0.94,
    metalness: 0.01
  });
  const trunkPale = new MeshStandardMaterial({
    color: 0x7a5332,
    roughness: 0.92,
    metalness: 0.01
  });
  const foliageA = new MeshStandardMaterial({
    color: 0x3f8f4a,
    roughness: 0.84,
    metalness: 0.02
  });
  const foliageB = new MeshStandardMaterial({
    color: 0x2f7340,
    roughness: 0.86,
    metalness: 0.02
  });
  const foliageC = new MeshStandardMaterial({
    color: 0x4aa358,
    roughness: 0.82,
    metalness: 0.02
  });
  const foliageHigh = new MeshStandardMaterial({
    color: 0x246038,
    roughness: 0.85,
    metalness: 0.02
  });
  const bush = new MeshStandardMaterial({
    color: 0x3a7a42,
    roughness: 0.9,
    metalness: 0.01
  });
  const fern = new MeshStandardMaterial({
    color: 0x5a9a4e,
    roughness: 0.88,
    metalness: 0.01
  });
  const rock = new MeshStandardMaterial({
    color: 0x6a737c,
    roughness: 0.96,
    metalness: 0.03
  });
  const rockMoss = new MeshStandardMaterial({
    color: 0x5a6e52,
    roughness: 0.94,
    metalness: 0.02
  });
  materials.push(
    trunk,
    trunkPale,
    foliageA,
    foliageB,
    foliageC,
    foliageHigh,
    bush,
    fern,
    rock,
    rockMoss
  );

  const trunkGeom = new CylinderGeometry(0.026, 0.04, 0.16, 6);
  const trunkThin = new CylinderGeometry(0.018, 0.028, 0.12, 5);
  const leafWide = new ConeGeometry(0.16, 0.22, 7);
  const leafMid = new ConeGeometry(0.12, 0.2, 6);
  const leafTip = new ConeGeometry(0.08, 0.16, 6);
  const leafRound = new ConeGeometry(0.14, 0.18, 8);
  const bushGeom = new ConeGeometry(0.09, 0.1, 5);
  const fernGeom = new ConeGeometry(0.045, 0.08, 4);
  const rockGeom = new CylinderGeometry(0.05, 0.065, 0.04, 5);
  geometries.push(
    trunkGeom,
    trunkThin,
    leafWide,
    leafMid,
    leafTip,
    leafRound,
    bushGeom,
    fernGeom,
    rockGeom
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

  function pine(
    group: Group,
    scale: number,
    yaw: number,
    foliage: MeshStandardMaterial,
    bark: MeshStandardMaterial
  ) {
    const tree = new Group();
    tree.rotation.y = yaw;
    addMesh(tree, trunkGeom, bark, 0, 0.08 * scale, 0, scale, scale, scale, 0);
    addMesh(tree, leafWide, foliage, 0, 0.22 * scale, 0, scale, scale * 0.95, scale, 0.1);
    addMesh(tree, leafMid, foliage, 0, 0.36 * scale, 0, scale * 0.9, scale, scale * 0.9, 0.4);
    addMesh(tree, leafTip, foliage, 0, 0.48 * scale, 0, scale * 0.85, scale * 1.05, scale * 0.85, 0.7);
    group.add(tree);
  }

  function broadleaf(
    group: Group,
    scale: number,
    yaw: number,
    foliage: MeshStandardMaterial,
    bark: MeshStandardMaterial
  ) {
    const tree = new Group();
    tree.rotation.y = yaw;
    addMesh(tree, trunkGeom, bark, 0, 0.07 * scale, 0, scale * 0.95, scale * 0.85, scale * 0.95, 0);
    addMesh(tree, leafRound, foliage, 0, 0.24 * scale, 0, scale * 1.15, scale * 0.9, scale * 1.15, 0.2);
    addMesh(tree, leafMid, foliage, 0.04 * scale, 0.34 * scale, -0.03 * scale, scale * 0.85, scale, scale * 0.85, 0.8);
    addMesh(tree, leafTip, foliage, -0.03 * scale, 0.4 * scale, 0.04 * scale, scale * 0.7, scale * 0.9, scale * 0.7, 1.2);
    group.add(tree);
  }

  function sapling(
    group: Group,
    scale: number,
    yaw: number,
    foliage: MeshStandardMaterial
  ) {
    const tree = new Group();
    tree.rotation.y = yaw;
    addMesh(tree, trunkThin, trunkPale, 0, 0.05 * scale, 0, scale, scale, scale, 0);
    addMesh(tree, leafMid, foliage, 0, 0.16 * scale, 0, scale * 0.85, scale * 0.9, scale * 0.85, 0.3);
    addMesh(tree, leafTip, foliage, 0, 0.26 * scale, 0, scale * 0.7, scale, scale * 0.7, 0.6);
    group.add(tree);
  }

  function createForTile(q: number, r: number, density: ForestDecorDensity = "normal") {
    const hash = tileHash(q, r);
    const h1 = tileHash(q, r, 41);
    const h2 = tileHash(q, r, 97);
    const high = density === "high";
    const layouts = high ? TREE_LAYOUTS_HIGH : TREE_LAYOUTS_NORMAL;
    const layout = layouts[hash % layouts.length]!;
    const count = high ? Math.min(layout.length, 5 + (hash % 2)) : Math.min(layout.length, 2 + (hash % 3));
    const group = new Group();

    for (let i = 0; i < count; i += 1) {
      const spot = layout[i]!;
      const foliagePool = high
        ? [foliageHigh, foliageB, foliageA]
        : [foliageA, foliageB, foliageC];
      const foliage = foliagePool[(hash >>> (i * 2)) % foliagePool.length]!;
      const bark = ((hash >>> (i + 3)) & 1) === 1 ? trunkPale : trunk;
      const scaleBoost = high ? 1.05 : 1;
      const scale = spot.scale * scaleBoost;
      const kind = spot.kind;

      if (kind === 0) pine(group, scale, spot.yaw, foliage, bark);
      else if (kind === 1) broadleaf(group, scale, spot.yaw, foliage, bark);
      else sapling(group, scale, spot.yaw, foliage);

      const last = group.children[group.children.length - 1] as Group;
      last.position.set(spot.x, 0, spot.z);
    }

    // Sous-bois : buissons + fougères
    const underCount = high ? 4 + (h1 % 3) : 2 + (h1 % 3);
    for (let i = 0; i < underCount; i += 1) {
      const spot = UNDERGROWTH_SPOTS[(h1 + i * 3) % UNDERGROWTH_SPOTS.length]!;
      const jx = (((h2 >>> (i * 3)) & 7) / 7 - 0.5) * 0.06;
      const jz = (((h2 >>> (i * 3 + 2)) & 7) / 7 - 0.5) * 0.06;
      const sx = 0.85 + ((h1 >>> i) & 3) * 0.12;
      if (((h1 >>> i) & 1) === 0) {
        addMesh(group, bushGeom, bush, spot.x + jx, 0.045 * sx, spot.z + jz, sx, sx, sx, i * 0.7);
      } else {
        addMesh(group, fernGeom, fern, spot.x + jx, 0.04 * sx, spot.z + jz, sx, sx * 1.1, sx, i * 0.9);
        addMesh(
          group,
          fernGeom,
          fern,
          spot.x + jx + 0.03,
          0.035 * sx,
          spot.z + jz - 0.02,
          sx * 0.8,
          sx,
          sx * 0.8,
          i * 1.2
        );
      }
    }

    // Rochers moussus
    const rockCount = high ? 2 + (h2 % 2) : 1 + (h2 % 2);
    for (let i = 0; i < rockCount; i += 1) {
      const ang = ((h2 + i * 2.3) % (Math.PI * 2));
      const dist = 0.28 + ((h1 >>> (i * 2)) % 4) * 0.05;
      const mat = ((h2 >>> i) & 1) === 1 ? rockMoss : rock;
      addMesh(
        group,
        rockGeom,
        mat,
        Math.cos(ang) * dist,
        0.02,
        Math.sin(ang) * dist,
        0.9 + (i % 2) * 0.35,
        0.8 + (i % 2) * 0.2,
        1 + (i % 3) * 0.15,
        ang
      );
    }

    return group;
  }

  return {
    createForTile,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
