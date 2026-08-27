import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  type BufferGeometry,
  type Material
} from "three";
import type { HexCoord } from "@hexald/shared";
import { HEX_DIRECTIONS, hexKey } from "@hexald/shared";

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

/** Apothem — milieu d’arête pour hex rayon 1 pointy-top. */
const EDGE_RADIAL = Math.cos(Math.PI / 6);

function axialToWorld(q: number, r: number) {
  const x = Math.sqrt(3) * (q + r / 2);
  const z = 1.5 * r;
  return { x, z };
}

/**
 * Contour blanc d’emprise (style Civ) — rubans sur les arêtes
 * où une tuile influencée touche une tuile hors emprise.
 */
export function createInfluenceBorderKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const band = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    depthWrite: false
  });
  const glow = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  materials.push(band, glow);

  const coreGeo = new BoxGeometry(1.04, 0.018, 0.055);
  const glowGeo = new BoxGeometry(1.08, 0.01, 0.12);
  geometries.push(coreGeo, glowGeo);

  const root = new Group();
  root.name = "influence-border";

  const rebuild = (
    coords: readonly HexCoord[],
    heightForTile?: (q: number, r: number) => number
  ) => {
    while (root.children.length > 0) {
      root.remove(root.children[0]!);
    }

    if (coords.length === 0) return;

    const influenced = new Set(coords.map((cell) => hexKey(cell.q, cell.r)));
    const defaultY = 0.16;

    for (const cell of coords) {
      const { x: cx, z: cz } = axialToWorld(cell.q, cell.r);
      const baseY = heightForTile?.(cell.q, cell.r) ?? defaultY;

      for (let dir = 0; dir < 6; dir += 1) {
        const n = HEX_DIRECTIONS[dir]!;
        const nKey = hexKey(cell.q + n.q, cell.r + n.r);
        if (influenced.has(nKey)) continue;

        const { x: ux, z: uz, yaw } = unitToward(dir);
        const segment = new Group();
        segment.position.set(
          cx + ux * EDGE_RADIAL,
          baseY,
          cz + uz * EDGE_RADIAL
        );
        segment.rotation.y = yaw;

        const outer = new Mesh(glowGeo, glow);
        disableRaycast(outer);
        outer.position.y = 0.002;
        segment.add(outer);

        const inner = new Mesh(coreGeo, band);
        disableRaycast(inner);
        inner.position.y = 0.008;
        segment.add(inner);

        root.add(segment);
      }
    }
  };

  const clear = () => rebuild([]);

  const dispose = () => {
    clear();
    for (const geo of geometries) geo.dispose();
    for (const mat of materials) mat.dispose();
  };

  return { root, rebuild, clear, dispose };
}
