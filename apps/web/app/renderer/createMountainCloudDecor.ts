import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
  type Texture
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

function createPuffTexture(size: number, variant: 0 | 1): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.clearRect(0, 0, size, size);

  const blobs =
    variant === 0
      ? [
          { x: 0.5, y: 0.55, r: 0.38, a: 0.85 },
          { x: 0.32, y: 0.5, r: 0.26, a: 0.55 },
          { x: 0.68, y: 0.52, r: 0.28, a: 0.5 },
          { x: 0.48, y: 0.38, r: 0.22, a: 0.4 }
        ]
      : [
          { x: 0.48, y: 0.52, r: 0.34, a: 0.8 },
          { x: 0.28, y: 0.55, r: 0.24, a: 0.5 },
          { x: 0.7, y: 0.48, r: 0.26, a: 0.48 },
          { x: 0.55, y: 0.4, r: 0.2, a: 0.38 }
        ];

  for (const blob of blobs) {
    const cx = blob.x * size;
    const cy = blob.y * size;
    const radius = blob.r * size;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, `rgba(255, 255, 255, ${blob.a})`);
    g.addColorStop(0.4, `rgba(248, 250, 252, ${blob.a * 0.7})`);
    g.addColorStop(0.75, `rgba(230, 236, 240, ${blob.a * 0.25})`);
    g.addColorStop(1, "rgba(220, 228, 232, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

type CloudMotion = {
  mesh: Mesh;
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  rz: number;
  speed: number;
  phase: number;
  bob: number;
  baseScale: number;
};

/**
 * Petits nuages soft autour des pics — dérivent lentement (habillage montagne).
 */
export function createMountainCloudDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: Texture[] = [];

  const texA = createPuffTexture(96, 0);
  const texB = createPuffTexture(96, 1);
  textures.push(texA, texB);

  const matA = new MeshBasicMaterial({
    map: texA,
    transparent: true,
    depthWrite: false,
    opacity: 0.72
  });
  const matB = new MeshBasicMaterial({
    map: texB,
    transparent: true,
    depthWrite: false,
    opacity: 0.62
  });
  materials.push(matA, matB);

  const plane = new PlaneGeometry(1, 1);
  geometries.push(plane);

  const createForTile = (q: number, r: number) => {
    const group = new Group();
    group.userData.isMountainClouds = true;
    const hash = tileHash(q, r, 331);
    const count = 2 + Math.floor(unit(hash, 0) * 2); // 2–3
    const clouds: CloudMotion[] = [];

    for (let i = 0; i < count; i += 1) {
      const mat = i % 2 === 0 ? matA : matB;
      const mesh = new Mesh(plane, mat);
      disableRaycast(mesh);
      // Face légèrement vers la caméra iso (tilt X).
      mesh.rotation.x = -0.55;
      const scale = 0.28 + unit(hash, i + 2) * 0.22;
      mesh.scale.set(scale * 1.35, scale * 0.85, 1);

      const ang = unit(hash, i + 4) * Math.PI * 2;
      const dist = 0.12 + unit(hash, i + 6) * 0.22;
      const motion: CloudMotion = {
        mesh,
        cx: Math.cos(ang) * dist * 0.35,
        cy: 0.42 + unit(hash, i + 8) * 0.28,
        cz: Math.sin(ang) * dist * 0.35,
        rx: 0.08 + unit(hash, i + 10) * 0.14,
        rz: 0.06 + unit(hash, i + 12) * 0.12,
        speed: 0.12 + unit(hash, i + 14) * 0.14,
        phase: unit(hash, i + 16) * Math.PI * 2,
        bob: 0.012 + unit(hash, i + 18) * 0.018,
        baseScale: scale
      };
      clouds.push(motion);
      group.add(mesh);
    }

    group.userData.clouds = clouds;
    group.userData.phase = unit(hash, 22) * Math.PI * 2;
    animate(group, performance.now());
    return group;
  };

  const animate = (group: Group, nowMs: number) => {
    if (!group.userData.isMountainClouds) return;
    const list = group.userData.clouds as CloudMotion[] | undefined;
    if (!list?.length) return;
    const base = (group.userData.phase as number) ?? 0;
    const t = nowMs * 0.001;

    for (const cloud of list) {
      const a = t * cloud.speed + cloud.phase + base;
      const x = cloud.cx + Math.cos(a) * cloud.rx;
      const z = cloud.cz + Math.sin(a * 0.85) * cloud.rz;
      const y = cloud.cy + Math.sin(a * 1.4) * cloud.bob;
      cloud.mesh.position.set(x, y, z);
      // Légère variation d’échelle / respiration.
      const pulse = 1 + Math.sin(a * 0.7) * 0.04;
      cloud.mesh.scale.set(
        cloud.baseScale * 1.35 * pulse,
        cloud.baseScale * 0.85 * pulse,
        1
      );
    }
  };

  return {
    createForTile,
    animate,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    }
  };
}
