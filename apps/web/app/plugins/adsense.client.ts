/**
 * Loads the AdSense script once when ads are allowed.
 * Never loads in development (fake rails only).
 * Never loads when hasNoAds / adsEnabled is false.
 */
export default defineNuxtPlugin(() => {
  if (import.meta.server) return;

  const { adsEnabled, loadAdsense, setDevNoAds, hasNoAds } = useAds();

  if (import.meta.dev) {
    (
      globalThis as {
        __hexaldAds?: {
          setDevNoAds: (enabled: boolean) => void;
          hasNoAds: typeof hasNoAds;
        };
      }
    ).__hexaldAds = { setDevNoAds, hasNoAds };
  }

  watch(
    adsEnabled,
    (enabled) => {
      if (!enabled) return;
      void loadAdsense().catch(() => {
        // Swallow — ads must never break the game
      });
    },
    { immediate: true }
  );
});
