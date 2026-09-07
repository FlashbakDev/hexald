<script setup lang="ts">
import type { BuildingRole, BuildingStatus } from "@hexald/content";
import type { BuildingId } from "@hexald/shared";
import type { WikiInfoboxRow } from "~/data/wikiBuildings";
import {
  ADMIN_PREVIEW_FOCUS,
  buildingHasMesh,
  previewWorldForBuilding
} from "~/utils/adminContentPreview";

const props = defineProps<{
  title: string;
  role: BuildingRole;
  status: BuildingStatus;
  rows: WikiInfoboxRow[];
  roleLabel: string;
  statusLabel: string;
  buildingId?: BuildingId;
}>();

const roleIcon: Record<BuildingRole, string> = {
  extractor: "i-lucide-pickaxe",
  processor: "i-lucide-cog",
  settlement: "i-lucide-home",
  special: "i-lucide-landmark"
};

const showMesh = computed(
  () => Boolean(props.buildingId && buildingHasMesh(props.buildingId))
);

const previewWorld = computed(() =>
  props.buildingId && showMesh.value
    ? previewWorldForBuilding(props.buildingId)
    : null
);

const previewKey = computed(
  () => `wiki-building:${props.buildingId ?? "none"}`
);
</script>

<template>
  <aside class="wiki-infobox" :data-role="props.role" :data-status="props.status">
    <div
      class="wiki-infobox__media"
      :class="{ 'wiki-infobox__media--mesh': showMesh }"
      :aria-hidden="showMesh ? undefined : true"
      :aria-label="showMesh ? `Aperçu 3D — ${props.title}` : undefined"
      role="img"
    >
      <ClientOnly v-if="showMesh && previewWorld">
        <div class="wiki-infobox__viewport">
          <HexPreview
            :key="previewKey"
            class="wiki-infobox__canvas"
            :initial-world="previewWorld"
            :look-at="ADMIN_PREVIEW_FOCUS"
            :view-size="3.4"
            :frame-bias-y="0.08"
            :fog-clear-region-padding="1"
            :device-tilt="false"
          />
        </div>
        <template #fallback>
          <div class="wiki-infobox__fallback">
            <UIcon :name="roleIcon[props.role]" class="wiki-infobox__icon" />
            <span class="wiki-infobox__media-label">Chargement 3D…</span>
          </div>
        </template>
      </ClientOnly>
      <template v-else>
        <UIcon :name="roleIcon[props.role]" class="wiki-infobox__icon" />
        <span class="wiki-infobox__media-label">{{ props.roleLabel }}</span>
      </template>
    </div>
    <h2 class="wiki-infobox__title font-display">{{ props.title }}</h2>
    <p class="wiki-infobox__badge">{{ props.statusLabel }}</p>
    <table class="wiki-infobox__table">
      <tbody>
        <tr v-for="row in props.rows" :key="row.label">
          <th scope="row">{{ row.label }}</th>
          <td>
            <NuxtLink v-if="row.href" :to="row.href">{{ row.value }}</NuxtLink>
            <template v-else>{{ row.value }}</template>
          </td>
        </tr>
      </tbody>
    </table>
  </aside>
</template>
