import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';

import { tasks, users } from './db/schema';

export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;

export const createTaskSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(512).default(''),
  dueAt: z.number().int().positive().optional(),
  scheduledFor: z.number().int().positive().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
});


export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().max(128).optional(),
});
