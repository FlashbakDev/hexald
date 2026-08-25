<script setup lang="ts">
import { createHexScene, type HexSceneApi, type SelectedTile } from "~/renderer/createHexScene";
import type { PrimaryBiomeId } from "@hexald/shared";

const emit = defineEmits<{
  select: [tile: SelectedTile | null];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let api: HexSceneApi | undefined;

function mountScene(create = createHexScene) {
  api?.dispose();
  if (!canvas.value) return;
  api = create(canvas.value, {
    onSelect: (tile) => emit("select", tile)
  });
  if (import.meta.dev) {
    (globalThis as { __twHex?: HexSceneApi }).__twHex = api;
  }
}

onMounted(() => {
  nextTick(() => {
    requestAnimationFrame(() => mountScene());
  });
});

onBeforeUnmount(() => {
  api?.dispose();
  if (import.meta.dev) {
    delete (globalThis as { __twHex?: HexSceneApi }).__twHex;
  }
});

if (import.meta.hot) {
  import.meta.hot.accept("../renderer/createHexScene", (mod) => {
    if (mod?.createHexScene) mountScene(mod.createHexScene);
  });
  import.meta.hot.accept("../renderer/createVillageMesh", () => {
    mountScene();
  });
}

defineExpose({
  recenter: () => api?.recenter(),
  clearSelection: () => api?.clearSelection(),
  generateRegion: (q: number, r: number, biome: PrimaryBiomeId) =>
    api?.generateRegion(q, r, biome) ?? false
});
</script>

<template>
  <canvas ref="canvas" class="block size-full touch-none" />
</template>
