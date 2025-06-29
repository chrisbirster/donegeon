/// <reference path="./.sst/platform/config.d.ts" />
export default $config({
  app(input) {
    return {
      name: "donegeon",
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "cloudflare",
      providers: { aws: "6.82.1", cloudflare: "6.2.1" },
    };
  },
  async run() {
    await import("./infra/database");
    await import("./infra/secrets");
    await import("./infra/api");
    await import("./infra/marketing");
    await import("./infra/app");
    await import("./infra/auth");
    await import("./infra/email");
    return {
      status: "ok",
    };
  },
});
