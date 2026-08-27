import type { PrimaryBiomeId, TechId, WorkerJob } from "./ids.ts";
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

export type SetProcessorInputRateAction = {
  type: "set_processor_input_rate";
  origin: HexCoord;
  /** Unités d’input / min depuis le stock village (0…max bâtiment). */
  ratePerMinute: number;
};

export type GenerateRegionAction = {
  type: "generate_region";
  biome: PrimaryBiomeId;
  center: HexCoord;
};

export type SetResearchTargetAction = {
  type: "set_research_target";
  techId: TechId;
};

export type GameAction =
  | BuildAction
  | AssignWorkersAction
  | SetProcessorInputRateAction
  | GenerateRegionAction
  | SetResearchTargetAction;

export type ApplyActionSuccess =
  | { ok: true; type: "build"; result: BuildResult }
  | { ok: true; type: "assign_workers"; world: WorldSnapshot }
  | { ok: true; type: "set_processor_input_rate"; world: WorldSnapshot }
  | { ok: true; type: "generate_region"; result: ExpandRegionResult }
  | { ok: true; type: "set_research_target"; world: WorldSnapshot };

export type ApplyActionFailure = { ok: false; error: string };

export type ApplyActionOutcome = ApplyActionSuccess | ApplyActionFailure;

export type { ExtractorJob, PlaceableBuildingId, WorkerJob };
