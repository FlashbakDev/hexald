import {
  BoxGeometry,
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

function unitToward(dirIndex: number) {
  const dir = HEX_DIRECTIONS[dirIndex]!;
  const x = Math.sqrt(3) * (dir.q + dir.r / 2);
  const z = 1.5 * dir.r;
  const len = Math.hypot(x, z) || 1;
  return { x: x / len, z: z / len, yaw: Math.atan2(x, z) };
}

/**
 * Distance centre → milieu d’arête (apothem) pour hex rayon 1 pointy-top.
 * Le ruban est posé exactement sur la frontière partagée.
 */
const EDGE_RADIAL = Math.cos(Math.PI / 6); // ≈ 0.866

/**
 * Dirs à dessiner une seule fois par arête (propriétaire = dir 0..2).
 * L’autre tuile a le bit opposé (dir+3) et ne redessine pas.
 */
export function ownedRiverDirsFromMask(mask: number): number[] {
  const dirs: number[] = [];
  for (let dir = 0; dir < 3; dir += 1) {
    if (mask & (1 << dir)) dirs.push(dir);
  }
  return dirs;
}

/** Première direction de sortie (bits 0–5). */
export function firstRiverDirFromMask(mask: number): number | null {
  for (let dir = 0; dir < 6; dir += 1) {
    if (mask & (1 << dir)) return dir;
  }
  return null;
}

/** @deprecated alias — préférer ownedRiverDirsFromMask */
export function riverDirsFromMask(mask: number): number[] {
  return ownedRiverDirsFromMask(mask);
}

/**
 * Ruban de rivière centré sur l’arête hex (entre les deux tuiles),
 * dessiné une seule fois par arête via owned dirs.
 */
export function createRiverEdgeDecorKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const water = new MeshStandardMaterial({
    color: 0x4a9eb8,
    roughness: 0.35,
    metalness: 0.08,
    emissive: 0x1a4050,
    emissiveIntensity: 0.12
  });
  const waterDeep = new MeshStandardMaterial({
    color: 0x3a8aa8,
    roughness: 0.28,
    metalness: 0.1,
    emissive: 0x154050,
    emissiveIntensity: 0.15
  });
  materials.push(water, waterDeep);

  // Longueur ≈ arête hex (rayon 1) ; largeur couvre le joint des deux tuiles.
  const band = new BoxGeometry(1, 0.022, 0.11);
  const core = new BoxGeometry(1, 0.014, 0.055);
  geometries.push(band, core);

  const createRiverEdges = (dirIndices: readonly number[]) => {
    const group = new Group();
    group.userData.hasRiverEdges = true;

    for (const dirIndex of dirIndices) {
      const { x: ux, z: uz, yaw } = unitToward(dirIndex);
      const segment = new Group();
      segment.position.set(ux * EDGE_RADIAL, 0.024, uz * EDGE_RADIAL);
      segment.rotation.y = yaw;

      const outer = new Mesh(band, water);
      disableRaycast(outer);
      // Légèrement plus long que l’arête pour joindre les coins.
      outer.scale.set(1.02, 1, 1);
      segment.add(outer);

      const inner = new Mesh(core, waterDeep);
      disableRaycast(inner);
      inner.position.y = 0.008;
      inner.scale.set(0.98, 1, 1);
      segment.add(inner);

      group.add(segment);
    }

    return group;
  };

  return {
    createRiverEdges,
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    }
  };
}
