import {
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

/** Positions locales (XZ) — layouts courts (forêt) et denses (haute forêt). */
const TREE_LAYOUTS_NORMAL: readonly (readonly { x: number; z: number; scale: number; yaw: number }[])[] =
  [
    [
      { x: -0.32, z: 0.18, scale: 0.92, yaw: 0.2 },
      { x: 0.28, z: -0.22, scale: 1.05, yaw: -0.4 },
      { x: 0.08, z: 0.34, scale: 0.78, yaw: 0.7 }
    ],
    [
      { x: 0.3, z: 0.2, scale: 1, yaw: -0.15 },
      { x: -0.26, z: -0.28, scale: 0.85, yaw: 0.55 },
      { x: -0.1, z: 0.3, scale: 0.95, yaw: -0.8 }
    ],
    [
      { x: -0.34, z: -0.1, scale: 0.88, yaw: 0.3 },
      { x: 0.22, z: 0.28, scale: 1.08, yaw: -0.25 },
      { x: 0.32, z: -0.3, scale: 0.72, yaw: 1.1 }
    ]
  ];

const TREE_LAYOUTS_HIGH: readonly (readonly { x: number; z: number; scale: number; yaw: number }[])[] =
  [
    [
      { x: -0.28, z: 0.22, scale: 1.35, yaw: 0.15 },
      { x: 0.3, z: -0.18, scale: 1.5, yaw: -0.35 },
      { x: 0.05, z: 0.32, scale: 1.25, yaw: 0.6 },
      { x: -0.32, z: -0.26, scale: 1.4, yaw: -0.7 },
      { x: 0.34, z: 0.28, scale: 1.2, yaw: 0.4 },
      { x: -0.05, z: -0.34, scale: 1.45, yaw: 1.0 }
    ],
    [
      { x: 0.22, z: 0.3, scale: 1.42, yaw: -0.2 },
      { x: -0.3, z: 0.12, scale: 1.55, yaw: 0.5 },
      { x: 0.32, z: -0.28, scale: 1.28, yaw: -0.55 },
      { x: -0.18, z: -0.3, scale: 1.38, yaw: 0.85 },
      { x: 0.08, z: 0.05, scale: 1.6, yaw: 0.1 },
      { x: -0.35, z: 0.32, scale: 1.22, yaw: -0.9 }
    ],
    [
      { x: -0.25, z: -0.2, scale: 1.48, yaw: 0.25 },
      { x: 0.28, z: 0.24, scale: 1.32, yaw: -0.4 },
      { x: 0.12, z: -0.32, scale: 1.52, yaw: 0.7 },
      { x: -0.34, z: 0.2, scale: 1.26, yaw: -0.15 },
      { x: 0.35, z: 0.02, scale: 1.44, yaw: 0.95 },
      { x: -0.02, z: 0.36, scale: 1.36, yaw: -0.65 }
    ]
  ];

function tileHash(q: number, r: number) {
  let n = Math.imul(q | 0, 1597334677) ^ Math.imul(r | 0, 3812015801);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n ^= n >>> 16;
  return n >>> 0;
}

/**
 * Kit de décor forêt : géométries / matériaux partagés.
 * `normal` = 2–3 arbres ; `high` (haute forêt) = 5–6 plus grands.
 */
export function createForestDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const trunk = new MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.92,
    metalness: 0
  });
  const foliageA = new MeshStandardMaterial({
    color: 0x3f8f4a,
    roughness: 0.82,
    metalness: 0.02
  });
  const foliageB = new MeshStandardMaterial({
    color: 0x2f7340,
    roughness: 0.85,
    metalness: 0.02
  });
  const foliageHigh = new MeshStandardMaterial({
    color: 0x246038,
    roughness: 0.84,
    metalness: 0.02
  });
  materials.push(trunk, foliageA, foliageB, foliageHigh);

  const trunkGeom = new CylinderGeometry(0.028, 0.038, 0.14, 6);
  const leafGeom = new ConeGeometry(0.14, 0.28, 7);
  geometries.push(trunkGeom, leafGeom);

  function tree(scale: number, yaw: number, foliage: MeshStandardMaterial) {
    const group = new Group();
    group.rotation.y = yaw;

    const trunkMesh = new Mesh(trunkGeom, trunk);
    trunkMesh.position.y = 0.07 * scale;
    trunkMesh.scale.setScalar(scale);
    disableRaycast(trunkMesh);
    group.add(trunkMesh);

    const leafMesh = new Mesh(leafGeom, foliage);
    leafMesh.position.y = (0.14 + 0.12) * scale;
    leafMesh.scale.setScalar(scale);
    disableRaycast(leafMesh);
    group.add(leafMesh);

    return group;
  }

  function createForTile(q: number, r: number, density: ForestDecorDensity = "normal") {
    const hash = tileHash(q, r);
    const high = density === "high";
    const layouts = high ? TREE_LAYOUTS_HIGH : TREE_LAYOUTS_NORMAL;
    const layout = layouts[hash % layouts.length]!;
    const count = high ? 5 + (hash % 2) : 2 + (hash % 2); // high: 5–6, normal: 2–3
    const group = new Group();

    for (let i = 0; i < count; i += 1) {
      const spot = layout[i]!;
      const foliage =
        high && ((hash >>> (i * 2)) & 1) === 1
          ? foliageHigh
          : ((hash >>> (i * 3)) & 1) === 1
            ? foliageB
            : foliageA;
      const scaleBoost = high ? 1.05 : 1;
      const treeGroup = tree(spot.scale * scaleBoost, spot.yaw, foliage);
      treeGroup.position.set(spot.x, 0, spot.z);
      group.add(treeGroup);
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
