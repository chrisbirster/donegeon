import { issuer } from "@openauthjs/openauth";
import { CloudflareStorage } from "@openauthjs/openauth/storage/cloudflare";
import { PasswordUI } from "@openauthjs/openauth/ui/password"
import { PasswordProvider } from "@openauthjs/openauth/provider/password"
import { Hono } from "hono";
import { cors } from "hono/cors";

import { Resource } from "sst";
import { subjects } from "./subject";

const app = new Hono()

// TODO: placeholder replace
async function getUser(email: string) {
  // Get user from database
  // Return user ID
  return "123"
}

export function getAuthServerCORS() {
  return {
    credentials: false,
    origin: ["http://localhost:3000", "https://app.donegeon.com"],
    allowHeaders: ["Content-Type"],
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
    allow: async () => true,
    success: async (ctx, value) => {
      if (value.provider === "password") {
        return ctx.subject("user", {
          id: await getUser(value.email),
        })
      }
      throw new Error("Invalid provider");
    },

  }).fetch(c.req.raw, c.env);
});

export default app;
