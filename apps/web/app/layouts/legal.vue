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
          to="/"
          class="text-sm text-[#3d524c] transition hover:text-[#1c2b28]"
        >
          Retour
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-6 py-10 sm:px-10 sm:py-14">
      <slot />
    </main>

    <SiteFooter />
  </div>
</template>
