<script setup lang="ts">
import type {
  BuildingId,
  HexCoord,
  PrimaryBiomeId,
  WorldTileSnapshot
} from "@hexald/shared";
import {
  buildings,
  BUILD_COST_WOOD,
  BUILD_IDLE_POP_REQUIREMENT,
  BUILD_DURATION_MS,
  DEV_BUILD_DURATION_MS,
  primaryBiomes,
  STONE_RATE_PER_WORKER_PER_MINUTE,
  WHEAT_RATE_PER_WORKER_PER_MINUTE,
  WOOD_RATE_PER_WORKER_PER_MINUTE,
  type PlaceableExtractorId
} from "@hexald/content";
import {
  computeRegionExpansionCost,
  listBuildOptionsForTile,
  isBuildingUnderConstruction,
  committedWorkersFromTiles,
  WORKERS_PER_EXTRACTOR_L1
} from "@hexald/game-core";
import type { HexScreenPoint, SelectedTile } from "~/renderer/createHexScene";

definePageMeta({
  layout: "blank"
});

const { pseudo, ensureSession } = useSession();
const {
  ensureWorld,
  expandRegion,
  assignWorkers,
  buildBuilding,
  resetWorld,
  grantDevResources,
  refreshWorld,
  world,
  error: worldError
} = useWorld();

const session = await ensureSession();
if (!session?.pseudo) {
  await navigateTo("/", { replace: true });
} else {
  await ensureWorld();
}

useHead({
  title: computed(() =>
    pseudo.value ? `${pseudo.value} · Hexald` : "Hexald"
  )
});

const preview = useTemplateRef<{
  recenter: () => void;
  clearSelection: () => void;
  applyRegion: (
    center: HexCoord,
    biome: PrimaryBiomeId,
    tiles: readonly WorldTileSnapshot[]
  ) => boolean;
  applyBuilding: (q: number, r: number, buildingId: BuildingId) => boolean;
  projectTile: (q: number, r: number) => HexScreenPoint | null;
}>("preview");

const stage = useTemplateRef<HTMLElement>("stage");
const selected = ref<SelectedTile | null>(null);
const expanding = ref(false);
const building = ref(false);
const expandError = ref<string | null>(null);
const assigning = ref(false);
const resetting = ref(false);
const granting = ref(false);
const nowTick = ref(Date.now());
const isDevClient = import.meta.dev;

const wheelInteractive = ref(false);
let wheelReadyTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let overlayRaf: number | null = null;

onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
  refreshTimer = setInterval(() => {
    void refreshWorld();
  }, 30_000);
  startOverlayLoop();
});

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
  if (refreshTimer) clearInterval(refreshTimer);
  if (wheelReadyTimer) clearTimeout(wheelReadyTimer);
  if (overlayRaf != null) {
    cancelAnimationFrame(overlayRaf);
    overlayRaf = null;
  }
});

const economy = computed(() => world.value?.economy ?? null);
const populationCap = computed(() => economy.value?.populationCap ?? 0);

const buildingDefs: Record<
  PlaceableExtractorId,
  { label: string; icon: string; short: string }
> = {
  lumber_camp: { label: "Camp de bûcherons", icon: "i-lucide-trees", short: "Camp" },
  farm: { label: "Ferme", icon: "i-lucide-wheat", short: "Ferme" },
  quarry: { label: "Carrière", icon: "i-lucide-mountain", short: "Carrière" }
};

function projectedStock(
  stock: number,
  cap: number,
  lastIso: string,
  ratePerMinute: number
) {
  const last = Date.parse(lastIso);
  if (Number.isNaN(last)) return Math.floor(stock);
  const minutes = Math.max(0, (nowTick.value - last) / 60_000);
  return Math.min(cap, stock + ratePerMinute * minutes);
}

const displayedWood = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const rate = eco.hasLumberCamp
    ? eco.woodcutters * WOOD_RATE_PER_WORKER_PER_MINUTE
    : 0;
  return projectedStock(eco.wood, eco.woodCap, eco.woodLastCalculatedAt, rate);
});

const displayedWheat = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const rate = eco.hasFarm ? eco.farmers * WHEAT_RATE_PER_WORKER_PER_MINUTE : 0;
  return projectedStock(eco.wheat, eco.wheatCap, eco.wheatLastCalculatedAt, rate);
});

const displayedStone = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const rate = eco.hasQuarry
    ? eco.quarriers * STONE_RATE_PER_WORKER_PER_MINUTE
    : 0;
  return projectedStock(eco.stone, eco.stoneCap, eco.stoneLastCalculatedAt, rate);
});

const idlePop = computed(() => {
  const eco = economy.value;
  const tiles = world.value?.tiles;
  if (!eco || !tiles) return 0;
  return Math.max(0, eco.population - committedWorkersFromTiles(tiles));
});

function rateLabel(count: number, rate: number, active: boolean) {
  if (!active || count === 0) return "0/min";
  return `${count * rate}/min`;
}

