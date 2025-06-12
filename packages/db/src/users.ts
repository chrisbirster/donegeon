import { eq } from 'drizzle-orm';
import { users } from './db/schema.js';
import { getDb } from './util/api.js';
import { randomUUID } from 'crypto';

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

