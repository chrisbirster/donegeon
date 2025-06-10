import { sql } from 'drizzle-orm';
import { Context } from 'hono';
import { BlankEnv, BlankInput } from 'hono/types';
import { waitlist } from './db/schema';
import { sha256Hex } from "./util/hash";
import { getDb, getSecret } from './util/api';

async function verifyTurnstile(token: string, ip: string) {
  const turnstileSecret = await getSecret();
  const body = new URLSearchParams({
    secret: turnstileSecret,
    response: token,
    remoteip: ip,
  });
  const r = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body },
  );
  const data = await r.json();
  return data.success;
}

export const joinWaitlist = async (c: Context<BlankEnv, "/join-waitlist", BlankInput>) => {
  const { email, turnstileToken } = await c.req.json<{
    email?: string;
    turnstileToken?: string;
  }>();

  if (!email || !turnstileToken) {
    return c.json({ error: "email and token required" }, 400);
  }

  // 1) Turnstile
  const ip = c.req.header("cf-connecting-ip") ?? "0.0.0.0";
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return c.json({ error: "bot verification failed" }, 400);
  }

  // 2) simple per‑IP / per‑email throttle (max 3 per hour)
  const ipHash = await sha256Hex(ip);
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const createdAt = Date.now();

  const recent = await getDb()
    .select()
    .from(waitlist)
    .where(
      sql`(created_at > ${oneHourAgo}) AND (ip_hash = ${ipHash} OR email = ${email})`,
    )
    .all();

  if (recent.length >= 3)
    return c.json({ error: "slow down, brave adventurer" }, 429);

  // 3) insert or ignore duplicates
  await getDb()
    .insert(waitlist)
    .values({ email, ipHash, createdAt })
    .onConflictDoNothing();

  // 4) TODO: send confirmation e‑mail here

  return c.json({ ok: true });
}
