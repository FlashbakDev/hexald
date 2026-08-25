import {
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";

function disableRaycast(mesh: Mesh) {
  mesh.raycast = () => {};
}

function tileHash(q: number, r: number) {
  let n = Math.imul(q | 0, 1597334677) ^ Math.imul(r | 0, 3812015801);
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n ^= n >>> 16;
  return n >>> 0;
}

/** Touffes d’herbe très basses, clairsemées — pas d’arbres. */
const GRASS_SPOTS: readonly { x: number; z: number }[] = [
  { x: -0.28, z: 0.16 },
  { x: 0.24, z: -0.2 },
  { x: 0.1, z: 0.3 },
  { x: -0.18, z: -0.26 },
  { x: 0.32, z: 0.12 },
  { x: -0.05, z: 0.02 }
];

/**
 * Décor plaine : quelques brins d’herbe discrets sur une tuile verte.
 */
export function createPlainsDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const grassA = new MeshStandardMaterial({
    color: 0x6aad4e,
    roughness: 0.9,
    metalness: 0
  });
  const grassB = new MeshStandardMaterial({
    color: 0x7fbe5c,
    roughness: 0.88,
    metalness: 0
  });
  materials.push(grassA, grassB);

  const bladeGeom = new ConeGeometry(0.028, 0.07, 4);
  geometries.push(bladeGeom);

  function tuft(scale: number, yaw: number, dark: boolean) {
    const group = new Group();
    group.rotation.y = yaw;
    const count = 2 + (dark ? 1 : 0);
    for (let i = 0; i < count; i += 1) {
      const blade = new Mesh(bladeGeom, dark ? grassA : grassB);
      blade.position.set((i - 1) * 0.022, 0.032 * scale, (i % 2) * 0.018);
      blade.rotation.z = (i - 1) * 0.18;
      blade.scale.set(scale * 0.85, scale, scale * 0.85);
      disableRaycast(blade);
      group.add(blade);
    }
    return group;
  }

  function createForTile(q: number, r: number) {
    const hash = tileHash(q, r);
    const group = new Group();
    const count = 3 + (hash % 3); // 3 à 5 touffes

    for (let i = 0; i < count; i += 1) {
      const spot = GRASS_SPOTS[(hash + i * 3) % GRASS_SPOTS.length]!;
      const jitterX = (((hash >>> (i * 4)) & 7) / 7 - 0.5) * 0.08;
      const jitterZ = (((hash >>> (i * 4 + 3)) & 7) / 7 - 0.5) * 0.08;
      const scale = 0.75 + (((hash >>> (i + 2)) & 3) / 3) * 0.35;
      const yaw = ((hash >>> (i * 5)) & 15) / 15 * Math.PI * 2;
      const bunch = tuft(scale, yaw, ((hash >>> i) & 1) === 1);
      bunch.position.set(spot.x + jitterX, 0, spot.z + jitterZ);
      group.add(bunch);
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