const woodRateLabel = computed(() => {
  const eco = economy.value;
  if (!eco) return "0/min";
  return rateLabel(eco.woodcutters, WOOD_RATE_PER_WORKER_PER_MINUTE, eco.hasLumberCamp);
});

const wheatRateLabel = computed(() => {
  const eco = economy.value;
  if (!eco) return "0/min";
  return rateLabel(eco.farmers, WHEAT_RATE_PER_WORKER_PER_MINUTE, eco.hasFarm);
});

const stoneRateLabel = computed(() => {
  const eco = economy.value;
  if (!eco) return "0/min";
  return rateLabel(eco.quarriers, STONE_RATE_PER_WORKER_PER_MINUTE, eco.hasQuarry);
});

const selectedWorldTile = computed(() => {
  const tile = selected.value;
  const tiles = world.value?.tiles;
  if (!tile || !tiles) return null;
  return tiles.find((entry) => entry.q === tile.q && entry.r === tile.r) ?? null;
});

const selectedConstruction = computed(() => {
  const snap = selectedWorldTile.value;
  const completesAt = snap?.constructionCompletesAt;
  const buildingId = snap?.buildingId;
  if (!buildingId || !completesAt) return null;
  if (
    buildingId !== "lumber_camp" &&
    buildingId !== "farm" &&
    buildingId !== "quarry"
  ) {
    return null;
  }
  const endsAt = Date.parse(completesAt);
  if (Number.isNaN(endsAt)) return null;
  const remainingMs = Math.max(0, endsAt - nowTick.value);
  if (remainingMs <= 0) return null;
  const durationMs = import.meta.dev
    ? DEV_BUILD_DURATION_MS
    : BUILD_DURATION_MS[buildingId];
  const progress = Math.min(
    1,
    Math.max(0, 1 - remainingMs / Math.max(1, durationMs))
  );
  return {
    endsAt,
    remainingMs,
    progress,
    label: formatRemaining(remainingMs)
  };
});

