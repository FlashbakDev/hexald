import {
  BoxGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  type BufferGeometry,
  type Material
} from "three";

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

function unit(hash: number, i: number) {
  return ((hash >>> (i % 24)) & 255) / 255;
}

/** Palette plaine + argile orangée. */
const PLAINS_TOP = 0xa3b87a;
const PLAINS_SIDE = 0xa09060;
const CLAY_LIGHT = 0xc4a07a;
const CLAY_MID = 0xa87858;
const CLAY_DARK = 0x8a5c42;

const CLUMP_COUNT = 9;

type ClayClump = {
  mesh: Mesh;
  mat: MeshStandardMaterial;
  baseY: number;
  phase: number;
  speed: number;
  bob: number;
};

/**
 * Gisement d’argile — socle plaine + tas d’argile orangée.
 */
export function createClayDepositDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const plinthTop = new MeshStandardMaterial({
    color: PLAINS_TOP,
    roughness: 0.94,
    metalness: 0.02
  });
  const plinthSide = new MeshStandardMaterial({
    color: PLAINS_SIDE,
    roughness: 0.96,
    metalness: 0.02
  });

  const clayLight = new MeshStandardMaterial({
    color: CLAY_LIGHT,
    roughness: 0.92,
    metalness: 0.02
  });
  const clayMid = new MeshStandardMaterial({
    color: CLAY_MID,
    roughness: 0.94,
    metalness: 0.02
  });
  const clayDark = new MeshStandardMaterial({
    color: CLAY_DARK,
    roughness: 0.96,
    metalness: 0.02
  });

  materials.push(plinthTop, plinthSide, clayLight, clayMid, clayDark);

  const plinthGeom = new CylinderGeometry(0.9, 0.94, 0.05, 6);
  const clumpGeos = [
    new DodecahedronGeometry(0.055, 0),
    new OctahedronGeometry(0.048, 0),
    new BoxGeometry(0.07, 0.04, 0.055),
    new DodecahedronGeometry(0.042, 0)
  ];
  geometries.push(plinthGeom, ...clumpGeos);

  const clayMats = [clayLight, clayMid, clayDark];

  const createForTile = (q: number, r: number) => {
    const group = new Group();
    group.userData.isClayDeposit = true;
    const hash = tileHash(q, r, 523);

    const plinth = new Mesh(plinthGeom, [plinthSide, plinthTop, plinthTop]);
    disableRaycast(plinth);
    plinth.position.y = 0.025;
    group.add(plinth);

    const clumps: ClayClump[] = [];

    for (let i = 0; i < CLUMP_COUNT; i += 1) {
      const mat = clayMats[i % clayMats.length]!.clone();
      materials.push(mat);
      const geo = clumpGeos[Math.floor(unit(hash, i + 2) * clumpGeos.length)]!;
      const mesh = new Mesh(geo, mat);
      disableRaycast(mesh);

      const ang = (i / CLUMP_COUNT) * Math.PI * 2 + unit(hash, i + 4) * 0.4;
      const radial = 0.1 + unit(hash, i + 6) * 0.48;
      const x = Math.cos(ang) * radial;
      const z = Math.sin(ang) * radial * 0.9;
      const y = 0.055 + unit(hash, i + 8) * 0.035;

      mesh.position.set(x, y, z);
      mesh.rotation.set(
        unit(hash, i + 10) * 1.4,
        unit(hash, i + 12) * Math.PI * 2,
        unit(hash, i + 14) * 1.1
      );
      const s = 0.9 + unit(hash, i + 16) * 0.6;
      mesh.scale.set(
        s * (0.95 + unit(hash, i + 18) * 0.3),
        s * (0.65 + unit(hash, i + 20) * 0.4),
        s * (0.95 + unit(hash, i + 22) * 0.25)
      );
      group.add(mesh);

      clumps.push({
        mesh,
        mat,
        baseY: y,
        phase: unit(hash, i + 1) * Math.PI * 2,
        speed: 0.6 + unit(hash, i + 3) * 0.5,
        bob: 0.004 + unit(hash, i + 5) * 0.006
      });
    }

    // Petit monticule central.
    const moundMat = clayMid.clone();
    materials.push(moundMat);
    const mound = new Mesh(new DodecahedronGeometry(0.12, 0), moundMat);
    disableRaycast(mound);
    mound.position.set(0, 0.07, 0);
    mound.scale.set(1.1, 0.55, 1);
    group.add(mound);
    geometries.push(mound.geometry);

    group.userData.clayClumps = clumps;
    group.userData.phase = unit(hash, 0) * Math.PI * 2;
    animate(group, performance.now());
    return group;
  };

  const animate = (group: Group, nowMs: number) => {
    if (!group.userData.isClayDeposit) return;
    const list = group.userData.clayClumps as ClayClump[] | undefined;
    const base = (group.userData.phase as number) ?? 0;
    if (!list?.length) return;
    const t = nowMs * 0.001;
    for (const clump of list) {
      const a = t * clump.speed + clump.phase + base;
      clump.mesh.position.y = clump.baseY + Math.sin(a) * clump.bob;
    }
  };

  return {
    createForTile,
    animate,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
