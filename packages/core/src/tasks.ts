import { eq } from 'drizzle-orm';
import { Context } from 'hono';
import { taskSchema, getDb, createTaskSchema, patchTaskSchema } from '@donegeon/db';
import type { NewTask, Task } from '@donegeon/db';
import { BlankEnv, BlankInput } from 'hono/types';

export const listTasks = async (c: Context<BlankEnv, "/tasks", BlankInput>
) => {
  const rows = await getDb().select().from(taskSchema).all() as Task[];
  return c.json(rows);
};

export const getTask = async (c: Context<BlankEnv, "/tasks", BlankInput>) => {
  const id = Number(c.req.param('id'));
  const [row] = await getDb().select().from(taskSchema).where(eq(taskSchema.id, id)).all() as [Task?];
  return row ? c.json(row) : c.json({ error: 'Task not found' }, 404);
};


export const updateTask = async (
  c: Context<BlankEnv, '/tasks', BlankInput>,
) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) {
    return c.json({ error: 'Invalid task ID' }, 400);
  }

  const rawBody = await c.req.json();
  const patch = patchTaskSchema.parse(rawBody);

  if (Object.keys(patch).length === 0) {
    return c.json({ error: 'No updatable fields supplied' }, 400);
  }

  const [updated] = (await getDb()
    .update(taskSchema)
    .set(patch)
    .where(eq(taskSchema.id, id))
    .returning()) as [Task?];

  if (!updated) {
    return c.json({ error: 'Task not found' }, 404);
  }

  return c.json(updated, 200);
};

export const createTask = async (c: Context<BlankEnv, "/tasks", BlankInput>) => {
  console.log("start createTask");
  const input = await c.req.json();
  console.log({ input })
  const payload = createTaskSchema.parse(input);

  console.log({ payload })

  const task = {
    ...payload,
    status: 'pending',
  } as NewTask

  const [inserted] = await getDb()
    .insert(taskSchema)
    .values(task)
    .returning() as [Task];

  return c.json(inserted, 201);
}

export const deleteTask = async (c: Context<BlankEnv, "/tasks", BlankInput>) => {
  const id = Number(c.req.param('id'));
  const deletedTask: Task[] = await getDb().delete(taskSchema)
    .where(eq(taskSchema.id, id))
    .returning();
  return c.json(deletedTask, 201)
}

