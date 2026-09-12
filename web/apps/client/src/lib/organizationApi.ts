import type { Project, Task } from "../domain/contracts";

export type OrganizationSection = {
  id: string;
  projectId: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
};

export type OrganizationLabel = {
  id: string;
  name: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
};

type ActionPage<T> = {
  items: T[];
  nextCursor?: number;
  total?: number;
};

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("donegeon_token")?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) headers["X-Timezone"] = timezone;
  } catch {
    // Timezone is optional.
  }

  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message =
        body?.error?.message ||
        body?.error?.code ||
        (typeof body?.error === "string" ? body.error : undefined) ||
        body?.message ||
        message;
    } catch {
      // Keep the HTTP status message when the response body is not JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function taskManagerAction<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await request<{ result: T }>("/api/taskmanager/action", {
    method: "POST",
    body: JSON.stringify({ action, payload }),
  });
  return response.result;
}

export const organizationApi = {
  sections: {
    list: (projectId: string) =>
      taskManagerAction<ActionPage<OrganizationSection>>("getSections", { projectId }),
    create: (projectId: string, name: string) =>
      taskManagerAction<OrganizationSection>("addSection", { projectId, name }),
    rename: (sectionId: string, name: string) =>
      taskManagerAction<OrganizationSection>("updateSection", { sectionId, name }),
    remove: (sectionId: string) =>
      taskManagerAction<{ deleted: boolean }>("deleteSection", { sectionId }),
  },
  labels: {
    list: () => taskManagerAction<ActionPage<OrganizationLabel>>("getLabels"),
    create: (name: string) => taskManagerAction<OrganizationLabel>("addLabel", { name }),
    rename: (labelId: string, name: string) =>
      taskManagerAction<OrganizationLabel>("updateLabel", { labelId, name }),
    remove: (labelId: string) =>
      taskManagerAction<{ deleted: boolean }>("deleteLabel", { labelId }),
  },
  projects: {
    archived: () => taskManagerAction<ActionPage<Project>>("getArchivedProjects"),
    archive: (projectId: string) => taskManagerAction<Project>("archiveProject", { projectId }),
    unarchive: (projectId: string) => taskManagerAction<Project>("unarchiveProject", { projectId }),
    remove: (projectId: string) => taskManagerAction<{ deleted: boolean }>("deleteProject", { projectId }),
  },
};

export type FullTaskCreateInput = {
  content: string;
  description?: string;
  projectId?: string;
  sectionId?: string;
  priority?: number;
  labels?: string[];
  dueText?: string;
  dueDeadline?: string;
  recurrenceRule?: string;
  scheduleInput?: string;
};

export function createFullTask(input: FullTaskCreateInput): Promise<Task> {
  return request<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      priority: input.priority ?? 4,
    }),
  });
}
