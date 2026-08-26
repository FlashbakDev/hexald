import {
  ConeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry
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

type FishMotion = {
  mesh: Group;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
  speed: number;
  phase: number;
  /** Profondeur sous la face top (décor à y = surface). */
  depth: number;
  bob: number;
};

/**
 * Silhouettes de petits poissons sous la surface d’eau transparente.
 * Le décor est ancré sur la face top du hex ; y négatif = dans l’eau.
 */
export function createFishBankDecorKit() {
  const bodyGeo = new SphereGeometry(0.065, 6, 4);
  bodyGeo.scale(1.9, 0.2, 0.68);
  const tailGeo = new ConeGeometry(0.04, 0.085, 3);
  tailGeo.scale(1, 1, 0.3);

  const makeMat = (color: number, opacity: number) =>
    new MeshStandardMaterial({
      color,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity,
      depthWrite: true,
      emissive: color,
      emissiveIntensity: 0.12
    });

  const silhouette = makeMat(0x0a2433, 0.88);
  const silhouetteSoft = makeMat(0x123040, 0.72);

  const createForTile = (q: number, r: number) => {
    const group = new Group();
    group.userData.isFishBank = true;
    const hash = tileHash(q, r, 91);
    const count = 6 + Math.floor(unit(hash, 0) * 3);
    const fish: FishMotion[] = [];

    for (let i = 0; i < count; i += 1) {
      const fishGroup = new Group();
      const mat = i % 2 === 0 ? silhouette : silhouetteSoft;
      const body = new Mesh(bodyGeo, mat);
      disableRaycast(body);
      const tail = new Mesh(tailGeo, mat);
      disableRaycast(tail);
      tail.rotation.z = Math.PI / 2;
      tail.position.x = -0.1;
      fishGroup.add(body, tail);

      const scale = 0.7 + unit(hash, i + 2) * 0.55;
      fishGroup.scale.setScalar(scale);

      // WATER_HEIGHT ≈ 0.12 → rester entre surface et lit.
      const motion: FishMotion = {
        mesh: fishGroup,
        cx: (unit(hash, i + 4) - 0.5) * 0.28,
        cz: (unit(hash, i + 6) - 0.5) * 0.28,
        rx: 0.26 + unit(hash, i + 8) * 0.38,
        rz: 0.22 + unit(hash, i + 10) * 0.34,
        speed: 0.85 + unit(hash, i + 12) * 0.9,
        phase: unit(hash, i + 14) * Math.PI * 2,
        depth: -0.028 - unit(hash, i + 16) * 0.045,
        bob: 0.006 + unit(hash, i + 18) * 0.01
      };
      fish.push(motion);
      group.add(fishGroup);
    }

    group.userData.fish = fish;
    group.userData.phase = unit(hash, 22) * Math.PI * 2;
    animate(group, performance.now());
    return group;
  };

  const animate = (group: Group, nowMs: number) => {
    if (!group.userData.isFishBank) return;
    const list = group.userData.fish as FishMotion[] | undefined;
    if (!list?.length) return;
    const basePhase = (group.userData.phase as number) ?? 0;
    const t = nowMs * 0.001;

    for (const fish of list) {
      const a = t * fish.speed + fish.phase + basePhase;
      const x = fish.cx + Math.cos(a) * fish.rx;
      const z = fish.cz + Math.sin(a) * fish.rz;
      const tx = -Math.sin(a) * fish.rx;
      const tz = Math.cos(a) * fish.rz;
      const yaw = Math.atan2(tx, tz) - Math.PI / 2;
      const y = fish.depth + Math.sin(a * 2.1 + fish.phase) * fish.bob;

      fish.mesh.position.set(x, y, z);
      fish.mesh.rotation.set(
        Math.sin(a * 1.7) * 0.1,
        yaw,
        Math.sin(a * 3.2) * 0.16
      );
    }
  };

  const dispose = () => {
    bodyGeo.dispose();
    tailGeo.dispose();
    silhouette.dispose();
    silhouetteSoft.dispose();
  };

  return { createForTile, animate, dispose };
}
