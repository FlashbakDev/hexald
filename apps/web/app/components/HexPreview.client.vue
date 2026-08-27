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
  BiomeId,
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
  frameBiasX?: number;
  /** Centre caméra axial (défaut 0,0). */
  lookAt?: HexCoord | null;
  /** Écarte la brume de N anneaux de régions (preview admin). */
  fogClearRegionPadding?: number;
  /** Parallax gyro / souris (défaut true). */
  deviceTilt?: boolean;
}>();

const emit = defineEmits<{
  select: [tile: SelectedTile | null];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let api: HexSceneApi | undefined;

const tilt = useDeviceTilt({
  enabled: props.deviceTilt !== false,
  mouseFallback: true
});

watch(
  () => props.deviceTilt,
  (next) => {
    if (next === false) tilt.setEnabled(false);
    else if (next === true) tilt.setEnabled(true);
  }
);

function mountScene(create = createHexScene) {
  api?.dispose();
  if (!canvas.value) return;
  api = create(canvas.value, {
    onSelect: (tile) => emit("select", tile),
    initialWorld: props.initialWorld ?? undefined,
    initialLookAt: props.lookAt ?? undefined,
    fogClearRegionPadding: props.fogClearRegionPadding,
    viewSize: props.viewSize,
    frameBiasY: props.frameBiasY,
    frameBiasX: props.frameBiasX,
    getDeviceTilt: () => (tilt.enabled.value ? tilt.getTilt() : { x: 0, y: 0 })
  });
  if (import.meta.dev) {
    (globalThis as { __twHex?: HexSceneApi }).__twHex = api;
  }
}

watch(
  () => [props.viewSize, props.frameBiasY, props.frameBiasX] as const,
  ([viewSize, frameBiasY, frameBiasX]) => {
    api?.setFraming({ viewSize, frameBiasY, frameBiasX });
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
  import.meta.hot.accept("../renderer/createFishingHutMesh", () => {
    mountScene();
  });
  import.meta.hot.accept("../renderer/createHouseMesh", () => {
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
  import.meta.hot.accept("../renderer/createShoreEdgeDecor", () => {
    mountScene();
  });
  import.meta.hot.accept("../renderer/createInfluenceBorderKit", () => {
    mountScene();
  });
  import.meta.hot.accept("../renderer/createFishBankDecor", () => {
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
  removeBuilding: (q: number, r: number) => api?.removeBuilding(q, r) ?? false,
  applyTileBiome: (q: number, r: number, biome: BiomeId) =>
    api?.applyTileBiome(q, r, biome) ?? false,
  projectTile: (q: number, r: number) => api?.projectTile(q, r) ?? null,
  setTutorialHighlights: (coords: readonly HexCoord[]) =>
    api?.setTutorialHighlights(coords),
  setBuildHighlights: (valid: readonly HexCoord[], invalid?: readonly HexCoord[]) =>
    api?.setBuildHighlights(valid, invalid),
  setInfluenceHighlights: (coords: readonly HexCoord[]) =>
    api?.setInfluenceHighlights(coords),
  setDeviceTiltEnabled: (next: boolean) => tilt.setEnabled(next),
  deviceTilt: tilt
});
</script>

<template>
  <canvas ref="canvas" class="block size-full touch-none" />
</template>
