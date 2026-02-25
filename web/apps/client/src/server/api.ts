export type Task = {
  id: string;
  content: string;
  description: string;
  projectId?: string;
  sectionId?: string;
  sortOrder: number;
  recurrenceRule?: string;
  priority: number;
  checked: boolean;
  isDeleted: boolean;
  dueText?: string;
  dueDeadline?: string;
};

export type Project = {
  id: string;
  name: string;
  isInboxProject: boolean;
  isArchived: boolean;
  isFavorite: boolean;
  openTaskCount: number;
};

export type BoardPoint = {
  x: number;
  y: number;
};

export type BoardStack = {
  id: string;
  pos: BoardPoint;
  z: number;
  cards: string[];
};

export type BoardCard = {
  id: string;
  defId: string;
  data?: Record<string, unknown>;
};

export type BoardMeta = {
  inventory?: Record<string, number>;
  villagers?: Record<
    string,
    {
      stamina?: number;
      xp?: number;
      level?: number;
      perks?: string[];
    }
  >;
  metrics?: Record<string, number>;
  deckOpen?: Record<string, number>;
  dayTickCount?: number;
};

export type BoardStateResponse = {
  stacks: Record<string, BoardStack>;
  cards: Record<string, BoardCard>;
  meta?: BoardMeta;
  version: string;
};

type TaskListResponse = {
  items: Task[];
  nextCursor?: number;
  total: number;
};

type ProjectListResponse = {
  items: Project[];
};

export type QuickAddParsed = {
  content: string;
  project?: string;
  labels: string[];
  assignee?: string;
  priority?: number;
  deadline?: string;
  dueText?: string;
  recurrenceRule?: string;
  description: string;
};

const DEFAULT_TOKEN = "TOKEN_VALID";

type UpdateTaskPayload = {
  content?: string;
  description?: string;
  projectId?: string;
  sectionId?: string;
  sortOrder?: number;
  recurrenceRule?: string;
  priority?: number;
  dueText?: string;
  dueDeadline?: string;
};

export type ParsedRRule = {
  raw: string;
  freq: string;
  until?: {
    value: string;
    isDate: boolean;
    utc: boolean;
  };
  count?: number;
  interval?: number;
  bySecond?: number[];
  byMinute?: number[];
  byHour?: number[];
  byDay?: Array<{
    ordinal?: number;
    weekday: string;
  }>;
  byMonthDay?: number[];
  byYearDay?: number[];
  byWeekNo?: number[];
  byMonth?: number[];
  bySetPos?: number[];
  weekStart?: string;
  extensionParts?: Record<string, string>;
};

export type BoardCommandPayload = {
  cmd: string;
  args?: Record<string, unknown>;
  clientVersion?: string;
};

export type BoardCommandResponse = {
  ok: boolean;
  newVersion: string;
  patch?: unknown;
  error?: string;
};

function getAuthHeaders() {
  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    timezone = undefined;
  }

  const token = localStorage.getItem("donegeon_token") || DEFAULT_TOKEN;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (timezone) {
    headers["X-Timezone"] = timezone;
  }
  return headers;
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
    let body: any;
    let message = `HTTP ${response.status}`;
    try {
      body = await response.json();
      const apiMessage =
        body?.error?.message ||
        body?.error?.code ||
        (typeof body?.error === "string" ? body.error : undefined) ||
        (typeof body?.message === "string" ? body.message : undefined);
      if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
        message = apiMessage.trim();
      }
    } catch {
      // Ignore malformed error body and preserve HTTP status message.
    }
    const error = new Error(message) as Error & { status?: number; body?: any };
    error.status = response.status;
    error.body = body;
    throw error;
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
  update: (id: string, payload: UpdateTaskPayload) =>
    api<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  close: (id: string) =>
    api<void>(`/api/tasks/${id}/close`, {
      method: "POST",
    }),
  reopen: (id: string) =>
    api<void>(`/api/tasks/${id}/reopen`, {
      method: "POST",
    }),
  remove: (id: string) =>
    api<void>(`/api/tasks/${id}`, {
      method: "DELETE",
    }),
};

export const projectApi = {
  list: () => api<ProjectListResponse>("/api/projects"),
  update: (id: string, payload: { name?: string; isFavorite?: boolean }) =>
    api<Project>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

export const parseApi = {
  quickAdd: (text: string) =>
    api<{ parsed: QuickAddParsed }>("/api/quick-add/parse", {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
};

export const rruleApi = {
  parse: (rrule: string) =>
    api<{ rule: ParsedRRule; canonical: string }>("/api/rrule/parse", {
      method: "POST",
      body: JSON.stringify({ rrule }),
    }),
};

export const boardApi = {
  getState: (board?: string) =>
    api<BoardStateResponse>(board ? `/api/board/state?board=${encodeURIComponent(board)}` : "/api/board/state"),
  command: (payload: BoardCommandPayload, board?: string) =>
    api<BoardCommandResponse>(board ? `/api/board/cmd?board=${encodeURIComponent(board)}` : "/api/board/cmd", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
