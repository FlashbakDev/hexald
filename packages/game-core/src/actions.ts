import type { GameAction } from "@hexald/shared";

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: string };

const extractorJobs = new Set(["woodcutter", "farmer", "quarrier"]);

/**
 * Validation structurelle légère.
 * Les effets métier (économie, monde) passent par les services dédiés.
 */
export function validateAction(action: GameAction): ActionResult {
  if (action.type === "assign_workers") {
    if (!extractorJobs.has(action.job)) {
      return { ok: false, reason: "unsupported_job" };
    }
    if (!Number.isInteger(action.count) || action.count < 0) {
      return { ok: false, reason: "invalid_count" };
    }
    return { ok: true };
  }

  if (action.type === "generate_region" || action.type === "build") {
    return { ok: false, reason: "not_implemented" };
  }

  return { ok: false, reason: "unknown_action" };
}
