import type { BuildingId, ResourceId, TechId } from "@hexald/shared";
import { buildings, resources } from "@hexald/content";

/** Icônes Lucide alignées sur le HUD / wiki. */
export const RESOURCE_ICONS: Record<ResourceId, string> = {
  wood: "i-lucide-tree-pine",
  planks: "i-lucide-layers",
  wheat: "i-lucide-wheat",
  flour: "i-lucide-cooking-pot",
  food: "i-lucide-beef",
  stone: "i-lucide-stone",
  stone_blocks: "i-lucide-brick-wall",
  clay: "i-lucide-shovel",
  iron_ore: "i-lucide-pickaxe",
  iron_ingot: "i-lucide-flame",
  tools: "i-lucide-wrench",
  gold: "i-lucide-coins",
  worldshard: "i-lucide-sparkles"
};

/** Toujours visibles (HUD + panneau). */
export const CORE_RESOURCE_IDS: readonly ResourceId[] = [
  "food",
  "wood",
  "worldshard",
  "gold"
] as const;

export type EconomyChainDef = {
  id: string;
  resourceIds: ResourceId[];
};

/** Organisation UX recommandée Lot 3. */
export const ECONOMY_CHAINS: EconomyChainDef[] = [
  { id: "wood", resourceIds: ["wood", "planks"] },
  { id: "food", resourceIds: ["wheat", "flour", "food"] },
  { id: "stone", resourceIds: ["stone"] },
  { id: "clay", resourceIds: ["clay", "stone_blocks"] },
  { id: "iron", resourceIds: ["iron_ore", "iron_ingot", "tools"] },
  { id: "gold", resourceIds: ["gold"] },
  { id: "worldshard", resourceIds: ["worldshard"] }
];

const labelById = new Map(resources.map((r) => [r.id, r.label] as const));

export function resourceLabel(id: ResourceId): string {
  return labelById.get(id) ?? id;
}

export function resourceIcon(id: ResourceId): string {
  return RESOURCE_ICONS[id] ?? "i-lucide-circle";
}

type UnlockContext = {
  amount: number;
  unlockedTechIds: ReadonlySet<TechId> | readonly TechId[];
  ownedBuildingIds: ReadonlySet<BuildingId> | readonly BuildingId[];
};

function asSet<T extends string>(
  value: ReadonlySet<T> | readonly T[]
): ReadonlySet<T> {
  return value instanceof Set ? value : new Set(value);
}

/** Bâtiments liés à une ressource (input ou output catalogue). */
function relatedBuildings(resourceId: ResourceId) {
  return buildings.filter(
    (b) => b.input === resourceId || b.output === resourceId
  );
}

/**
 * Progressive disclosure sans table DB :
 * stock > 0, ou tech/bâtiment correspondant débloqué / présent.
 * Les ressources cœur restent toujours visibles.
 */
export function isResourceVisible(
  resourceId: ResourceId,
  ctx: UnlockContext
): boolean {
  if ((CORE_RESOURCE_IDS as readonly string[]).includes(resourceId)) {
    return true;
  }
  if (ctx.amount > 0) return true;

  const techs = asSet(ctx.unlockedTechIds);
  const owned = asSet(ctx.ownedBuildingIds);

  for (const b of relatedBuildings(resourceId)) {
    if (owned.has(b.id)) return true;
    if (b.requiredTechId && techs.has(b.requiredTechId)) return true;
  }
  return false;
}

export type EconomyPanelRow = {
  resourceId: ResourceId;
  label: string;
  icon: string;
  amount: number;
  cap: number | null;
};

export type EconomyPanelChain = {
  id: string;
  rows: EconomyPanelRow[];
};

export function buildEconomyPanelChains(options: {
  amounts: Partial<Record<ResourceId, number>>;
  caps: Partial<Record<ResourceId, number | null | undefined>>;
  unlockedTechIds: ReadonlySet<TechId> | readonly TechId[];
  ownedBuildingIds: ReadonlySet<BuildingId> | readonly BuildingId[];
}): EconomyPanelChain[] {
  const chains: EconomyPanelChain[] = [];

  for (const chain of ECONOMY_CHAINS) {
    const rows: EconomyPanelRow[] = [];
    for (const resourceId of chain.resourceIds) {
      const amount = Math.max(0, Math.floor(options.amounts[resourceId] ?? 0));
      if (
        !isResourceVisible(resourceId, {
          amount,
          unlockedTechIds: options.unlockedTechIds,
          ownedBuildingIds: options.ownedBuildingIds
        })
      ) {
        continue;
      }
      const rawCap = options.caps[resourceId];
      const cap =
        rawCap != null && Number.isFinite(rawCap) && rawCap > 0
          ? Math.floor(rawCap)
          : null;
      rows.push({
        resourceId,
        label: resourceLabel(resourceId),
        icon: resourceIcon(resourceId),
        amount,
        cap
      });
    }
    if (rows.length > 0) {
      chains.push({ id: chain.id, rows });
    }
  }

  return chains;
}

/** Chaînes processor pour le panneau tuile (input → output). */
export type ProcessorIoDef = {
  buildingId: BuildingId;
  inputId: ResourceId;
  outputId: ResourceId;
  inputPerCraft: number;
  outputPerCraft: number;
  chainLabel: string;
};

const PROCESSOR_IO: ProcessorIoDef[] = [
  {
    buildingId: "sawmill",
    inputId: "wood",
    outputId: "planks",
    inputPerCraft: 5,
    outputPerCraft: 1,
    chainLabel: "Bois → Planches"
  },
  {
    buildingId: "mill",
    inputId: "wheat",
    outputId: "flour",
    inputPerCraft: 5,
    outputPerCraft: 1,
    chainLabel: "Blé → Farine"
  },
  {
    buildingId: "bakery",
    inputId: "flour",
    outputId: "food",
    inputPerCraft: 1,
    outputPerCraft: 2,
    chainLabel: "Farine → Nourriture"
  },
  {
    buildingId: "smelter",
    inputId: "iron_ore",
    outputId: "iron_ingot",
    inputPerCraft: 5,
    outputPerCraft: 1,
    chainLabel: "Minerai → Lingot"
  },
  {
    buildingId: "forge",
    inputId: "iron_ingot",
    outputId: "tools",
    inputPerCraft: 5,
    outputPerCraft: 1,
    chainLabel: "Lingot → Outils"
  },
  {
    buildingId: "brickworks",
    inputId: "clay",
    outputId: "stone_blocks",
    inputPerCraft: 5,
    outputPerCraft: 1,
    chainLabel: "Argile → Briques"
  }
];

export function getProcessorIo(
  buildingId: BuildingId | null | undefined
): ProcessorIoDef | null {
  if (!buildingId) return null;
  return PROCESSOR_IO.find((row) => row.buildingId === buildingId) ?? null;
}
