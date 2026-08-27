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

/** Fonderie low-poly : fourneau + cheminée + lingots. */
export function createSmelterMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const stone = new MeshStandardMaterial({
    color: 0x6a6864,
    roughness: 0.94,
    metalness: 0.08
  });
  const brick = new MeshStandardMaterial({
    color: 0x8a4a3a,
    roughness: 0.9,
    metalness: 0.05
  });
  const ember = new MeshStandardMaterial({
    color: 0xd4682a,
    roughness: 0.55,
    metalness: 0.15,
    emissive: 0x6a2008,
    emissiveIntensity: 0.35
  });
  const ingot = new MeshStandardMaterial({
    color: 0x8a9098,
    roughness: 0.45,
    metalness: 0.65
  });
  const earth = new MeshStandardMaterial({
    color: 0x7a7468,
    roughness: 0.96,
    metalness: 0
  });
  materials.push(stone, brick, ember, ingot, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const kilnGeom = new BoxGeometry(0.24, 0.2, 0.24);
  geometries.push(kilnGeom);
  const kiln = new Mesh(kilnGeom, stone);
  kiln.position.set(-0.06, 0.1, 0);
  group.add(kiln);

  const mouthGeom = new BoxGeometry(0.1, 0.08, 0.04);
  geometries.push(mouthGeom);
  const mouth = new Mesh(mouthGeom, ember);
  mouth.position.set(-0.06, 0.08, 0.14);
  group.add(mouth);

  const chimneyGeom = new CylinderGeometry(0.04, 0.05, 0.18, 8);
  geometries.push(chimneyGeom);
  const chimney = new Mesh(chimneyGeom, brick);
  chimney.position.set(-0.06, 0.28, -0.02);
  group.add(chimney);

  const capGeom = new ConeGeometry(0.06, 0.05, 4);
  geometries.push(capGeom);
  const cap = new Mesh(capGeom, brick);
  cap.position.set(-0.06, 0.39, -0.02);
  cap.rotation.y = Math.PI / 4;
  group.add(cap);

  const ingotGeom = new BoxGeometry(0.1, 0.035, 0.05);
  geometries.push(ingotGeom);
  for (let i = 0; i < 3; i++) {
    const bar = new Mesh(ingotGeom, ingot);
    bar.position.set(0.18, 0.03 + i * 0.04, -0.08 + i * 0.04);
    bar.rotation.y = 0.25 * i;
    group.add(bar);
  }

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
