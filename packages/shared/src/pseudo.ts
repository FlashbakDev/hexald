export const PSEUDO_MIN_LENGTH = 3;
export const PSEUDO_MAX_LENGTH = 20;
export const PSEUDO_PATTERN = /^[a-zA-Z0-9_]+$/;

export type PseudoValidation =
  | { ok: true; pseudo: string }
  | { ok: false; reason: "empty" | "too_short" | "too_long" | "invalid_chars" };

export function normalizePseudo(raw: string): string {
  return raw.trim();
}

export function validatePseudo(raw: unknown): PseudoValidation {
  if (typeof raw !== "string") {
    return { ok: false, reason: "empty" };
  }

  const pseudo = normalizePseudo(raw);
  if (!pseudo) return { ok: false, reason: "empty" };
  if (pseudo.length < PSEUDO_MIN_LENGTH) return { ok: false, reason: "too_short" };
  if (pseudo.length > PSEUDO_MAX_LENGTH) return { ok: false, reason: "too_long" };
  if (!PSEUDO_PATTERN.test(pseudo)) return { ok: false, reason: "invalid_chars" };

  return { ok: true, pseudo };
}
