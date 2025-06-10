import { eq } from 'drizzle-orm';
import { Context } from 'hono';
import { users } from './db/schema';
import { getDb } from './util/api';
import { BlankEnv, BlankInput } from 'hono/types';
import { randomUUID } from 'crypto';
import { createClient } from '@openauthjs/openauth/client';
import { subjects } from './subject';


const SERVICE_TOKEN = process.env.API_AUTH_TOKEN

const client = createClient({
  clientID: 'game',
  issuer: 'https://auth.donegeon.com',
});

/** create row if it doesn't exist, return full user record */
export async function getOrCreateUser(email: string) {
  const existing = await getDb().select()
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (existing) return existing;

  const now = new Date();
  const name = email.split('@')[0];

  const [row] = await getDb().insert(users)
    .values({
      id: randomUUID(),
      name,
      email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

export const getMe = async (c: Context<BlankEnv, "/user", BlankInput>) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) {

    return c.json({ error: 'unauthorized' }, 401);
  }
  const token = authHeader.split(" ")[1]
  const verified = await client.verify(subjects, token)
  if (verified.err && Object.keys(verified.err).length > 0) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  // @ts-ignore - TODO: type this out
  const userId = verified.subject.properties.id
  return c.json({ id: userId })
}

export const getUser = async (c: Context<BlankEnv, "/user", BlankInput>) => {
  const deezHeader = c.req.header('X-Deez-Token');
  if (deezHeader !== SERVICE_TOKEN)
    return c.json({ error: 'unauthenticated' }, 401);

  const { email } = await c.req.json<{ email: string }>();
  const user = await getOrCreateUser(email)
  return c.json(user);
}
