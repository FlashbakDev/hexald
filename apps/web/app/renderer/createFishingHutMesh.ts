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

/** Cabane de pêcheur low-poly : hutte sur pilotis + petite barque. */
export function createFishingHutMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const timber = new MeshStandardMaterial({ color: 0x6e4a2e, roughness: 0.9, metalness: 0 });
  const weathered = new MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.88, metalness: 0.02 });
  const roof = new MeshStandardMaterial({ color: 0x5c6e52, roughness: 0.92, metalness: 0 });
  const hull = new MeshStandardMaterial({ color: 0x3d4a55, roughness: 0.85, metalness: 0.08 });
  materials.push(timber, weathered, roof, hull);

  const deckGeom = new BoxGeometry(0.36, 0.02, 0.3);
  geometries.push(deckGeom);
  const deck = new Mesh(deckGeom, weathered);
  deck.position.set(-0.04, 0.06, 0);
  group.add(deck);

  for (const [x, z] of [
    [-0.16, -0.1],
    [-0.16, 0.1],
    [0.08, -0.1],
    [0.08, 0.1]
  ] as const) {
    const postGeom = new CylinderGeometry(0.018, 0.022, 0.12, 5);
    geometries.push(postGeom);
    const post = new Mesh(postGeom, timber);
    post.position.set(x, 0.03, z);
    group.add(post);
  }

  const wallGeom = new BoxGeometry(0.24, 0.14, 0.2);
  geometries.push(wallGeom);
  const walls = new Mesh(wallGeom, timber);
  walls.position.set(-0.04, 0.14, 0);
  group.add(walls);

  const roofGeom = new ConeGeometry(0.18, 0.1, 4);
  geometries.push(roofGeom);
  const roofMesh = new Mesh(roofGeom, roof);
  roofMesh.position.set(-0.04, 0.26, 0);
  roofMesh.rotation.y = Math.PI / 4;
  group.add(roofMesh);

  const boatGeom = new BoxGeometry(0.22, 0.05, 0.1);
  geometries.push(boatGeom);
  const boat = new Mesh(boatGeom, hull);
  boat.position.set(0.22, 0.04, 0.12);
  boat.rotation.y = -0.35;
  group.add(boat);

  const prowGeom = new ConeGeometry(0.04, 0.08, 4);
  geometries.push(prowGeom);
  const prow = new Mesh(prowGeom, hull);
  prow.rotation.z = -Math.PI / 2;
  prow.position.set(0.34, 0.04, 0.08);
  group.add(prow);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
