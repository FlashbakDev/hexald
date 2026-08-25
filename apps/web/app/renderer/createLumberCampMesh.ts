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

/** Camp de bûcherons low-poly : cabane + pile de grumes. */
export function createLumberCampMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const timber = new MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9, metalness: 0 });
  const bark = new MeshStandardMaterial({ color: 0x4a3422, roughness: 0.95, metalness: 0 });
  const roof = new MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85, metalness: 0.02 });
  const earth = new MeshStandardMaterial({ color: 0xb8956a, roughness: 0.95, metalness: 0 });
  materials.push(timber, bark, roof, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const wallGeom = new BoxGeometry(0.28, 0.16, 0.22);
  geometries.push(wallGeom);
  const walls = new Mesh(wallGeom, timber);
  walls.position.set(-0.12, 0.08, 0.02);
  group.add(walls);

  const roofGeom = new ConeGeometry(0.2, 0.12, 4);
  geometries.push(roofGeom);
  const roofMesh = new Mesh(roofGeom, roof);
  roofMesh.position.set(-0.12, 0.2, 0.02);
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const logGeom = new CylinderGeometry(0.035, 0.038, 0.34, 6);
  geometries.push(logGeom);
  for (let i = 0; i < 3; i++) {
    const log = new Mesh(logGeom, bark);
    log.rotation.z = Math.PI / 2;
    log.position.set(0.16, 0.035 + i * 0.055, -0.06 + i * 0.02);
    log.rotation.y = 0.15 * i;
    group.add(log);
  }

  const stumpGeom = new CylinderGeometry(0.05, 0.055, 0.06, 7);
  geometries.push(stumpGeom);
  const stump = new Mesh(stumpGeom, bark);
  stump.position.set(0.22, 0.03, 0.18);
  group.add(stump);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
