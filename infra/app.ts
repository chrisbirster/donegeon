import { worker } from "./api";

export const app = new sst.cloudflare.StaticSite("game", {
  path: "packages/app",
  domain: "app.donegeon.com",
  build: {
    command: "npm run build",
    output: "dist",
  },
  environment: {
    VITE_API_URL: worker.url,
  }
});
