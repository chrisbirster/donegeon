import { issuer } from "@openauthjs/openauth";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { PasswordUI } from "@openauthjs/openauth/ui/password"
import { PasswordProvider } from "@openauthjs/openauth/provider/password"
import { Hono } from "hono";
import { cors } from "hono/cors";

import { Resource } from "sst";
import { subjects } from "./subject";
import { ensureUser } from "./services/user";

const app = new Hono()

export function getAuthServerCORS() {
  return {
    origin: ["http://localhost:3000", "https://app.donegeon.com"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "Access-Control-Allow-Origin"],
    maxAge: 600,
  }
}

app.use("*", async (c, next) => {
  return cors(getAuthServerCORS())(c, next);
});

app.all("*", async (c) => {
  return issuer({
    storage: CloudflareStorage({
      namespace: Resource.AuthStorage,
    }),
    subjects,
    providers: {
      password: PasswordProvider(
        PasswordUI({
          sendCode: async (email, code) => {
            console.log(email, code)
          },
        }),
      ),
    },
    allow: async (input) => {
      const url = new URL(input.redirectURI);
      const hostname = url.hostname;
      if (hostname.endsWith("donegeon.com")) return true;
      if (hostname === "localhost") return true;
      return false;
    },
    success: async (ctx, value) => {
      if (value.provider === "password") {
        console.log({ value });

        const user = await ensureUser(value.email);
        console.log({ user });

        return ctx.subject('user', {
          id: user.id,
          email: user.email,
          name: user.name,
        });

      }
      throw new Error("Invalid provider");
    },

  }).fetch(c.req.raw, c.env);
});

export default app;
