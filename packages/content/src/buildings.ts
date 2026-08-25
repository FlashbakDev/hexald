import type { BiomeId, BuildingId, ResourceId } from "@hexald/shared";

export type BuildingStatus = "mvp" | "planned" | "later";

export type BuildingDefinition = {
  id: BuildingId;
  label: string;
  /** Biome requis ; `"any"` = toute tuile constructible (pas l’eau pure). */
  terrain: BiomeId | "any";
  input: ResourceId | "workers" | null;
  output: ResourceId | "population" | "prestige" | null;
  hexSize: number | "multi";
  status: BuildingStatus;
};

export const buildings: BuildingDefinition[] = [
  { id: "village", label: "Village", terrain: "any", input: null, output: "population", hexSize: "multi", status: "planned" },
  { id: "lumber_camp", label: "Camp de bûcherons", terrain: "forest", input: "workers", output: "wood", hexSize: 1, status: "mvp" },
  { id: "sawmill", label: "Scierie", terrain: "any", input: "wood", output: "planks", hexSize: 1, status: "mvp" },
  { id: "mine", label: "Mine", terrain: "mountain", input: "workers", output: "iron_ore", hexSize: 1, status: "mvp" },
  { id: "farm", label: "Ferme", terrain: "plains", input: "workers", output: "wheat", hexSize: 1, status: "mvp" },
  { id: "mill", label: "Moulin", terrain: "any", input: "wheat", output: "flour", hexSize: 1, status: "planned" },
  { id: "bakery", label: "Boulangerie", terrain: "any", input: "flour", output: "food", hexSize: 1, status: "planned" },
  { id: "quarry", label: "Carrière", terrain: "mountain", input: "workers", output: "stone", hexSize: 1, status: "mvp" },
  { id: "smelter", label: "Fonderie", terrain: "any", input: "iron_ore", output: "iron_ingot", hexSize: "multi", status: "mvp" },
  { id: "forge", label: "Forge", terrain: "any", input: "iron_ingot", output: "tools", hexSize: 1, status: "mvp" },
  { id: "monument", label: "Monument", terrain: "any", input: null, output: "prestige", hexSize: "multi", status: "later" }
];
