import type { ResourceId } from "@hexald/shared";

export type ResourceDefinition = {
  id: ResourceId;
  label: string;
};

export const resources: ResourceDefinition[] = [
  { id: "wood", label: "Bois" },
  { id: "planks", label: "Planches" },
  { id: "wheat", label: "Blé" },
  { id: "flour", label: "Farine" },
  { id: "food", label: "Nourriture" },
  { id: "stone", label: "Pierre" },
  { id: "stone_blocks", label: "Blocs" },
  { id: "iron_ore", label: "Minerai de fer" },
  { id: "iron_ingot", label: "Lingot de fer" },
  { id: "tools", label: "Outils" }
];
