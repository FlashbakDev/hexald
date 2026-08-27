import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";

function disableRaycast(mesh: Mesh) {
  mesh.raycast = () => {};
}

/** Estuaire — embouchure fleuve → mer. */
export function createEstuaryDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const silt = new MeshStandardMaterial({
    color: 0x3a7a90,
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0x0a3040,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });
  const foam = new MeshStandardMaterial({
    color: 0xc8e0ec,
    roughness: 0.55,
    metalness: 0.04,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  });
  materials.push(silt, foam);

  const fanGeo = new BoxGeometry(0.55, 0.01, 0.4);
  const foamGeo = new BoxGeometry(0.5, 0.008, 0.08);
  geometries.push(fanGeo, foamGeo);

  const createForTile = (q: number, r: number) => {
    const group = new Group();
    group.userData.isEstuary = true;
    const yaw = ((q * 2 + r * 7) % 6) * (Math.PI / 6);

    const fan = new Mesh(fanGeo, silt);
    disableRaycast(fan);
    fan.position.y = 0.018;
    fan.rotation.y = yaw;
    group.add(fan);

    const lip = new Mesh(foamGeo, foam);
    disableRaycast(lip);
    lip.position.set(Math.sin(yaw) * 0.12, 0.026, Math.cos(yaw) * 0.12);
    lip.rotation.y = yaw;
    group.add(lip);

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
