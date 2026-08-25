import type { GameAction } from "@hexald/shared";

export type ActionResult =
  | { ok: true }
  | { ok: false; reason: string };

/** Le serveur appelle game-core. Le client ne décide jamais du résultat. */
export function validateAction(_action: GameAction): ActionResult {
  return { ok: false, reason: "not_implemented" };
}