function formatRemaining(ms: number) {
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

type MapBadgeKind = "pop" | "workers" | "timer";

type MapBadge = {
  key: string;
  q: number;
  r: number;
  kind: MapBadgeKind;
  label: string;
  icon: string;
  x: number;
  y: number;
  visible: boolean;
  /** Extracteur sans pop assignée. */
  needsWorkers?: boolean;
};

const overlayPositions = ref(
  new Map<string, { x: number; y: number; visible: boolean }>()
);

const START_VILLAGE = { q: 0, r: 0 } as const;

function workersForBuilding(
  tile: WorldTileSnapshot
): { count: number; max: number } | null {
  const buildingId = tile.buildingId;
  if (
    buildingId !== "lumber_camp" &&
    buildingId !== "farm" &&
    buildingId !== "quarry"
  ) {
    return null;
  }
  const assigned = tile.assignedWorkers ?? 0;
  return { count: assigned, max: WORKERS_PER_EXTRACTOR_L1 };
}

const mapBadges = computed((): MapBadge[] => {
  const tiles = world.value?.tiles;
  const eco = economy.value;
  if (!tiles?.length || !eco) return [];
  const now = nowTick.value;
  const out: MapBadge[] = [];

  const villageKey = `${START_VILLAGE.q},${START_VILLAGE.r}`;
  const villagePos = overlayPositions.value.get(villageKey);
  out.push({
    key: `pop:${villageKey}`,
    q: START_VILLAGE.q,
    r: START_VILLAGE.r,
    kind: "pop",
    label: `${idlePop.value}/${eco.populationCap}`,
    icon: "i-lucide-users",
    x: villagePos?.x ?? -9999,
    y: villagePos?.y ?? -9999,
    visible: villagePos?.visible ?? false
  });

  for (const tile of tiles) {
    if (!tile.buildingId) continue;
    const key = `${tile.q},${tile.r}`;
    const pos = overlayPositions.value.get(key);
    const underConstruction = isBuildingUnderConstruction(
      tile.constructionCompletesAt,
      now
    );

    if (underConstruction && tile.constructionCompletesAt) {
      const ends = Date.parse(tile.constructionCompletesAt);
      if (!Number.isNaN(ends) && ends > now) {
        out.push({
          key: `timer:${key}`,
          q: tile.q,
          r: tile.r,
          kind: "timer",
          label: formatRemaining(ends - now),
          icon: "i-lucide-hammer",
          x: pos?.x ?? -9999,
          y: pos?.y ?? -9999,
          visible: pos?.visible ?? false
        });
      }
      continue;
    }

    const workers = workersForBuilding(tile);
    if (workers == null) continue;
    out.push({
      key: `workers:${key}`,
      q: tile.q,
      r: tile.r,
      kind: "workers",
      label: `${workers.count}/${workers.max}`,
      icon: "i-lucide-users",
      x: pos?.x ?? -9999,
      y: pos?.y ?? -9999,
      visible: pos?.visible ?? false,
      needsWorkers: workers.count === 0
    });
  }

  return out;
});

function collectOverlayTargets(): { q: number; r: number }[] {
  const tiles = world.value?.tiles;
  if (!tiles?.length) return [{ ...START_VILLAGE }];
  const targets: { q: number; r: number }[] = [{ ...START_VILLAGE }];
  const seen = new Set([`${START_VILLAGE.q},${START_VILLAGE.r}`]);
  for (const tile of tiles) {
    if (!tile.buildingId) continue;
    const key = `${tile.q},${tile.r}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({ q: tile.q, r: tile.r });
  }
  return targets;
}

function syncOverlayPositions() {
  const project = preview.value?.projectTile;
  if (!project || !world.value) {
    if (overlayPositions.value.size) overlayPositions.value = new Map();
    return;
  }
  const next = new Map<string, { x: number; y: number; visible: boolean }>();
  for (const target of collectOverlayTargets()) {
    const point = project(target.q, target.r);
    if (!point) continue;
    next.set(`${target.q},${target.r}`, {
      x: point.x,
      y: point.y,
      visible: point.visible
    });
  }
  overlayPositions.value = next;
}

function startOverlayLoop() {
  if (overlayRaf != null) return;
  const loop = () => {
    syncOverlayPositions();
    overlayRaf = requestAnimationFrame(loop);
  };
  overlayRaf = requestAnimationFrame(loop);
}

const hasActiveConstruction = computed(
  () =>
    world.value?.tiles.some((tile) => {
      const at = tile.constructionCompletesAt;
      if (!at) return false;
      const ends = Date.parse(at);
      return !Number.isNaN(ends) && ends > nowTick.value;
    }) ?? false
);

watch(hasActiveConstruction, (active, wasActive) => {
  if (wasActive && !active) void refreshWorld();
});

watch(nowTick, (now) => {
  const tiles = world.value?.tiles;
  if (!tiles?.length) return;
  const due = tiles.some((tile) => {
    const at = tile.constructionCompletesAt;
    if (!at || !tile.buildingId) return false;
    const ends = Date.parse(at);
    return !Number.isNaN(ends) && ends <= now;
  });
  if (due) void refreshWorld();
});

const buildOptions = computed(() => {
  const tile = selected.value;
  const tiles = world.value?.tiles;
  if (!tile?.biome || !tiles) return [] as PlaceableExtractorId[];
  return listBuildOptionsForTile({
    biome: tile.biome,
    hasVillage: tile.hasVillage,
    existingBuildingId: tile.buildingId ?? null,
    wood: displayedWood.value
  });
});

const buildWheelSlots = computed(() => {
  const options = buildOptions.value;
  const n = options.length;
  const hasWood = (cost: number) => displayedWood.value + 1e-9 >= cost;
  const hasIdlePop = idlePop.value + 1e-9 >= BUILD_IDLE_POP_REQUIREMENT;
  return options.map((id, index) => {
    const angle =
      n === 1 ? -Math.PI / 2 : -Math.PI / 2 + (index * 2 * Math.PI) / n;
    const radius = 56;
    const def = buildingDefs[id];
    const woodCost = BUILD_COST_WOOD[id];
    const canAffordWood = hasWood(woodCost);
    return {
      id,
      woodCost,
      canAffordWood,
      hasIdlePop,
      canAfford: canAffordWood && hasIdlePop,
      ...def,
      style: {
        transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`
      }
    };
  });
});

type WorkerPanel = {
  title: string;
  hint: string;
  count: number;
  max: number;
  rateLabel: string;
  canAdd: boolean;
  canRemove: boolean;
};

const selectedWorkerPanel = computed((): WorkerPanel | null => {
  const tile = selectedWorldTile.value;
  const eco = economy.value;
  if (!tile?.buildingId || !eco) return null;
  if (selectedConstruction.value) return null;

  const assigned = tile.assignedWorkers ?? 0;
  const max = WORKERS_PER_EXTRACTOR_L1;

  if (tile.buildingId === "lumber_camp") {
    return {
      title: "Bûcheron",
      hint: "Assigne un habitant du village pour produire du bois sur ce camp.",
      count: assigned,
      max,
      rateLabel:
        assigned > 0
          ? `${assigned * WOOD_RATE_PER_WORKER_PER_MINUTE}/min`
          : "0/min",
      canAdd: !assigning.value && assigned < max && idlePop.value > 0,
      canRemove: !assigning.value && assigned > 0
    };
  }
  if (tile.buildingId === "farm") {
    return {
      title: "Fermier",
      hint: "Assigne un habitant du village pour produire du blé sur cette ferme.",
      count: assigned,
      max,
      rateLabel:
        assigned > 0
          ? `${assigned * WHEAT_RATE_PER_WORKER_PER_MINUTE}/min`
          : "0/min",
      canAdd: !assigning.value && assigned < max && idlePop.value > 0,
      canRemove: !assigning.value && assigned > 0
    };
  }
  if (tile.buildingId === "quarry") {
    return {
      title: "Carrier",
      hint: "Assigne un habitant du village pour produire de la pierre sur cette carrière.",
      count: assigned,
      max,
      rateLabel:
        assigned > 0
          ? `${assigned * STONE_RATE_PER_WORKER_PER_MINUTE}/min`
          : "0/min",
      canAdd: !assigning.value && assigned < max && idlePop.value > 0,
      canRemove: !assigning.value && assigned > 0
    };
  }
  return null;
});

