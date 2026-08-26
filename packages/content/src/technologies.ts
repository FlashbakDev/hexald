/** Catalogue technologies — DEC-022, frise Civ-like (Agriculture → 3 branches). */

import type { CityImprovementId } from "./cityImprovements.ts";

export type TechAgeId = "origins" | "craft" | "metal";

export type TechId =
  | "foundations"
  | "agriculture"
  | "sailing"
  | "animal_husbandry"
  | "pottery"
  | "writing"
  | "masonry"
  | "irrigation"
  | "wheel"
  | "currency"
  | "bronze_working"
  | "military_training"
  | "advanced_navigation"
  | "engineering"
  | "mining"
  | "metallurgy";

export type TechPrototypeStatus =
  | "locked"
  | "available"
  | "researching"
  | "unlocked";

export type TechUnlockKind =
  | "building"
  | "city_improvement"
  | "passive_bonus"
  | "tech_branch";

export type TechUnlock = {
  kind: TechUnlockKind;
  refId: string;
  label: string;
  icon: string;
};

export type TechAgeDefinition = {
  id: TechAgeId;
  order: number;
  label: string;
  subtitle: string;
};

export type TechNodeDefinition = {
  id: TechId;
  ageId: TechAgeId;
  label: string;
  description: string;
  scienceCost: number;
  prerequisites: TechId[];
  unlocksLabel: string;
  icon: string;
  unlocks: TechUnlock[];
};

export const ANIMAL_HUSBANDRY_PASTURE_FOOD_BONUS_PER_MINUTE = 1;
export const ANIMAL_HUSBANDRY_LUMBER_BONUS_PER_MINUTE = 1;
export const POTTERY_PLANTATION_FOOD_BONUS_PER_MINUTE = 1;
export const MASONRY_STONE_BONUS_PER_MINUTE = 1;
export const MASONRY_MINE_BONUS_PER_MINUTE = 1;

/** Ordre d’affichage dans la frise horizontale. */
export const TECH_DISPLAY_ORDER: readonly TechId[] = [
  "foundations",
  "agriculture",
  "sailing",
  "animal_husbandry",
  "pottery",
  "writing",
  "masonry",
  "irrigation",
  "wheel",
  "currency",
  "bronze_working",
  "mining",
  "military_training",
  "advanced_navigation",
  "engineering",
  "metallurgy"
] as const;

export const TECH_AGES: readonly TechAgeDefinition[] = [
  {
    id: "origins",
    order: 0,
    label: "Origines",
    subtitle: "Survie et premiers outils"
  },
  {
    id: "craft",
    order: 1,
    label: "Artisanat",
    subtitle: "Chaînes de transformation"
  },
  {
    id: "metal",
    order: 2,
    label: "Métallurgie",
    subtitle: "Minerais et forge"
  }
] as const;

