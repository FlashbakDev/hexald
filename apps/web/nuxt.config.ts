const apiProxyTarget =
  process.env.NUXT_API_PROXY_TARGET ?? "http://127.0.0.1:9088";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  modules: ["@nuxt/ui"],
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
      adminCode: "nimda"
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
  }
});
