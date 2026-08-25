export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@nuxt/ui"],
  css: ["~/assets/css/main.css"],
  fonts: {
    families: [
      { name: "Syne", provider: "google", weights: [600, 700, 800] },
      { name: "Figtree", provider: "google", weights: [400, 500, 600, 700] }
    ]
  },
  devServer: {
    host: "0.0.0.0",
    port: 3000
  },
  colorMode: {
    preference: "dark",
    fallback: "dark"
  },
  runtimeConfig: {
    public: {
      apiBase: "/backend"
    }
  },
  routeRules: {
    "/backend/**": {
      proxy: "http://127.0.0.1:3001/**"
    }
  },
  vite: {
    optimizeDeps: {
      include: ["three"]
    }
  }
});
