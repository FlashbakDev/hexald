<script setup lang="ts">
import type {
  BuildingId,
  ExtractorJob,
  HexCoord,
  PrimaryBiomeId,
  WorldTileSnapshot
} from "@hexald/shared";
import {
  buildings,
  primaryBiomes,
  STONE_RATE_PER_WORKER_PER_HOUR,
  WHEAT_RATE_PER_WORKER_PER_HOUR,
  WOOD_RATE_PER_WORKER_PER_HOUR,
  type PlaceableExtractorId
} from "@hexald/content";
import { listBuildOptionsForTile } from "@hexald/game-core";
import type { SelectedTile } from "~/renderer/createHexScene";

definePageMeta({
  layout: "blank"
});

const { pseudo, ensureSession } = useSession();
const {
  ensureWorld,
  expandRegion,
  assignWorkers,
  buildBuilding,
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
  clearSelection: () => void;
  applyRegion: (
    center: HexCoord,
    biome: PrimaryBiomeId,
    tiles: readonly WorldTileSnapshot[]
  ) => boolean;
  applyBuilding: (q: number, r: number, buildingId: BuildingId) => boolean;
}>("preview");

const stage = useTemplateRef<HTMLElement>("stage");
const selected = ref<SelectedTile | null>(null);
const expanding = ref(false);
const building = ref(false);
const expandError = ref<string | null>(null);
const assigning = ref(false);
const nowTick = ref(Date.now());

const wheelInteractive = ref(false);
let wheelReadyTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  tickTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
  refreshTimer = setInterval(() => {
    void refreshWorld();
  }, 30_000);
});

onBeforeUnmount(() => {
  if (tickTimer) clearInterval(tickTimer);
  if (refreshTimer) clearInterval(refreshTimer);
  if (wheelReadyTimer) clearTimeout(wheelReadyTimer);
});

const economy = computed(() => world.value?.economy ?? null);
const population = computed(() => economy.value?.population ?? 0);

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
  ratePerHour: number
) {
  const last = Date.parse(lastIso);
  if (Number.isNaN(last)) return Math.floor(stock);
  const hours = Math.max(0, (nowTick.value - last) / 3_600_000);
  return Math.min(cap, stock + ratePerHour * hours);
}

const displayedWood = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const rate = eco.hasLumberCamp
    ? eco.woodcutters * WOOD_RATE_PER_WORKER_PER_HOUR
    : 0;
  return projectedStock(eco.wood, eco.woodCap, eco.woodLastCalculatedAt, rate);
});

const displayedWheat = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const rate = eco.hasFarm ? eco.farmers * WHEAT_RATE_PER_WORKER_PER_HOUR : 0;
  return projectedStock(eco.wheat, eco.wheatCap, eco.wheatLastCalculatedAt, rate);
});

const displayedStone = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const rate = eco.hasQuarry
    ? eco.quarriers * STONE_RATE_PER_WORKER_PER_HOUR
    : 0;
  return projectedStock(eco.stone, eco.stoneCap, eco.stoneLastCalculatedAt, rate);
});

const idlePop = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  return Math.max(0, eco.population - eco.woodcutters - eco.farmers - eco.quarriers);
});

function rateLabel(count: number, rate: number, active: boolean) {
  if (!active || count === 0) return "0/h";
  return `${count * rate}/h`;
}

const woodRateLabel = computed(() => {
  const eco = economy.value;
  if (!eco) return "0/h";
  return rateLabel(eco.woodcutters, WOOD_RATE_PER_WORKER_PER_HOUR, eco.hasLumberCamp);
});

const wheatRateLabel = computed(() => {
  const eco = economy.value;
  if (!eco) return "0/h";
  return rateLabel(eco.farmers, WHEAT_RATE_PER_WORKER_PER_HOUR, eco.hasFarm);
});

const stoneRateLabel = computed(() => {
  const eco = economy.value;
  if (!eco) return "0/h";
  return rateLabel(eco.quarriers, STONE_RATE_PER_WORKER_PER_HOUR, eco.hasQuarry);
});

const buildOptions = computed(() => {
  const tile = selected.value;
  const eco = economy.value;
  if (!tile?.biome || !eco) return [] as PlaceableExtractorId[];
  return listBuildOptionsForTile({
    biome: tile.biome,
    hasVillage: tile.hasVillage,
    existingBuildingId: tile.buildingId ?? null,
    counts: {
      lumber_camp: eco.hasLumberCamp ? 1 : 0,
      farm: eco.hasFarm ? 1 : 0,
      quarry: eco.hasQuarry ? 1 : 0
    }
  });
});

