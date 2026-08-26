<script setup lang="ts">
/**
 * Visual placeholder for AdSense mobile Anchor ads — development only.
 * Real production anchors are injected by Google AdSense automatically.
 */
const { showDevMobileAnchor } = useAds();

const isMobile = ref(false);
let media: MediaQueryList | null = null;

function syncMedia() {
  isMobile.value = media?.matches ?? false;
}

onMounted(() => {
  media = window.matchMedia("(max-width: 768px)");
  syncMedia();
  media.addEventListener("change", syncMedia);
});

onBeforeUnmount(() => {
  media?.removeEventListener("change", syncMedia);
  media = null;
});
</script>

<template>
  <div
    v-if="showDevMobileAnchor && isMobile"
    class="dev-mobile-anchor"
    aria-hidden="true"
  >
    <div class="dev-mobile-anchor__bar">
      <span class="dev-mobile-anchor__label">DEV AD · Anchor</span>
      <span class="dev-mobile-anchor__close" title="Rétractable (visuel)">×</span>
    </div>
  </div>
</template>

<style scoped>
.dev-mobile-anchor {
  pointer-events: none;
}

.dev-mobile-anchor__bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  box-sizing: border-box;
  height: var(--play-ad-bottom-inset, 3.25rem);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  border-top: 1px dashed rgb(28 43 40 / 0.28);
  background: rgb(28 43 40 / 0.06);
  color: rgb(28 43 40 / 0.45);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.8;
  pointer-events: none;
  user-select: none;
}

.dev-mobile-anchor__close {
  position: absolute;
  top: 0.2rem;
  right: 0.55rem;
  display: grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 999px;
  border: 1px solid rgb(28 43 40 / 0.2);
  font-size: 14px;
  line-height: 1;
  opacity: 0.7;
}
</style>
