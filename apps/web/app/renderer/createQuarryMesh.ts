import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";

/** Carrière low-poly : bloc de pierre + tas. */
export function createQuarryMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const stone = new MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.92, metalness: 0.05 });
  const darkStone = new MeshStandardMaterial({ color: 0x6d7580, roughness: 0.95, metalness: 0.04 });
  const earth = new MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.96, metalness: 0 });
  materials.push(stone, darkStone, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const pitGeom = new BoxGeometry(0.32, 0.08, 0.28);
  geometries.push(pitGeom);
  const pit = new Mesh(pitGeom, darkStone);
  pit.position.set(-0.06, 0.04, 0);
  group.add(pit);

  const blockGeom = new BoxGeometry(0.14, 0.12, 0.12);
  geometries.push(blockGeom);
  const block = new Mesh(blockGeom, stone);
  block.position.set(0.18, 0.07, -0.08);
  block.rotation.y = 0.35;
  group.add(block);

  const rubbleGeom = new BoxGeometry(0.08, 0.06, 0.08);
  geometries.push(rubbleGeom);
  for (let i = 0; i < 3; i++) {
    const rubble = new Mesh(rubbleGeom, stone);
    rubble.position.set(0.12 + i * 0.06, 0.04, 0.12 - i * 0.04);
    rubble.rotation.y = 0.4 * i;
    group.add(rubble);
  }

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
