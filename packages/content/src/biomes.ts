import type { BiomeId, PrimaryBiomeId } from "@hexald/shared";

/** Sol constructible ou eau. Le rivage n’est plus un kind de biome (décor d’arête). */
export type BiomeKind = "land" | "water";

export type BiomeDefinition = {
  id: BiomeId;
  label: string;
  kind: BiomeKind;
  /** Biomes que le joueur peut choisir pour générer une région. */
  primary?: boolean;
};

export const biomes: BiomeDefinition[] = [
  { id: "forest", label: "Forêt", kind: "land", primary: true },
  { id: "plains", label: "Plaine", kind: "land", primary: true },
  { id: "mountain", label: "Montagne", kind: "land", primary: true },
  { id: "water", label: "Eau", kind: "water", primary: true },
  { id: "forest_plains", label: "Lisière", kind: "land" },
  { id: "plains_mountain", label: "Piémont", kind: "land" },
  { id: "forest_mountain", label: "Haute forêt", kind: "land" }
];

export const primaryBiomes = biomes.filter(
  (biome): biome is BiomeDefinition & { id: PrimaryBiomeId } => biome.primary === true
);