export const TECH_NODES: readonly TechNodeDefinition[] = [
  {
    id: "foundations",
    ageId: "origins",
    label: "Fondations",
    description: "Extracteurs terrestres de base, maison et expansion.",
    scienceCost: 0,
    prerequisites: [],
    unlocksLabel: "Camp, ferme, carrière, maison",
    icon: "i-lucide-home",
    unlocks: [
      {
        kind: "building",
        refId: "lumber_camp",
        label: "Camp",
        icon: "i-lucide-trees"
      },
      {
        kind: "building",
        refId: "farm",
        label: "Ferme",
        icon: "i-lucide-wheat"
      },
      {
        kind: "building",
        refId: "quarry",
        label: "Carrière",
        icon: "i-lucide-pickaxe"
      },
      {
        kind: "building",
        refId: "house",
        label: "Maison",
        icon: "i-lucide-home"
      }
    ]
  },
  {
    id: "agriculture",
    ageId: "origins",
    label: "Agriculture",
    description: "Ouvre les voies Navigation à voile, Élevage et Poterie.",
    scienceCost: 20,
    prerequisites: ["foundations"],
    unlocksLabel: "Voile · Élevage · Poterie",
    icon: "i-lucide-wheat",
    unlocks: [
      {
        kind: "tech_branch",
        refId: "sailing",
        label: "Navigation à voile",
        icon: "i-lucide-sailboat"
      },
      {
        kind: "tech_branch",
        refId: "animal_husbandry",
        label: "Élevage",
        icon: "i-lucide-beef"
      },
      {
        kind: "tech_branch",
        refId: "pottery",
        label: "Poterie",
        icon: "i-lucide-amphora"
      }
    ]
  },
  {
    id: "sailing",
    ageId: "craft",
    label: "Navigation à voile",
    description: "Aménager un quai de pêche le long des côtes.",
    scienceCost: 25,
    prerequisites: ["agriculture"],
    unlocksLabel: "Quai de pêche",
    icon: "i-lucide-sailboat",
    unlocks: [
      {
        kind: "building",
        refId: "fishing_hut",
        label: "Quai",
        icon: "i-lucide-anchor"
      }
    ]
  },
  {
    id: "animal_husbandry",
    ageId: "craft",
    label: "Élevage",
    description: "+1 nourriture / pâturage, scierie, +1 bois / camp de bûcherons.",
    scienceCost: 25,
    prerequisites: ["agriculture"],
    unlocksLabel: "Pâturage · Scierie · Bois",
    icon: "i-lucide-beef",
    unlocks: [
      {
        kind: "passive_bonus",
        refId: "pasture_food",
        label: "+1 / pâturage",
        icon: "i-lucide-milk"
      },
      {
        kind: "building",
        refId: "sawmill",
        label: "Scierie",
        icon: "i-lucide-axe"
      },
      {
        kind: "passive_bonus",
        refId: "lumber_camp_yield",
        label: "+1 / camp",
        icon: "i-lucide-trees"
      }
    ]
  },
  {
    id: "pottery",
    ageId: "craft",
    label: "Poterie",
    description: "+1 nourriture / plantation, briqueterie, +1 argile (hors jeu).",
    scienceCost: 25,
    prerequisites: ["agriculture"],
    unlocksLabel: "Plantation · Briques · Argile",
    icon: "i-lucide-amphora",
    unlocks: [
      {
        kind: "passive_bonus",
        refId: "plantation_food",
        label: "+1 / plantation",
        icon: "i-lucide-wheat"
      },
      {
        kind: "building",
        refId: "brickworks",
        label: "Briqueterie",
        icon: "i-lucide-brick-wall"
      },
      {
        kind: "passive_bonus",
        refId: "clay_yield",
        label: "+1 argile",
        icon: "i-lucide-mountain"
      }
    ]
  },
  {
    id: "writing",
    ageId: "craft",
    label: "Écriture",
    description: "Consigner le savoir du village dans une bibliothèque.",
    scienceCost: 30,
    prerequisites: ["pottery"],
    unlocksLabel: "Bibliothèque",
    icon: "i-lucide-book-open",
    unlocks: [
      {
        kind: "building",
        refId: "library",
        label: "Bibliothèque",
        icon: "i-lucide-library"
      }
    ]
  },
  {
    id: "masonry",
    ageId: "craft",
    label: "Maçonnerie",
    description: "Muraille de village, +1 pierre / carrière et +1 minerai / mine.",
    scienceCost: 30,
    prerequisites: ["animal_husbandry"],
    unlocksLabel: "Muraille · Carrière · Mine",
    icon: "i-lucide-hammer",
    unlocks: [
      {
        kind: "city_improvement",
        refId: "village_wall",
        label: "Muraille",
        icon: "i-lucide-shield"
      },
      {
        kind: "passive_bonus",
        refId: "quarry_yield",
        label: "+1 / carrière",
        icon: "i-lucide-pickaxe"
      },
      {
        kind: "passive_bonus",
        refId: "mine_yield",
        label: "+1 / mine",
        icon: "i-lucide-mountain"
      }
    ]
  },
  {
    id: "irrigation",
    ageId: "craft",
    label: "Irrigation",
    description: "Canaux et bassins pour cultiver des jardins nourriciers.",
    scienceCost: 35,
    prerequisites: ["animal_husbandry", "pottery"],
    unlocksLabel: "Jardin",
    icon: "i-lucide-droplets",
    unlocks: [
      {
        kind: "building",
        refId: "garden",
        label: "Jardin",
        icon: "i-lucide-flower-2"
      }
    ]
  },
  {
    id: "wheel",
    ageId: "craft",
    label: "Roue",
    description: "Mécanique rotative — chariots et machines simples.",
    scienceCost: 40,
    prerequisites: ["irrigation", "masonry"],
    unlocksLabel: "Transport",
    icon: "i-lucide-circle-dot",
    unlocks: [
      {
        kind: "passive_bonus",
        refId: "wheel_transport",
        label: "Transport",
        icon: "i-lucide-truck"
      }
    ]
  },
  {
    id: "currency",
    ageId: "craft",
    label: "Monnaie",
    description: "Échanges structurés : marché, bains publics et monnaie.",
    scienceCost: 40,
    prerequisites: ["sailing", "writing"],
    unlocksLabel: "Marché · Bains · Monnaie",
    icon: "i-lucide-coins",
    unlocks: [
      {
        kind: "building",
        refId: "market",
        label: "Marché",
        icon: "i-lucide-store"
      },
      {
        kind: "building",
        refId: "baths",
        label: "Bains",
        icon: "i-lucide-bath"
      },
      {
        kind: "passive_bonus",
        refId: "currency",
        label: "Monnaie",
        icon: "i-lucide-coins"
      }
    ]
  },
  {
    id: "bronze_working",
    ageId: "craft",
    label: "Travail du bronze",
    description: "Alliage cuivre-étain — caserne et voies militaires.",
    scienceCost: 45,
    prerequisites: ["irrigation", "writing"],
    unlocksLabel: "Caserne",
    icon: "i-lucide-shield-half",
    unlocks: [
      {
        kind: "building",
        refId: "barracks",
        label: "Caserne",
        icon: "i-lucide-swords"
      }
    ]
  },
  {
    id: "mining",
    ageId: "craft",
    label: "Mine souterraine",
    description: "Exploitation structurée du fer et des minerais.",
    scienceCost: 40,
    prerequisites: ["pottery"],
    unlocksLabel: "Mine",
    icon: "i-lucide-pickaxe",
    unlocks: [
      {
        kind: "building",
        refId: "mine",
        label: "Mine",
        icon: "i-lucide-pickaxe"
      }
    ]
  },
  {
    id: "military_training",
    ageId: "craft",
    label: "Formation militaire",
    description: "Entraînement et discipline des troupes.",
    scienceCost: 50,
    prerequisites: ["bronze_working"],
    unlocksLabel: "Armée",
    icon: "i-lucide-sword",
    unlocks: [
      {
        kind: "passive_bonus",
        refId: "military_training",
        label: "Armée",
        icon: "i-lucide-swords"
      }
    ]
  },
  {
    id: "advanced_navigation",
    ageId: "craft",
    label: "Navigation avancée",
    description: "Cartographie et routes maritimes étendues.",
    scienceCost: 50,
    prerequisites: ["currency"],
    unlocksLabel: "Navigation",
    icon: "i-lucide-compass",
    unlocks: [
      {
        kind: "passive_bonus",
        refId: "advanced_navigation",
        label: "Routes maritimes",
        icon: "i-lucide-ship"
      }
    ]
  },
  {
    id: "engineering",
    ageId: "craft",
    label: "Ingénierie",
    description: "Convergence bronze et monnaie — ouvrages et mécanismes avancés.",
    scienceCost: 55,
    prerequisites: ["bronze_working", "currency"],
    unlocksLabel: "Ouvrages",
    icon: "i-lucide-drafting-compass",
    unlocks: [
      {
        kind: "passive_bonus",
        refId: "engineering",
        label: "Ouvrages",
        icon: "i-lucide-construction"
      }
    ]
  },
  {
    id: "metallurgy",
    ageId: "metal",
    label: "Métallurgie",
    description: "Fonte et forge pour outils et chaînes industrielles.",
    scienceCost: 50,
    prerequisites: ["mining"],
    unlocksLabel: "Fonderie, forge",
    icon: "i-lucide-flame",
    unlocks: [
      {
        kind: "building",
        refId: "smelter",
        label: "Fonderie",
        icon: "i-lucide-flame"
      },
      {
        kind: "building",
        refId: "forge",
        label: "Forge",
        icon: "i-lucide-hammer"
      }
    ]
  }
] as const;

