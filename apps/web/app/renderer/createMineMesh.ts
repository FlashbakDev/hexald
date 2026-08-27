import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";

/** Mine de fer low-poly : puits gris + tas de minerai + chevalement. */
export function createMineMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const ore = new MeshStandardMaterial({
    color: 0x6a6e78,
    roughness: 0.88,
    metalness: 0.22
  });
  const oreDark = new MeshStandardMaterial({
    color: 0x3f444c,
    roughness: 0.92,
    metalness: 0.18
  });
  const wood = new MeshStandardMaterial({
    color: 0x6b5340,
    roughness: 0.9,
    metalness: 0.04
  });
  const earth = new MeshStandardMaterial({
    color: 0x7a7468,
    roughness: 0.96,
    metalness: 0
  });
  materials.push(ore, oreDark, wood, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const pitGeom = new CylinderGeometry(0.12, 0.14, 0.1, 8);
  geometries.push(pitGeom);
  const pit = new Mesh(pitGeom, oreDark);
  pit.position.set(-0.06, 0.04, 0.02);
  group.add(pit);

  const heapGeom = new BoxGeometry(0.18, 0.11, 0.15);
  geometries.push(heapGeom);
  const heap = new Mesh(heapGeom, ore);
  heap.position.set(0.18, 0.065, -0.05);
  heap.rotation.y = 0.35;
  group.add(heap);

  const rubbleGeom = new BoxGeometry(0.06, 0.05, 0.06);
  geometries.push(rubbleGeom);
  for (let i = 0; i < 3; i++) {
    const rubble = new Mesh(rubbleGeom, ore);
    rubble.position.set(0.12 + i * 0.05, 0.035, 0.14 - i * 0.04);
    rubble.rotation.y = 0.4 * i;
    group.add(rubble);
  }

  const postGeom = new BoxGeometry(0.035, 0.22, 0.035);
  geometries.push(postGeom);
  const postL = new Mesh(postGeom, wood);
  postL.position.set(-0.16, 0.12, -0.12);
  group.add(postL);
  const postR = new Mesh(postGeom, wood);
  postR.position.set(0.04, 0.12, -0.12);
  group.add(postR);

  const beamGeom = new BoxGeometry(0.26, 0.03, 0.04);
  geometries.push(beamGeom);
  const beam = new Mesh(beamGeom, wood);
  beam.position.set(-0.06, 0.24, -0.12);
  group.add(beam);

  const winchGeom = new BoxGeometry(0.08, 0.05, 0.08);
  geometries.push(winchGeom);
  const winch = new Mesh(winchGeom, wood);
  winch.position.set(-0.06, 0.2, -0.02);
  group.add(winch);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
