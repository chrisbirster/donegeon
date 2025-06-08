import 'dotenv/config';
import { db } from "./database";
import { databaseId, cloudflareApiToken, cloudflareAccountId, turnstileSecret } from "./secrets";

export const worker = new sst.cloudflare.Worker("Worker", {
  link: [databaseId, db, cloudflareAccountId, cloudflareApiToken, turnstileSecret],
  domain: "api.donegeon.com",
  url: true,
  handler: "packages/core/src/api.ts",
});
