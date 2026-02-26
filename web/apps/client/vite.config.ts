import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

const apiTarget = process.env.DONEGEON_API_URL || "http://localhost:42069";

export default defineConfig({
  plugins: [solid(), tailwindcss()],
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
