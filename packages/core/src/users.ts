import { eq } from 'drizzle-orm';
import { Context } from 'hono';
import { users } from './db/schema';
import { getDb } from './util/api';
import { BlankEnv, BlankInput } from 'hono/types';
import { randomUUID } from 'crypto';

const SERVICE_TOKEN = process.env.API_AUTH_TOKEN

/** create row if it doesn't exist, return full user record */
export async function getOrCreateUser(email: string) {
  console.log("inside getOrCreateUser");
  console.log("email used: ", email);
  const db = getDb();
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();

  if (existing) return existing;

  const now = new Date();
  const name = email.split('@')[0];
  const [row] = await db
    .insert(users)
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
  console.log({ authHeader });
  const user = { id: 123 }
  return c.json(user);
}

export const getUser = async (c: Context<BlankEnv, "/user", BlankInput>) => {
  const deezHeader = c.req.header('X-Deez-Token');
  console.log({ deezHeader });
  if (deezHeader !== SERVICE_TOKEN)
    return c.json({ error: 'unauthenticated' }, 401);

  const { email } = await c.req.json<{ email: string }>();
  console.log({ email })
  const user = getOrCreateUser(email)
  return c.json(user);
}
