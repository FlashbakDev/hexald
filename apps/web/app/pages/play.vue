<script setup lang="ts">
import type { BiomeId, PrimaryBiomeId } from "@hexald/shared";
import { biomes, primaryBiomes } from "@hexald/content";
import type { SelectedTile } from "~/renderer/createHexScene";

definePageMeta({
  layout: "blank"
});

const { pseudo, ensureSession } = useSession();

const session = await ensureSession();
if (!session?.pseudo) {
  await navigateTo("/");
}

useHead({
  title: computed(() =>
    pseudo.value ? `${pseudo.value} · Hexald` : "Hexald"
  )
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

const showTilePanel = computed(
  () => selected.value != null && selected.value.biome != null
);

const showBiomeWheel = computed(
  () =>
    selected.value != null &&
    selected.value.canGenerate &&
    selected.value.biome == null
);

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
  transform: "translate(-50%, -50%) translate(0px, 100px)"
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
  <div ref="stage" class="relative h-dvh overflow-hidden bg-[#0a1512]">
    <div class="absolute inset-0 z-0">
      <HexPreview
        ref="preview"
        class="size-full"
        @select="onSelect"
      />
    </div>

    <header
      class="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-start justify-between gap-3 p-4 sm:p-6"
    >
      <div
        class="pointer-events-auto rounded-lg border border-white/10 bg-[#0e1f1a]/90 px-3 py-2 shadow-lg backdrop-blur-md"
      >
        <p class="font-display text-xs font-semibold tracking-[0.22em] text-[#e8a54b] uppercase">
          Hexald
        </p>
        <p class="mt-1 text-sm text-[#f2f6ee]">
          {{ pseudo ?? "…" }}
        </p>
      </div>
      <div class="pointer-events-auto flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-white/10 bg-[#0e1f1a]/90 px-3 py-2 text-sm text-[#c8d5c0] shadow-lg backdrop-blur-md transition hover:text-[#e8a54b]"
          @click="preview?.recenter()"
        >
          Recentrer
        </button>
        <NuxtLink
          to="/"
          class="rounded-lg border border-white/10 bg-[#0e1f1a]/90 px-3 py-2 text-sm text-[#c8d5c0] shadow-lg backdrop-blur-md transition hover:text-[#e8a54b]"
        >
          Quitter
        </NuxtLink>
      </div>
    </header>

    <div
      v-if="showBiomeWheel"
      class="pointer-events-none absolute inset-0 z-40"
    >
      <div
        class="absolute"
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
          <span
            class="text-[10px] font-semibold uppercase tracking-wide"
            :class="slot.biome.id === 'mountain' ? 'text-stone-800' : 'text-white'"
          >
            {{ slot.biome.label.slice(0, 1) }}
          </span>
        </button>
      </div>
    </div>

    <div
      v-if="showTilePanel && selected"
      class="absolute bottom-4 left-4 z-50 w-80 max-w-[calc(100%-2rem)] rounded-xl border border-white/10 bg-[#0e1f1a]/95 p-4 text-[#f2f6ee] shadow-xl backdrop-blur-md"
    >
      <div class="mb-3 flex items-center justify-between gap-2">
        <p class="font-medium">Tuile sélectionnée</p>
        <button
          type="button"
          class="rounded-md px-2 py-1 text-[#c8d5c0] transition hover:bg-white/5 hover:text-[#e8a54b]"
          aria-label="Désélectionner"
          @click="clearSelection"
        >
          <UIcon name="i-lucide-x" class="size-4" />
        </button>
      </div>
      <dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
        <dt class="text-[#9aab9e]">Biome</dt>
        <dd>
          <UBadge :color="biomeColor(selected.biome!)" variant="subtle">
            {{ biomeLabel(selected.biome!) }}
          </UBadge>
        </dd>
        <dt class="text-[#9aab9e]">Bâtiment</dt>
        <dd>
          <UBadge v-if="selected.hasVillage" color="primary" variant="subtle">Village</UBadge>
          <span v-else class="text-[#9aab9e]">Aucun</span>
        </dd>
        <dt class="text-[#9aab9e]">Axial</dt>
        <dd class="font-mono text-[#c8d5c0]">q {{ selected.q }} · r {{ selected.r }}</dd>
        <dt class="text-[#9aab9e]">Cube</dt>
        <dd class="font-mono text-[#c8d5c0]">s {{ -selected.q - selected.r }}</dd>
      </dl>
    </div>
  </div>
</template>
