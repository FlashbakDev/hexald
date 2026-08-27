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

/** Scierie low-poly : atelier + scie circulaire + pile de planches. */
export function createSawmillMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const timber = new MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.88,
    metalness: 0
  });
  const plank = new MeshStandardMaterial({
    color: 0xc4a574,
    roughness: 0.75,
    metalness: 0
  });
  const roof = new MeshStandardMaterial({
    color: 0x5c4030,
    roughness: 0.9,
    metalness: 0.02
  });
  const metal = new MeshStandardMaterial({
    color: 0x6a6e72,
    roughness: 0.45,
    metalness: 0.55
  });
  const earth = new MeshStandardMaterial({
    color: 0xb8956a,
    roughness: 0.95,
    metalness: 0
  });
  materials.push(timber, plank, roof, metal, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const wallGeom = new BoxGeometry(0.32, 0.18, 0.24);
  geometries.push(wallGeom);
  const walls = new Mesh(wallGeom, timber);
  walls.position.set(-0.08, 0.09, 0);
  group.add(walls);

  const roofGeom = new ConeGeometry(0.24, 0.12, 4);
  geometries.push(roofGeom);
  const roofMesh = new Mesh(roofGeom, roof);
  roofMesh.position.set(-0.08, 0.22, 0);
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const bladeGeom = new CylinderGeometry(0.1, 0.1, 0.012, 16);
  geometries.push(bladeGeom);
  const blade = new Mesh(bladeGeom, metal);
  blade.rotation.z = Math.PI / 2;
  blade.position.set(0.18, 0.12, 0.02);
  group.add(blade);

  const hubGeom = new CylinderGeometry(0.02, 0.02, 0.04, 8);
  geometries.push(hubGeom);
  const hub = new Mesh(hubGeom, metal);
  hub.rotation.z = Math.PI / 2;
  hub.position.set(0.18, 0.12, 0.02);
  group.add(hub);

  const plankGeom = new BoxGeometry(0.28, 0.025, 0.08);
  geometries.push(plankGeom);
  for (let i = 0; i < 3; i++) {
    const board = new Mesh(plankGeom, plank);
    board.position.set(0.14, 0.03 + i * 0.03, -0.14 + i * 0.02);
    board.rotation.y = 0.2 * i;
    group.add(board);
  }

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
