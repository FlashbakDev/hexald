<template>
  <UApp>
    <NuxtPwaManifest />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ClientOnly>
      <OfflineBlocker />
    </ClientOnly>
  </UApp>
</template>

<script setup lang="ts">
import { SITE_DESCRIPTION, SITE_NAME } from "~/utils/seo";

useHead({
  script: [
    {
      src: "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2502594141763499",
      async: true,
      crossorigin: "anonymous"
    }
  ]
});

/**
 * WebSite global. SearchAction à ajouter quand une recherche site existera.
 */
useSchemaOrg([
  defineWebSite({
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: "fr"
    // potentialAction: defineSearchAction({ … }) — quand /search existera
  })
]);
</script>
