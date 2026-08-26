<script setup lang="ts">
import { getNewsPost, newsKindLabel } from "~/data/news";

definePageMeta({
  layout: "blank"
});

const route = useRoute();
const slug = String(route.params.slug ?? "");
const post = getNewsPost(slug);

if (!post) {
  throw createError({ statusCode: 404, statusMessage: "Actualité introuvable" });
}

useHead({
  title: `${post.title} · Hexald`
});
</script>

<template>
  <div class="min-h-dvh bg-[#e8f0ec] text-[#1c2b28]">
    <header class="border-b border-[#1c2b28]/10 bg-[#dfe8e4]/80 backdrop-blur-md">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4 sm:px-10">
        <NuxtLink
          to="/news"
          class="text-sm text-[#3d524c] transition hover:text-[#1c2b28]"
        >
          ← Actualités
        </NuxtLink>
        <NuxtLink
          to="/play"
          class="text-sm text-[#3d524c] transition hover:text-[#1c2b28]"
        >
          Retour au jeu
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
      <div class="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-[#4a7c6f]">
        <span>{{ newsKindLabel(post.kind) }}</span>
        <span class="opacity-40">·</span>
        <time :datetime="post.date">{{ post.dateLabel }}</time>
      </div>
      <h1 class="mt-2 font-display text-3xl font-medium tracking-tight text-[#1c2b28] sm:text-4xl">
        {{ post.title }}
      </h1>

      <article class="legal-prose mt-8" v-html="post.body" />
    </main>
  </div>
</template>
