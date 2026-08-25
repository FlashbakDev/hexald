import type { BuildingId, PrimaryBiomeId, WorkerJob } from "./ids.ts";
import type { HexCoord } from "./hex.ts";

export type BuildAction = {
  type: "build";
  buildingId: BuildingId;
  origin: HexCoord;
};

export type AssignWorkersAction = {
  type: "assign_workers";
  job: Extract<WorkerJob, "woodcutter">;
  /** Effectif cible (absolu) pour ce métier. */
  count: number;
};

export type GenerateRegionAction = {
  type: "generate_region";
  biome: PrimaryBiomeId;
  center: HexCoord;
};

export type GameAction = BuildAction | AssignWorkersAction | GenerateRegionAction;
