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

/** Animation de base du bétail : pause puis quelques pas individuels. */
export const LIVESTOCK_IDLE_MIN_MS = 2000;
export const LIVESTOCK_IDLE_MAX_MS = 5000;
export const LIVESTOCK_WALK_MS = 700;
export const LIVESTOCK_STEP_DIST = 0.07;
export const LIVESTOCK_COUNT = 5;
/** Distance mini centre-à-centre pour éviter l’overlap des meshes. */
const MIN_SEPARATION = 0.2;
const TILE_RADIUS = 0.4;
/** Rayon de vagabondage autour du slot de chaque animal. */
const HOME_RADIUS = 0.09;

/** Formation espacée pour 5 têtes (≥ MIN_SEPARATION). */
const HERD_SLOTS: readonly { x: number; z: number }[] = [
  { x: -0.26, z: 0.16 },
  { x: 0.26, z: 0.14 },
  { x: 0.0, z: -0.28 },
  { x: -0.24, z: -0.14 },
  { x: 0.24, z: -0.12 }
];

type LivestockAnimal = {
  mesh: Group;
  /** Point d’attache (slot). */
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  yaw: number;
  phase: "idle" | "walking";
  phaseAt: number;
  idleMs: number;
  walkMs: number;
};

type HerdMotion = {
  animals: LivestockAnimal[];
  rng: number;
};

function clampTo(x: number, z: number, cx: number, cz: number, radius: number) {
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.hypot(dx, dz);
  if (d <= radius) return { x, z };
  const s = radius / d;
  return { x: cx + dx * s, z: cz + dz * s };
}

function clampInTile(x: number, z: number) {
  return clampTo(x, z, 0, 0, TILE_RADIUS);
}

