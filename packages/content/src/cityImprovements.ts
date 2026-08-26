/** Améliorations de ville (HDV) — catalogue, runtime hors MVP. */

export type CityImprovementId = "granary" | "village_wall";

export type CityImprovementStatus = "planned" | "mvp" | "later";

export type CityImprovementDefinition = {
  id: CityImprovementId;
  label: string;
  icon: string;
  status: CityImprovementStatus;
  description: string;
};

export const cityImprovements: readonly CityImprovementDefinition[] = [
  {
    id: "granary",
    label: "Grenier",
    icon: "i-lucide-warehouse",
    status: "planned",
    description: "Amélioration hôtel de ville — stockage blé (hors jeu pour le moment)."
  },
  {
    id: "village_wall",
    label: "Muraille de village",
    icon: "i-lucide-shield",
    status: "planned",
    description: "Amélioration hôtel de ville — défense du village (hors jeu pour le moment)."
  }
] as const;

const BY_ID = new Map(cityImprovements.map((row) => [row.id, row]));

export function getCityImprovement(
  id: CityImprovementId
): CityImprovementDefinition {
  const row = BY_ID.get(id);
  if (!row) throw new Error(`unknown_city_improvement:${id}`);
  return row;
}
