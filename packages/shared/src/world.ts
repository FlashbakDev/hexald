import type { BiomeId } from "./ids.ts";
import type { HexCoord } from "./hex.ts";

export type WorldTileSnapshot = {
  q: number;
  r: number;
  biome: BiomeId;
};

export type WorldRegionSnapshot = {
  center: HexCoord;
  biome: BiomeId;
};

export type WorldSnapshot = {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  tiles: WorldTileSnapshot[];
  regions: WorldRegionSnapshot[];
};

export type WorldSummary = {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};