const buildWheelSlots = computed(() => {
  const options = buildOptions.value;
  const n = options.length;
  return options.map((id, index) => {
    const angle =
      n === 1 ? -Math.PI / 2 : -Math.PI / 2 + (index * 2 * Math.PI) / n;
    const radius = 56;
    const def = buildingDefs[id];
    return {
      id,
      ...def,
      style: {
        transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`
      }
    };
  });
});

type WorkerPanel = {
  job: ExtractorJob;
  title: string;
  hint: string;
  count: number;
  max: number;
  rateLabel: string;
  canAdd: boolean;
  canRemove: boolean;
};

const selectedWorkerPanel = computed((): WorkerPanel | null => {
  const tile = selected.value;
  const eco = economy.value;
  if (!tile?.buildingId || !eco) return null;

  if (tile.buildingId === "lumber_camp" && eco.hasLumberCamp) {
    return {
      job: "woodcutter",
      title: "Bûcherons",
      hint: "Assigne des travailleurs pour produire du bois.",
      count: eco.woodcutters,
      max: eco.lumberCampMaxWorkers,
      rateLabel: woodRateLabel.value,
      canAdd:
        !assigning.value &&
        eco.woodcutters < eco.lumberCampMaxWorkers &&
        idlePop.value > 0,
      canRemove: !assigning.value && eco.woodcutters > 0
    };
  }
  if (tile.buildingId === "farm" && eco.hasFarm) {
    return {
      job: "farmer",
      title: "Fermiers",
      hint: "Assigne des travailleurs pour produire du blé.",
      count: eco.farmers,
      max: eco.farmMaxWorkers,
      rateLabel: wheatRateLabel.value,
      canAdd:
        !assigning.value &&
        eco.farmers < eco.farmMaxWorkers &&
        idlePop.value > 0,
      canRemove: !assigning.value && eco.farmers > 0
    };
  }
  if (tile.buildingId === "quarry" && eco.hasQuarry) {
    return {
      job: "quarrier",
      title: "Carriers",
      hint: "Assigne des travailleurs pour produire de la pierre.",
      count: eco.quarriers,
      max: eco.quarryMaxWorkers,
      rateLabel: stoneRateLabel.value,
      canAdd:
        !assigning.value &&
        eco.quarriers < eco.quarryMaxWorkers &&
        idlePop.value > 0,
      canRemove: !assigning.value && eco.quarriers > 0
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

const wheelSlots = computed(() => {
  const n = primaryBiomes.length;
  return primaryBiomes.map((biome, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / n;
    const radius = 56;
    return {
      biome,
      style: {
        transform: `translate(-50%, -50%) translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`
      }
    };
  });
});

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

async function setWorkers(job: ExtractorJob, count: number) {
  const id = world.value?.id;
  if (!id || assigning.value) return;
  assigning.value = true;
  expandError.value = null;
  try {
    const result = await assignWorkers(id, job, count);
    if (!result) {
      expandError.value = worldError.value ?? "Impossible d’assigner.";
    }
  } finally {
    assigning.value = false;
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
        ref="preview"
        class="size-full"
        :initial-world="world"
        @select="onSelect"
      />
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
          <p class="play-cloud-header__stat" title="Population">
            <UIcon name="i-lucide-users" class="play-cloud-header__stat-icon" aria-hidden="true" />
            <span class="sr-only">Pop</span>
            {{ idlePop }}/{{ population }}
          </p>
          <p v-if="economy" class="play-cloud-header__stat" title="Bois">
            <UIcon name="i-lucide-tree-pine" class="play-cloud-header__stat-icon" aria-hidden="true" />
            <span class="sr-only">Bois</span>
            {{ formatStock(displayedWood) }}
            <span class="opacity-70">· {{ woodRateLabel }}</span>
          </p>
          <p v-if="economy" class="play-cloud-header__stat" title="Blé">
            <UIcon name="i-lucide-wheat" class="play-cloud-header__stat-icon" aria-hidden="true" />
            <span class="sr-only">Blé</span>
            {{ formatStock(displayedWheat) }}
            <span class="opacity-70">· {{ wheatRateLabel }}</span>
          </p>
          <p v-if="economy" class="play-cloud-header__stat" title="Pierre">
            <UIcon name="i-lucide-gem" class="play-cloud-header__stat-icon" aria-hidden="true" />
            <span class="sr-only">Pierre</span>
            {{ formatStock(displayedStone) }}
            <span class="opacity-70">· {{ stoneRateLabel }}</span>
          </p>
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
            class="absolute left-0 top-0 flex size-11 items-center justify-center rounded-full border-2 border-white/70 shadow-md transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8a54b]"
            :style="[slot.style, { backgroundColor: biomeSwatch[slot.biome.id] }]"
            :title="slot.biome.label"
            :aria-label="slot.biome.label"
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
            class="absolute left-0 top-0 flex size-12 flex-col items-center justify-center rounded-full border-2 border-[#e8a54b]/80 bg-[#2d5248] text-[#f2f6ee] shadow-md transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8a54b]"
            :style="slot.style"
            :title="slot.label"
            :aria-label="slot.label"
            @click="placeBuilding(slot.id)"
          >
            <UIcon :name="slot.icon" class="size-4" />
            <span class="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">
              {{ slot.short }}
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
              <p v-if="selectedWorkerPanel" class="building-sheet__hint">
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
                @click="setWorkers(selectedWorkerPanel.job, selectedWorkerPanel.count - 1)"
              >
                −
              </button>
              <button
                type="button"
                class="building-sheet__stepper"
                :disabled="!selectedWorkerPanel.canAdd"
                :aria-label="`Ajouter un ${selectedWorkerPanel.title.toLowerCase()}`"
                @click="setWorkers(selectedWorkerPanel.job, selectedWorkerPanel.count + 1)"
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
