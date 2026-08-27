import type { Ref } from "vue";
import type { ResourceId, TechId, WorldSnapshot, WorldTileSnapshot } from "@hexald/shared";
import { getBuildingDefinition, getTechNode, resources } from "@hexald/content";
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
  for (const tile of snapshot.tiles) {
    if (
      tile.buildingId &&
      isBuildingUnderConstruction(tile.constructionCompletesAt, now)
    ) {
      underConstruction.add(tileKey(tile));
    }
  }

  return {
    unlockedTechIds: new Set(snapshot.research.unlockedTechIds),
    population: snapshot.economy.population,
    fullStocks,
    underConstruction
  };
}

function emitDiff(
  toast: ReturnType<typeof useToast>,
  isEnabled: (kind: NotificationKind) => boolean,
  before: TrackedState,
  after: TrackedState,
  snapshot: WorldSnapshot
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

  if (isEnabled("construction_complete")) {
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
      toast.add({
        title: "Construction terminée",
        description: definition?.label ?? tile.buildingId,
        icon: "i-lucide-hammer",
        color: "success"
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
export function useGameNotifications(world: Ref<WorldSnapshot | null>) {
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
        emitDiff(toast, isEnabled, previous, next, snapshot);
      }

      previous = next;
    }
  );
}
