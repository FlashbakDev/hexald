<script setup lang="ts">
defineProps<{
  /** Sommaire d’ancres (colonne contenu). */
  toc?: { id: string; title: string }[];
}>();
</script>

<template>
  <div class="wiki-article">
    <div class="wiki-article__infobox">
      <slot name="infobox" />
    </div>
    <div class="wiki-article__body">
      <nav v-if="toc?.length" class="wiki-toc" aria-label="Sommaire">
        <a v-for="item in toc" :key="item.id" :href="`#${item.id}`">
          {{ item.title }}
        </a>
      </nav>
      <slot />
    </div>
  </div>
</template>
