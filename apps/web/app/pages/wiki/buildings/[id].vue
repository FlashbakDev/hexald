<script setup lang="ts">
import { getBuildingDefinition } from "@hexald/content";
import type { BuildingId } from "@hexald/shared";
import {
  buildingRoleLabel,
  buildingStatusLabel,
  relatedBuildingIds,
  tocFromContentBody,
  wikiBuildingInfoboxRows,
  wikiBuildingPath
} from "~/data/wikiBuildings";

definePageMeta({
  layout: "default"
});

const route = useRoute();
const id = String(route.params.id ?? "") as BuildingId;
const path = wikiBuildingPath(id);

const building = getBuildingDefinition(id);
if (!building) {
  throw createError({ statusCode: 404, statusMessage: "Bâtiment introuvable" });
}

const { data: page } = await useAsyncData(`wiki-building-${id}`, () =>
  queryCollection("wikiBuildings").path(path).first()
);

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: "Fiche wiki introuvable" });
}

const rows = wikiBuildingInfoboxRows(building);
const related = relatedBuildingIds(building.id)
  .map((rid) => getBuildingDefinition(rid))
  .filter((item): item is NonNullable<typeof item> => Boolean(item));
const toc = computed(() => tocFromContentBody(page.value?.body));
const summary = page.value.summary?.trim() || building.label;

usePageSeo({
  title: `${building.label} — Wiki Hexald`,
  description:
    summary ||
    `${building.label} dans Hexald : construction, production et conseils.`,
  path
});

useBreadcrumbSchema([
  { name: "Accueil", item: "/" },
  { name: "Wiki", item: "/wiki" },
  { name: "Bâtiments", item: "/wiki/buildings" },
  { name: building.label, item: path }
]);

useSchemaOrg([
  defineWebPage({
    name: `${building.label} — Wiki Hexald`,
    description: summary
  })
]);
</script>

<template>
  <WikiShell
    :title="building.label"
    eyebrow="Bâtiment"
    :crumbs="[
      { label: 'Accueil', to: '/' },
      { label: 'Wiki', to: '/wiki' },
      { label: 'Bâtiments', to: '/wiki/buildings' },
      { label: building.label }
    ]"
  >
    <template #lead>
      <p class="wiki-lead">{{ summary }}</p>
    </template>

    <WikiArticleLayout :toc="toc">
      <template #infobox>
        <WikiInfobox
          :title="building.label"
          :role="building.role"
          :status="building.status"
          :role-label="buildingRoleLabel(building.role)"
          :status-label="buildingStatusLabel(building.status)"
          :rows="rows"
          :building-id="building.id"
        />
      </template>

      <ContentRenderer v-if="page" :value="page" class="wiki-prose" />

      <section v-if="related.length" class="wiki-related">
        <h2 class="font-display">Bâtiments liés</h2>
        <ul>
          <li v-for="item in related" :key="item.id">
            <NuxtLink :to="wikiBuildingPath(item.id)">{{ item.label }}</NuxtLink>
          </li>
        </ul>
      </section>
    </WikiArticleLayout>
  </WikiShell>
</template>
