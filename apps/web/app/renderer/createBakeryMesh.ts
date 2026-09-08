import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";

/** Boulangerie low-poly : four + comptoir + pain. */
export function createBakeryMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const wood = new MeshStandardMaterial({
    color: 0x8a6238,
    roughness: 0.9,
    metalness: 0.02
  });
  const plaster = new MeshStandardMaterial({
    color: 0xd8c4a0,
    roughness: 0.92,
    metalness: 0.01
  });
  const brick = new MeshStandardMaterial({
    color: 0x9a5a3c,
    roughness: 0.88,
    metalness: 0.04
  });
  const crust = new MeshStandardMaterial({
    color: 0xc48a3a,
    roughness: 0.75,
    metalness: 0.02
  });
  const earth = new MeshStandardMaterial({
    color: 0x7a7468,
    roughness: 0.96,
    metalness: 0
  });
  materials.push(wood, plaster, brick, crust, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const baseGeom = new BoxGeometry(0.34, 0.14, 0.28);
  geometries.push(baseGeom);
  const base = new Mesh(baseGeom, plaster);
  base.position.set(-0.04, 0.08, 0);
  group.add(base);

  const counterGeom = new BoxGeometry(0.3, 0.04, 0.12);
  geometries.push(counterGeom);
  const counter = new Mesh(counterGeom, wood);
  counter.position.set(-0.04, 0.17, 0.12);
  group.add(counter);

  const ovenGeom = new BoxGeometry(0.2, 0.22, 0.2);
  geometries.push(ovenGeom);
  const oven = new Mesh(ovenGeom, brick);
  oven.position.set(0.18, 0.12, -0.06);
  group.add(oven);

  const domeGeom = new CylinderGeometry(0.09, 0.11, 0.08, 8);
  geometries.push(domeGeom);
  const dome = new Mesh(domeGeom, brick);
  dome.position.set(0.18, 0.26, -0.06);
  group.add(dome);

  const loafGeom = new BoxGeometry(0.08, 0.035, 0.05);
  geometries.push(loafGeom);
  const loafA = new Mesh(loafGeom, crust);
  loafA.position.set(-0.1, 0.2, 0.12);
  group.add(loafA);
  const loafB = new Mesh(loafGeom, crust);
  loafB.position.set(0.02, 0.2, 0.12);
  group.add(loafB);

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
