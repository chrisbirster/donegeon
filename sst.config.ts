/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "donegeon",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "cloudflare",
    };
  },
  async run() {
    await import("./infra/database");
    await import("./infra/secrets");
    await import("./infra/api");
    await import("./infra/marketing");
    return {
      status: "ok",
    };
  },
});
