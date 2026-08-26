<script setup lang="ts">
import { newsKindLabel, newsPosts } from "~/data/news";

definePageMeta({
  layout: "blank"
});

useHead({
  title: "Actualités · Hexald"
});

const posts = [...newsPosts].sort((a, b) => b.date.localeCompare(a.date));
</script>

<template>
  <div class="min-h-dvh bg-[#e8f0ec] text-[#1c2b28]">
    <header class="border-b border-[#1c2b28]/10 bg-[#dfe8e4]/80 backdrop-blur-md">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4 sm:px-10">
        <NuxtLink
          to="/"
          class="font-display text-xl font-medium tracking-tight text-[#1c2b28] transition hover:text-[#2d5248]"
        >
          Hexald
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
      <p class="mb-2 text-sm font-medium tracking-wide text-[#4a7c6f]">Actualités</p>
      <h1 class="font-display text-3xl font-medium tracking-tight text-[#1c2b28] sm:text-4xl">
        Ce qui bouge dans Hexald
      </h1>
      <p class="mt-3 max-w-2xl text-[#3d524c]">
        Patch notes, petites notes d’équipe, et bientôt d’autres billets. Tu fais
        partie de l’aventure — merci d’être là.
      </p>

      <ul class="mt-10 space-y-4">
        <li v-for="post in posts" :key="post.slug">
          <NuxtLink
            :to="`/news/${post.slug}`"
            class="block rounded-2xl border border-[#1c2b28]/10 bg-white/70 px-5 py-4 shadow-[0_10px_30px_rgb(28_43_40_/_0.05)] transition hover:border-[#4a7c6f]/35 hover:bg-white"
          >
            <div class="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-[#4a7c6f]">
              <span>{{ newsKindLabel(post.kind) }}</span>
              <span class="opacity-40">·</span>
              <time :datetime="post.date">{{ post.dateLabel }}</time>
            </div>
            <h2 class="mt-1.5 font-display text-xl font-medium text-[#1c2b28]">
              {{ post.title }}
            </h2>
            <p class="mt-1.5 text-sm text-[#3d524c]">
              {{ post.summary }}
            </p>
          </NuxtLink>
        </li>
      </ul>
    </main>
  </div>
</template>
