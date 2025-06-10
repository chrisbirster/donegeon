import { eq } from 'drizzle-orm';
import { Context } from 'hono';
import { tasks } from './db/schema';
import { getDb } from './util/api';
import { createTaskSchema, Task, NewTask } from './types';
import { BlankEnv, BlankInput } from 'hono/types';

export const listTasks = async (c: Context<BlankEnv, "/tasks", BlankInput>
) => {
  const rows = await getDb().select().from(tasks).all() as Task[];
  return c.json(rows);
};

export const getTask = async (c: Context<BlankEnv, "/tasks", BlankInput>) => {
  const id = Number(c.req.param('id'));
  const [row] = await getDb().select().from(tasks).where(eq(tasks.id, id)).all() as [Task?];
  return row ? c.json(row) : c.json({ error: 'Task not found' }, 404);
};

export const createTask = async (c: Context<BlankEnv, "/tasks", BlankInput>) => {
  const payload = createTaskSchema.parse(await c.req.json());
  const now = Date.now();

  const task = {
    ...payload,
    status: 'pending',
  } as NewTask

  const [inserted] = await getDb()
    .insert(tasks)
    .values(task)
    .returning();

  return c.json(inserted, 201);
}

export const deleteTask = async (c: Context<BlankEnv, "/tasks", BlankInput>) => {
  const id = Number(c.req.param('id'));
  const deletedTask: Task[] = await getDb().delete(tasks)
    .where(eq(tasks.id, id))
    .returning();
  return c.json(deletedTask, 201)
}

