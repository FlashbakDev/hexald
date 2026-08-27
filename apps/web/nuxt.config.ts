const apiProxyTarget =
  process.env.NUXT_API_PROXY_TARGET ?? "http://127.0.0.1:9088";

const firebaseAuthDomain = (
  process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? ""
).trim();

const siteUrl = (
  process.env.NUXT_PUBLIC_SITE_URL ?? "https://hexald.com"
).replace(/\/$/, "");

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@nuxt/ui", "@nuxtjs/seo", "@vite-pwa/nuxt"],
  css: ["~/assets/css/main.css"],
  site: {
    url: siteUrl,
    name: "Hexald",
    description:
      "Hexald est un jeu de gestion / stratégie persistant par navigateur : construis ton monde hexagonal, développe ta civilisation et grimpe au classement.",
    defaultLocale: "fr"
  },
  app: {
    head: {
      htmlAttrs: { lang: "fr" },
      meta: [{ name: "theme-color", content: "#2d5248" }],
      link: [
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon-32x32.png"
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/favicon-16x16.png"
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png"
        },
        { rel: "mask-icon", href: "/icon.png", color: "#2d5248" }
      ]
    }
  },
  robots: {
    disallow: ["/play", "/admin", "/backend", "/poc", "/offline", "/__/auth"]
  },
  sitemap: {
    exclude: ["/play", "/admin/**", "/poc", "/offline", "/backend/**"]
  },
  ogImage: {
    enabled: false
  },
  schemaOrg: {
    identity: {
      type: "Organization",
      name: "Hexald",
      url: siteUrl,
      logo: "/icon.png",
      description:
        "Jeu de gestion / stratégie hexagonal persistant par navigateur."
    }
  },
  fonts: {
    // Self-hosted via @fontsource-variable imports in main.css — no Google runtime.
    defaults: {
      weights: [400, 500, 600],
      styles: ["normal"],
      subsets: ["latin", "latin-ext"]
    },
    families: [
      { name: "Fraunces", provider: "none" },
      { name: "Fraunces Variable", provider: "none" },
      { name: "Source Sans 3", provider: "none" },
      { name: "Source Sans 3 Variable", provider: "none" }
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
      siteUrl,
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
    "/": { prerender: true },
    "/news": { prerender: true },
    "/news/**": { prerender: true },
    "/guide": { prerender: true },
    "/leaderboard": { swr: 60 },
    "/legals": { prerender: true },
    "/privacy": { prerender: true },
    "/terms": { prerender: true },
    "/cookies": { prerender: true },
    "/offline": { prerender: true, robots: false },
    "/play": { ssr: false, robots: false },
    "/admin/**": { robots: false },
    "/poc": { robots: false },
    "/backend/**": {
      proxy: `${apiProxyTarget}/**`,
      robots: false
    },
    // Proxy auth helper same-origin (Option 3 Firebase) — utile pour redirect mobile.
    ...(firebaseAuthDomain
      ? {
          "/__/auth/**": {
            proxy: `https://${firebaseAuthDomain}/__/auth/**`,
            robots: false
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
        }
      ]
    },
    workbox: {
      // Fallback dédié offline — pas la homepage (évite shell marketing pour bots / routes manquantes).
      navigateFallback: "/offline",
      navigateFallbackDenylist: [
        /^\/backend/,
        /^\/__\/auth/,
        /^\/api/,
        /^\/sitemap/,
        /^\/robots\.txt/,
        /\/[^/?]+\.[^/]+$/
      ],
      // icon.png / favicon restent hors SW : servis en réseau (évite plafond 2 MiB).
      globPatterns: [
        "**/*.{js,css,html,svg,webp,woff2,jpg}",
        "pwa/*.png",
        "favicon-*.png",
        "apple-touch-icon.png",
        "og.jpg",
        "icon-*.webp"
      ],
      maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
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
