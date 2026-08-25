<script setup lang="ts">
import { LEGAL_LINKS } from "~/utils/legal";

withDefaults(
  defineProps<{
    /** Fond clair (pages légales) ou transparent (landing). */
    tone?: "mist" | "overlay";
  }>(),
  { tone: "mist" }
);

const year = new Date().getFullYear();
</script>

<template>
  <footer
    class="w-full"
    :class="
      tone === 'overlay'
        ? 'border-t border-[#1c2b28]/08 bg-[#dfe8e4]/75 text-[#3d524c] backdrop-blur-md'
        : 'border-t border-[#1c2b28]/10 bg-[#dfe8e4] text-[#3d524c]'
    "
  >
    <div
      class="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16"
    >
      <p class="text-xs sm:text-sm">
        © {{ year }} Hexald
      </p>
      <nav
        class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm"
        aria-label="Informations légales"
      >
        <NuxtLink
          v-for="link in LEGAL_LINKS"
          :key="link.to"
          :to="link.to"
          class="transition hover:text-[#1c2b28]"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
    </div>
  </footer>
</template>
