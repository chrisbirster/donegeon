import 'dotenv/config';
import { db } from "./database";
import { databaseId, cloudflareApiToken, cloudflareAccountId } from "./secrets";

export const worker = new sst.cloudflare.Worker("Worker", {
  link: [databaseId, db, cloudflareAccountId, cloudflareApiToken],
  domain: "api.donegeon.com",
  url: true,
  handler: "packages/core/src/api.ts",
});
