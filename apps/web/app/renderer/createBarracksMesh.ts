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

/** Caserne low-poly : baraquement + pavillon (placeholder militaire). */
export function createBarracksMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const wood = new MeshStandardMaterial({
    color: 0x7a5a3a,
    roughness: 0.9,
    metalness: 0.02
  });
  const roof = new MeshStandardMaterial({
    color: 0x4a3a2a,
    roughness: 0.92,
    metalness: 0.02
  });
  const banner = new MeshStandardMaterial({
    color: 0x8b3a3a,
    roughness: 0.85,
    metalness: 0.05
  });
  const earth = new MeshStandardMaterial({
    color: 0x6b7a5a,
    roughness: 0.96,
    metalness: 0
  });
  materials.push(wood, roof, banner, earth);

  const yardGeom = new CylinderGeometry(0.4, 0.4, 0.014, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.007;
  group.add(yard);

  const hallGeom = new BoxGeometry(0.36, 0.16, 0.22);
  geometries.push(hallGeom);
  const hall = new Mesh(hallGeom, wood);
  hall.position.set(0, 0.08, 0);
  group.add(hall);

  const roofGeom = new BoxGeometry(0.4, 0.03, 0.26);
  geometries.push(roofGeom);
  const roofMesh = new Mesh(roofGeom, roof);
  roofMesh.position.set(0, 0.18, 0);
  group.add(roofMesh);

  const poleGeom = new CylinderGeometry(0.012, 0.012, 0.22, 6);
  geometries.push(poleGeom);
  const pole = new Mesh(poleGeom, wood);
  pole.position.set(0.18, 0.2, 0.12);
  group.add(pole);

  const flagGeom = new BoxGeometry(0.1, 0.06, 0.01);
  geometries.push(flagGeom);
  const flag = new Mesh(flagGeom, banner);
  flag.position.set(0.24, 0.28, 0.12);
  group.add(flag);

  const peakGeom = new ConeGeometry(0.02, 0.04, 4);
  geometries.push(peakGeom);
  const peak = new Mesh(peakGeom, banner);
  peak.position.set(0.18, 0.33, 0.12);
  group.add(peak);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
