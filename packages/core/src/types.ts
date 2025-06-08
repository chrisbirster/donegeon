import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { z } from 'zod';

import { tasks, waitlist } from './db/schema';

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

