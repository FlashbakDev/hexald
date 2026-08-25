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

/** Ferme low-poly : grange + champs. */
export function createFarmMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const wood = new MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.88, metalness: 0 });
  const roof = new MeshStandardMaterial({ color: 0xa84c32, roughness: 0.82, metalness: 0.02 });
  const crop = new MeshStandardMaterial({ color: 0xc9b04a, roughness: 0.9, metalness: 0 });
  const soil = new MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.95, metalness: 0 });
  materials.push(wood, roof, crop, soil);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, soil);
  yard.position.y = 0.008;
  group.add(yard);

  const barnGeom = new BoxGeometry(0.26, 0.18, 0.2);
  geometries.push(barnGeom);
  const barn = new Mesh(barnGeom, wood);
  barn.position.set(-0.1, 0.09, 0.04);
  group.add(barn);

  const roofGeom = new ConeGeometry(0.18, 0.1, 4);
  geometries.push(roofGeom);
  const roofMesh = new Mesh(roofGeom, roof);
  roofMesh.position.set(-0.1, 0.22, 0.04);
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const rowGeom = new BoxGeometry(0.22, 0.04, 0.05);
  geometries.push(rowGeom);
  for (let i = 0; i < 3; i++) {
    const row = new Mesh(rowGeom, crop);
    row.position.set(0.16, 0.03, -0.12 + i * 0.1);
    group.add(row);
  }

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
