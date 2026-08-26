import type { BiomeId, PrimaryBiomeId } from "@hexald/shared";

/** Sol constructible ou eau. Le rivage n’est plus un kind de biome (décor d’arête). */
export type BiomeKind = "land" | "water";

export type BiomeDefinition = {
  id: BiomeId;
  label: string;
  /** Courte description pour le panneau de sélection. */
  description: string;
  kind: BiomeKind;
  /** Biomes que le joueur peut choisir pour générer une région. */
  primary?: boolean;
};

export const biomes: BiomeDefinition[] = [
  {
    id: "forest",
    label: "Forêt",
    description: "Bois dense. Idéal pour installer un camp de bûcherons.",
    kind: "land",
    primary: true
  },
  {
    id: "plains",
    label: "Plaine",
    description: "Herbes ouvertes. Terrain de choix pour les fermes.",
    kind: "land",
    primary: true
  },
  {
    id: "mountain",
    label: "Montagne",
    description:
      "Relief rocheux. Pierre pour la carrière ; des gisements de fer attendent une mine.",
    kind: "land",
    primary: true
  },
  {
    id: "water",
    label: "Eau",
    description: "Étendue d’eau. La pêche se fait sur les bancs côtiers.",
    kind: "water",
    primary: true
  },
  {
    id: "forest_plains",
    label: "Lisière",
    description: "Entre forêt et plaine. Bonus de production (+20 %).",
    kind: "land"
  },
  {
    id: "plains_mountain",
    label: "Piémont",
    description: "Entre plaine et montagne. Bonus de production (+20 %).",
    kind: "land"
  },
  {
    id: "forest_mountain",
    label: "Haute forêt",
    description: "Forêt d’altitude. Bonus de production (+20 %).",
    kind: "land"
  }
];

export const primaryBiomes = biomes.filter(
  (biome): biome is BiomeDefinition & { id: PrimaryBiomeId } => biome.primary === true
);

export function getBiomeDefinition(
  id: BiomeId | string | null | undefined
): BiomeDefinition | undefined {
  if (!id) return undefined;
  return biomes.find((biome) => biome.id === id);
}
