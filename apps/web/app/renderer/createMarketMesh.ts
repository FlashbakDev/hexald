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

/** Marché low-poly : étals + auvent + pile d’or. */
export function createMarketMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const wood = new MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.88,
    metalness: 0
  });
  const cloth = new MeshStandardMaterial({
    color: 0xc45a3a,
    roughness: 0.9,
    metalness: 0.02
  });
  const gold = new MeshStandardMaterial({
    color: 0xd4a84b,
    roughness: 0.4,
    metalness: 0.7
  });
  const earth = new MeshStandardMaterial({
    color: 0xb8956a,
    roughness: 0.95,
    metalness: 0
  });
  materials.push(wood, cloth, gold, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const stallGeom = new BoxGeometry(0.28, 0.1, 0.18);
  geometries.push(stallGeom);
  const stall = new Mesh(stallGeom, wood);
  stall.position.set(-0.04, 0.06, 0);
  group.add(stall);

  const postGeom = new BoxGeometry(0.03, 0.16, 0.03);
  geometries.push(postGeom);
  const postL = new Mesh(postGeom, wood);
  postL.position.set(-0.16, 0.14, -0.06);
  group.add(postL);
  const postR = new Mesh(postGeom, wood);
  postR.position.set(0.08, 0.14, -0.06);
  group.add(postR);

  const awningGeom = new BoxGeometry(0.3, 0.02, 0.2);
  geometries.push(awningGeom);
  const awning = new Mesh(awningGeom, cloth);
  awning.position.set(-0.04, 0.22, -0.02);
  awning.rotation.x = -0.15;
  group.add(awning);

  const coinGeom = new CylinderGeometry(0.03, 0.03, 0.012, 10);
  geometries.push(coinGeom);
  for (let i = 0; i < 4; i++) {
    const coin = new Mesh(coinGeom, gold);
    coin.position.set(0.16 + (i % 2) * 0.05, 0.02 + Math.floor(i / 2) * 0.014, 0.1);
    group.add(coin);
  }

  const bagGeom = new ConeGeometry(0.05, 0.08, 6);
  geometries.push(bagGeom);
  const bag = new Mesh(bagGeom, gold);
  bag.position.set(0.18, 0.05, -0.1);
  group.add(bag);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
