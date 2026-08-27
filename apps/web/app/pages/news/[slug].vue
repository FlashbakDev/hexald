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

usePageSeo({
  title: `${post.title} · Hexald`,
  description:
    post.summary.slice(0, 160) ||
    `Actualité Hexald du ${post.dateLabel} : ${post.title}.`,
  path: `/news/${post.slug}`
});

useNewsArticleSchema({
  slug: post.slug,
  kind: post.kind,
  title: post.title,
  date: post.date,
  summary: post.summary
});
</script>

<template>
  <div class="min-h-dvh bg-[#e8f0ec] text-[#1c2b28]">
    <header class="border-b border-[#1c2b28]/10 bg-[#dfe8e4]/80 backdrop-blur-md">
      <div class="landing-col flex items-center justify-between gap-4 py-4">
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
      <p class="mb-4 text-sm">
        <NuxtLink to="/news" class="text-[#3d524c] transition hover:text-[#1c2b28]">
          ← Actualités
        </NuxtLink>
      </p>

      <div
        class="flex flex-wrap items-center gap-2 text-xs font-semibold tracking-wide text-[#4a7c6f]"
      >
        <span>{{ newsKindLabel(post.kind) }}</span>
        <span class="opacity-40">·</span>
        <time :datetime="post.date">{{ post.dateLabel }}</time>
      </div>
      <h1
        class="mt-2 font-display text-3xl font-medium tracking-tight text-[#1c2b28] sm:text-4xl"
      >
        {{ post.title }}
      </h1>
      <p
        v-if="post.summary"
        class="mt-4 max-w-2xl text-lg leading-relaxed text-[#3d524c]"
      >
        {{ post.summary }}
      </p>

      <article class="legal-prose mt-8" v-html="post.body" />

      <aside class="mt-12 border-t border-[#1c2b28]/10 pt-8 text-sm text-[#3d524c]">
        <p class="font-semibold text-[#1c2b28]">Continuer sur Hexald</p>
        <ul class="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-5">
          <li>
            <NuxtLink to="/" class="font-semibold text-[#2d5248] underline">
              Accueil
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/guide" class="font-semibold text-[#2d5248] underline">
              Guide — comment jouer
            </NuxtLink>
          </li>
          <li>
            <NuxtLink
              to="/leaderboard"
              class="font-semibold text-[#2d5248] underline"
            >
              Classement
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/news" class="font-semibold text-[#2d5248] underline">
              Toutes les actualités
            </NuxtLink>
          </li>
        </ul>
      </aside>
    </main>

    <SiteFooter variant="section" />
  </div>
</template>
