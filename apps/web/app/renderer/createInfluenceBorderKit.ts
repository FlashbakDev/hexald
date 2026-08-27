import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
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
/** Longueur d’arête (rayon centre→sommet = 1). */
const EDGE_LEN = 1;
/** Tiret court + grand écart = lecture « pointillé ». */
const DASH_LEN = 0.09;
const DASH_GAP = 0.1;
const DASH_THICK = 0.042;
const DASH_H = 0.012;

function axialToWorld(q: number, r: number) {
  const x = Math.sqrt(3) * (q + r / 2);
  const z = 1.5 * r;
  return { x, z };
}

/**
 * Contour d’emprise — pointillés blancs à plat sur les arêtes délimitantes
 * (tuile influencée ↔ hors emprise). Pas de muret.
 *
 * `heightForTile` = cote du **plateau** (dessus du hex).
 */
export function createInfluenceBorderKit() {
  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const dashMat = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    roughness: 0.45,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4
  });
  materials.push(dashMat);

  const dashGeo = new BoxGeometry(DASH_LEN, DASH_H, DASH_THICK);
  geometries.push(dashGeo);

  const root = new Group();
  root.name = "influence-border";
  root.renderOrder = 10;

  const rebuild = (
    coords: readonly HexCoord[],
    heightForTile?: (q: number, r: number) => number
  ) => {
    while (root.children.length > 0) {
      root.remove(root.children[0]!);
    }

    if (coords.length === 0) return;

    const influenced = new Set(coords.map((cell) => hexKey(cell.q, cell.r)));
    const defaultTop = 0.3;
    const step = DASH_LEN + DASH_GAP;
    const inset = DASH_LEN * 0.55;
    const usable = Math.max(DASH_LEN, EDGE_LEN - inset * 2);
    const count = Math.max(2, Math.floor((usable + DASH_GAP) / step));
    const span = (count - 1) * step;

    for (const cell of coords) {
      const { x: cx, z: cz } = axialToWorld(cell.q, cell.r);
      const topY = heightForTile?.(cell.q, cell.r) ?? defaultTop;

      for (let dir = 0; dir < 6; dir += 1) {
        const n = HEX_DIRECTIONS[dir]!;
        const nKey = hexKey(cell.q + n.q, cell.r + n.r);
        if (influenced.has(nKey)) continue;

        const { x: ux, z: uz, yaw } = unitToward(dir);
        const midX = cx + ux * EDGE_RADIAL;
        const midZ = cz + uz * EDGE_RADIAL;

        for (let i = 0; i < count; i += 1) {
          const t = count === 1 ? 0 : -span / 2 + i * step;
          const dash = new Mesh(dashGeo, dashMat);
          disableRaycast(dash);
          dash.renderOrder = 10;
          dash.position.set(midX, topY + DASH_H / 2 + 0.01, midZ);
          dash.rotation.y = yaw;
          dash.translateX(t);
          root.add(dash);
        }
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
