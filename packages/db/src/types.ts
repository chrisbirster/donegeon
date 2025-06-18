import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';

import { tasks, users } from './db/schema.js';

export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;

export const createTaskSchema = z.object({
  title: z.string().min(1).max(256),
  /* ↓ allow null */
  description: z.string().max(512).nullable().optional(),

  /* scheduling */
  dueAt: z.number().int().positive().nullable().optional(),
  scheduledFor: z.number().int().positive().nullable().optional(),

  /* state & meta stay the same … */
  status: z
    .enum(["pending", "active", "blocked", "done", "archived"])
    .optional(),
  priority: z.number().int().min(1).max(5).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),

  parentId: z.number().optional(),
  tags: z
    .array(z.string())
    .optional()
    .transform((t) => (t ? JSON.stringify(t) : undefined)),
});

export const patchTaskSchema = createTaskSchema.partial();

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().max(128).optional(),
});
