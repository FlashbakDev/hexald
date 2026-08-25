import type { GameAction } from "@hexald/shared";

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validation structurelle légère.
 * Les effets métier (économie, monde) passent par les services dédiés.
 */
export function validateAction(action: GameAction): ActionResult {
  if (action.type === "assign_workers") {
    const origin = action.origin;
    if (
      !origin ||
      typeof origin !== "object" ||
      !Number.isInteger(origin.q) ||
      !Number.isInteger(origin.r)
    ) {
      return { ok: false, reason: "invalid_origin" };
    }
    if (!Number.isInteger(action.count) || action.count < 0 || action.count > 1) {
      return { ok: false, reason: "invalid_count" };
    }
    return { ok: true };
  }

  if (action.type === "generate_region" || action.type === "build") {
    return { ok: false, reason: "not_implemented" };
  }

  return { ok: false, reason: "unknown_action" };
}
