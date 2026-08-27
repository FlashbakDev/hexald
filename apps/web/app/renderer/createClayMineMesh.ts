import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";

/** Mine d’argile low-poly : fosse orangée + tas + abri. */
export function createClayMineMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const clay = new MeshStandardMaterial({
    color: 0xb88868,
    roughness: 0.94,
    metalness: 0.02
  });
  const clayDark = new MeshStandardMaterial({
    color: 0x8a5c42,
    roughness: 0.96,
    metalness: 0.02
  });
  const wood = new MeshStandardMaterial({
    color: 0x6b5340,
    roughness: 0.9,
    metalness: 0.04
  });
  const earth = new MeshStandardMaterial({
    color: 0x8a7a66,
    roughness: 0.96,
    metalness: 0
  });
  materials.push(clay, clayDark, wood, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const pitGeom = new BoxGeometry(0.3, 0.07, 0.26);
  geometries.push(pitGeom);
  const pit = new Mesh(pitGeom, clayDark);
  pit.position.set(-0.08, 0.035, 0.02);
  group.add(pit);

  const heapGeom = new BoxGeometry(0.16, 0.1, 0.14);
  geometries.push(heapGeom);
  const heap = new Mesh(heapGeom, clay);
  heap.position.set(0.16, 0.06, -0.06);
  heap.rotation.y = 0.4;
  group.add(heap);

  const rubbleGeom = new BoxGeometry(0.07, 0.05, 0.07);
  geometries.push(rubbleGeom);
  for (let i = 0; i < 3; i++) {
    const rubble = new Mesh(rubbleGeom, clay);
    rubble.position.set(0.1 + i * 0.05, 0.035, 0.14 - i * 0.04);
    rubble.rotation.y = 0.35 * i;
    group.add(rubble);
  }

  const postGeom = new BoxGeometry(0.03, 0.16, 0.03);
  geometries.push(postGeom);
  const postL = new Mesh(postGeom, wood);
  postL.position.set(-0.2, 0.09, -0.14);
  group.add(postL);
  const postR = new Mesh(postGeom, wood);
  postR.position.set(-0.02, 0.09, -0.14);
  group.add(postR);

  const roofGeom = new BoxGeometry(0.26, 0.02, 0.12);
  geometries.push(roofGeom);
  const roof = new Mesh(roofGeom, wood);
  roof.position.set(-0.11, 0.18, -0.14);
  roof.rotation.z = -0.12;
  group.add(roof);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
