<script setup lang="ts">
import type { PrimaryBiomeId } from "@hexald/shared";
import { hexKey } from "@hexald/shared";
import { REGION_NEIGHBOR_OFFSETS } from "@hexald/game-core";

const preview = useTemplateRef<{
  recenter: () => void;
  generateRegion: (q: number, r: number, biome: PrimaryBiomeId) => boolean;
}>("preview");

const biomes: PrimaryBiomeId[] = ["plains", "water", "forest", "mountain", "plains", "water"];

const placed = new Set<string>([hexKey(0, 0)]);
const queue: { q: number; r: number }[] = REGION_NEIGHBOR_OFFSETS.map((offset) => ({
  q: offset.q,
  r: offset.r
}));

let step = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let startTimer: ReturnType<typeof setTimeout> | null = null;

/** Zoom serré sur le village ; biais mobile pour cadrer au-dessus du titre. */
const isNarrow = ref(
  import.meta.client && window.matchMedia("(max-width: 1023px)").matches
);
const viewSize = computed(() => (isNarrow.value ? 8.2 : 6.8));
const frameBiasY = computed(() => (isNarrow.value ? 0.42 : 0.06));
/** Desktop : centre la carte (village) sur la moitié droite de l’écran. */
const frameBiasX = computed(() => (isNarrow.value ? 0 : 0.32));

function syncViewport() {
  isNarrow.value = window.matchMedia("(max-width: 1023px)").matches;
}

function enqueueNeighbors(center: { q: number; r: number }) {
  for (const offset of REGION_NEIGHBOR_OFFSETS) {
    const next = { q: center.q + offset.q, r: center.r + offset.r };
    const key = hexKey(next.q, next.r);
    if (placed.has(key)) continue;
    if (queue.some((item) => item.q === next.q && item.r === next.r)) continue;
    queue.push(next);
  }
}

function expandOnce() {
  const api = preview.value;
  if (!api || queue.length === 0) return;

  const target = queue.shift()!;
  const key = hexKey(target.q, target.r);
  if (placed.has(key)) {
    expandOnce();
    return;
  }

  const biome = biomes[step % biomes.length]!;
  const ok = api.generateRegion(target.q, target.r, biome);
  step += 1;

  if (!ok) return;

  placed.add(key);
  enqueueNeighbors(target);
  if (step % 2 === 0) api.recenter();
}

onMounted(() => {
  syncViewport();
  window.addEventListener("resize", syncViewport);

  startTimer = setTimeout(() => {
    expandOnce();
    timer = setInterval(expandOnce, 3200);
  }, 1200);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", syncViewport);
  if (startTimer) clearTimeout(startTimer);
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="landing-world pointer-events-none absolute inset-0 overflow-hidden">
    <HexPreview
      ref="preview"
      class="size-full min-h-dvh"
      :view-size="viewSize"
      :frame-bias-y="frameBiasY"
      :frame-bias-x="frameBiasX"
    />
    <div class="landing-world__mist pointer-events-none absolute inset-0" />
    <div class="landing-world__drift pointer-events-none absolute inset-0" />
  </div>
</template>

<style scoped>
.landing-world__mist {
  background:
    radial-gradient(ellipse 80% 60% at 50% 28%, rgb(232 240 236 / 0.22), transparent 60%),
    radial-gradient(ellipse 55% 45% at 30% 70%, rgb(223 232 228 / 0.35), transparent 55%),
    radial-gradient(ellipse 40% 35% at 75% 18%, rgb(255 255 255 / 0.22), transparent 50%);
  animation: landing-mist 14s ease-in-out infinite alternate;
}

@media (min-width: 1024px) {
  .landing-world__mist {
    background:
      radial-gradient(ellipse 80% 60% at 70% 40%, rgb(232 240 236 / 0.35), transparent 60%),
      radial-gradient(ellipse 55% 45% at 25% 75%, rgb(223 232 228 / 0.4), transparent 55%),
      radial-gradient(ellipse 40% 35% at 85% 20%, rgb(255 255 255 / 0.25), transparent 50%);
  }
}

.landing-world__drift {
  background: linear-gradient(
    115deg,
    rgb(232 240 236 / 0.15) 0%,
    transparent 40%,
    rgb(255 255 255 / 0.12) 70%,
    transparent 100%
  );
  background-size: 200% 200%;
  animation: landing-drift 18s ease-in-out infinite alternate;
}

@keyframes landing-mist {
  from {
    opacity: 0.65;
    transform: scale(1);
  }
  to {
    opacity: 1;
    transform: scale(1.04);
  }
}

@keyframes landing-drift {
  from {
    background-position: 0% 40%;
    opacity: 0.5;
  }
  to {
    background-position: 100% 60%;
    opacity: 0.85;
  }
}
</style>
