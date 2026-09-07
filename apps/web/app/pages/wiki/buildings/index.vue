<script setup lang="ts">
import {
  mergeWikiBuildingIndex,
  resourceLabel,
  terrainLabel
} from "~/data/wikiBuildings";

definePageMeta({
  layout: "default"
});

const { data: pages } = await useAsyncData("wiki-buildings-index", () =>
  queryCollection("wikiBuildings").all()
);

const groups = computed(() => mergeWikiBuildingIndex(pages.value ?? []));

usePageSeo({
  title: "Bâtiments — Wiki Hexald",
  description:
    "Liste des bâtiments Hexald : camps, fermes, mines, scierie, marché, bibliothèque… Conditions de pose, rôles et liens vers chaque fiche.",
  path: "/wiki/buildings"
});

useBreadcrumbSchema([
  { name: "Accueil", item: "/" },
  { name: "Wiki", item: "/wiki" },
  { name: "Bâtiments", item: "/wiki/buildings" }
]);

useSchemaOrg([
  defineWebPage({
    name: "Bâtiments — Wiki Hexald",
    description: "Index des bâtiments du jeu Hexald."
  })
]);

function lineFor(item: (typeof groups.value)[number]["items"][number]) {
  const terrain = terrainLabel(item.definition.terrain);
  const output = resourceLabel(item.definition.output);
  const status =
    item.definition.status === "mvp"
      ? ""
      : item.definition.status === "planned"
        ? " · prévu"
        : " · plus tard";
  return `${terrain} · ${output}${status}`;
}
</script>

<template>
  <WikiShell
    title="Bâtiments"
    eyebrow="Wiki"
    :crumbs="[
      { label: 'Accueil', to: '/' },
      { label: 'Wiki', to: '/wiki' },
      { label: 'Bâtiments' }
    ]"
  >
    <template #lead>
      <p class="wiki-lead">
        Tous les bâtiments du catalogue Hexald, regroupés par rôle. Ouvre une
        fiche pour l’infobox (stats) et le détail de construction / production.
      </p>
    </template>

    <div class="wiki-index-groups">
      <section
        v-for="group in groups"
        :id="group.role"
        :key="group.role"
        class="wiki-index-group"
      >
        <h2 class="font-display">{{ group.label }}</h2>
        <ul class="wiki-index-list">
          <li v-for="item in group.items" :key="item.id">
            <NuxtLink :to="item.path">
              <span class="wiki-index-list__name">{{ item.definition.label }}</span>
              <span class="wiki-index-list__meta">{{ lineFor(item) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </WikiShell>
</template>
