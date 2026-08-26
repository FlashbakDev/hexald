<script setup lang="ts">
/**
 * Visual placeholders for Side Rail Ads — development only.
 * Real production rails are injected by Google AdSense automatically.
 */
const { showDevSideRails } = useAds();

const wideEnough = ref(false);
let media: MediaQueryList | null = null;

function syncMedia() {
  wideEnough.value = media?.matches ?? false;
}

onMounted(() => {
  media = window.matchMedia("(min-width: 1700px)");
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
    v-if="showDevSideRails && wideEnough"
    class="dev-side-rails"
    aria-hidden="true"
  >
    <div class="dev-ad dev-ad--left">DEV AD<br />160×600</div>
    <div class="dev-ad dev-ad--right">DEV AD<br />160×600</div>
  </div>
</template>

<style scoped>
.dev-side-rails {
  pointer-events: none;
}

.dev-ad {
  position: fixed;
  top: 50%;
  z-index: 5;
  transform: translateY(-50%);
  width: 160px;
  height: 600px;
  display: grid;
  place-items: center;
  border: 1px dashed rgb(28 43 40 / 0.28);
  background: rgb(28 43 40 / 0.04);
  color: rgb(28 43 40 / 0.45);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-align: center;
  line-height: 1.35;
  opacity: 0.75;
  pointer-events: none;
  user-select: none;
}

.dev-ad--left {
  left: 12px;
}

.dev-ad--right {
  right: 12px;
}
</style>
