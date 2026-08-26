import type { PrimaryBiomeId, WorkerJob } from "./ids.ts";
import type { HexCoord } from "./hex.ts";
import type {
  BuildResult,
  ExpandRegionResult,
  ExtractorJob,
  PlaceableBuildingId,
  WorldSnapshot
} from "./world.ts";

export type BuildAction = {
  type: "build";
  buildingId: PlaceableBuildingId;
  origin: HexCoord;
};

export type AssignWorkersAction = {
  type: "assign_workers";
  origin: HexCoord;
  count: number;
};

export type GenerateRegionAction = {
  type: "generate_region";
  biome: PrimaryBiomeId;
  center: HexCoord;
};

export type GameAction = BuildAction | AssignWorkersAction | GenerateRegionAction;

export type ApplyActionSuccess =
  | { ok: true; type: "build"; result: BuildResult }
  | { ok: true; type: "assign_workers"; world: WorldSnapshot }
  | { ok: true; type: "generate_region"; result: ExpandRegionResult };

export type ApplyActionFailure = { ok: false; error: string };

export type ApplyActionOutcome = ApplyActionSuccess | ApplyActionFailure;

export type { ExtractorJob, PlaceableBuildingId, WorkerJob };
