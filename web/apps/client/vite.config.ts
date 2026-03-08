import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

const apiTarget = process.env.DONEGEON_API_URL || "http://localhost:42069";
const pwaDevEnabled = process.env.DONEGEON_PWA_DEV === "1";

export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectRegister: false,
      registerType: "autoUpdate",
      manifest: {
        name: "Donegeon",
        short_name: "Donegeon",
        description: "Gamified task and board workflow.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0b1220",
        theme_color: "#0f1728",
      },
      devOptions: {
        enabled: pwaDevEnabled,
        type: "module",
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../../dist",
    // Keep dist/embed.go so backend embedding remains in place across builds.
    emptyOutDir: false,
  },
});