const buildingLabel = (id: BuildingId | null | undefined) => {
  if (!id) return null;
  return buildings.find((entry) => entry.id === id)?.label ?? id;
};

const biomeSwatch: Record<PrimaryBiomeId, string> = {
  forest: "#62c46f",
  plains: "#8fce6e",
  mountain: "#d0d7e2",
  water: "#62bfe8"
};

const biomeIcon: Record<PrimaryBiomeId, string> = {
  forest: "i-lucide-trees",
  plains: "i-lucide-sprout",
  mountain: "i-lucide-mountain",
  water: "i-lucide-waves"
};

const showBiomeWheel = computed(
  () =>
    selected.value != null &&
    selected.value.canGenerate &&
    selected.value.biome == null &&
    !expanding.value &&
    !building.value
);

const regionExpansionCost = computed(() => {
  const tile = selected.value;
  const tiles = world.value?.tiles;
  if (!tile?.canGenerate || tile.biome != null || !tiles) return null;
  return computeRegionExpansionCost({
    center: { q: tile.q, r: tile.r },
    tiles,
    now: nowTick.value
  });
});

const canAffordRegion = computed(() => {
  const cost = regionExpansionCost.value;
  if (!cost) return false;
  return displayedWood.value + 1e-9 >= cost.wood;
});

const regionExpansionDiscountPct = computed(() => {
  const cost = regionExpansionCost.value;
  if (!cost || cost.discount <= 0) return 0;
  return Math.round(cost.discount * 100);
});

const regionCostLabel = computed(() => {
  const cost = regionExpansionCost.value;
  if (!cost) return "";
  const wood = `${cost.wood} bois`;
  if (cost.discount <= 0) return wood;
  return `${wood} (−${regionExpansionDiscountPct.value}%)`;
});

const showBuildWheel = computed(
  () =>
    selected.value != null &&
    buildOptions.value.length > 0 &&
    !expanding.value &&
    !building.value
);

/** Bottom sheet ouvert uniquement si la tuile porte un bâtiment. */
const showBuildingSheet = computed(() => {
  const tile = selected.value;
  if (!tile || showBuildWheel.value) return false;
  return tile.hasVillage || tile.buildingId != null;
});

const selectedBuildingTitle = computed(() => {
  const tile = selected.value;
  if (!tile) return "";
  if (tile.hasVillage) return "Village";
  return buildingLabel(tile.buildingId) ?? "Bâtiment";
});

const anyWheelOpen = computed(() => showBiomeWheel.value || showBuildWheel.value);

watch(anyWheelOpen, (show) => {
  if (wheelReadyTimer) {
    clearTimeout(wheelReadyTimer);
    wheelReadyTimer = null;
  }
  if (!show) {
    wheelInteractive.value = false;
    return;
  }
  wheelInteractive.value = false;
  wheelReadyTimer = setTimeout(() => {
    wheelInteractive.value = true;
    wheelReadyTimer = null;
  }, 450);
});

const wheelStyle = computed(() => {
  const tile = selected.value;
  const root = stage.value;
  if (!tile || tile.clientX == null || tile.clientY == null || !root) {
    return { left: "50%", top: "50%" };
  }
  const rect = root.getBoundingClientRect();
  const x = Math.min(rect.width - 72, Math.max(72, tile.clientX - rect.left));
  const y = Math.min(rect.height - 72, Math.max(72, tile.clientY - rect.top));
  return { left: `${x}px`, top: `${y}px` };
});

const BIOME_WHEEL_RADIUS = 56;

