import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";
import { HEX_DIRECTIONS } from "@hexald/shared";

function disableRaycast(mesh: Mesh) {
  mesh.raycast = () => {};
}

function unitTowardEdge(dirIndex: number) {
  const dir = HEX_DIRECTIONS[dirIndex]!;
  const x = Math.sqrt(3) * (dir.q + dir.r / 2);
  const z = 1.5 * dir.r;
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len };
}

/** Sommet `v` = jonction des arêtes `v` et `(v+1)%6` (pointy-top, rayon 1). */
function unitTowardVertex(vertexIndex: number) {
  const a = unitTowardEdge(vertexIndex);
  const b = unitTowardEdge((vertexIndex + 1) % 6);
  const x = a.x + b.x;
  const z = a.z + b.z;
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len, yaw: Math.atan2(x, z) };
}

/** Rayon hex pointy-top (aligne CylinderGeometry 6 faces de la tuile). */
const HEX_RADIUS = 1;
const VERTEX_RADIAL = HEX_RADIUS;

/**
 * Lac plein-tuile (hex) orienté vers un coin + demi-fleuve radial.
 */
export function createLakeDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const bank = new MeshStandardMaterial({
    color: 0x5a6e4e,
    roughness: 0.94,
    metalness: 0.02
  });
  const shore = new MeshStandardMaterial({
    color: 0x6a8070,
    roughness: 0.88,
    metalness: 0.04
  });
  const water = new MeshStandardMaterial({
    color: 0x3a9ec0,
    roughness: 0.2,
    metalness: 0.14,
    emissive: 0x154858,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.92
  });
  const waterDeep = new MeshStandardMaterial({
    color: 0x2a7a9a,
    roughness: 0.18,
    metalness: 0.16,
    emissive: 0x0e3848,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.95
  });
  const river = new MeshStandardMaterial({
    color: 0x4a9eb8,
    roughness: 0.32,
    metalness: 0.1,
    emissive: 0x1a4050,
    emissiveIntensity: 0.14
  });
  const riverCore = new MeshStandardMaterial({
    color: 0x3a8aa8,
    roughness: 0.25,
    metalness: 0.12,
    emissive: 0x154050,
    emissiveIntensity: 0.16
  });
  materials.push(bank, shore, water, waterDeep, river, riverCore);

  // Même orientation que la tuile (CylinderGeometry 6 → sommet sur +Z).
  const bankGeo = new CylinderGeometry(0.99, 0.99, 0.04, 6);
  const shoreGeo = new CylinderGeometry(0.94, 0.96, 0.03, 6);
  const waterGeo = new CylinderGeometry(0.9, 0.9, 0.036, 6);
  const deepGeo = new CylinderGeometry(0.62, 0.62, 0.028, 6);
  const spoutGeo = new BoxGeometry(0.22, 0.035, 0.28);
  // Longueur sur Z local (= radial après yaw) vers le coin.
  const halfBand = new BoxGeometry(0.14, 0.022, 0.4);
  const halfCore = new BoxGeometry(0.07, 0.014, 0.36);
  geometries.push(
    bankGeo,
    shoreGeo,
    waterGeo,
    deepGeo,
    spoutGeo,
    halfBand,
    halfCore
  );

  const createForTile = (
    _q: number,
    _r: number,
    outflowVertex: number | null,
    options?: { halfRiver?: boolean }
  ) => {
    const group = new Group();
    group.userData.isLake = true;
    group.userData.outflowVertex = outflowVertex;

    const hasOutflow = outflowVertex != null;
    const { x: ux, z: uz, yaw } = hasOutflow
      ? unitTowardVertex(outflowVertex)
      : { x: 0, z: 1, yaw: 0 };

    // Plan d’eau plein hex — couvre toute la tuile.
    const bankMesh = new Mesh(bankGeo, bank);
    disableRaycast(bankMesh);
    bankMesh.position.y = 0.02;
    group.add(bankMesh);

    const shoreMesh = new Mesh(shoreGeo, shore);
    disableRaycast(shoreMesh);
    shoreMesh.position.y = 0.032;
    group.add(shoreMesh);

    const pool = new Mesh(waterGeo, water);
    disableRaycast(pool);
    pool.position.y = 0.048;
    group.add(pool);

    const deep = new Mesh(deepGeo, waterDeep);
    disableRaycast(deep);
    deep.position.y = 0.055;
    if (hasOutflow) {
      deep.position.x = ux * 0.06;
      deep.position.z = uz * 0.06;
      deep.scale.set(1.05, 1, 0.88);
      deep.rotation.y = yaw;
    }
    group.add(deep);

    if (hasOutflow) {
      // Exutoire au coin (bec sur le bord du lac).
      const spout = new Mesh(spoutGeo, water);
      disableRaycast(spout);
      spout.position.set(ux * 0.72, 0.05, uz * 0.72);
      spout.rotation.y = yaw;
      group.add(spout);
    }

    // Demi-fleuve radial du bord du lac jusqu’au sommet.
    if (hasOutflow && options?.halfRiver !== false) {
      const start = 0.78;
      const end = VERTEX_RADIAL * 0.98;
      const mid = (start + end) / 2;
      const len = Math.max(0.08, end - start);

      const band = new Mesh(halfBand, river);
      disableRaycast(band);
      band.position.set(ux * mid, 0.04, uz * mid);
      band.rotation.y = yaw;
      band.scale.set(1, 1, len / 0.4);
      group.add(band);

      const core = new Mesh(halfCore, riverCore);
      disableRaycast(core);
      core.position.set(ux * mid, 0.048, uz * mid);
      core.rotation.y = yaw;
      core.scale.set(1, 1, len / 0.36);
      group.add(core);
    }

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
