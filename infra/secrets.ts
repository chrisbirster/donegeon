import { db } from "./database";

export const databaseId = db.databaseId.apply((id) =>
  new sst.Secret("MyDatabaseId", id)
);
export const cloudflareAccountId = new sst.Secret("CloudflareAccountID", sst.cloudflare.DEFAULT_ACCOUNT_ID)
export const cloudflareApiToken = new sst.Secret("CloudflareApiToken", process.env.CLOUDFLARE_API_TOKEN)
export const emailApiKey = new sst.Secret("EmailAPIKey", process.env.EMAIL_API_KEY)
export const turnstileSecret = new sst.Secret("TurnstileSecret", process.env.TURNSTILE_SECRET);