const TECH_BY_ID = new Map<TechId, TechNodeDefinition>(
  TECH_NODES.map((node) => [node.id, node])
);

export const TECH_PROTOTYPE_STATUS: Record<TechId, TechPrototypeStatus> = {
  foundations: "unlocked",
  agriculture: "available",
  sailing: "locked",
  animal_husbandry: "locked",
  pottery: "locked",
  writing: "locked",
  masonry: "locked",
  irrigation: "locked",
  wheel: "locked",
  currency: "locked",
  bronze_working: "locked",
  military_training: "locked",
  advanced_navigation: "locked",
  engineering: "locked",
  mining: "locked",
  metallurgy: "locked"
};

export function isTechId(value: string): value is TechId {
  return TECH_BY_ID.has(value as TechId);
}

/** Alias legacy (mondes / saves avant branche Agriculture). */
export function normalizeTechId(value: string): TechId | null {
  if (isTechId(value)) return value;
  if (value === "fishing") return "sailing";
  if (value === "woodworking") return "animal_husbandry";
  return null;
}

export function getTechNode(id: TechId): TechNodeDefinition {
  const node = TECH_BY_ID.get(id);
  if (!node) throw new Error(`unknown_tech:${id}`);
  return node;
}

export function techScienceCost(id: TechId): number {
  return getTechNode(id).scienceCost;
}

