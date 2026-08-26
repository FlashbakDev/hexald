/**
 * Centralised advertising gate.
 *
 * Production Side Rails are placed automatically by Google AdSense —
 * this module only decides whether the AdSense script may load.
 *
 * Backend wiring (later): replace `backendNoAds` via GET /me
 *   { entitlements: { noAds: true } }
 * using `applyEntitlements(...)`.
 */

const DEV_NO_ADS_KEY = "hexald:dev:noAds";

let adsenseLoadPromise: Promise<void> | null = null;

function readDevNoAds(): boolean {
  if (!import.meta.client) return false;
  try {
    return localStorage.getItem(DEV_NO_ADS_KEY) === "true";
  } catch {
    return false;
  }
}

export function useAds() {
  const config = useRuntimeConfig();

  /** Future: set from GET /me → entitlements.noAds */
  const backendNoAds = useState("ads-backend-no-ads", () => false);
  /** Dev-only simulation persisted in localStorage (lu après mount). */
  const devNoAds = useState("ads-dev-no-ads", () => false);

  if (import.meta.client) {
    onMounted(() => {
      devNoAds.value = readDevNoAds();
    });
  }

  const hasNoAds = computed(
    () => backendNoAds.value || (import.meta.dev && devNoAds.value)
  );

  /**
   * TMP: CMP consent is configured on the AdSense/CMP side but not yet
   * exposed to the app. Assume ads are allowed until a real CMP signal
   * is wired here (do not mix CMP DOM logic into game components).
   */
  const consentAllowsAds = computed(() => true);

  const adsenseClientId = computed(
    () => String(config.public.adsenseClientId ?? "").trim()
  );

  const adsEnabled = computed(
    () =>
      import.meta.prod &&
      !hasNoAds.value &&
      consentAllowsAds.value &&
      adsenseClientId.value.length > 0
  );

  /** Fake side rails — development only, never in production */
  const showDevSideRails = computed(
    () => import.meta.dev && !hasNoAds.value
  );

  /** Fake mobile anchor bar — development only, never in production */
  const showDevMobileAnchor = computed(
    () => import.meta.dev && !hasNoAds.value
  );

  function setDevNoAds(enabled: boolean) {
    if (!import.meta.dev) return;
    devNoAds.value = enabled;
    if (!import.meta.client) return;
    try {
      localStorage.setItem(DEV_NO_ADS_KEY, enabled ? "true" : "false");
    } catch {
      // ignore quota / private mode
    }
  }

  /** Call when session/me payload includes entitlements (future). */
  function applyEntitlements(
    entitlements: { noAds?: boolean } | null | undefined
  ) {
    backendNoAds.value = Boolean(entitlements?.noAds);
  }

  async function loadAdsense(): Promise<void> {
    if (!import.meta.client) return;
    if (import.meta.dev) return;
    if (!adsEnabled.value) return;

    const clientId = adsenseClientId.value;
    if (!clientId) return;

    if (document.querySelector("[data-adsense-script]")) return;
    if (adsenseLoadPromise) return adsenseLoadPromise;

    adsenseLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector("[data-adsense-script]");
      if (existing) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
      script.crossOrigin = "anonymous";
      script.dataset.adsenseScript = "true";
      script.onload = () => resolve();
      script.onerror = () => {
        adsenseLoadPromise = null;
        reject(new Error("adsense_load_failed"));
      };
      document.head.appendChild(script);
    });

    return adsenseLoadPromise;
  }

  return {
    hasNoAds,
    adsEnabled,
    consentAllowsAds,
    showDevSideRails,
    showDevMobileAnchor,
    adsenseClientId,
    setDevNoAds,
    applyEntitlements,
    loadAdsense
  };
}
