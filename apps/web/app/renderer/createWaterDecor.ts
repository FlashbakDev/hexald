import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  type BufferGeometry,
  type Material,
  type Texture
} from "three";
import type { BiomeId } from "@hexald/shared";
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

function lerpChannel(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function lerpHexColor(a: number, b: number, t: number) {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (lerpChannel(ar, br, t) << 16) |
    (lerpChannel(ag, bg, t) << 8) |
    lerpChannel(ab, bb, t)
  );
}

function unitToward(dirIndex: number) {
  const dir = HEX_DIRECTIONS[dirIndex]!;
  const x = Math.sqrt(3) * (dir.q + dir.r / 2);
  const z = 1.5 * dir.r;
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len, yaw: Math.atan2(x, z) };
}

/** Eau en contact avec la terre. */
export const WATER_COASTAL = { top: 0x62bfe8, side: 0x2f86b5 };

/** Mer au large. */
export const WATER_DEEP = { top: 0x3a9fd0, side: 0x1f6f9a };

export function isLandBiome(biome: BiomeId) {
  return biome !== "water";
}

export function waterTopColorForDepth(depth: number) {
  const t = Math.min(1, Math.max(0, depth));
  return lerpHexColor(WATER_COASTAL.top, WATER_DEEP.top, t);
}

/**
 * Teinte d’eau selon un facteur de profondeur 0→1 (côte → large).
 */
export function paintWaterMaterials(
  materials: MeshStandardMaterial[],
  depth: number,
  surfaceMap?: Texture | null
) {
  const t = Math.min(1, Math.max(0, depth));
  materials[0].color.setHex(lerpHexColor(WATER_COASTAL.side, WATER_DEEP.side, t));
  materials[1].color.setHex(lerpHexColor(WATER_COASTAL.top, WATER_DEEP.top, t));
  materials[2].color.copy(materials[0].color);

  if (t > 0.25 && surfaceMap) {
    materials[1].map = surfaceMap;
  } else {
    materials[1].map = null;
  }

  materials[1].roughness = 0.34 - t * 0.1;
  materials[1].metalness = 0.26 + t * 0.12;
  materials[0].roughness = 0.48 - t * 0.1;
  materials[0].metalness = 0.1 + t * 0.08;
  materials[0].needsUpdate = true;
  materials[1].needsUpdate = true;
  materials[2].needsUpdate = true;
}

