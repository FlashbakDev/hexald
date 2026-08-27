import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";

function disableRaycast(mesh: Mesh) {
  mesh.raycast = () => {};
}

/** Lac plein-tuile (sans écoulement). */
export function createLakeDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const bank = new MeshStandardMaterial({
    color: 0x4a5e42,
    roughness: 0.94,
    metalness: 0.02
  });
  const water = new MeshStandardMaterial({
    color: 0x2f92b4,
    roughness: 0.18,
    metalness: 0.14,
    emissive: 0x123c4c,
    emissiveIntensity: 0.3
  });
  const waterDeep = new MeshStandardMaterial({
    color: 0x247a9a,
    roughness: 0.16,
    metalness: 0.16,
    emissive: 0x0c3040,
    emissiveIntensity: 0.24
  });
  materials.push(bank, water, waterDeep);

  const bankGeo = new CylinderGeometry(1, 1, 0.045, 6);
  const waterGeo = new CylinderGeometry(0.97, 0.97, 0.04, 6);
  const deepGeo = new CylinderGeometry(0.7, 0.7, 0.03, 6);
  geometries.push(bankGeo, waterGeo, deepGeo);

  const createForTile = (_q: number, _r: number) => {
    const group = new Group();
    group.userData.isLake = true;

    const bankMesh = new Mesh(bankGeo, bank);
    disableRaycast(bankMesh);
    bankMesh.position.y = 0.018;
    group.add(bankMesh);

    const pool = new Mesh(waterGeo, water);
    disableRaycast(pool);
    pool.position.y = 0.042;
    group.add(pool);

    const deep = new Mesh(deepGeo, waterDeep);
    disableRaycast(deep);
    deep.position.y = 0.05;
    group.add(deep);

    return group;
  };

  return {
    createForTile,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
