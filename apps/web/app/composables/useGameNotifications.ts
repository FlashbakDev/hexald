import type { Ref } from "vue";
import type {
  BuildingId,
  ResourceId,
  TechId,
  WorldSnapshot,
  WorldTileSnapshot
} from "@hexald/shared";
import {
  getBuildingDefinition,
  getProcessorStepForBuilding,
  getTechNode,
  recipeOutputCount,
  resources
} from "@hexald/content";
import { isBuildingUnderConstruction } from "@hexald/game-core";
import type { NotificationKind } from "~/composables/useNotificationPreferences";

/** Ressources dont un stock plein mérite un toast in-app. */
const STOCK_NOTIFY_RESOURCES: readonly ResourceId[] = [
  "wood",
  "wheat",
  "stone",
  "clay",
  "food",
  "worldshard"
];

type TrackedState = {
  unlockedTechIds: Set<TechId>;
  population: number;
  fullStocks: Set<ResourceId>;
  underConstruction: Set<string>;
  /** tileKey → craftCompletesAt ISO (pending crafts). */
  pendingCrafts: Map<string, string>;
};

export type ConstructionCompleteEvent = {
  tile: WorldTileSnapshot;
  buildingId: BuildingId;
  label: string;
};

export type CraftCompleteEvent = {
  tile: WorldTileSnapshot;
  buildingId: BuildingId;
  buildingLabel: string;
  resourceId: ResourceId;
  resourceLabel: string;
  amount: number;
};

export type GameNotificationHooks = {
  onConstructionComplete?: (event: ConstructionCompleteEvent) => void;
  onCraftComplete?: (event: CraftCompleteEvent) => void;
};

function tileKey(tile: WorldTileSnapshot): string {
  return `${tile.q},${tile.r}`;
}

function resourceLabel(id: ResourceId): string {
  return resources.find((r) => r.id === id)?.label ?? id;
}

function captureState(snapshot: WorldSnapshot, now: number): TrackedState {
  const fullStocks = new Set<ResourceId>();
  const stocks = snapshot.economy.stocks ?? [];

  for (const resourceId of STOCK_NOTIFY_RESOURCES) {
    const stock = stocks.find((row) => row.resourceId === resourceId);
    if (!stock || stock.cap <= 0) continue;
    if (stock.amount >= stock.cap - 1e-9) {
      fullStocks.add(resourceId);
    }
  }

  const underConstruction = new Set<string>();
  const pendingCrafts = new Map<string, string>();
  for (const tile of snapshot.tiles) {
    if (
      tile.buildingId &&
      isBuildingUnderConstruction(tile.constructionCompletesAt, now)
    ) {
      underConstruction.add(tileKey(tile));
    }
    if (tile.buildingId && tile.craftCompletesAt) {
      const ends = Date.parse(tile.craftCompletesAt);
      if (!Number.isNaN(ends) && ends > now) {
        pendingCrafts.set(tileKey(tile), tile.craftCompletesAt);
      }
    }
  }

  return {
    unlockedTechIds: new Set(snapshot.research.unlockedTechIds),
    population: snapshot.economy.population,
    fullStocks,
    underConstruction,
    pendingCrafts
  };
}

function emitDiff(
  toast: ReturnType<typeof useToast>,
  isEnabled: (kind: NotificationKind) => boolean,
  before: TrackedState,
  after: TrackedState,
  snapshot: WorldSnapshot,
  now: number,
  hooks?: GameNotificationHooks
) {
  if (isEnabled("tech_unlocked")) {
    for (const techId of after.unlockedTechIds) {
      if (before.unlockedTechIds.has(techId)) continue;
      const node = getTechNode(techId);
      toast.add({
        title: "Technologie débloquée",
        description: node.label,
        icon: node.icon,
        color: "primary"
      });
    }
  }

  if (isEnabled("construction_complete") || hooks?.onConstructionComplete) {
    for (const tile of snapshot.tiles) {
      const key = tileKey(tile);
      if (
        !before.underConstruction.has(key) ||
        after.underConstruction.has(key) ||
        !tile.buildingId
      ) {
        continue;
      }
      const definition = getBuildingDefinition(tile.buildingId);
      const label = definition?.label ?? tile.buildingId;
      if (isEnabled("construction_complete")) {
        toast.add({
          title: "Construction terminée",
          description: label,
          icon: "i-lucide-hammer",
          color: "success"
        });
      }
      hooks?.onConstructionComplete?.({
        tile,
        buildingId: tile.buildingId,
        label
      });
    }
  }

  if (isEnabled("craft_complete") || hooks?.onCraftComplete) {
    for (const [key, completesAt] of before.pendingCrafts) {
      const ends = Date.parse(completesAt);
      if (Number.isNaN(ends) || ends > now) continue;
      const afterPending = after.pendingCrafts.get(key);
      // Complet si plus de craft, ou nouveau cycle démarré (timestamp différent / plus tard).
      if (afterPending === completesAt) continue;
      const tile = snapshot.tiles.find((t) => tileKey(t) === key);
      if (!tile?.buildingId) continue;
      const step = getProcessorStepForBuilding(tile.buildingId);
      if (!step) continue;
      const workers = Math.max(1, Math.floor(tile.assignedWorkers ?? 1));
      const amount = recipeOutputCount(step) * workers;
      const definition = getBuildingDefinition(tile.buildingId);
      const buildingLabel = definition?.label ?? tile.buildingId;
      const outLabel = resourceLabel(step.output);
      if (isEnabled("craft_complete")) {
        toast.add({
          title: buildingLabel,
          description: `+${amount} ${outLabel}`,
          icon: "i-lucide-factory",
          color: "success"
        });
      }
      hooks?.onCraftComplete?.({
        tile,
        buildingId: tile.buildingId,
        buildingLabel,
        resourceId: step.output,
        resourceLabel: outLabel,
        amount
      });
    }
  }

  if (isEnabled("population_growth") && after.population > before.population) {
    const delta = after.population - before.population;
    toast.add({
      title: delta === 1 ? "Nouvel habitant" : `${delta} nouveaux habitants`,
      description: `Population : ${after.population}`,
      icon: "i-lucide-users",
      color: "primary"
    });
  }

  if (!isEnabled("stock_full")) return;

  for (const resourceId of after.fullStocks) {
    if (before.fullStocks.has(resourceId)) continue;
    toast.add({
      title: "Stock plein",
      description: `${resourceLabel(resourceId)} — dépense ou agrandis`,
      icon: "i-lucide-package",
      color: "warning"
    });
  }
}

/** Toasts in-app sur changements d’état monde (refresh ou action). */
export function useGameNotifications(
  world: Ref<WorldSnapshot | null>,
  hooks?: GameNotificationHooks
) {
  const toast = useToast();
  const { isEnabled } = useNotificationPreferences();
  let ready = false;
  let previous: TrackedState | null = null;

  watch(
    () => world.value,
    (snapshot) => {
      if (!snapshot) {
        ready = false;
        previous = null;
        return;
      }

      const now = Date.now();
      const next = captureState(snapshot, now);

      if (!ready) {
        ready = true;
        previous = next;
        return;
      }

      if (previous) {
        emitDiff(toast, isEnabled, previous, next, snapshot, now, hooks);
      }

      previous = next;
    }
  );
}
