<script setup lang="ts">
const online = useNetworkStatus();
</script>

<template>
  <div
    v-if="!online"
    class="offline-blocker"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="offline-title"
    aria-describedby="offline-desc"
  >
    <div class="offline-blocker__card">
      <img
        class="offline-blocker__icon"
        src="/icon.png"
        width="64"
        height="64"
        alt=""
        aria-hidden="true"
      />
      <p class="offline-blocker__brand font-display">Hexald</p>
      <h1 id="offline-title" class="offline-blocker__title font-display">
        Connexion requise
      </h1>
      <p id="offline-desc" class="offline-blocker__text">
        Hexald ne fonctionne pas hors ligne. Vérifie ta connexion internet, puis
        réessaie.
      </p>
      <p class="offline-blocker__hint">
        Dès que le réseau revient, cette page se met à jour automatiquement.
      </p>
    </div>
  </div>
</template>
