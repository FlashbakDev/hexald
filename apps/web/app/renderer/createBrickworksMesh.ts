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

/** Briqueterie low-poly : four + tas d’argile + pile de briques. */
export function createBrickworksMesh() {
  const group = new Group();
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const brick = new MeshStandardMaterial({
    color: 0xb85a3a,
    roughness: 0.9,
    metalness: 0.04
  });
  const brickDark = new MeshStandardMaterial({
    color: 0x8a3f28,
    roughness: 0.92,
    metalness: 0.04
  });
  const clay = new MeshStandardMaterial({
    color: 0xb88868,
    roughness: 0.94,
    metalness: 0.02
  });
  const stone = new MeshStandardMaterial({
    color: 0x8a8680,
    roughness: 0.95,
    metalness: 0.05
  });
  const earth = new MeshStandardMaterial({
    color: 0xb8956a,
    roughness: 0.95,
    metalness: 0
  });
  materials.push(brick, brickDark, clay, stone, earth);

  const yardGeom = new CylinderGeometry(0.42, 0.42, 0.016, 10);
  geometries.push(yardGeom);
  const yard = new Mesh(yardGeom, earth);
  yard.position.y = 0.008;
  group.add(yard);

  const kilnGeom = new BoxGeometry(0.22, 0.2, 0.22);
  geometries.push(kilnGeom);
  const kiln = new Mesh(kilnGeom, stone);
  kiln.position.set(-0.1, 0.1, 0.02);
  group.add(kiln);

  const chimneyGeom = new CylinderGeometry(0.035, 0.045, 0.16, 8);
  geometries.push(chimneyGeom);
  const chimney = new Mesh(chimneyGeom, brickDark);
  chimney.position.set(-0.1, 0.26, 0.02);
  group.add(chimney);

  const roofGeom = new ConeGeometry(0.08, 0.06, 4);
  geometries.push(roofGeom);
  const roof = new Mesh(roofGeom, brickDark);
  roof.position.set(-0.1, 0.36, 0.02);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  const clayHeapGeom = new BoxGeometry(0.14, 0.08, 0.12);
  geometries.push(clayHeapGeom);
  const clayHeap = new Mesh(clayHeapGeom, clay);
  clayHeap.position.set(0.16, 0.05, -0.1);
  clayHeap.rotation.y = 0.3;
  group.add(clayHeap);

  const brickGeom = new BoxGeometry(0.08, 0.035, 0.04);
  geometries.push(brickGeom);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      const block = new Mesh(brickGeom, row % 2 === 0 ? brick : brickDark);
      block.position.set(
        0.12 + col * 0.09,
        0.025 + row * 0.038,
        0.1 + (row % 2) * 0.02
      );
      group.add(block);
    }
  }

  return {
    group,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
