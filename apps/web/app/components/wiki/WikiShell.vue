<script setup lang="ts">
export type WikiCrumb = { label: string; to?: string };

defineProps<{
  title: string;
  eyebrow?: string;
  crumbs?: WikiCrumb[];
}>();
</script>

<template>
  <div class="wiki-page min-h-dvh bg-[#dfe8e4] text-[#1c2b28]">
    <header class="wiki-header">
      <div class="landing-col wiki-header__inner">
        <NuxtLink
          to="/"
          class="font-display text-xl font-medium tracking-tight text-[#1c2b28] transition hover:text-[#2d5248]"
        >
          Hexald
        </NuxtLink>
        <SiteTopNav />
      </div>
    </header>

    <main class="landing-col wiki-main pb-20 pt-10 sm:pt-14">
      <nav v-if="crumbs?.length" class="wiki-crumbs" aria-label="Fil d’Ariane">
        <template v-for="(crumb, index) in crumbs" :key="`${crumb.label}-${index}`">
          <span v-if="index > 0" class="wiki-crumbs__sep" aria-hidden="true">/</span>
          <NuxtLink v-if="crumb.to" :to="crumb.to" class="wiki-crumbs__link">
            {{ crumb.label }}
          </NuxtLink>
          <span v-else class="wiki-crumbs__current">{{ crumb.label }}</span>
        </template>
      </nav>

      <p v-if="eyebrow" class="wiki-eyebrow">{{ eyebrow }}</p>
      <h1 class="wiki-title font-display">{{ title }}</h1>
      <slot name="lead" />
      <slot />
    </main>

    <SiteFooter variant="section" />
  </div>
</template>
