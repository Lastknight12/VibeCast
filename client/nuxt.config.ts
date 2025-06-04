import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },
  css: ["~/assets/css/main.css"],
  modules: ["reka-ui/nuxt", "shadcn-nuxt", "@nuxt/icon"],
  vite: {
    plugins: [tailwindcss()],
  },
  runtimeConfig: {
    public: {
      backendUrl: process.env.BACKEND_URL,
    },
  },
  components: {
    dirs: [
      {
        path: "~/components",
        pathPrefix: true,
      },
    ],
  },
});
