<script setup lang="ts">
definePageMeta({
  layout: false,
  robots: false
});

usePageSeo({
  title: "Hors ligne · Hexald",
  description: "Hexald nécessite une connexion internet.",
  path: "/offline",
  indexable: false
});
</script>

<template>
  <div class="offline-page">
    <img
      src="/icon-64.webp"
      width="64"
      height="64"
      alt=""
      aria-hidden="true"
    />
    <p class="offline-page__brand font-display">Hexald</p>
    <h1 class="offline-page__title font-display">Connexion requise</h1>
    <p class="offline-page__text">
      Hexald ne fonctionne pas hors ligne. Vérifie ta connexion, puis
      réessaie.
    </p>
    <NuxtLink to="/" class="offline-page__link">Retour à l’accueil</NuxtLink>
  </div>
</template>

<style scoped>
.offline-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  text-align: center;
  background: #dfe8e4;
  color: #1c2b28;
}

.offline-page__brand {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 500;
}

.offline-page__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 500;
}

.offline-page__text {
  margin: 0;
  max-width: 22rem;
  color: #3d524c;
  line-height: 1.55;
}

.offline-page__link {
  margin-top: 0.75rem;
  color: #2d5248;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 0.15rem;
}
</style>
