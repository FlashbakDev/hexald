<script setup lang="ts">
import { newsKindLabel, newsPosts } from "~/data/news";

definePageMeta({
  layout: "blank"
});

usePageSeo({
  title: "Actualités Hexald — patch notes & blog",
  description:
    "Suis les actualités Hexald : patch notes, nouveautés de gameplay et notes de développement du jeu de stratégie hexagonale.",
  path: "/news"
});

useBreadcrumbSchema([
  { name: "Accueil", item: "/" },
  { name: "Actualités", item: "/news" }
]);

useSchemaOrg([
  defineWebPage({
    "@type": "CollectionPage",
    name: "Actualités Hexald",
    description:
      "Patch notes et billets de développement du jeu Hexald."
  })
]);

const posts = [...newsPosts].sort((a, b) => b.date.localeCompare(a.date));
</script>

<template>
  <div class="min-h-dvh bg-[#e8f0ec] text-[#1c2b28]">
    <header class="border-b border-[#1c2b28]/10 bg-[#dfe8e4]/80 backdrop-blur-md">
      <div
        class="landing-col flex items-center justify-between gap-4 py-4"
      >
        <NuxtLink
          to="/"
          class="font-display text-xl font-medium tracking-tight text-[#1c2b28] transition hover:text-[#2d5248]"
        >
          Hexald
        </NuxtLink>
        <SiteTopNav />
      </div>
    </header>

    <main class="landing-col max-w-3xl pb-16 pt-10 sm:pt-14">
      <p class="mb-2 text-sm font-medium tracking-wide text-[#4a7c6f]">
        Actualités
      </p>
      <h1
        class="font-display text-3xl font-medium tracking-tight text-[#1c2b28] sm:text-4xl"
      >
        Ce qui bouge dans Hexald
      </h1>
      <p class="mt-3 max-w-2xl text-[#3d524c]">
        Patch notes, notes d’équipe et nouveautés du jeu de stratégie
        hexagonale. Nouveau joueur&nbsp;?
        <NuxtLink to="/guide" class="font-semibold text-[#2d5248] underline">
          Commence par le guide
        </NuxtLink>.
      </p>

      <ul class="mt-10 space-y-4">
        <li v-for="post in posts" :key="post.slug">
          <NuxtLink
            :to="`/news/${post.slug}`"
            class="block rounded-2xl border border-[#1c2b28]/10 bg-white/70 px-5 py-4 shadow-[0_10px_30px_rgb(28_43_40_/_0.05)] transition hover:border-[#4a7c6f]/35 hover:bg-white"
          >
            <div
              class="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-[#4a7c6f]"
            >
              <span>{{ newsKindLabel(post.kind) }}</span>
              <span class="opacity-40">·</span>
              <time :datetime="post.date">{{ post.dateLabel }}</time>
            </div>
            <h2 class="mt-1.5 font-display text-xl font-medium text-[#1c2b28]">
              {{ post.title }}
            </h2>
            <p class="mt-1.5 text-sm leading-relaxed text-[#3d524c]">
              {{ post.summary }}
            </p>
          </NuxtLink>
        </li>
      </ul>
    </main>

    <SiteFooter variant="section" />
  </div>
</template>
