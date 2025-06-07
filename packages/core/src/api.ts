import { Resource } from 'sst';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { drizzle } from 'drizzle-orm/d1';
import { eq, InferInsertModel, InferSelectModel } from 'drizzle-orm';

import { tasks } from './db/schema';
import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */
export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const getDb = () => drizzle(Resource.DonegeonDB);

const createTaskSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(512).default(''),
  dueAt: z.number().int().positive().optional(),
  scheduledFor: z.number().int().positive().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
});

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */
const api = new Hono();

/* CORS for local dev + prod */
api.use('/*',
  cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://app.dongeon.com'
    ],
    credentials: true,
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type']
  })
);

/* GET /tasks – list */
api.get('/tasks', async (c) => {
  const rows = await getDb().select().from(tasks).all() as Task[];
  return c.json(rows);
});

/* GET /tasks/:id – single */
api.get('/tasks/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const [row] = await getDb().select().from(tasks).where(eq(tasks.id, id)).all() as [Task?];
  return row ? c.json(row) : c.json({ error: 'Task not found' }, 404);
});

/* POST /tasks – create */
api.post('/tasks', async (c) => {
  const payload = createTaskSchema.parse(await c.req.json());
  const now = Date.now();

  const [inserted] = await getDb().insert(tasks)
    .values<NewTask>({
      ...payload,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    })
    .returning() as [Task];

  return c.json(inserted, 201);
});

/* -------------------------------------------------------------------------- */
/* Mount under /api                                                           */
/* -------------------------------------------------------------------------- */
const app = new Hono();
app.route('/api', api);

export default app;
