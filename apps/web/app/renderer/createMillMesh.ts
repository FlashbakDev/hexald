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

/** Moulin low-poly : tour + ailes + sac de blé. */
export function createMillMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const timber = new MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.88,
    metalness: 0
  });
  const stone = new MeshStandardMaterial({
    color: 0xb8b0a0,
    roughness: 0.94,
    metalness: 0.04
  });
  const cloth = new MeshStandardMaterial({
    color: 0xd8c8a0,
    roughness: 0.9,
    metalness: 0
  });
  const wheat = new MeshStandardMaterial({
    color: 0xd4a84b,
    roughness: 0.88,
    metalness: 0
  });
  const earth = new MeshStandardMaterial({
    color: 0xb8956a,
    roughness: 0.95,
    metalness: 0
  });
  materials.push(timber, stone, cloth, wheat, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const baseGeom = new CylinderGeometry(0.14, 0.16, 0.12, 8);
  geometries.push(baseGeom);
  const base = new Mesh(baseGeom, stone);
  base.position.set(-0.04, 0.06, 0);
  group.add(base);

  const towerGeom = new CylinderGeometry(0.11, 0.13, 0.18, 8);
  geometries.push(towerGeom);
  const tower = new Mesh(towerGeom, timber);
  tower.position.set(-0.04, 0.2, 0);
  group.add(tower);

  const capGeom = new ConeGeometry(0.14, 0.1, 8);
  geometries.push(capGeom);
  const cap = new Mesh(capGeom, cloth);
  cap.position.set(-0.04, 0.34, 0);
  group.add(cap);

  const hubGeom = new CylinderGeometry(0.025, 0.025, 0.06, 8);
  geometries.push(hubGeom);
  const hub = new Mesh(hubGeom, timber);
  hub.rotation.z = Math.PI / 2;
  hub.position.set(0.1, 0.26, 0);
  group.add(hub);

  const bladeGeom = new BoxGeometry(0.04, 0.22, 0.02);
  geometries.push(bladeGeom);
  for (let i = 0; i < 4; i++) {
    const blade = new Mesh(bladeGeom, cloth);
    blade.position.set(0.14, 0.26, 0);
    blade.rotation.z = (Math.PI / 2) * i;
    group.add(blade);
  }

  const sackGeom = new BoxGeometry(0.1, 0.08, 0.08);
  geometries.push(sackGeom);
  const sack = new Mesh(sackGeom, wheat);
  sack.position.set(0.2, 0.05, -0.12);
  sack.rotation.y = 0.35;
  group.add(sack);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
