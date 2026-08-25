import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from "three";
import type { HexCoord } from "@hexald/shared";
import { HEX_DIRECTIONS } from "@hexald/shared";

function disableRaycast(mesh: Mesh) {
  mesh.raycast = () => {};
}

function tileHash(q: number, r: number, salt = 0) {
  let n = Math.imul(q | 0, 1597334677) ^ Math.imul(r | 0, 3812015801) ^ salt;
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  n ^= n >>> 16;
  return n >>> 0;
}

function unitToward(dirIndex: number) {
  const dir = HEX_DIRECTIONS[dirIndex]!;
  const x = Math.sqrt(3) * (dir.q + dir.r / 2);
  const z = 1.5 * dir.r;
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len, yaw: Math.atan2(x, z) };
}

export type MountainDecorContext = {
  q: number;
  r: number;
  chainDirs: readonly number[];
};

/**
 * Montagne centrée et alignée sur l’hex (même orientation que la tuile).
 * Voisins : épaulements bas vers l’arête, sans décaler la masse hors tuile.
 */
export function createMountainDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const rockDark = new MeshStandardMaterial({
    color: 0x5c6570,
    roughness: 0.97,
    metalness: 0.04
  });
  const rock = new MeshStandardMaterial({
    color: 0x7d8794,
    roughness: 0.94,
    metalness: 0.03
  });
  const rockLight = new MeshStandardMaterial({
    color: 0x9aa3ae,
    roughness: 0.9,
    metalness: 0.02
  });
  const snow = new MeshStandardMaterial({
    color: 0xeef3f7,
    roughness: 0.72,
    metalness: 0.02
  });
  materials.push(rockDark, rock, rockLight, snow);

  // Socle = même hexa que la tuile (6 faces, rotation 0, rayon ≈ tuile).
  const plinthGeom = new CylinderGeometry(0.94, 0.98, 0.12, 6);
  const bodyGeom = new ConeGeometry(0.72, 0.42, 5);
  const peakL = new ConeGeometry(0.34, 0.55, 5);
  const peakM = new ConeGeometry(0.24, 0.4, 4);
  const peakS = new ConeGeometry(0.16, 0.28, 5);
  const snowCap = new ConeGeometry(0.11, 0.1, 5);
  const shoulderGeom = new ConeGeometry(0.36, 0.18, 5);
  geometries.push(plinthGeom, bodyGeom, peakL, peakM, peakS, snowCap, shoulderGeom);

  function addPeak(
    group: Group,
    geom: BufferGeometry,
    mat: MeshStandardMaterial,
    x: number,
    z: number,
    y: number,
    sx: number,
    sy: number,
    sz: number,
    yaw: number
  ) {
    const mesh = new Mesh(geom, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.y = yaw;
    disableRaycast(mesh);
    group.add(mesh);
  }

  function createForTile(ctx: MountainDecorContext) {
    const { q, r, chainDirs } = ctx;
    const h0 = tileHash(q, r);
    const h1 = tileHash(q, r, 91);
    const h2 = tileHash(q, r, 207);
    const group = new Group();
    // Groupe centré sur l’origine de la tuile (pas de décalage XZ).
    group.position.set(0, 0, 0);

    // Socle plein, aligné comme biomeGeometry (pas de rotation Y).
    const plinth = new Mesh(plinthGeom, rockDark);
    plinth.position.set(0, 0.06, 0);
    plinth.rotation.y = 0;
    disableRaycast(plinth);
    group.add(plinth);

    // Corps large, presque centré (léger jitter < 0.08).
    const bx = ((h0 % 5) - 2) * 0.025;
    const bz = ((h1 % 5) - 2) * 0.025;
    const body = new Mesh(bodyGeom, rock);
    body.position.set(bx, 0.12 + 0.21, bz);
    body.scale.set(1.05, 1 + (h0 % 3) * 0.06, 1.05);
    body.rotation.y = ((h0 % 7) * Math.PI) / 14;
    disableRaycast(body);
    group.add(body);

    // Pic principal proche du centre.
    const mainH = 0.95 + (h0 % 3) * 0.08;
    const mx = ((h2 % 5) - 2) * 0.04;
    const mz = ((h0 % 5) - 2) * 0.04;
    addPeak(group, peakL, rockLight, mx, mz, 0.28 + 0.28 * mainH, 1, mainH, 1, (h1 % 5) * 0.2);

    const cap = new Mesh(snowCap, snow);
    cap.position.set(mx, 0.28 + 0.55 * mainH + 0.02, mz);
    cap.scale.setScalar(0.95);
    disableRaycast(cap);
    group.add(cap);

    // Pics secondaires — restent dans le disque ~0.4 (intérieur de l’hex).
    const secondaries = [
      { geom: peakM, dist: 0.28, h: 0.72 },
      { geom: peakS, dist: 0.34, h: 0.55 },
      { geom: peakM, dist: 0.22, h: 0.65 }
    ];
    const count = 2 + (h1 % 2);
    for (let i = 0; i < count; i += 1) {
      const spec = secondaries[i]!;
      const ang = ((h0 + i * 2.1 + h2 * 0.01) % (Math.PI * 2));
      const dist = Math.min(0.38, spec.dist + ((h1 >>> (i * 2)) % 3) * 0.02);
      addPeak(
        group,
        spec.geom,
        i === 0 ? rock : rockDark,
        Math.cos(ang) * dist,
        Math.sin(ang) * dist,
        0.14 + 0.2 * spec.h,
        0.9,
        spec.h + ((h2 >>> i) % 3) * 0.06,
        0.9,
        ang
      );
    }

    // Fusion bas avec voisins montagne : épaule vers l’arête, toujours dans l’hex
    // (distance ≤ apothème ≈ 0.86) pour ne pas décaler le volume hors tuile.
    for (const dirIndex of chainDirs) {
      const { x: nx, z: nz, yaw } = unitToward(dirIndex);
      const shoulder = new Mesh(shoulderGeom, rockDark);
      // ~0.55 reste clairement dans l’hex ; le voisin pose la sienne en face.
      shoulder.position.set(nx * 0.55, 0.1, nz * 0.55);
      shoulder.scale.set(1.1, 0.85, 1.1);
      shoulder.rotation.y = yaw;
      disableRaycast(shoulder);
      group.add(shoulder);

      addPeak(
        group,
        peakS,
        rock,
        nx * 0.35,
        nz * 0.35,
        0.2,
        0.75,
        0.55,
        0.75,
        yaw
      );
    }

    return group;
  }

  return {
    createForTile,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}

export function mountainChainDirs(
  q: number,
  r: number,
  isMountainAt: (cell: HexCoord) => boolean
): number[] {
  const dirs: number[] = [];
  for (let i = 0; i < HEX_DIRECTIONS.length; i += 1) {
    const dir = HEX_DIRECTIONS[i]!;
    if (isMountainAt({ q: q + dir.q, r: r + dir.r })) dirs.push(i);
  }
  return dirs;
}
