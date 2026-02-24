export type Task = {
  id: string;
  content: string;
  description: string;
  priority: number;
  checked: boolean;
  dueText?: string;
  dueDeadline?: string;
};

type TaskListResponse = {
  items: Task[];
  nextCursor?: number;
  total: number;
};

export type QuickAddParsed = {
  content: string;
  project?: string;
  labels: string[];
  assignee?: string;
  priority?: number;
  deadline?: string;
  dueText?: string;
  description: string;
};

const DEFAULT_TOKEN = "TOKEN_VALID";

function getAuthHeaders() {
  const token = localStorage.getItem("donegeon_token") || DEFAULT_TOKEN;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body?.error?.code || message;
    } catch {
      // Ignore malformed error body and preserve HTTP status message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const taskApi = {
  list: () => api<TaskListResponse>("/api/tasks"),
  create: (content: string) =>
    api<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ content, priority: 4 }),
    }),
  quickAdd: (text: string) =>
    api<{ task: Task; parsed: QuickAddParsed }>("/api/tasks/quick-add", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  close: (id: string) =>
    api<void>(`/api/tasks/${id}/close`, {
      method: "POST",
    }),
  reopen: (id: string) =>
    api<void>(`/api/tasks/${id}/reopen`, {
      method: "POST",
    }),
};

export const parseApi = {
  quickAdd: (text: string) =>
    api<{ parsed: QuickAddParsed }>("/api/quick-add/parse", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};
