import type { BuildingId, ResourceId } from "@hexald/shared";
import { getBuildingDefinition } from "./buildings.ts";

export type RecipeStep = {
  buildingId: BuildingId;
  input: ResourceId | null;
  output: ResourceId;
  /** Unités d’input consommées par cycle craft (processors). Défaut 1. */
  inputCount?: number;
  /** Unités d’output produites par cycle. Défaut 1. */
  outputCount?: number;
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
      {
        buildingId: "smelter",
        input: "iron_ore",
        output: "iron_ingot",
        inputCount: 5,
        outputCount: 1
      },
      { buildingId: "forge", input: "iron_ingot", output: "tools" }
    ]
  },
  {
    id: "wood",
    label: "Bois",
    steps: [
      { buildingId: "lumber_camp", input: null, output: "wood" },
      {
        buildingId: "sawmill",
        input: "wood",
        output: "planks",
        inputCount: 5,
        outputCount: 1
      }
    ]
  },
  {
    id: "food",
    label: "Nourriture",
    steps: [
      { buildingId: "farm", input: null, output: "wheat" },
      {
        buildingId: "mill",
        input: "wheat",
        output: "flour",
        inputCount: 5,
        outputCount: 1
      },
      { buildingId: "bakery", input: "flour", output: "food" },
      { buildingId: "fishing_hut", input: null, output: "food" }
    ]
  },
  {
    id: "stone",
    label: "Pierre",
    steps: [
      { buildingId: "quarry", input: null, output: "stone" }
    ]
  },
  {
    id: "clay",
    label: "Argile",
    steps: [
      { buildingId: "clay_mine", input: null, output: "clay" },
      {
        buildingId: "brickworks",
        input: "clay",
        output: "stone_blocks",
        inputCount: 5,
        outputCount: 1
      }
    ]
  },
  {
    id: "commerce",
    label: "Commerce",
    steps: [
      { buildingId: "market", input: null, output: "gold" }
    ]
  }
];

export function recipeInputCount(step: RecipeStep): number {
  return Math.max(1, Math.floor(step.inputCount ?? 1));
}

export function recipeOutputCount(step: RecipeStep): number {
  return Math.max(1, Math.floor(step.outputCount ?? 1));
}

export function getChain(id: string): ProductionChain | undefined {
  return chains.find((chain) => chain.id === id);
}

/** Première étape de chaîne (souvent extracteur, `input: null`). */
export function getExtractorStepForBuilding(
  buildingId: BuildingId
): RecipeStep | undefined {
  for (const chain of chains) {
    const step = chain.steps.find(
      (entry) => entry.buildingId === buildingId && entry.input === null
    );
    if (step) return step;
  }
  return undefined;
}

/** Étape de transformation (`input` ressource → `output`). */
export function getProcessorStepForBuilding(
  buildingId: BuildingId
): RecipeStep | undefined {
  for (const chain of chains) {
    const step = chain.steps.find(
      (entry) => entry.buildingId === buildingId && entry.input !== null
    );
    if (step) return step;
  }
  return undefined;
}

export function getRecipeStepForBuilding(
  buildingId: BuildingId
): RecipeStep | undefined {
  return (
    getExtractorStepForBuilding(buildingId) ??
    getProcessorStepForBuilding(buildingId)
  );
}

/** Toutes les recettes craftables (processors) — prêt pour le runtime craft. */
export function listProcessorRecipes(): RecipeStep[] {
  return chains.flatMap((chain) =>
    chain.steps.filter((step) => step.input !== null)
  );
}

/**
 * Output ressource d’un bâtiment : priorité définition catalogue, sinon chaîne.
 */
export function resourceOutputForBuilding(
  buildingId: BuildingId
): ResourceId | null {
  const definition = getBuildingDefinition(buildingId);
  if (
    definition?.output &&
    definition.output !== "population" &&
    definition.output !== "prestige"
  ) {
    return definition.output;
  }
  return getRecipeStepForBuilding(buildingId)?.output ?? null;
}

/** Vérifie cohérence chaînes ↔ bâtiments (appel module-load). */
export function assertChainsMatchBuildings(): void {
  for (const chain of chains) {
    for (const step of chain.steps) {
      const definition = getBuildingDefinition(step.buildingId);
      if (!definition) {
        throw new Error(
          `chain "${chain.id}": unknown building "${step.buildingId}"`
        );
      }
      if (
        definition.output &&
        definition.output !== "population" &&
        definition.output !== "prestige" &&
        definition.output !== step.output
      ) {
        throw new Error(
          `chain "${chain.id}" step ${step.buildingId}: output "${step.output}" ≠ building "${definition.output}"`
        );
      }
      if (step.input !== null && definition.input !== step.input) {
        throw new Error(
          `chain "${chain.id}" step ${step.buildingId}: input "${step.input}" ≠ building "${definition.input}"`
        );
      }
    }
  }
}

assertChainsMatchBuildings();
