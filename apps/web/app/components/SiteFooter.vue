<script setup lang="ts">
import { LEGAL_LINKS } from "~/utils/legal";
import { SITE_NAV_LINKS } from "~/utils/siteNav";

withDefaults(
  defineProps<{
    /** Fond clair (pages légales) ou transparent (landing). */
    tone?: "mist" | "overlay";
    /** `section` = pied de page généreux (landing) ; `compact` = barre légale. */
    variant?: "compact" | "section";
  }>(),
  { tone: "mist", variant: "compact" }
);

const year = new Date().getFullYear();
</script>

<template>
  <footer
    class="w-full"
    :class="[
      tone === 'overlay'
        ? 'bg-[#dfe8e4]/75 text-[#3d524c] backdrop-blur-md'
        : 'bg-[#dfe8e4] text-[#3d524c]',
      variant === 'section'
        ? 'site-footer site-footer--section'
        : 'site-footer site-footer--compact'
    ]"
  >
    <div
      class="site-footer__inner"
      :class="
        variant === 'section'
          ? 'landing-col flex flex-col gap-10 py-16 sm:py-20'
          : 'landing-col flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between'
      "
    >
      <template v-if="variant === 'section'">
        <div class="site-footer__brand">
          <p
            class="font-display text-3xl font-medium tracking-tight text-[#1c2b28] sm:text-4xl"
          >
            Hexald
          </p>
          <p class="mt-3 max-w-md text-base leading-relaxed text-[#3d524c]">
            Un monde hexagonal à bâtir à ton rythme — village, production,
            expansion.
          </p>
        </div>
        <div
          class="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between"
        >
          <div class="flex flex-col gap-4 sm:gap-5">
            <nav
              class="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-semibold"
              aria-label="Navigation"
            >
              <NuxtLink
                v-for="link in SITE_NAV_LINKS"
                :key="link.to"
                :to="link.to"
                class="text-[#2d5248] transition hover:text-[#1c2b28]"
              >
                {{ link.label }}
              </NuxtLink>
            </nav>
            <nav
              class="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm"
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
          <p class="text-sm text-[#6b7c76]">© {{ year }} Hexald</p>
        </div>
      </template>

      <template v-else>
        <p class="text-xs sm:text-sm">© {{ year }} Hexald</p>
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
      </template>
    </div>
  </footer>
</template>
