import type { NewTask, Task } from "@donegeon/db";
import type { TaskAPI } from "../components/task-manager";

const API_BASE = import.meta.env.VITE_API_URL

export const taskAPI: TaskAPI = {
  /* GET /api/tasks */
  async list() {
    const r = await fetch(`${API_BASE}/api/tasks`, { credentials: "include" });
    if (!r.ok) throw new Error("Failed to fetch tasks");
    return (await r.json()) as Task[];
  },

  /* POST /api/tasks */
  async create(body: NewTask) {
    const r = await fetch(`${API_BASE}/api/tasks`, {
      method: "POST",
      body: JSON.stringify(body),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!r.ok) throw new Error("Failed to create task");
    return (await r.json()) as Task;
  },

  /* PATCH /api/tasks/:id */
  async update(id: number, patch: Partial<Task>) {
    const r = await fetch(`${API_BASE}/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!r.ok) throw new Error("Failed to update task");
    return (await r.json()) as Task;
  },

  /* DELETE /api/tasks/:id */
  async destroy(id: number) {
    const r = await fetch(`${API_BASE}/api/tasks/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!r.ok) throw new Error("Failed to delete task");
  },
};