const wheelSlots = computed(() => {
  const n = primaryBiomes.length;
  const radius = BIOME_WHEEL_RADIUS;
  // Arc inférieur (droite → bas → gauche), coût réservé à la moitié haute.
  return primaryBiomes.map((biome, index) => {
    const angle =
      n <= 1 ? Math.PI / 2 : (index * Math.PI) / (n - 1);
    return {
      biome,
      style: {
        transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`
      }
    };
  });
});

const regionCostStyle = {
  transform: `translate(-50%, -50%) translate(0px, ${-BIOME_WHEEL_RADIUS}px)`
};

const cancelButtonStyle = {
  transform: "translate(-50%, -50%)"
};

const buildingSheet = useTemplateRef<HTMLElement>("buildingSheet");
const wheelRoot = useTemplateRef<HTMLElement>("wheelRoot");

function onStagePointerDown(event: PointerEvent) {
  if (event.pointerType !== "touch" || !anyWheelOpen.value) return;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (wheelRoot.value?.contains(target)) return;
  if (buildingSheet.value?.contains(target)) return;
  if (target instanceof HTMLCanvasElement) return;
  clearSelection();
}

function onSelect(tile: SelectedTile | null) {
  if ((expanding.value || building.value) && tile != null) return;
  selected.value = tile;
  expandError.value = null;
}

function clearSelection() {
  selected.value = null;
  preview.value?.clearSelection();
}

async function generate(biome: PrimaryBiomeId) {
  const tile = selected.value;
  const id = world.value?.id;
  if (!tile || tile.biome || !tile.canGenerate || !id || expanding.value) return;
  if (!canAffordRegion.value) {
    expandError.value = "Pas assez de bois pour étendre.";
    return;
  }

  expanding.value = true;
  expandError.value = null;
  const center = { q: tile.q, r: tile.r };

  try {
    const result = await expandRegion(id, center, biome);
    if (!result) {
      expandError.value = worldError.value ?? "Impossible d’étendre le monde.";
      return;
    }
    preview.value?.applyRegion(result.center, result.biome, result.tiles);
    clearSelection();
  } finally {
    expanding.value = false;
  }
}

async function placeBuilding(buildingId: PlaceableExtractorId) {
  const tile = selected.value;
  const id = world.value?.id;
  if (!tile?.biome || !id || building.value) return;
  if (!buildOptions.value.includes(buildingId)) return;
  const cost = BUILD_COST_WOOD[buildingId];
  if (displayedWood.value + 1e-9 < cost) {
    expandError.value = `Pas assez de bois (${cost} requis).`;
    return;
  }
  if (idlePop.value < BUILD_IDLE_POP_REQUIREMENT) {
    expandError.value = "Pas assez de pop libre (1 requis).";
    return;
  }

  building.value = true;
  expandError.value = null;
  const origin = { q: tile.q, r: tile.r };

  try {
    const result = await buildBuilding(id, buildingId, origin);
    if (!result) {
      expandError.value = worldError.value ?? "Impossible de construire.";
      return;
    }
    preview.value?.applyBuilding(result.tile.q, result.tile.r, buildingId);
    selected.value = {
      ...tile,
      buildingId,
      clientX: tile.clientX,
      clientY: tile.clientY
    };
  } finally {
    building.value = false;
  }
}

async function setWorkers(count: number) {
  const id = world.value?.id;
  const tile = selected.value;
  if (!id || !tile || assigning.value) return;
  assigning.value = true;
  expandError.value = null;
  try {
    const result = await assignWorkers(id, { q: tile.q, r: tile.r }, count);
    if (!result) {
      expandError.value = worldError.value ?? "Impossible d’assigner.";
    }
  } finally {
    assigning.value = false;
  }
}

async function onResetWorld() {
  const id = world.value?.id;
  if (!isDevClient || !id || resetting.value) return;
  resetting.value = true;
  expandError.value = null;
  clearSelection();
  try {
    const snapshot = await resetWorld(id);
    if (!snapshot) {
      expandError.value = worldError.value ?? "Impossible de reset le monde.";
    }
  } finally {
    resetting.value = false;
  }
}

async function onGrantResources() {
  const id = world.value?.id;
  if (!isDevClient || !id || granting.value) return;
  granting.value = true;
  expandError.value = null;
  try {
    const snapshot = await grantDevResources(id);
    if (!snapshot) {
      expandError.value =
        worldError.value ?? "Impossible d’ajouter des ressources.";
    }
  } finally {
    granting.value = false;
  }
}

function formatStock(value: number) {
  return Math.floor(value).toLocaleString("fr-FR");
}
</script>

<template>
  <div
    ref="stage"
    class="relative h-dvh overflow-hidden bg-[#0a1512]"
    @pointerdown.capture="onStagePointerDown"
  >
    <div
      v-if="!world"
      class="absolute inset-0 z-50 flex items-center justify-center bg-[#0a1512] p-6 text-center"
    >
      <div class="max-w-sm rounded-xl border border-white/10 bg-[#0e1f1a]/95 p-6 text-[#f2f6ee] shadow-xl">
        <p class="font-display text-sm font-semibold tracking-[0.2em] text-[#e8a54b] uppercase">
          Hexald
        </p>
        <p class="mt-3 text-sm text-[#c8d5c0]">
          {{ worldError ?? "Impossible de charger ton monde." }}
        </p>
        <NuxtLink
          to="/"
          class="mt-5 inline-flex rounded-lg border border-white/10 px-3 py-2 text-sm text-[#c8d5c0] transition hover:text-[#e8a54b]"
        >
          Retour
        </NuxtLink>
      </div>
    </div>

    <div v-else class="absolute inset-0 z-0">
      <HexPreview
        :key="world.id"
        ref="preview"
        class="size-full"
        :initial-world="world"
        @select="onSelect"
      />
    </div>

    <div
      v-for="badge in mapBadges"
      v-show="badge.visible"
      :key="badge.key"
      class="map-badge pointer-events-none absolute z-20"
      :class="[
        `map-badge--${badge.kind}`,
        badge.needsWorkers ? 'map-badge--needs-workers' : null
      ]"
      :style="{ left: `${badge.x}px`, top: `${badge.y}px` }"
      aria-hidden="true"
    >
      <span class="map-badge__chip">
        <UIcon :name="badge.icon" class="map-badge__icon" />
        {{ badge.label }}
        <span v-if="badge.needsWorkers" class="map-badge__alert">!</span>
      </span>
    </div>

    <header
      v-if="world"
      class="play-cloud-header pointer-events-none absolute inset-x-0 top-0 z-50"
    >
      <div class="play-cloud-header__sky" aria-hidden="true">
        <svg
          class="play-cloud-header__svg"
          viewBox="0 0 1200 160"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="play-cloud-fill" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" stop-opacity="0.97" />
              <stop offset="55%" stop-color="#f4f8f5" stop-opacity="0.92" />
              <stop offset="100%" stop-color="#e4eee8" stop-opacity="0.72" />
            </linearGradient>
            <filter id="play-cloud-soft" x="-5%" y="-30%" width="110%" height="170%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
          </defs>
          <path
            fill="url(#play-cloud-fill)"
            filter="url(#play-cloud-soft)"
            d="M0 0H1200V70
              C1120 70 1060 92 980 88
              C880 83 820 108 720 102
              C620 96 560 118 460 110
              C360 102 300 122 210 112
              C130 104 70 92 0 84
              Z"
          />
        </svg>
        <div class="play-cloud-header__puff play-cloud-header__puff--1" />
        <div class="play-cloud-header__puff play-cloud-header__puff--2" />
        <div class="play-cloud-header__puff play-cloud-header__puff--3" />
        <div class="play-cloud-header__puff play-cloud-header__puff--4" />
      </div>

      <div class="play-cloud-header__content pointer-events-auto">
        <p class="play-cloud-header__name truncate">
          {{ pseudo ?? "…" }}
        </p>
        <div class="play-cloud-header__stats">
          <div class="play-cloud-header__stats-row">
            <p class="play-cloud-header__stat" title="Population">
              <UIcon name="i-lucide-users" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Pop</span>
              {{ idlePop }}/{{ populationCap }}
            </p>
            <p v-if="economy" class="play-cloud-header__stat" title="Bois">
              <UIcon name="i-lucide-tree-pine" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Bois</span>
              {{ formatStock(displayedWood) }}
              <span class="opacity-70">· {{ woodRateLabel }}</span>
            </p>
          </div>
          <div v-if="economy" class="play-cloud-header__stats-row">
            <p class="play-cloud-header__stat" title="Blé">
              <UIcon name="i-lucide-wheat" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Blé</span>
              {{ formatStock(displayedWheat) }}
              <span class="opacity-70">· {{ wheatRateLabel }}</span>
            </p>
            <p class="play-cloud-header__stat" title="Pierre">
              <UIcon name="i-lucide-gem" class="play-cloud-header__stat-icon" aria-hidden="true" />
              <span class="sr-only">Pierre</span>
              {{ formatStock(displayedStone) }}
              <span class="opacity-70">· {{ stoneRateLabel }}</span>
            </p>
          </div>
        </div>
      </div>

      <p
        v-if="expandError"
        class="pointer-events-none absolute inset-x-0 top-full z-10 flex justify-center px-3"
      >
        <span class="mt-1 rounded-full bg-[#2a1212]/85 px-3 py-1 text-xs text-red-200 shadow-md backdrop-blur-sm">
          {{ expandError }}
        </span>
      </p>
    </header>

    <div
      v-if="expanding || building"
      class="pointer-events-none absolute inset-x-0 top-24 z-40 flex justify-center"
    >
      <p class="rounded-full border border-white/10 bg-[#0e1f1a]/90 px-3 py-1.5 text-xs text-[#c8d5c0] shadow-lg backdrop-blur-md">
        {{ building ? "Construction…" : "Extension du monde…" }}
      </p>
    </div>

    <div
      v-if="world && isDevClient"
      class="pointer-events-auto absolute left-3 z-30 flex items-center gap-2"
      :class="
        showBuildingSheet
          ? 'bottom-[calc(13.5rem+env(safe-area-inset-bottom))]'
          : 'bottom-[max(0.85rem,env(safe-area-inset-bottom))]'
      "
    >
      <button
        type="button"
        class="flex h-11 items-center gap-1.5 rounded-full border border-amber-500/40 bg-[#2a1a0e]/90 px-3 text-xs font-semibold tracking-wide text-[#f0d2a0] shadow-lg backdrop-blur-md transition hover:border-amber-400/70 hover:text-[#ffe4b8] active:scale-95 disabled:opacity-50"
        :disabled="resetting || granting || expanding || building"
        @click="onResetWorld"
      >
        <UIcon name="i-lucide-rotate-ccw" class="size-4" />
        {{ resetting ? "Reset…" : "Reset monde" }}
      </button>
      <button
        type="button"
        class="flex h-11 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-[#0e2a1a]/90 px-3 text-xs font-semibold tracking-wide text-[#b8f0d0] shadow-lg backdrop-blur-md transition hover:border-emerald-400/70 hover:text-[#d8ffe8] active:scale-95 disabled:opacity-50"
        :disabled="resetting || granting || expanding || building"
        title="+100 bois / blé / pierre"
        @click="onGrantResources"
      >
        <UIcon name="i-lucide-package-plus" class="size-4" />
        {{ granting ? "…" : "+ Ressources" }}
      </button>
    </div>

    <button
      v-if="world"
      type="button"
      class="pointer-events-auto absolute right-3 z-30 flex size-11 items-center justify-center rounded-full border border-white/15 bg-[#0e1f1a]/88 text-[#c8d5c0] shadow-lg backdrop-blur-md transition hover:border-[#e8a54b]/50 hover:text-[#e8a54b] active:scale-95"
      :class="
        showBuildingSheet
          ? 'bottom-[calc(13.5rem+env(safe-area-inset-bottom))]'
          : 'bottom-[max(0.85rem,env(safe-area-inset-bottom))]'
      "
      aria-label="Recentrer la caméra"
      @click="preview?.recenter()"
    >
      <UIcon name="i-lucide-locate-fixed" class="size-5" />
    </button>

    <Transition name="biome-wheel">
      <div
        v-if="showBiomeWheel"
        class="pointer-events-none absolute inset-0 z-40"
      >
        <div
          ref="wheelRoot"
          class="biome-wheel__ring absolute"
          :class="wheelInteractive ? 'pointer-events-auto' : 'pointer-events-none'"
          :style="wheelStyle"
        >
          <p
            v-if="regionExpansionCost"
            class="absolute left-0 top-0 z-10 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-md backdrop-blur-sm"
            :class="
              canAffordRegion
                ? 'border-white/20 bg-[#0e1f1a]/92 text-[#e8a54b]'
                : 'border-red-400/40 bg-[#1a0e0e]/92 text-red-300'
            "
            :style="regionCostStyle"
          >
            {{ regionExpansionCost.wood }} bois
            <span
              v-if="regionExpansionDiscountPct > 0"
              class="text-[#6ecf7a]"
            >
              (−{{ regionExpansionDiscountPct }}%)
            </span>
          </p>
          <button
            type="button"
            class="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full border border-white/20 bg-[#0e1f1a]/95 text-[#c8d5c0] shadow-md backdrop-blur-sm"
            :style="cancelButtonStyle"
            aria-label="Annuler"
            @click="clearSelection"
          >
            <UIcon name="i-lucide-x" class="size-3.5" />
          </button>
          <button
            v-for="slot in wheelSlots"
            :key="slot.biome.id"
            type="button"
            class="absolute left-0 top-0 flex size-11 items-center justify-center rounded-full border-2 shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8a54b]"
            :class="
              canAffordRegion
                ? 'border-white/70 hover:scale-110'
                : 'border-white/30 opacity-45'
            "
            :style="[slot.style, { backgroundColor: biomeSwatch[slot.biome.id] }]"
            :title="
              canAffordRegion
                ? `${slot.biome.label} · ${regionCostLabel}`
                : `${slot.biome.label} · pas assez de bois`
            "
            :aria-label="slot.biome.label"
            :disabled="!canAffordRegion"
            @click="generate(slot.biome.id)"
          >
            <UIcon
              :name="biomeIcon[slot.biome.id]"
              class="size-5"
              :class="slot.biome.id === 'mountain' ? 'text-stone-800' : 'text-white'"
            />
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="biome-wheel">
      <div
        v-if="showBuildWheel"
        class="pointer-events-none absolute inset-0 z-40"
      >
        <div
          ref="wheelRoot"
          class="biome-wheel__ring absolute"
          :class="wheelInteractive ? 'pointer-events-auto' : 'pointer-events-none'"
          :style="wheelStyle"
        >
          <button
            type="button"
            class="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full border border-white/20 bg-[#0e1f1a]/95 text-[#c8d5c0] shadow-md backdrop-blur-sm"
            :style="cancelButtonStyle"
            aria-label="Annuler"
            @click="clearSelection"
          >
            <UIcon name="i-lucide-x" class="size-3.5" />
          </button>
          <button
            v-for="slot in buildWheelSlots"
            :key="slot.id"
            type="button"
            class="absolute left-0 top-0 flex size-12 flex-col items-center justify-center rounded-full border-2 bg-[#2d5248] text-[#f2f6ee] shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8a54b]"
            :class="
              slot.canAfford
                ? 'border-[#e8a54b]/80 hover:scale-110'
                : 'border-white/30 opacity-45'
            "
            :style="slot.style"
            :title="
              !slot.canAfford
                ? !slot.canAffordWood && !slot.hasIdlePop
                  ? `${slot.label} · pas assez de bois ni de pop libre`
                  : !slot.canAffordWood
                    ? `${slot.label} · pas assez de bois`
                    : `${slot.label} · pas assez de pop libre`
                : `${slot.label} · ${slot.woodCost} bois · ${BUILD_IDLE_POP_REQUIREMENT} pop`
            "
            :aria-label="slot.label"
            :disabled="!slot.canAfford"
            @click="placeBuilding(slot.id)"
          >
            <UIcon :name="slot.icon" class="size-4" />
            <span class="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">
              {{ slot.short }}
            </span>
            <span
              class="text-[8px] font-medium"
              :class="slot.canAffordWood ? 'opacity-80' : 'text-red-300'"
            >
              {{ slot.woodCost }} bois
            </span>
            <span
              class="text-[8px] font-medium"
              :class="slot.hasIdlePop ? 'text-[#6ecf7a]' : 'text-red-300'"
            >
              {{ BUILD_IDLE_POP_REQUIREMENT }} pop
            </span>
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="building-sheet">
      <aside
        v-if="showBuildingSheet && selected && economy"
        ref="buildingSheet"
        class="building-sheet pointer-events-none absolute inset-x-0 bottom-0 z-50"
      >
        <div class="building-sheet__sky" aria-hidden="true">
          <svg
            class="building-sheet__svg"
            viewBox="0 0 1200 180"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="play-cloud-sheet-fill" x1="50%" y1="100%" x2="50%" y2="0%">
                <stop offset="0%" stop-color="#ffffff" stop-opacity="0.97" />
                <stop offset="55%" stop-color="#f4f8f5" stop-opacity="0.94" />
                <stop offset="100%" stop-color="#e4eee8" stop-opacity="0.78" />
              </linearGradient>
              <filter id="play-cloud-sheet-soft" x="-4%" y="-35%" width="108%" height="180%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" />
              </filter>
            </defs>
            <path
              fill="url(#play-cloud-sheet-fill)"
              filter="url(#play-cloud-sheet-soft)"
              d="M0 180H1200V48
                C1080 48 1000 28 880 34
                C740 42 660 22 520 30
                C380 38 300 20 180 32
                C90 40 40 44 0 48
                Z"
            />
          </svg>
          <div class="building-sheet__puff building-sheet__puff--1" />
          <div class="building-sheet__puff building-sheet__puff--2" />
          <div class="building-sheet__puff building-sheet__puff--3" />
          <div class="building-sheet__puff building-sheet__puff--4" />
        </div>

        <div class="building-sheet__content pointer-events-auto">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="building-sheet__title truncate">
                {{ selectedBuildingTitle }}
              </p>
              <p v-if="selectedConstruction" class="building-sheet__hint">
                En construction · {{ selectedConstruction.label }} · 1 habitant réservé
              </p>
              <p v-else-if="selectedWorkerPanel" class="building-sheet__hint">
                {{ selectedWorkerPanel.hint }}
              </p>
              <p v-else-if="selected.hasVillage" class="building-sheet__hint">
                Cœur de ton territoire.
              </p>
            </div>
            <button
              type="button"
              class="building-sheet__close"
              aria-label="Fermer"
              @click="clearSelection"
            >
              <UIcon name="i-lucide-x" class="size-4" />
            </button>
          </div>

          <div
            v-if="selectedConstruction"
            class="mt-3"
          >
            <div class="h-1.5 overflow-hidden rounded-full bg-black/10">
              <div
                class="h-full rounded-full bg-[#e8a54b] transition-[width] duration-1000 linear"
                :style="{ width: `${Math.round(selectedConstruction.progress * 100)}%` }"
              />
            </div>
          </div>

          <div
            v-if="selectedWorkerPanel"
            class="mt-3 flex items-center justify-between gap-3"
          >
            <div>
              <p class="building-sheet__metric">
                {{ selectedWorkerPanel.title }}
                <span class="font-mono">
                  {{ selectedWorkerPanel.count }}/{{ selectedWorkerPanel.max }}
                </span>
              </p>
              <p class="building-sheet__hint mt-0.5">
                {{ selectedWorkerPanel.rateLabel }} · {{ idlePop }} libre{{ idlePop === 1 ? "" : "s" }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="building-sheet__stepper"
                :disabled="!selectedWorkerPanel.canRemove"
                :aria-label="`Retirer un ${selectedWorkerPanel.title.toLowerCase()}`"
                @click="setWorkers(selectedWorkerPanel.count - 1)"
              >
                −
              </button>
              <button
                type="button"
                class="building-sheet__stepper"
                :disabled="!selectedWorkerPanel.canAdd"
                :aria-label="`Ajouter un ${selectedWorkerPanel.title.toLowerCase()}`"
                @click="setWorkers(selectedWorkerPanel.count + 1)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>
