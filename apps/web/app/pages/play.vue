<script setup lang="ts">
import type {
  BuildingId,
  HexCoord,
  PrimaryBiomeId,
  WorldTileSnapshot
} from "@hexald/shared";
import {
  buildings,
  primaryBiomes,
  WOOD_RATE_PER_WORKER_PER_HOUR
} from "@hexald/content";
import { terrainAllowsBuilding } from "@hexald/game-core";
import type { SelectedTile } from "~/renderer/createHexScene";

definePageMeta({
  layout: "blank"
});

const { pseudo, ensureSession } = useSession();
const {
  ensureWorld,
  expandRegion,
  assignWorkers,
  buildLumberCamp,
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

const lumberDef = computed(
  () => buildings.find((entry) => entry.id === "lumber_camp")!
);

const displayedWood = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  const last = Date.parse(eco.woodLastCalculatedAt);
  if (Number.isNaN(last)) return Math.floor(eco.wood);
  const hours = Math.max(0, (nowTick.value - last) / 3_600_000);
  const rate = eco.hasLumberCamp
    ? eco.woodcutters * WOOD_RATE_PER_WORKER_PER_HOUR
    : 0;
  return Math.min(eco.woodCap, eco.wood + rate * hours);
});

const idlePop = computed(() => {
  const eco = economy.value;
  if (!eco) return 0;
  return Math.max(0, eco.population - eco.woodcutters);
});

const woodRateLabel = computed(() => {
  const eco = economy.value;
  if (!eco || !eco.hasLumberCamp || eco.woodcutters === 0) return "0/h";
  return `${eco.woodcutters * WOOD_RATE_PER_WORKER_PER_HOUR}/h`;
});

const canAddWoodcutter = computed(() => {
  const eco = economy.value;
  if (!eco || !eco.hasLumberCamp || assigning.value) return false;
  return eco.woodcutters < eco.lumberCampMaxWorkers && idlePop.value > 0;
});

const canRemoveWoodcutter = computed(() => {
  const eco = economy.value;
  if (!eco || !eco.hasLumberCamp || assigning.value) return false;
  return eco.woodcutters > 0;
});

const canBuildLumberCampHere = computed(() => {
  const tile = selected.value;
  const eco = economy.value;
  if (!tile?.biome || tile.hasVillage || tile.buildingId || !eco) return false;
  if (eco.hasLumberCamp) return false;
  return terrainAllowsBuilding(lumberDef.value.terrain, tile.biome);
});

const buildingLabel = (id: BuildingId | null | undefined) => {
  if (!id) return null;
  return buildings.find((entry) => entry.id === id)?.label ?? id;
};

