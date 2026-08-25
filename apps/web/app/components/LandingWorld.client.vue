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
  startTimer = setTimeout(() => {
    expandOnce();
    timer = setInterval(expandOnce, 2400);
  }, 700);
});

onBeforeUnmount(() => {
  if (startTimer) clearTimeout(startTimer);
  if (timer) clearInterval(timer);
});
</script>

<template>
  <div class="landing-world absolute inset-0">
    <HexPreview ref="preview" class="size-full min-h-dvh" />
    <div class="landing-world__sheen pointer-events-none absolute inset-0" />
    <div class="landing-world__pulse pointer-events-none absolute inset-0" />
  </div>
</template>

<style scoped>
.landing-world__sheen {
  background:
    radial-gradient(ellipse 70% 55% at 72% 42%, rgb(56 189 248 / 0.22), transparent 55%),
    radial-gradient(ellipse 50% 40% at 30% 70%, rgb(52 211 153 / 0.22), transparent 50%),
    radial-gradient(ellipse 40% 30% at 80% 15%, rgb(251 191 36 / 0.2), transparent 45%);
  mix-blend-mode: screen;
  animation: landing-sheen 10s ease-in-out infinite alternate;
}

.landing-world__pulse {
  background: radial-gradient(
    circle at 68% 48%,
    rgb(255 255 255 / 0.1),
    transparent 42%
  );
  animation: landing-pulse 4.5s ease-in-out infinite;
}

@keyframes landing-sheen {
  from {
    opacity: 0.55;
    transform: scale(1);
  }
  to {
    opacity: 1;
    transform: scale(1.06);
  }
}

@keyframes landing-pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 0.9;
  }
}
</style>
