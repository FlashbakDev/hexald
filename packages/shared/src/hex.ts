import type { BiomeId } from "./ids.ts";

export type HexCoord = {
  q: number;
  r: number;
};

export type Region = {
  center: HexCoord;
  biome: BiomeId;
};

/** Pointy-top axial directions, clockwise from east. */
export const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

export function hexKey(q: number, r: number) {
  return `${q},${r}`;
}

export function cubeDistance(a: HexCoord, b: HexCoord = { q: 0, r: 0 }) {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(-a.q - a.r - (-b.q - b.r))) / 2;
}

export function hexNeighbors(cell: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map((dir) => ({ q: cell.q + dir.q, r: cell.r + dir.r }));
}

/** Centre + six voisins. */
export function regionCells(center: HexCoord): HexCoord[] {
  return [center, ...hexNeighbors(center)];
}

/** Toutes les cellules à distance cube ≤ radius (inclut le centre). */
export function hexDisk(center: HexCoord, radius: number): HexCoord[] {
  const r = Math.max(0, Math.floor(radius));
  if (r === 0) return [{ q: center.q, r: center.r }];
  const cells: HexCoord[] = [];
  for (let dq = -r; dq <= r; dq++) {
    for (let dr = Math.max(-r, -dq - r); dr <= Math.min(r, -dq + r); dr++) {
      cells.push({ q: center.q + dq, r: center.r + dr });
    }
  }
  return cells;
}
