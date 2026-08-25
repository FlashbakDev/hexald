import type { BuildingId, ResourceId } from "@hexald/shared";

export type RecipeStep = {
  buildingId: BuildingId;
  input: ResourceId | null;
  output: ResourceId;
};

export type ProductionChain = {
  id: string;
  label: string;
  steps: RecipeStep[];
};

export const chains: ProductionChain[] = [
  {
    id: "iron",
    label: "Fer",
    steps: [
      { buildingId: "mine", input: null, output: "iron_ore" },
      { buildingId: "smelter", input: "iron_ore", output: "iron_ingot" },
      { buildingId: "forge", input: "iron_ingot", output: "tools" }
    ]
  },
  {
    id: "wood",
    label: "Bois",
    steps: [
      { buildingId: "lumber_camp", input: null, output: "wood" },
      { buildingId: "sawmill", input: "wood", output: "planks" }
    ]
  },
  {
    id: "food",
    label: "Nourriture",
    steps: [
      { buildingId: "farm", input: null, output: "wheat" },
      { buildingId: "mill", input: "wheat", output: "flour" },
      { buildingId: "bakery", input: "flour", output: "food" }
    ]
  },
  {
    id: "stone",
    label: "Pierre",
    steps: [
      { buildingId: "quarry", input: null, output: "stone" }
    ]
  }
];
