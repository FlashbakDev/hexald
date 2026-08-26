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

/** Palette montagne (même que biomePalette.mountain). */
const MOUNTAIN_TOP = 0xe6eaf0;
const MOUNTAIN_SHADE = 0xb0bac8;
const MOUNTAIN_SIDE = 0x556070;

const ORE_COUNT = 10;

type Sparkle = {
  mesh: Mesh;
  baseY: number;
  phase: number;
  speed: number;
  bob: number;
  baseScale: number;
};

type OreChunk = {
  mesh: Mesh;
  mat: MeshStandardMaterial;
  baseEmissive: number;
  phase: number;
  speed: number;
};

/**
 * Gisement de fer — construction en couches :
 * 1) socle couleur montagne
 * 2) sol de cailloux partout
 * 3) ~10 minerais de fer + brillance sur chacun
 */
export function createIronDepositDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  // --- 1. Socle (couleur biome montagne) ---
  const plinthTop = new MeshStandardMaterial({
    color: MOUNTAIN_TOP,
    roughness: 0.9,
    metalness: 0.04
  });
  const plinthSide = new MeshStandardMaterial({
    color: MOUNTAIN_SIDE,
    roughness: 0.94,
    metalness: 0.03
  });

  // --- 2. Cailloux ---
  const pebbleLight = new MeshStandardMaterial({
    color: MOUNTAIN_SHADE,
    roughness: 0.95,
    metalness: 0.04
  });
  const pebbleMid = new MeshStandardMaterial({
    color: 0x8a949e,
    roughness: 0.96,
    metalness: 0.03
  });
  const pebbleDark = new MeshStandardMaterial({
    color: 0x6a727c,
    roughness: 0.97,
    metalness: 0.03
  });

  // --- 3. Minerai de fer brut ---
  const oreMat = new MeshStandardMaterial({
    color: 0x7a868e,
    roughness: 0.5,
    metalness: 0.82,
    emissive: 0x4a6878,
    emissiveIntensity: 0.45
  });
  const sparkleMat = new MeshStandardMaterial({
    color: 0xf4f9fc,
    roughness: 0.08,
    metalness: 1,
    emissive: 0xc8e0f0,
    emissiveIntensity: 1.15,
    transparent: true,
    opacity: 0.95,
    depthWrite: false
  });

  materials.push(
    plinthTop,
    plinthSide,
    pebbleLight,
    pebbleMid,
    pebbleDark,
    oreMat,
    sparkleMat
  );

  const plinthGeom = new CylinderGeometry(0.92, 0.96, 0.06, 6);
  const pebbleGeos = [
    new DodecahedronGeometry(0.048, 0),
    new DodecahedronGeometry(0.038, 0),
    new BoxGeometry(0.06, 0.032, 0.048),
    new BoxGeometry(0.042, 0.028, 0.05),
    new OctahedronGeometry(0.034, 0)
  ];
  const oreGeos = [
    new DodecahedronGeometry(0.052, 0),
    new OctahedronGeometry(0.046, 0),
    new BoxGeometry(0.058, 0.034, 0.044),
    new DodecahedronGeometry(0.04, 0)
  ];
  const sparkleGeo = new OctahedronGeometry(0.013, 0);
  geometries.push(plinthGeom, ...pebbleGeos, ...oreGeos, sparkleGeo);

  const pebbleMats = [pebbleLight, pebbleMid, pebbleDark];

  const createForTile = (q: number, r: number) => {
    const group = new Group();
    group.userData.isIronDeposit = true;
    const hash = tileHash(q, r, 417);

    // ── Étape 1 : socle couleur montagne ──
    const plinth = new Mesh(plinthGeom, [plinthSide, plinthTop, plinthTop]);
    disableRaycast(plinth);
    plinth.position.y = 0.03;
    group.add(plinth);

    // ── Étape 2 : sol de cailloux partout ──
    const pebbleCount = 36;
    for (let i = 0; i < pebbleCount; i += 1) {
      const geo = pebbleGeos[Math.floor(unit(hash, i + 2) * pebbleGeos.length)]!;
      const mat = pebbleMats[i % pebbleMats.length]!;
      const stone = new Mesh(geo, mat);
      disableRaycast(stone);

      // Remplissage uniforme du hex (pas un monticule).
      const ang = unit(hash, i + 4) * Math.PI * 2;
      const radial = Math.sqrt(unit(hash, i + 6)) * 0.78;
      const x = Math.cos(ang) * radial;
      const z = Math.sin(ang) * radial * 0.92;
      const y = 0.058 + unit(hash, i + 8) * 0.022;

      stone.position.set(x, y, z);
      stone.rotation.set(
        unit(hash, i + 10) * Math.PI,
        unit(hash, i + 12) * Math.PI * 2,
        unit(hash, i + 14) * Math.PI
      );
      const s = 0.85 + unit(hash, i + 16) * 0.55;
      stone.scale.set(
        s * (0.9 + unit(hash, i + 18) * 0.35),
        s * (0.55 + unit(hash, i + 20) * 0.3),
        s * (0.9 + unit(hash, i + 22) * 0.3)
      );
      group.add(stone);
    }

    // ── Étape 3 : une dizaine de minerais + brillance sur chacun ──
    const chunks: OreChunk[] = [];
    const sparkles: Sparkle[] = [];

    for (let i = 0; i < ORE_COUNT; i += 1) {
      const mat = oreMat.clone();
      materials.push(mat);

      const geo = oreGeos[Math.floor(unit(hash, i + 3) * oreGeos.length)]!;
      const mesh = new Mesh(geo, mat);
      disableRaycast(mesh);

      // Positions espacées (anneau + un peu de jitter).
      const ang = (i / ORE_COUNT) * Math.PI * 2 + unit(hash, i + 5) * 0.35;
      const radial = 0.12 + unit(hash, i + 7) * 0.42;
      const x = Math.cos(ang) * radial;
      const z = Math.sin(ang) * radial * 0.9;
      const y = 0.078 + unit(hash, i + 9) * 0.03;

      mesh.position.set(x, y, z);
      mesh.rotation.set(
        unit(hash, i + 11) * 1.6,
        unit(hash, i + 13) * Math.PI * 2,
        unit(hash, i + 15) * 1.2
      );
      const s = 0.95 + unit(hash, i + 17) * 0.55;
      mesh.scale.set(
        s * (0.95 + unit(hash, i + 19) * 0.3),
        s * (0.7 + unit(hash, i + 21) * 0.35),
        s * (0.95 + unit(hash, i + 23) * 0.25)
      );
      group.add(mesh);

      chunks.push({
        mesh,
        mat,
        baseEmissive: 0.45,
        phase: unit(hash, i + 1) * Math.PI * 2,
        speed: 1.8 + unit(hash, i + 3) * 1.6
      });

      // Brillance sur chaque minerai.
      const sparkle = new Mesh(sparkleGeo, sparkleMat);
      disableRaycast(sparkle);
      const baseY = y + 0.045 + unit(hash, i + 6) * 0.02;
      sparkle.position.set(x, baseY, z);
      const baseScale = 0.75 + unit(hash, i + 8) * 0.4;
      sparkle.scale.setScalar(baseScale);
      sparkles.push({
        mesh: sparkle,
        baseY,
        phase: unit(hash, i + 10) * Math.PI * 2,
        speed: 2.4 + unit(hash, i + 12) * 2.2,
        bob: 0.008 + unit(hash, i + 14) * 0.01,
        baseScale
      });
      group.add(sparkle);
    }

    group.userData.oreChunks = chunks;
    group.userData.sparkles = sparkles;
    group.userData.phase = unit(hash, 0) * Math.PI * 2;
    animate(group, performance.now());
    return group;
  };

  const animate = (group: Group, nowMs: number) => {
    if (!group.userData.isIronDeposit) return;
    const chunks = group.userData.oreChunks as OreChunk[] | undefined;
    const list = group.userData.sparkles as Sparkle[] | undefined;
    const base = (group.userData.phase as number) ?? 0;
    const t = nowMs * 0.001;

    if (chunks?.length) {
      for (const chunk of chunks) {
        const a = t * chunk.speed + chunk.phase + base;
        const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(a));
        chunk.mat.emissiveIntensity = chunk.baseEmissive * (0.6 + pulse * 0.85);
      }
    }

    if (!list?.length) return;
    for (const sparkle of list) {
      const a = t * sparkle.speed + sparkle.phase + base;
      const pulse = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(a));
      sparkle.mesh.position.y = sparkle.baseY + Math.sin(a * 1.2) * sparkle.bob;
      sparkle.mesh.scale.setScalar(sparkle.baseScale * (0.5 + pulse * 0.75));
      sparkle.mesh.rotation.y = a * 0.5;
      sparkle.mesh.rotation.z = a * 0.3;
      sparkleMat.emissiveIntensity = 0.7 + pulse * 0.7;
      sparkleMat.opacity = 0.45 + pulse * 0.5;
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