export function isResearchableTechId(id: TechId): boolean {
  return id !== "foundations" && techScienceCost(id) > 0;
}

export function techNodesForAge(ageId: TechAgeId): TechNodeDefinition[] {
  return TECH_NODES.filter((node) => node.ageId === ageId);
}

export function techAgeByOrder(): TechAgeDefinition[] {
  return [...TECH_AGES].sort((a, b) => a.order - b.order);
}

export function techDisplayIndex(id: TechId): number {
  const index = TECH_DISPLAY_ORDER.indexOf(id);
  return index >= 0 ? index : TECH_DISPLAY_ORDER.length;
}

export function isCityImprovementId(value: string): value is CityImprovementId {
  return value === "granary" || value === "village_wall";
}

export function pastureFoodBonusPerMinute(
  unlockedTechIds: readonly TechId[],
  pastureTileCount: number
): number {
  if (!unlockedTechIds.includes("animal_husbandry") || pastureTileCount <= 0) {
    return 0;
  }
  return pastureTileCount * ANIMAL_HUSBANDRY_PASTURE_FOOD_BONUS_PER_MINUTE;
}

export function plantationFoodBonusPerMinute(
  unlockedTechIds: readonly TechId[],
  completedFarmCount: number
): number {
  if (!unlockedTechIds.includes("pottery") || completedFarmCount <= 0) {
    return 0;
  }
  return completedFarmCount * POTTERY_PLANTATION_FOOD_BONUS_PER_MINUTE;
}

export function lumberCampTechBonusPerMinute(
  unlockedTechIds: readonly TechId[],
  completedLumberCampCount: number
): number {
  if (!unlockedTechIds.includes("animal_husbandry") || completedLumberCampCount <= 0) {
    return 0;
  }
  return completedLumberCampCount * ANIMAL_HUSBANDRY_LUMBER_BONUS_PER_MINUTE;
}

export function quarryMasonryBonusPerMinute(
  unlockedTechIds: readonly TechId[],
  completedQuarryCount: number
): number {
  if (!unlockedTechIds.includes("masonry") || completedQuarryCount <= 0) {
    return 0;
  }
  return completedQuarryCount * MASONRY_STONE_BONUS_PER_MINUTE;
}

export function mineMasonryBonusPerMinute(
  unlockedTechIds: readonly TechId[],
  completedMineCount: number
): number {
  if (!unlockedTechIds.includes("masonry") || completedMineCount <= 0) {
    return 0;
  }
  return completedMineCount * MASONRY_MINE_BONUS_PER_MINUTE;
}
