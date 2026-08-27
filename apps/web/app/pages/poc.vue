<script setup lang="ts">
import type { BiomeId, PrimaryBiomeId } from "@hexald/shared";
import { biomes, primaryBiomes } from "@hexald/content";
import type { SelectedTile } from "~/renderer/createHexScene";

usePageSeo({
  title: "POC visuel · Hexald",
  description: "Prototype visuel Hexald — non indexé.",
  path: "/poc",
  indexable: false
});

definePageMeta({
  layout: false,
  robots: false
});

const preview = useTemplateRef<{
  recenter: () => void;
  clearSelection: () => void;
  generateRegion: (q: number, r: number, biome: PrimaryBiomeId) => boolean;
}>("preview");

const stage = useTemplateRef<HTMLElement>("stage");
const selected = ref<SelectedTile | null>(null);

const biomeLabel = (id: BiomeId) => biomes.find((biome) => biome.id === id)?.label ?? id;

const biomeColor = (id: BiomeId) => {
  if (id === "water") return "info" as const;
  if (id === "forest" || id === "forest_plains" || id === "forest_mountain" || id === "plains") {
    return "success" as const;
  }
  if (id === "plains_mountain") return "success" as const;
  return "neutral" as const;
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

const showTilePanel = computed(
  () => selected.value != null && selected.value.biome != null
);

const showBiomeWheel = computed(
  () =>
    selected.value != null &&
    selected.value.canGenerate &&
    selected.value.biome == null
);

/** Évite que le clic fantôme mobile (après le tap) touche la roue / le bouton X. */
const wheelInteractive = ref(false);
let wheelReadyTimer: ReturnType<typeof setTimeout> | null = null;

watch(showBiomeWheel, (show) => {
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

onBeforeUnmount(() => {
  if (wheelReadyTimer) clearTimeout(wheelReadyTimer);
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
function onSelect(tile: SelectedTile | null) {
  selected.value = tile;
}

function clearSelection() {
  preview.value?.clearSelection();
}

function generate(biome: PrimaryBiomeId) {
  const tile = selected.value;
  if (!tile || tile.biome || !tile.canGenerate) return;
  preview.value?.generateRegion(tile.q, tile.r, biome);
}
</script>

<template>
  <div class="flex h-dvh flex-col bg-default">
    <header class="flex items-center justify-between border-b border-default px-4 py-3">
      <div class="flex items-center gap-3">
        <UButton to="/" variant="ghost" color="neutral" icon="i-lucide-arrow-left" />
        <div>
          <p class="font-medium leading-none">POC visuel</p>
          <p class="mt-1 text-xs text-muted">
            Clic : tuile · centre (+) = nouvelle région · glisser
          </p>
        </div>
      </div>
      <UButton
        color="primary"
        variant="subtle"
        icon="i-lucide-locate-fixed"
        @click="preview?.recenter()"
      >
        Recentrer
      </UButton>
    </header>
    <div ref="stage" class="relative min-h-0 flex-1">
      <HexPreview ref="preview" @select="onSelect" />

      <Transition name="biome-wheel">
        <div
          v-if="showBiomeWheel"
          class="pointer-events-none absolute inset-0 z-20"
        >
          <div
            class="biome-wheel__ring absolute"
            :class="wheelInteractive ? 'pointer-events-auto' : 'pointer-events-none'"
            :style="wheelStyle"
          >
            <button
              type="button"
              class="absolute left-0 top-0 flex size-9 items-center justify-center rounded-full border border-default/80 bg-default/90 text-muted shadow-md backdrop-blur-sm"
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
              class="absolute left-0 top-0 flex size-11 items-center justify-center rounded-full border-2 border-white/70 shadow-md transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      <UCard
        v-if="showTilePanel && selected"
        class="absolute bottom-4 left-4 z-10 w-80 max-w-[calc(100%-2rem)] shadow-lg"
      >
        <template #header>
          <div class="flex items-center justify-between gap-2">
            <p class="font-medium">Tuile sélectionnée</p>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              icon="i-lucide-x"
              aria-label="Désélectionner"
              @click="clearSelection"
            />
          </div>
        </template>
        <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <dt class="text-muted">Biome</dt>
          <dd>
            <UBadge :color="biomeColor(selected.biome!)" variant="subtle">
              {{ biomeLabel(selected.biome!) }}
            </UBadge>
          </dd>
          <dt class="text-muted">Bâtiment</dt>
          <dd>
            <UBadge v-if="selected.hasVillage" color="primary" variant="subtle">Village</UBadge>
            <span v-else class="text-muted">Aucun</span>
          </dd>
          <dt class="text-muted">Axial</dt>
          <dd class="font-mono">q {{ selected.q }} · r {{ selected.r }}</dd>
          <dt class="text-muted">Cube</dt>
          <dd class="font-mono">s {{ -selected.q - selected.r }}</dd>
        </dl>
      </UCard>
    </div>
  </div>
</template>
