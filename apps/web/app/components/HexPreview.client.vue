<script setup lang="ts">
import {
  createHexScene,
  type HexSceneApi,
  type HexSceneFraming,
  type SelectedTile
} from "~/renderer/createHexScene";
import type {
  HexCoord,
  BuildingId,
  PrimaryBiomeId,
  WorldRegionSnapshot,
  WorldTileSnapshot
} from "@hexald/shared";

const props = defineProps<{
  initialWorld?: {
    tiles: readonly WorldTileSnapshot[];
    regions: readonly WorldRegionSnapshot[];
  } | null;
  viewSize?: number;
  frameBiasY?: number;
}>();

const emit = defineEmits<{
  select: [tile: SelectedTile | null];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let api: HexSceneApi | undefined;

function mountScene(create = createHexScene) {
  api?.dispose();
  if (!canvas.value) return;
  api = create(canvas.value, {
    onSelect: (tile) => emit("select", tile),
    initialWorld: props.initialWorld ?? undefined,
    viewSize: props.viewSize,
    frameBiasY: props.frameBiasY
  });
  if (import.meta.dev) {
    (globalThis as { __twHex?: HexSceneApi }).__twHex = api;
  }
}

watch(
  () => [props.viewSize, props.frameBiasY] as const,
  ([viewSize, frameBiasY]) => {
    api?.setFraming({ viewSize, frameBiasY });
  }
);

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
  import.meta.hot.accept("../renderer/createLumberCampMesh", () => {
    mountScene();
  });
  import.meta.hot.accept("../renderer/createForestDecor", () => {
    mountScene();
  });
  import.meta.hot.accept("../renderer/createFogCloudKit", () => {
    mountScene();
  });
  import.meta.hot.accept("../renderer/createWaterDecor", () => {
    mountScene();
  });
}

defineExpose({
  recenter: () => api?.recenter(),
  clearSelection: () => api?.clearSelection(),
  setFraming: (framing: HexSceneFraming) => api?.setFraming(framing),
  generateRegion: (q: number, r: number, biome: PrimaryBiomeId) =>
    api?.generateRegion(q, r, biome) ?? false,
  applyRegion: (
    center: HexCoord,
    biome: PrimaryBiomeId,
    tiles: readonly WorldTileSnapshot[]
  ) => api?.applyRegion(center, biome, tiles) ?? false,
  applyBuilding: (q: number, r: number, buildingId: BuildingId) =>
    api?.applyBuilding(q, r, buildingId) ?? false,
  projectTile: (q: number, r: number) => api?.projectTile(q, r) ?? null
});
</script>

<template>
  <canvas ref="canvas" class="block size-full touch-none" />
</template>
