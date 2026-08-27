import type { GameAction, HexCoord, PrimaryBiomeId } from "@hexald/shared";
import { isPlaceableBuilding } from "./build.ts";
import { isPrimaryBiome } from "./world.ts";

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: string };

function isHexCoord(value: unknown): value is HexCoord {
  return (
    typeof value === "object" &&
    value !== null &&
    Number.isInteger((value as HexCoord).q) &&
    Number.isInteger((value as HexCoord).r)
  );
}

/**
 * Validation structurelle légère.
 * Les effets métier (économie, monde) passent par applyWorldAction / services API.
 */
export function validateAction(action: GameAction): ActionResult {
  if (action.type === "assign_workers") {
    if (!isHexCoord(action.origin)) {
      return { ok: false, reason: "invalid_origin" };
    }
    if (!Number.isInteger(action.count) || action.count < 0 || action.count > 1) {
      return { ok: false, reason: "invalid_count" };
    }
    return { ok: true };
  }

  if (action.type === "set_processor_input_rate") {
    if (!isHexCoord(action.origin)) {
      return { ok: false, reason: "invalid_origin" };
    }
    if (
      !Number.isInteger(action.ratePerMinute) ||
      action.ratePerMinute < 0
    ) {
      return { ok: false, reason: "invalid_rate" };
    }
    return { ok: true };
  }

  if (action.type === "build") {
    if (!isHexCoord(action.origin)) {
      return { ok: false, reason: "invalid_origin" };
    }
    if (!isPlaceableBuilding(action.buildingId)) {
      return { ok: false, reason: "unknown_building" };
    }
    return { ok: true };
  }

  if (action.type === "generate_region") {
    if (!isHexCoord(action.center)) {
      return { ok: false, reason: "invalid_center" };
    }
    if (!isPrimaryBiome(action.biome as PrimaryBiomeId)) {
      return { ok: false, reason: "invalid_biome" };
    }
    return { ok: true };
  }

  if (action.type === "set_research_target") {
    if (typeof action.techId !== "string" || action.techId.length === 0) {
      return { ok: false, reason: "invalid_tech" };
    }
    return { ok: true };
  }

  return { ok: false, reason: "unknown_action" };
}
