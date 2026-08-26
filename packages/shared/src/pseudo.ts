export const PSEUDO_MIN_LENGTH = 3;
export const PSEUDO_MAX_LENGTH = 20;
export const PSEUDO_PATTERN = /^[a-zA-Z0-9_]+$/;

export type PseudoValidation =
  | { ok: true; pseudo: string }
  | { ok: false; reason: "empty" | "too_short" | "too_long" | "invalid_chars" };

/** Prénoms / noms historiques (ASCII) pour les pseudos invités. */
export const GUEST_HISTORICAL_NAMES = [
  "Napoleon",
  "Cleopatra",
  "Caesar",
  "Augustus",
  "Hannibal",
  "Socrates",
  "Plato",
  "Aristotle",
  "Alexander",
  "Pericles",
  "Leonardo",
  "Galileo",
  "Copernicus",
  "Newton",
  "Darwin",
  "Einstein",
  "Curie",
  "Pasteur",
  "Voltaire",
  "Rousseau",
  "Moliere",
  "Hugo",
  "Dumas",
  "Charlemagne",
  "Richelieu",
  "Colbert",
  "Lafayette",
  "Bonaparte",
  "Churchill",
  "Lincoln",
  "Franklin",
  "Washington",
  "Genghis",
  "Saladin",
  "Ramses",
  "Nefertiti",
  "Confucius",
  "Ashoka",
  "Suleiman",
  "Magellan",
  "Columbus",
  "Beethoven",
  "Mozart",
  "Bach",
  "Chopin",
  "Rembrandt",
  "VanGogh",
  "Monet",
  "Picasso",
  "Dali",
  "Cleisthenes",
  "Hypatia",
  "Sappho",
  "JoanOfArc",
  "Boudica",
  "Leonidas",
  "Spartacus",
  "Cicero",
  "Seneca",
  "Marcus",
  "Trajan",
  "Hadrian",
  "Justinian",
  "Theodora",
  "Bayard",
  "Turenne",
  "Vauban",
  "Descartes",
  "Pascal",
  "Lavoisier",
  "Ampere",
  "Fourier",
  "Laplace",
  "Fermat",
  "Euclid",
  "Archimedes",
  "Ptolemy",
  "Herodotus",
  "Thucydides",
  "Homer",
  "Virgil",
  "Dante",
  "Petrarch",
  "Erasmus",
  "Luther",
  "Calvin",
  "Hobbes",
  "Locke",
  "Kant",
  "Hegel",
  "Marx",
  "Freud",
  "Jung",
  "Tesla",
  "Edison",
  "Faraday",
  "Maxwell",
  "Kepler",
  "Brahe"
] as const;

export function normalizePseudo(raw: string): string {
  return raw.trim();
}

/** Garde uniquement [a-zA-Z0-9_], accents retirés, espaces → _. */
export function sanitizePseudoCandidate(raw: string): string {
  const ascii = raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return ascii.slice(0, PSEUDO_MAX_LENGTH);
}

/**
 * Suggestion de pseudo : nom d’affichage (Google) puis partie locale de l’email.
 */
export function suggestPseudoFromIdentity(input: {
  displayName?: string | null;
  email?: string | null;
}): string {
  const fromName = sanitizePseudoCandidate(input.displayName ?? "");
  if (fromName.length >= PSEUDO_MIN_LENGTH) return fromName;

  const local = (input.email ?? "").split("@")[0] ?? "";
  const fromEmail = sanitizePseudoCandidate(local);
  if (fromEmail.length >= PSEUDO_MIN_LENGTH) return fromEmail;

  const fallback = sanitizePseudoCandidate(
    `player_${fromName || fromEmail || "hex"}`
  );
  if (fallback.length >= PSEUDO_MIN_LENGTH) {
    return fallback.slice(0, PSEUDO_MAX_LENGTH);
  }
  return "player";
}

/** Variantes si le pseudo est déjà pris : base, base2, base3… */
export function pseudoCandidateWithSuffix(base: string, attempt: number): string {
  const clean = sanitizePseudoCandidate(base) || "player";
  if (attempt <= 0) return clean.slice(0, PSEUDO_MAX_LENGTH);
  const suffix = String(attempt + 1);
  const maxBase = Math.max(PSEUDO_MIN_LENGTH, PSEUDO_MAX_LENGTH - suffix.length);
  return `${clean.slice(0, maxBase)}${suffix}`;
}

/**
 * Pseudo invité : personnage historique + numéro aléatoire (ex. Napoleon42).
 */
export function suggestRandomGuestPseudo(
  random: () => number = Math.random
): string {
  const name =
    GUEST_HISTORICAL_NAMES[
      Math.floor(random() * GUEST_HISTORICAL_NAMES.length)
    ] ?? "Traveler";
  const room = PSEUDO_MAX_LENGTH - name.length;
  if (room <= 0) return name.slice(0, PSEUDO_MAX_LENGTH);

  const digits = Math.min(4, Math.max(1, room));
  const max = 10 ** digits - 1;
  const min = digits > 1 ? 10 ** (digits - 1) : 1;
  const num = Math.floor(random() * (max - min + 1)) + min;
  return `${name}${num}`;
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
