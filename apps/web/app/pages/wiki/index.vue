<script setup lang="ts">
definePageMeta({
  layout: "default"
});

usePageSeo({
  title: "Wiki Hexald — encyclopédie du jeu",
  description:
    "Wiki Hexald : fiches bâtiments, stats et guides. Apprends comment construire et enchaîner les productions de ton empire hexagonal.",
  path: "/wiki"
});

useBreadcrumbSchema([
  { name: "Accueil", item: "/" },
  { name: "Wiki", item: "/wiki" }
]);

useSchemaOrg([
  defineWebPage({
    name: "Wiki Hexald",
    description: "Encyclopédie du jeu : bâtiments et systèmes."
  })
]);
</script>

<template>
  <WikiShell
    title="Wiki Hexald"
    eyebrow="Encyclopédie"
    :crumbs="[{ label: 'Accueil', to: '/' }, { label: 'Wiki' }]"
  >
    <template #lead>
      <p class="wiki-lead">
        Référence joueur pour Hexald : fiches détaillées, conditions de pose et
        chaînes de production. On commence par les bâtiments — d’autres
        catégories arriveront ensuite.
      </p>
    </template>

    <div class="wiki-hub-grid">
      <NuxtLink to="/wiki/buildings" class="wiki-hub-link">
        <div class="wiki-hub-link__title">Bâtiments</div>
        <p class="wiki-hub-link__text">
          Extracteurs, transformateurs, habitat et bâtiments spéciaux — stats
          du catalogue et conseils de pose.
        </p>
      </NuxtLink>
    </div>
  </WikiShell>
</template>
