import type { BiomeId, PoiId } from "@hexald/shared";

export type PoiKind = "natural" | "landmark";

export type PoiDefinition = {
  id: PoiId;
  label: string;
  /** Courte description pour le panneau de sélection. */
  description: string;
  kind: PoiKind;
  /** Biomes autorisés. */
  biomes: readonly BiomeId[];
  /** Uniquement sur eau touchant au moins une terre. */
  coastalWaterOnly: boolean;
  status: "mvp" | "planned";
};

export const pois: PoiDefinition[] = [
  {
    id: "fish_bank",
    label: "Banc de poisson",
    description:
      "Poissons côtiers. Construis une cabane de pêcheur ici pour produire de la nourriture.",
    kind: "natural",
    biomes: ["water"],
    coastalWaterOnly: true,
    status: "mvp"
  },
  {
    id: "cow_herd",
    label: "Troupeau de vaches",
    description:
      "Bétail en pâture. Une étable permettra plus tard d’en tirer profit — une ferme efface le troupeau.",
    kind: "natural",
    biomes: ["plains"],
    coastalWaterOnly: false,
    status: "mvp"
  },
  {
    id: "iron_deposit",
    label: "Gisement de fer",
    description:
      "Veines de fer exposées. Une mine permettra d’extraire le minerai — une carrière efface le gisement.",
    kind: "natural",
    biomes: ["mountain"],
    coastalWaterOnly: false,
    status: "mvp"
  }
];

export function getPoiDefinition(id: PoiId | string | null | undefined): PoiDefinition | undefined {
  if (!id) return undefined;
  return pois.find((poi) => poi.id === id);
}

export function isPoiId(value: string): value is PoiId {
  return pois.some((poi) => poi.id === value);
}

/** POI encore valide pour ce biome (sinon à retirer). */
export function poiAllowedOnBiome(poiId: PoiId | null | undefined, biome: BiomeId): boolean {
  if (!poiId) return true;
  const def = getPoiDefinition(poiId);
  if (!def) return false;
  return def.biomes.includes(biome);
}

/**
 * Chance qu’une région nouvellement générée reçoive un banc
 * si elle a au moins une tuile d’eau côtière créée.
 */
export const FISH_BANK_SPAWN_CHANCE = 0.4;

/**
 * Chance qu’une région avec au moins une plaine créée
 * reçoive un troupeau de vaches.
 */
export const COW_HERD_SPAWN_CHANCE = 0.4;

/**
 * Chance qu’une région avec au moins une montagne créée
 * reçoive un gisement de fer.
 */
export const IRON_DEPOSIT_SPAWN_CHANCE = 0.4;
