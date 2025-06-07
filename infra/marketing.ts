export const marketing = new sst.cloudflare.StaticSite("Marketing", {
  path: "packages/marketing",
  domain: "donegeon.com",
  build: {
    command: "npm run build",
    output: "dist",
  },
});
