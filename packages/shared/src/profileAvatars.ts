/** Avatars profil historiques (low-poly) — IDs = clés pseudo guest. */
export const PROFILE_AVATAR_IDS = [
  "Napoleon",
  "Caesar",
  "Alexander",
  "Einstein",
  "Curie",
  "Mozart",
  "Confucius",
  "Nefertiti",
  "Genghis",
  "Charlemagne",
  "Cleopatra",
  "Leonardo",
  "JoanOfArc",
  "Socrates",
  "Hatshepsut"
] as const;

export type ProfileAvatarId = (typeof PROFILE_AVATAR_IDS)[number];

const PROFILE_AVATAR_ID_SET = new Set<string>(PROFILE_AVATAR_IDS);

export function isProfileAvatarId(value: unknown): value is ProfileAvatarId {
  return typeof value === "string" && PROFILE_AVATAR_ID_SET.has(value);
}

/** Tirage uniforme parmi le catalogue. */
export function pickRandomProfileAvatarId(
  random: () => number = Math.random
): ProfileAvatarId {
  const index = Math.floor(random() * PROFILE_AVATAR_IDS.length);
  return PROFILE_AVATAR_IDS[index] ?? "Cleopatra";
}

/**
 * Si le pseudo est un guest historique (ex. Napoleon42, JoanOfArc7),
 * retourne l’avatar correspondant. Sinon null.
 */
export function resolveProfileAvatarForPseudo(
  pseudo: string
): ProfileAvatarId | null {
  const sorted = [...PROFILE_AVATAR_IDS].sort((a, b) => b.length - a.length);
  for (const id of sorted) {
    if (!pseudo.toLowerCase().startsWith(id.toLowerCase())) continue;
    const rest = pseudo.slice(id.length);
    if (rest === "" || /^\d+$/.test(rest)) return id;
  }
  return null;
}

/** Avatar à assigner au claim : match guest, sinon aléatoire. */
export function assignProfileAvatarForClaim(
  pseudo: string,
  random: () => number = Math.random
): ProfileAvatarId {
  return (
    resolveProfileAvatarForPseudo(pseudo) ?? pickRandomProfileAvatarId(random)
  );
}
