<script setup lang="ts">
import { SITE_NAV_LINKS } from "~/utils/siteNav";

const route = useRoute();

function isActive(to: string) {
  if (to === "/") return route.path === "/";
  return route.path === to || route.path.startsWith(`${to}/`);
}
</script>

<template>
  <nav class="landing-topnav" aria-label="Navigation">
    <NuxtLink
      v-for="link in SITE_NAV_LINKS"
      :key="link.to"
      :to="link.to"
      class="landing-topnav__link"
      :class="{ 'is-active': isActive(link.to) }"
      :aria-current="isActive(link.to) ? 'page' : undefined"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>
