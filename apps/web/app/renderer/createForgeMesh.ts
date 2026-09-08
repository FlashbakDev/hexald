import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";

/** Forge low-poly : enclume + foyer + outils. */
export function createForgeMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const wood = new MeshStandardMaterial({
    color: 0x6b4e32,
    roughness: 0.92,
    metalness: 0.02
  });
  const iron = new MeshStandardMaterial({
    color: 0x4a4e56,
    roughness: 0.48,
    metalness: 0.72
  });
  const ember = new MeshStandardMaterial({
    color: 0xd4682a,
    roughness: 0.55,
    metalness: 0.12,
    emissive: 0x6a2008,
    emissiveIntensity: 0.4
  });
  const stone = new MeshStandardMaterial({
    color: 0x7a7874,
    roughness: 0.94,
    metalness: 0.05
  });
  const earth = new MeshStandardMaterial({
    color: 0x7a7468,
    roughness: 0.96,
    metalness: 0
  });
  materials.push(wood, iron, ember, stone, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const blockGeom = new BoxGeometry(0.18, 0.12, 0.14);
  geometries.push(blockGeom);
  const block = new Mesh(blockGeom, wood);
  block.position.set(-0.1, 0.07, 0.02);
  group.add(block);

  const anvilGeom = new BoxGeometry(0.2, 0.06, 0.1);
  geometries.push(anvilGeom);
  const anvil = new Mesh(anvilGeom, iron);
  anvil.position.set(-0.1, 0.15, 0.02);
  group.add(anvil);

  const hornGeom = new BoxGeometry(0.08, 0.04, 0.05);
  geometries.push(hornGeom);
  const horn = new Mesh(hornGeom, iron);
  horn.position.set(0.02, 0.15, 0.02);
  group.add(horn);

  const hearthGeom = new BoxGeometry(0.16, 0.1, 0.16);
  geometries.push(hearthGeom);
  const hearth = new Mesh(hearthGeom, stone);
  hearth.position.set(0.16, 0.06, -0.08);
  group.add(hearth);

  const coalGeom = new BoxGeometry(0.1, 0.04, 0.1);
  geometries.push(coalGeom);
  const coal = new Mesh(coalGeom, ember);
  coal.position.set(0.16, 0.12, -0.08);
  group.add(coal);

  const handleGeom = new CylinderGeometry(0.015, 0.018, 0.16, 6);
  geometries.push(handleGeom);
  const handle = new Mesh(handleGeom, wood);
  handle.position.set(0.08, 0.14, 0.14);
  handle.rotation.z = Math.PI / 3;
  group.add(handle);

  const headGeom = new BoxGeometry(0.06, 0.035, 0.04);
  geometries.push(headGeom);
  const head = new Mesh(headGeom, iron);
  head.position.set(0.15, 0.2, 0.14);
  head.rotation.z = Math.PI / 3;
  group.add(head);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
