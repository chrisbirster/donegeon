import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { listTasks, getTask, deleteTask, createTask } from "./tasks";
import { joinWaitlist } from './waitlist';

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
api.get('/tasks', async (c) => await listTasks(c))

/* GET /tasks/:id – single */
api.get('/tasks/:id', async (c) => await getTask(c))

/* POST /tasks – create */
api.post('/tasks', async (c) => await createTask(c));

/* DELETE /tasks/:id – single */
api.delete('/tasks/:id', async (c) => await deleteTask(c))

/* POST /join-waitlist – create waitlist record */
api.post('/join-waitlist', async (c) => await joinWaitlist(c));

/* -------------------------------------------------------------------------- */
/* Mount under /api                                                           */
/* -------------------------------------------------------------------------- */
const app = new Hono();
app.route('/api', api);

export default app;
