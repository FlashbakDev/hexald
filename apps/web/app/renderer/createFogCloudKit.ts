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

function hash01(q: number, r: number, salt: number) {
  return (tileHash(q, r, salt) >>> 0) / 4294967296;
}

/** Pointy-top axial offset (HEX_SIZE = 1), aligné avec createHexScene. */
function axialOffset(dq: number, dr: number) {
  return {
    x: Math.sqrt(3) * (dq + dr / 2),
    z: 1.5 * dr
  };
}

function createSoftCloudTexture(
  size: number,
  variant: 0 | 1 | 2
): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.clearRect(0, 0, size, size);

  const variants: { x: number; y: number; r: number; a: number; rx: number }[][] = [
    [
      { x: 0.5, y: 0.52, r: 0.44, a: 0.92, rx: 0.78 },
      { x: 0.28, y: 0.46, r: 0.3, a: 0.6, rx: 0.72 },
      { x: 0.74, y: 0.5, r: 0.32, a: 0.55, rx: 0.8 },
      { x: 0.48, y: 0.32, r: 0.26, a: 0.48, rx: 0.7 },
      { x: 0.56, y: 0.7, r: 0.28, a: 0.4, rx: 0.75 }
    ],
    [
      { x: 0.46, y: 0.5, r: 0.4, a: 0.88, rx: 0.85 },
      { x: 0.22, y: 0.55, r: 0.34, a: 0.58, rx: 0.68 },
      { x: 0.7, y: 0.42, r: 0.36, a: 0.62, rx: 0.74 },
      { x: 0.58, y: 0.66, r: 0.24, a: 0.42, rx: 0.9 },
      { x: 0.4, y: 0.28, r: 0.22, a: 0.38, rx: 0.65 }
    ],
    [
      { x: 0.52, y: 0.48, r: 0.38, a: 0.9, rx: 0.7 },
      { x: 0.34, y: 0.4, r: 0.28, a: 0.55, rx: 0.88 },
      { x: 0.68, y: 0.58, r: 0.3, a: 0.5, rx: 0.72 },
      { x: 0.42, y: 0.68, r: 0.26, a: 0.45, rx: 0.8 },
      { x: 0.62, y: 0.34, r: 0.24, a: 0.4, rx: 0.76 },
      { x: 0.5, y: 0.55, r: 0.2, a: 0.35, rx: 0.95 }
    ]
  ];

  for (const blob of variants[variant]!) {
    const cx = blob.x * size;
    const cy = blob.y * size;
    const radius = blob.r * size;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    g.addColorStop(0, `rgba(255, 255, 255, ${blob.a})`);
    g.addColorStop(0.35, `rgba(247, 250, 248, ${blob.a * 0.75})`);
    g.addColorStop(0.65, `rgba(232, 240, 236, ${blob.a * 0.3})`);
    g.addColorStop(1, "rgba(223, 232, 228, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * blob.rx, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

type PuffSpec = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  yaw: number;
  tier: 0 | 1 | 2;
  tex: 0 | 1 | 2;
};

export type FogNeighborDir = { q: number; r: number };

/** Hauteur de base du groupe au-dessus de la face. */
export const FOG_CLOUD_LIFT = 0.55;

/** Max puffs locaux + ponts (6 voisins). */
const MAX_PUFFS = 12;

function buildPuffs(q: number, r: number, neighbors: readonly FogNeighborDir[]): PuffSpec[] {
  const puffs: PuffSpec[] = [];
  const density = 3 + (tileHash(q, r, 1) % 3); // 3–5
  const scaleBias = 0.85 + hash01(q, r, 5) * 0.45;
  const heightBias = 0.7 + hash01(q, r, 11) * 0.7;

  // Base large — chevauche toujours les voisins.
  puffs.push({
    x: (hash01(q, r, 21) - 0.5) * 0.25,
    z: (hash01(q, r, 22) - 0.5) * 0.25,
    y: 0.06 * heightBias,
    sx: (2.35 + hash01(q, r, 23) * 0.45) * scaleBias,
    sy: (2.05 + hash01(q, r, 24) * 0.4) * scaleBias,
    yaw: hash01(q, r, 25) * Math.PI,
    tier: 0,
    tex: (tileHash(q, r, 26) % 3) as 0 | 1 | 2
  });

  for (let i = 0; i < density; i++) {
    const a = hash01(q, r, 40 + i) * Math.PI * 2;
    const rad = 0.12 + hash01(q, r, 50 + i) * 0.38;
    const tall = hash01(q, r, 60 + i);
    puffs.push({
      x: Math.cos(a) * rad,
      z: Math.sin(a) * rad,
      y: (0.16 + tall * 0.38) * heightBias,
      sx: (0.85 + hash01(q, r, 70 + i) * 0.85) * scaleBias,
      sy: (0.7 + hash01(q, r, 80 + i) * 0.7) * scaleBias,
      yaw: hash01(q, r, 90 + i) * Math.PI * 2,
      tier: (tall > 0.55 ? 2 : 1) as 1 | 2,
      tex: ((tileHash(q, r, 100 + i) + i) % 3) as 0 | 1 | 2
    });
  }

  // Ponts vers les voisins aussi dans le brouillard — lie la nappe.
  for (let i = 0; i < neighbors.length; i++) {
    const n = neighbors[i]!;
    // Un seul côté du pont (évite double densité) : ordre axial.
    const selfKey = q * 10007 + r;
    const otherKey = (q + n.q) * 10007 + (r + n.r);
    if (selfKey > otherKey) continue;

    const off = axialOffset(n.q, n.r);
    const mid = 0.42 + hash01(q, r, 200 + i) * 0.12;
    const yaw = Math.atan2(off.x, off.z);
    puffs.push({
      x: off.x * mid,
      z: off.z * mid,
      y: (0.14 + hash01(q, r, 210 + i) * 0.18) * heightBias,
      sx: 1.55 + hash01(q, r, 220 + i) * 0.55,
      sy: 1.05 + hash01(q, r, 230 + i) * 0.35,
      yaw: yaw + (hash01(q, r, 240 + i) - 0.5) * 0.35,
      tier: 1,
      tex: ((tileHash(q, r, 250 + i) + i) % 3) as 0 | 1 | 2
    });
    // Petite crête au milieu du pont.
    if (hash01(q, r, 260 + i) > 0.35) {
      puffs.push({
        x: off.x * (mid + 0.08),
        z: off.z * (mid + 0.08),
        y: (0.28 + hash01(q, r, 270 + i) * 0.2) * heightBias,
        sx: 0.9 + hash01(q, r, 280 + i) * 0.4,
        sy: 0.75 + hash01(q, r, 290 + i) * 0.3,
        yaw: yaw + 0.4,
        tier: 2,
        tex: (tileHash(q, r, 300 + i) % 3) as 0 | 1 | 2
      });
    }
  }

  return puffs.slice(0, MAX_PUFFS);
}

/**
 * Nuages de brouillard de guerre — variés et reliés entre tuiles voisines.
 */
export function createFogCloudKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: Texture[] = [];

  const cloudTextures = [0, 1, 2].map((v) => createSoftCloudTexture(160, v as 0 | 1 | 2));
  textures.push(...cloudTextures);

  const geometry = new PlaneGeometry(1, 1);
  geometries.push(geometry);

  // tier × texture
  const tierOpacities = [0.7, 0.52, 0.38] as const;
  const matGrid: MeshBasicMaterial[][] = tierOpacities.map((opacity) =>
    cloudTextures.map((map) => {
      const mat = new MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        opacity,
        fog: false
      });
      materials.push(mat);
      return mat;
    })
  );

  const ensureMesh = (group: Group, index: number) => {
    let mesh = group.children[index] as Mesh | undefined;
    if (mesh instanceof Mesh) return mesh;
    mesh = new Mesh(geometry, matGrid[0]![0]!);
    disableRaycast(mesh);
    mesh.renderOrder = 2;
    group.add(mesh);
    return mesh;
  };

  const configureInstance = (
    group: Group,
    q: number,
    r: number,
    neighbors: readonly FogNeighborDir[] = []
  ) => {
    group.userData.isFog = true;
    group.userData.q = q;
    group.userData.r = r;
    group.userData.phase = hash01(q, r, 17);
    group.userData.baseY = FOG_CLOUD_LIFT;
    group.userData.liftJitter = 0.85 + hash01(q, r, 19) * 0.35;
    group.rotation.set(0, 0, 0);
    group.scale.set(1, 1, 1);

    const puffs = buildPuffs(q, r, neighbors);

    for (let i = 0; i < puffs.length; i++) {
      const puff = puffs[i]!;
      const mesh = ensureMesh(group, i);
      mesh.material = matGrid[puff.tier]![puff.tex]!;
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.y = 0;
      mesh.rotation.z = puff.yaw;
      mesh.position.set(puff.x, puff.y, puff.z);
      mesh.scale.set(puff.sx, puff.sy, 1);
      mesh.visible = true;
    }
    for (let i = puffs.length; i < group.children.length; i++) {
      group.children[i]!.visible = false;
    }
  };

  const createInstance = (q: number, r: number, neighbors: readonly FogNeighborDir[] = []) => {
    const group = new Group();
    configureInstance(group, q, r, neighbors);
    return group;
  };

  /** Respiration cohérente spatialement (vent commun). */
  const animate = (group: Group, nowMs: number) => {
    const q = (group.userData.q as number) ?? 0;
    const r = (group.userData.r as number) ?? 0;
    const phase = (group.userData.phase as number) ?? 0;
    const baseY = (group.userData.baseY as number) ?? FOG_CLOUD_LIFT;
    const liftJitter = (group.userData.liftJitter as number) ?? 1;
    const t = nowMs * 0.001;
    const wind = t * 0.32;
    const spatial = q * 0.37 + r * 0.61;
    group.position.y =
      baseY * liftJitter + Math.sin(wind + spatial + phase) * 0.055;
    group.position.x = Math.sin(wind * 0.6 + spatial * 0.5) * 0.03;
    group.position.z = Math.cos(wind * 0.5 + spatial * 0.4) * 0.03;
  };

  return {
    createInstance,
    configureInstance,
    animate,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const texture of textures) texture.dispose();
    }
  };
}

export type FogCloudKit = ReturnType<typeof createFogCloudKit>;