/** Texture de surface : légers caustiques / ondulations (multiplie la couleur). */
export function createDeepWaterSurfaceTexture() {
  const size = 128;
  const canvasEl = document.createElement("canvas");
  canvasEl.width = size;
  canvasEl.height = size;
  const ctx = canvasEl.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");

  const gradient = ctx.createRadialGradient(
    size * 0.45,
    size * 0.4,
    size * 0.05,
    size * 0.5,
    size * 0.5,
    size * 0.65
  );
  gradient.addColorStop(0, "rgb(230, 245, 252)");
  gradient.addColorStop(0.45, "rgb(245, 250, 252)");
  gradient.addColorStop(1, "rgb(200, 228, 242)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 18; i += 1) {
    const x = (i * 37 + 11) % size;
    const y = (i * 53 + 19) % size;
    const w = 14 + (i % 5) * 4;
    const h = 3 + (i % 3);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + (i % 4) * 0.035})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, (i * 0.7) % Math.PI, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let i = 0; i < 12; i += 1) {
    const x = (i * 41 + 7) % size;
    const y = (i * 29 + 23) % size;
    ctx.fillStyle = `rgba(50, 120, 160, ${0.035 + (i % 3) * 0.02})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 8 + (i % 4) * 3, 5 + (i % 3) * 2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new CanvasTexture(canvasEl);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export type WaterSurfaceKind = "shelf" | "deep";

export type WaterDepthSeam = {
  dirIndex: number;
  neighborDepth: number;
};

/**
 * Décor eau : surface profonde + bandes de fondu sur les arêtes
 * entre profondeurs différentes.
 */
export function createWaterDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const seamMatCache = new Map<string, MeshStandardMaterial>();
  const seamMaterials: MeshStandardMaterial[] = [];

  const abyss = new MeshStandardMaterial({
    color: 0x2a7aaa,
    roughness: 0.28,
    metalness: 0.35,
    transparent: true,
    opacity: 0.32
  });
  const abyssSoft = new MeshStandardMaterial({
    color: 0x3a92bb,
    roughness: 0.3,
    metalness: 0.32,
    transparent: true,
    opacity: 0.16
  });
  const midDepth = new MeshStandardMaterial({
    color: 0x4aadcc,
    roughness: 0.25,
    metalness: 0.38,
    transparent: true,
    opacity: 0.2
  });
  const midSoft = new MeshStandardMaterial({
    color: 0x6bc0da,
    roughness: 0.28,
    metalness: 0.32,
    transparent: true,
    opacity: 0.14
  });
  const glint = new MeshStandardMaterial({
    color: 0xd0eef8,
    roughness: 0.15,
    metalness: 0.45,
    transparent: true,
    opacity: 0.3
  });
  materials.push(abyss, abyssSoft, midDepth, midSoft, glint);

  const abyssHex = new CylinderGeometry(0.55, 0.62, 0.01, 6);
  const ring = new CylinderGeometry(0.72, 0.78, 0.008, 6);
  const glintDisc = new CylinderGeometry(0.1, 0.12, 0.006, 6);
  // Bande large sur l’arête : fond doux + voile extérieur.
  const seamInner = new BoxGeometry(0.98, 0.01, 0.34);
  const seamOuter = new BoxGeometry(0.92, 0.008, 0.22);
  geometries.push(abyssHex, ring, glintDisc, seamInner, seamOuter);

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
    yaw: number
  ) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.rotation.y = yaw;
    disableRaycast(mesh);
    group.add(mesh);
  }

  function makeSeamMaterial(color: number, opacity: number) {
    const key = `${color}:${opacity.toFixed(2)}`;
    const cached = seamMatCache.get(key);
    if (cached) return cached;

    const mat = new MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.28,
      transparent: true,
      opacity,
      depthWrite: false
    });
    seamMatCache.set(key, mat);
    seamMaterials.push(mat);
    return mat;
  }

  function createDeepSurface(q: number, r: number, kind: WaterSurfaceKind = "deep") {
    const hash = tileHash(q, r);
    const h1 = tileHash(q, r, 71);
    const group = new Group();
    const shelf = kind === "shelf";

    addMesh(
      group,
      abyssHex,
      shelf ? abyssSoft : abyss,
      0,
      0.004,
      0,
      shelf ? 0.85 : 1,
      1,
      shelf ? 0.85 : 1,
      0
    );
    addMesh(
      group,
      ring,
      shelf ? midSoft : midDepth,
      0,
      0.003,
      0,
      shelf ? 0.9 : 1,
      1,
      shelf ? 0.9 : 1,
      Math.PI / 6
    );

    if (!shelf) {
      const glints = 1 + (hash % 2);
      for (let i = 0; i < glints; i += 1) {
        const ang = ((h1 + i * 2.3) % (Math.PI * 2));
        const dist = 0.22 + ((hash >>> (i * 3)) % 3) * 0.08;
        addMesh(
          group,
          glintDisc,
          glint,
          Math.cos(ang) * dist,
          0.007,
          Math.sin(ang) * dist,
          0.7 + (i % 2) * 0.35,
          1,
          0.45 + (i % 2) * 0.2,
          ang + 0.5
        );
      }
    }

    return group;
  }

  /**
   * Fondus d’arête vers les voisins d’eau de profondeur différente.
   * Couleur médiane + double bande pour un dégradé progressif.
   */
  function createDepthSeams(selfDepth: number, seams: readonly WaterDepthSeam[]) {
    const group = new Group();
    for (const seam of seams) {
      const delta = Math.abs(selfDepth - seam.neighborDepth);
      if (delta < 0.15) continue;

      const { x: ux, z: uz, yaw } = unitToward(seam.dirIndex);
      // Teinte à mi-chemin, un peu tirée vers le voisin pour adoucir la jointure.
      const blendDepth = selfDepth * 0.35 + seam.neighborDepth * 0.65;
      const color = waterTopColorForDepth(blendDepth);
      const strength = Math.min(1, delta * 1.4);

      addMesh(
        group,
        seamInner,
        makeSeamMaterial(color, 0.38 * strength),
        ux * 0.58,
        0.005,
        uz * 0.58,
        1,
        1,
        1,
        yaw
      );
      addMesh(
        group,
        seamOuter,
        makeSeamMaterial(color, 0.28 * strength),
        ux * 0.78,
        0.006,
        uz * 0.78,
        1,
        1,
        1.05,
        yaw
      );
    }
    return group;
  }

  return {
    createDeepSurface,
    createDepthSeams,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      for (const material of seamMaterials) material.dispose();
    }
  };
}
