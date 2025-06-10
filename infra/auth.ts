// import { emailApi } from "./email";

const kv = new sst.cloudflare.Kv("AuthStorage");
export const auth = new sst.cloudflare.Auth("Auth", {
  authenticator: {
    handler: "packages/auth/src/index.ts",
    // link: [kv, emailApi],
    link: [kv],
    domain: "auth.donegeon.com",
    url: true,
    environment: {
      API_AUTH_TOKEN: process.env.API_AUTH_TOKEN,
    }
  },
});