function nextIdleMs(seed: number) {
  return LIVESTOCK_IDLE_MIN_MS + seed * (LIVESTOCK_IDLE_MAX_MS - LIVESTOCK_IDLE_MIN_MS);
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Troupeau de vaches low-poly — chaque animal marche seul (pas de sync troupeau).
 */
export function createCowHerdDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const bodyMat = new MeshStandardMaterial({
    color: 0xf2efe6,
    roughness: 0.88,
    metalness: 0.02
  });
  const spotMat = new MeshStandardMaterial({
    color: 0x3a342e,
    roughness: 0.9,
    metalness: 0.02
  });
  const darkMat = new MeshStandardMaterial({
    color: 0x2c2824,
    roughness: 0.92,
    metalness: 0.02
  });
  const snoutMat = new MeshStandardMaterial({
    color: 0xd4a090,
    roughness: 0.85,
    metalness: 0.01
  });
  materials.push(bodyMat, spotMat, darkMat, snoutMat);

  const bodyGeo = new BoxGeometry(0.14, 0.09, 0.08);
  const spotGeo = new BoxGeometry(0.05, 0.05, 0.045);
  const headGeo = new BoxGeometry(0.06, 0.055, 0.055);
  const snoutGeo = new BoxGeometry(0.035, 0.028, 0.04);
  const legGeo = new CylinderGeometry(0.012, 0.014, 0.055, 5);
  const hornGeo = new ConeGeometry(0.012, 0.028, 4);
  const udderGeo = new CylinderGeometry(0.018, 0.022, 0.02, 5);
  geometries.push(bodyGeo, spotGeo, headGeo, snoutGeo, legGeo, hornGeo, udderGeo);

  function addMesh(
    group: Group,
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    yaw = 0
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.y = yaw;
    disableRaycast(mesh);
    group.add(mesh);
  }

  function makeCow(scale: number, spotted: boolean): Group {
    const cow = new Group();
    addMesh(cow, bodyGeo, bodyMat, 0, 0.08 * scale, 0, scale, scale, scale);
    if (spotted) {
      addMesh(cow, spotGeo, spotMat, 0.03 * scale, 0.1 * scale, 0.02 * scale, scale, scale, scale);
      addMesh(
        cow,
        spotGeo,
        spotMat,
        -0.035 * scale,
        0.09 * scale,
        -0.015 * scale,
        scale * 0.85,
        scale,
        scale
      );
    }
    addMesh(cow, headGeo, bodyMat, 0.09 * scale, 0.1 * scale, 0, scale, scale, scale);
    addMesh(cow, snoutGeo, snoutMat, 0.125 * scale, 0.09 * scale, 0, scale, scale, scale);
    addMesh(
      cow,
      hornGeo,
      darkMat,
      0.08 * scale,
      0.14 * scale,
      0.02 * scale,
      scale * 0.7,
      scale,
      scale * 0.7
    );
    addMesh(
      cow,
      hornGeo,
      darkMat,
      0.08 * scale,
      0.14 * scale,
      -0.02 * scale,
      scale * 0.7,
      scale,
      scale * 0.7
    );
    addMesh(cow, udderGeo, snoutMat, -0.02 * scale, 0.045 * scale, 0, scale, scale, scale);

    const legs: Array<[number, number]> = [
      [0.045, 0.028],
      [0.045, -0.028],
      [-0.05, 0.028],
      [-0.05, -0.028]
    ];
    for (const [lx, lz] of legs) {
      addMesh(cow, legGeo, darkMat, lx * scale, 0.03 * scale, lz * scale, scale, scale, scale);
    }
    return cow;
  }

  function placeAnimal(animal: LivestockAnimal, walkProgress = 1) {
    const p = animal.phase === "walking" ? walkProgress : 1;
    const x = animal.x + (animal.tx - animal.x) * p;
    const z = animal.z + (animal.tz - animal.z) * p;
    const bob =
      animal.phase === "walking" && p > 0 && p < 1
        ? Math.abs(Math.sin(p * Math.PI * 2.5)) * 0.01
        : 0;
    animal.mesh.position.set(x, bob, z);
    animal.mesh.rotation.y = animal.yaw;
  }

  function animalPos(animal: LivestockAnimal, nowMs: number) {
    if (animal.phase !== "walking") return { x: animal.x, z: animal.z };
    const t = Math.min(1, Math.max(0, (nowMs - animal.phaseAt) / animal.walkMs));
    const p = easeInOut(t);
    return {
      x: animal.x + (animal.tx - animal.x) * p,
      z: animal.z + (animal.tz - animal.z) * p
    };
  }

  function isClearOfOthers(
    x: number,
    z: number,
    self: LivestockAnimal,
    animals: readonly LivestockAnimal[],
    nowMs: number
  ) {
    for (const other of animals) {
      if (other === self) continue;
      const cur = animalPos(other, nowMs);
      if (Math.hypot(x - cur.x, z - cur.z) < MIN_SEPARATION) return false;
      if (other.phase === "walking") {
        if (Math.hypot(x - other.tx, z - other.tz) < MIN_SEPARATION) return false;
      }
    }
    return true;
  }

  function startWalk(
    animal: LivestockAnimal,
    animals: readonly LivestockAnimal[],
    nowMs: number,
    rand: () => number
  ) {
    let nx = animal.x;
    let nz = animal.z;
    let found = false;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const ang = rand() * Math.PI * 2;
      const dist = LIVESTOCK_STEP_DIST * (0.65 + rand() * 0.7);
      let cx = animal.x + Math.cos(ang) * dist;
      let cz = animal.z + Math.sin(ang) * dist;
      ({ x: cx, z: cz } = clampTo(cx, cz, animal.homeX, animal.homeZ, HOME_RADIUS));
      ({ x: cx, z: cz } = clampInTile(cx, cz));
      if (Math.hypot(cx - animal.x, cz - animal.z) < 0.025) continue;
      if (!isClearOfOthers(cx, cz, animal, animals, nowMs)) continue;
      nx = cx;
      nz = cz;
      found = true;
      break;
    }

    if (!found) {
      // Pas de case libre : reporter le prochain essai.
      animal.phase = "idle";
      animal.phaseAt = nowMs;
      animal.idleMs = 600 + rand() * 900;
      placeAnimal(animal, 1);
      return;
    }

    animal.tx = nx;
    animal.tz = nz;
    animal.yaw = Math.atan2(nz - animal.z, nx - animal.x);
    animal.phase = "walking";
    animal.phaseAt = nowMs;
    animal.walkMs = LIVESTOCK_WALK_MS * (0.8 + rand() * 0.4);
  }

  function startIdle(animal: LivestockAnimal, nowMs: number, rand: () => number) {
    animal.x = animal.tx;
    animal.z = animal.tz;
    animal.phase = "idle";
    animal.phaseAt = nowMs;
    animal.idleMs = nextIdleMs(rand());
  }

  function tickAnimal(
    animal: LivestockAnimal,
    animals: readonly LivestockAnimal[],
    nowMs: number,
    rand: () => number
  ) {
    if (animal.phase === "idle") {
      if (nowMs - animal.phaseAt >= animal.idleMs) {
        startWalk(animal, animals, nowMs, rand);
      }
      placeAnimal(animal, 1);
      return;
    }

    const t = (nowMs - animal.phaseAt) / animal.walkMs;
    if (t >= 1) {
      startIdle(animal, nowMs, rand);
      // Si on finit trop près d’une autre, recentre légèrement vers le home.
      if (!isClearOfOthers(animal.x, animal.z, animal, animals, nowMs)) {
        const pulled = clampTo(
          animal.homeX * 0.35 + animal.x * 0.65,
          animal.homeZ * 0.35 + animal.z * 0.65,
          animal.homeX,
          animal.homeZ,
          HOME_RADIUS
        );
        if (isClearOfOthers(pulled.x, pulled.z, animal, animals, nowMs)) {
          animal.x = pulled.x;
          animal.z = pulled.z;
          animal.tx = pulled.x;
          animal.tz = pulled.z;
        }
      }
      placeAnimal(animal, 1);
      return;
    }
    placeAnimal(animal, easeInOut(t));
  }

  const createForTile = (q: number, r: number) => {
    const group = new Group();
    group.userData.isCowHerd = true;
    group.userData.isLivestockHerd = true;
    const hash = tileHash(q, r, 77);
    const rand = mulberry32(hash ^ 0x9e3779b9);
    const animals: LivestockAnimal[] = [];
    const now = performance.now();

    for (let i = 0; i < LIVESTOCK_COUNT; i += 1) {
      const scale = 0.85 + unit(hash, i + 2) * 0.3;
      const cow = makeCow(scale, unit(hash, i + 4) > 0.35);
      const slot = HERD_SLOTS[i]!;
      // Jitter faible pour ne pas casser la séparation mini.
      const homeX = slot.x + (unit(hash, i + 10) - 0.5) * 0.02;
      const homeZ = slot.z + (unit(hash, i + 12) - 0.5) * 0.02;
      const yaw = unit(hash, i + 14) * Math.PI * 2;
      animals.push({
        mesh: cow,
        homeX,
        homeZ,
        x: homeX,
        z: homeZ,
        tx: homeX,
        tz: homeZ,
        yaw,
        phase: "idle",
        phaseAt: now + rand() * 1500,
        idleMs: nextIdleMs(rand()),
        walkMs: LIVESTOCK_WALK_MS
      });
      group.add(cow);
      placeAnimal(animals[i]!, 1);
    }

    const herd: HerdMotion = { animals, rng: hash };
    group.userData.herd = herd;
    group.userData.randState = hash ^ 0x85ebca6b;
    return group;
  };

  const animate = (group: Group, nowMs: number) => {
    if (!group.userData.isLivestockHerd && !group.userData.isCowHerd) return;
    const herd = group.userData.herd as HerdMotion | undefined;
    if (!herd?.animals.length) return;

    let seed = (group.userData.randState as number) ?? herd.rng;
    const rand = () => {
      seed = (Math.imul(seed ^ (seed >>> 16), 2246822519) + 0x9e3779b9) >>> 0;
      group.userData.randState = seed;
      return (seed >>> 0) / 4294967296;
    };

    for (const animal of herd.animals) {
      tickAnimal(animal, herd.animals, nowMs, rand);
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
