import { createEffect, createResource } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { Task, NewTask } from "@donegeon/db";

/* Back-end contract (can be your Hono handlers, Drizzle, etc.) */
export interface TaskAPI {
  list(): Promise<Task[]>;
  create(task: NewTask): Promise<Task>;
  update(id: number, patch: Partial<Task>): Promise<Task>;
  destroy(id: number): Promise<void>;
}

/* ───────── store ───────── */
const [store, setStore] = createStore<{
  tasks: Task[];
  state: "idle" | "loading" | "error";
}>({
  tasks: [],
  state: "idle",
});

export function createTaskManager(api: TaskAPI) {
  const [initial] = createResource<Task[]>(api.list);
  createEffect(() => {
    const list = initial();
    if (list) setStore("tasks", list);
  });

  const ensureLoaded = () => initial(); // just subscribes in Solid’s reactivity

  async function refresh() {
    setStore("state", "loading");
    try {
      const list = await api.list();
      setStore("tasks", list);
      setStore("state", "idle");
    } catch (err) {
      console.error(err);
      setStore("state", "error");
    }
  }

  async function add(input: Omit<NewTask, "id">) {
    console.log(input)
    setStore("state", "loading");
    const created = await api.create(input);
    setStore(
      produce((s) => {
        s.tasks.push(created);
        s.state = "idle";
      }),
    );
    return created;
  }

  async function update(id: number, patch: Partial<Task>) {
    /* optimistic update ↓ */
    const idx = store.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const prev = store.tasks[idx];
    setStore("tasks", idx, produce((t) => Object.assign(t, patch)));

    try {
      const saved = await api.update(id, patch);
      setStore("tasks", idx, saved);
      return saved;
    } catch (err) {
      /* rollback on failure */
      setStore("tasks", idx, prev);
      throw err;
    }
  }

  async function remove(id: number) {
    const idx = store.tasks.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const prev = store.tasks[idx];
    setStore("tasks", idx, undefined as unknown as Task); // temporary remove

    try {
      await api.destroy(id);
      setStore(
        produce((s) => {
          s.tasks.splice(idx, 1);
        }),
      );
    } catch (err) {
      /* rollback on failure */
      setStore("tasks", idx, prev);
      throw err;
    }
  }

  return {
    get tasks() {
      ensureLoaded();
      return store.tasks;
    },
    get state() {
      return store.state;
    },
    refresh,
    add,
    update,
    remove,
  };
}
