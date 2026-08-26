const apiProxyTarget =
  process.env.NUXT_API_PROXY_TARGET ?? "http://127.0.0.1:9088";

const firebaseAuthDomain = (
  process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? ""
).trim();

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@nuxt/ui", "@vite-pwa/nuxt"],
  css: ["~/assets/css/main.css"],
  app: {
    head: {
      title: "Hexald",
      htmlAttrs: { lang: "fr" },
      meta: [
        { name: "theme-color", content: "#2d5248" },
        { name: "description", content: "Gestion / stratégie hexagonale persistante." },
        { property: "og:title", content: "Hexald" },
        {
          property: "og:description",
          content: "Gestion / stratégie hexagonale persistante."
        },
        { property: "og:image", content: "/icon.png" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:image", content: "/icon.png" }
      ],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        { rel: "mask-icon", href: "/icon.png", color: "#2d5248" }
      ]
    }
  },
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
      adsenseClientId: "",
      /** Firebase web config — NUXT_PUBLIC_FIREBASE_* (explicit pour mobile / LAN) */
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY ?? "",
      firebaseAuthDomain,
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID ?? ""
    }
  },
  routeRules: {
    "/backend/**": {
      proxy: `${apiProxyTarget}/**`
    },
    // Proxy auth helper same-origin (Option 3 Firebase) — utile pour redirect mobile.
    ...(firebaseAuthDomain
      ? {
          "/__/auth/**": {
            proxy: `https://${firebaseAuthDomain}/__/auth/**`
          }
        }
      : {})
    // Pas de Cross-Origin-Opener-Policy : même `same-origin-allow-popups`
    // casse signInWithPopup (window.closed / window.close bloqués par Chrome).
  },
  vite: {
    optimizeDeps: {
      include: ["three", "firebase/app", "firebase/auth"]
    },
    server: firebaseAuthDomain
      ? {
          proxy: {
            "/__/auth": {
              target: `https://${firebaseAuthDomain}`,
              changeOrigin: true,
              secure: true
            }
          }
        }
      : undefined
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
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/pwa/pwa-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/pwa/pwa-512x512-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable"
        },
        {
          src: "/icon.png",
          sizes: "1254x1254",
          type: "image/png",
          purpose: "any"
        }
      ]
    },
    workbox: {
      // Shell précaché pour afficher le message offline ; API jamais en cache.
      navigateFallback: "/",
      navigateFallbackDenylist: [/^\/backend/, /^\/__\/auth/],
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