const biomeSwatch: Record<PrimaryBiomeId, string> = {
  forest: "#62c46f",
  plains: "#8fce6e",
  mountain: "#d0d7e2",
  water: "#4aa3d9"
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
    canBuildLumberCampHere.value &&
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

const isLumberCampSelected = computed(
  () => selected.value?.buildingId === "lumber_camp"
);

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

const buildSlotStyle = {
  transform: "translate(-50%, -50%) translate(0px, -56px)"
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

async function placeLumberCamp() {
  const tile = selected.value;
  const id = world.value?.id;
  if (!tile?.biome || !id || building.value || !canBuildLumberCampHere.value) return;

  building.value = true;
  expandError.value = null;
  const origin = { q: tile.q, r: tile.r };

  try {
    const result = await buildLumberCamp(id, origin);
    if (!result) {
      expandError.value = worldError.value ?? "Impossible de construire.";
      return;
    }
    preview.value?.applyBuilding(result.tile.q, result.tile.r, "lumber_camp");
    selected.value = {
      ...tile,
      buildingId: "lumber_camp",
      clientX: tile.clientX,
      clientY: tile.clientY
    };
  } finally {
    building.value = false;
  }
}

async function setWoodcutters(count: number) {
  const id = world.value?.id;
  if (!id || assigning.value) return;
  assigning.value = true;
  expandError.value = null;
  try {
    const result = await assignWorkers(id, count);
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
      class="play-cloud-header pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4"
    >
      <div class="play-cloud-header__cloud pointer-events-auto">
        <p class="play-cloud-header__name truncate">
          {{ pseudo ?? "…" }}
        </p>
        <div class="play-cloud-header__stats">
          <p class="play-cloud-header__stat">
            <span class="play-cloud-header__stat-label">Pop</span>
            {{ idlePop }}/{{ population }}
          </p>
          <p v-if="economy" class="play-cloud-header__stat">
            <span class="play-cloud-header__stat-label">Bois</span>
            {{ formatStock(displayedWood) }}
            <span class="opacity-70">· {{ woodRateLabel }}</span>
          </p>
        </div>
      </div>
      <p
        v-if="expandError"
        class="pointer-events-none absolute top-full mt-2 rounded-full bg-[#2a1212]/85 px-3 py-1 text-xs text-red-200 shadow-md backdrop-blur-sm"
      >
        {{ expandError }}
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
            type="button"
            class="absolute left-0 top-0 flex size-12 flex-col items-center justify-center rounded-full border-2 border-[#e8a54b]/80 bg-[#2d5248] text-[#f2f6ee] shadow-md transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e8a54b]"
            :style="buildSlotStyle"
            :title="lumberDef.label"
            :aria-label="lumberDef.label"
            @click="placeLumberCamp"
          >
            <UIcon name="i-lucide-trees" class="size-4" />
            <span class="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">Camp</span>
          </button>
        </div>
      </div>
    </Transition>

    <Transition name="building-sheet">
      <aside
        v-if="showBuildingSheet && selected && economy"
        ref="buildingSheet"
        class="building-sheet pointer-events-auto absolute inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div class="building-sheet__panel text-[#f2f6ee]">
          <div class="building-sheet__handle" aria-hidden="true" />
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <p class="font-display text-lg font-semibold tracking-tight">
                {{ selectedBuildingTitle }}
              </p>
              <p v-if="isLumberCampSelected" class="mt-1 text-xs text-[#9aab9e]">
                Assigne des travailleurs pour produire du bois.
              </p>
              <p v-else-if="selected.hasVillage" class="mt-1 text-xs text-[#9aab9e]">
                Cœur de ton territoire.
              </p>
            </div>
            <button
              type="button"
              class="rounded-md px-2 py-1 text-[#c8d5c0] transition hover:bg-white/5 hover:text-[#e8a54b]"
              aria-label="Fermer"
              @click="clearSelection"
            >
              <UIcon name="i-lucide-x" class="size-4" />
            </button>
          </div>

          <div v-if="isLumberCampSelected" class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm">
                Bûcherons
                <span class="font-mono">
                  {{ economy.woodcutters }}/{{ economy.lumberCampMaxWorkers }}
                </span>
              </p>
              <p class="mt-0.5 text-xs text-[#9aab9e]">
                {{ woodRateLabel }} · {{ idlePop }} libre{{ idlePop === 1 ? "" : "s" }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex size-9 items-center justify-center rounded-md border border-white/15 text-[#c8d5c0] transition hover:border-[#e8a54b]/50 hover:text-[#e8a54b] disabled:opacity-35"
                :disabled="!canRemoveWoodcutter"
                aria-label="Retirer un bûcheron"
                @click="setWoodcutters(economy.woodcutters - 1)"
              >
                −
              </button>
              <button
                type="button"
                class="flex size-9 items-center justify-center rounded-md border border-white/15 text-[#c8d5c0] transition hover:border-[#e8a54b]/50 hover:text-[#e8a54b] disabled:opacity-35"
                :disabled="!canAddWoodcutter"
                aria-label="Ajouter un bûcheron"
                @click="setWoodcutters(economy.woodcutters + 1)"
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
