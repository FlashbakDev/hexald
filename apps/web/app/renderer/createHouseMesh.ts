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

/** Maison low-poly niveau 1 : cottage bois + toit. */
export function createHouseMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const walls = new MeshStandardMaterial({
    color: 0xc4a574,
    roughness: 0.9,
    metalness: 0
  });
  const timber = new MeshStandardMaterial({
    color: 0x6b4423,
    roughness: 0.88,
    metalness: 0
  });
  const roof = new MeshStandardMaterial({
    color: 0x8b4518,
    roughness: 0.85,
    metalness: 0.02
  });
  const yard = new MeshStandardMaterial({
    color: 0x6b8f4e,
    roughness: 0.95,
    metalness: 0
  });
  materials.push(walls, timber, roof, yard);

  const yardGeom = new CylinderGeometry(0.38, 0.38, 0.014, 10);
  geometries.push(yardGeom);
  const yardMesh = new Mesh(yardGeom, yard);
  yardMesh.position.y = 0.007;
  group.add(yardMesh);

  const bodyGeom = new BoxGeometry(0.32, 0.22, 0.28);
  geometries.push(bodyGeom);
  const body = new Mesh(bodyGeom, walls);
  body.position.set(0, 0.12, 0);
  group.add(body);

  const beamGeom = new BoxGeometry(0.34, 0.03, 0.03);
  geometries.push(beamGeom);
  const beam = new Mesh(beamGeom, timber);
  beam.position.set(0, 0.22, 0);
  group.add(beam);

  const roofGeom = new ConeGeometry(0.26, 0.16, 4);
  geometries.push(roofGeom);
  const roofMesh = new Mesh(roofGeom, roof);
  roofMesh.position.set(0, 0.32, 0);
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const doorGeom = new BoxGeometry(0.08, 0.12, 0.02);
  geometries.push(doorGeom);
  const door = new Mesh(doorGeom, timber);
  door.position.set(0, 0.08, 0.145);
  group.add(door);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
