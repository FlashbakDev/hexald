const apiProxyTarget =
  process.env.NUXT_API_PROXY_TARGET ?? "http://127.0.0.1:9088";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@nuxt/ui", "@vite-pwa/nuxt"],
  css: ["~/assets/css/main.css"],
  fonts: {
    families: [
      { name: "Fraunces", provider: "google", weights: [400, 500, 600] },
      { name: "Source Sans 3", provider: "google", weights: [400, 500, 600] }
    ]
  },
  devServer: {
    host: "0.0.0.0",
    port: 9089
  },
  colorMode: {
    preference: "light",
    fallback: "light"
  },
  runtimeConfig: {
    public: {
      apiBase: "/backend",
      /** Override with NUXT_PUBLIC_ADMIN_CODE */
      adminCode: "nimda",
      /** AdSense publisher client — NUXT_PUBLIC_ADSENSE_CLIENT_ID (never load via head; plugin gates it) */
      adsenseClientId: ""
    }
  },
  routeRules: {
    "/backend/**": {
      proxy: `${apiProxyTarget}/**`
    }
  },
  vite: {
    optimizeDeps: {
      include: ["three"]
    }
  },
  pwa: {
    registerType: "autoUpdate",
    injectRegister: "auto",
    strategies: "generateSW",
    manifest: {
      name: "Hexald",
      short_name: "Hexald",
      description: "Gestion / stratégie hexagonale persistante.",
      theme_color: "#2d5248",
      background_color: "#e8f0ec",
      display: "standalone",
      orientation: "any",
      start_url: "/",
      lang: "fr",
      icons: [
        {
          src: "/pwa/pwa-192x192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "/pwa/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png"
        },
        {
          src: "/pwa/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        }
      ]
    },
    workbox: {
      // Shell précaché pour afficher le message offline ; API jamais en cache.
      navigateFallback: "/",
      navigateFallbackDenylist: [/^\/backend/],
      globPatterns: ["**/*.{js,css,html,png,svg,ico,webp,woff2}"],
      runtimeCaching: [
        {
          urlPattern: /\/backend\//,
          handler: "NetworkOnly"
        }
      ]
    },
    client: {
      installPrompt: false,
      periodicSyncForUpdates: 0
    },
    devOptions: {
      enabled: false,
      type: "module"
    }
  }
});
