import {
  UiActionBusUnavailableError,
  dispatchApiWorkerRequest,
  isUiActionBusEnabled,
} from "../lib/uiEventBus";

import type {
  Task,
  Project,
  BoardPoint,
  BoardStack,
  BoardCard,
  BoardQuestObjective,
  BoardQuestReward,
  BoardQuestUnlock,
  BoardQuestRuntime,
  BoardQuestHistoryEntry,
  BoardQuestState,
  BoardProgressionPerk,
  BoardProgressionLevel,
  BoardProgressionState,
  BoardMeta,
  BoardStateResponse,
  TaskListResponse,
  ProjectListResponse,
  QuickAddParsed,
  AuthUser,
  AuthTeam,
  TeamMember,
  TeamInvitation,
  InvitationForLogin,
  CompleteOnboardingInput,
  TeamSettings,
  CalendarProvider,
  CalendarConnection,
  CalendarSyncResult,
  CalendarSyncResponse,
  BoardMember,
  BillingCheckoutResponse,
  BillingPortalResponse,
  BillingTrialEndResponse,
  StoreCatalogItem,
  StoreCatalogResponse,
  StoreCheckoutResponse,
  AuthSession,
  LoginCodeRequestResponse,
  PublicConfig,
  WaitlistSignup,
  WaitlistSignupResponse,
  UpdateTaskPayload,
  ParsedRRule,
  BoardCommandPayload,
  BoardCommandResponse,
} from "../domain/contracts";
export type {
  Task,
  Project,
  BoardPoint,
  BoardStack,
  BoardCard,
  BoardQuestObjective,
  BoardQuestReward,
  BoardQuestUnlock,
  BoardQuestRuntime,
  BoardQuestHistoryEntry,
  BoardQuestState,
  BoardProgressionPerk,
  BoardProgressionLevel,
  BoardProgressionState,
  BoardMeta,
  BoardStateResponse,
  TaskListResponse,
  ProjectListResponse,
  QuickAddParsed,
  AuthUser,
  AuthTeam,
  TeamMember,
  TeamInvitation,
  InvitationForLogin,
  CompleteOnboardingInput,
  TeamSettings,
  CalendarProvider,
  CalendarConnection,
  CalendarSyncResult,
  CalendarSyncResponse,
  BoardMember,
  BillingCheckoutResponse,
  BillingPortalResponse,
  BillingTrialEndResponse,
  StoreCatalogItem,
  StoreCatalogResponse,
  StoreCheckoutResponse,
  AuthSession,
  LoginCodeRequestResponse,
  PublicConfig,
  WaitlistSignup,
  WaitlistSignupResponse,
  UpdateTaskPayload,
  ParsedRRule,
  BoardCommandPayload,
  BoardCommandResponse,
} from "../domain/contracts";

function getAuthHeaders() {
  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    timezone = undefined;
  }

  const token = localStorage.getItem("donegeon_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token && token.trim()) {
    headers.Authorization = `Bearer ${token.trim()}`;
  }
  if (timezone) {
    headers["X-Timezone"] = timezone;
  }
  return headers;
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};

  if (headers instanceof Headers) {
    const normalized: Record<string, string> = {};
    headers.forEach((value, key) => {
      normalized[key] = value;
    });
    return normalized;
  }

  if (Array.isArray(headers)) {
    const normalized: Record<string, string> = {};
    for (const [key, value] of headers) {
      normalized[key] = value;
    }
    return normalized;
  }

  return { ...headers };
}

function toWorkerBody(body: BodyInit | null | undefined): string | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  return undefined;
}

function toApiError(message: string, status?: number, body?: unknown): Error & { status?: number; body?: unknown } {
  const error = new Error(message) as Error & { status?: number; body?: unknown };
  if (status !== undefined) error.status = status;
  if (body !== undefined) error.body = body;
  return error;
}

async function apiDirect<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
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
    throw toApiError(message, response.status, body);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const mergedHeaders = {
    ...getAuthHeaders(),
    ...normalizeHeaders(init?.headers),
  };

  const requestInit: RequestInit = {
    ...init,
    credentials: "same-origin",
    headers: mergedHeaders,
  };

  if (init?.signal == null && isUiActionBusEnabled()) {
    const body = toWorkerBody(init?.body);
    const canUseWorkerForBody = body !== undefined || init?.body === undefined || init?.body === null;
    if (canUseWorkerForBody) {
      try {
        const response = await dispatchApiWorkerRequest({
          path,
          method: (init?.method || "GET").toUpperCase(),
          headers: mergedHeaders,
          body,
        });
        if (!response.ok) {
          throw toApiError(response.errorMessage || `HTTP ${response.status}`, response.status, response.body);
        }
        return response.body as T;
      } catch (err) {
        if (!(err instanceof UiActionBusUnavailableError)) {
          throw err;
        }
        // Fallback to direct fetch only when worker infrastructure is unavailable.
      }
    }
  }

  return apiDirect<T>(path, requestInit);
}

export const authApi = {
  me: () => api<{ session: AuthSession }>("/api/auth/me"),
  requestLoginCode: (payload: { email: string; name?: string }) =>
    api<LoginCodeRequestResponse>("/api/auth/login/request", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  verifyLoginCode: (payload: { challengeId: string; code: string; invitationCode?: string }) =>
    api<{ session: AuthSession }>("/api/auth/login/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  invitation: (invitationCode: string) =>
    api<{ invitation: InvitationForLogin }>(`/api/auth/invitation?code=${encodeURIComponent(invitationCode)}`),
  completeOnboarding: (input: CompleteOnboardingInput) =>
    api<{ session: AuthSession; invitations: Array<{ email: string; invitationCode: string }> }>("/api/auth/onboarding", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  logout: () =>
    api<void>("/api/auth/logout", {
      method: "POST",
    }),
};

export const publicApi = {
  config: () => apiDirect<{ config: PublicConfig }>("/api/public/config"),
  joinWaitlist: (payload: { name: string; email: string; source?: string; requestedPlan?: string }) =>
    apiDirect<WaitlistSignupResponse>("/api/public/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
};

export const teamApi = {
  getSettings: () => api<{ settings: TeamSettings }>("/api/team/settings"),
  updateSettings: (teamName: string) =>
    api<{ team: AuthTeam }>("/api/team/settings", {
      method: "PATCH",
      body: JSON.stringify({ teamName }),
    }),
  invite: (email: string, role: "admin" | "editor" | "reader" = "editor") =>
    api<{ invitation: TeamInvitation }>("/api/team/invitations", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  acceptInvitation: (invitationCode: string) =>
    api<{ session: AuthSession }>("/api/team/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ invitationCode }),
    }),
  updateMemberRole: (userId: string, role: "owner" | "admin" | "editor" | "reader") =>
    api<{ member: TeamMember }>(`/api/team/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  removeMember: (userId: string) =>
    api<void>(`/api/team/members/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),
  cancelInvitation: (invitationCode: string) =>
    api<void>(`/api/team/invitations/${encodeURIComponent(invitationCode)}`, {
      method: "DELETE",
    }),
};

export const billingApi = {
  status: () => api<{ team: AuthTeam }>("/api/billing/status"),
  checkout: (plan: "personal" | "pro_trial" | "pro" | "enterprise") =>
    api<BillingCheckoutResponse>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),
  portal: () =>
    api<BillingPortalResponse>("/api/billing/portal", {
      method: "POST",
    }),
  endTrial: () =>
    api<BillingTrialEndResponse>("/api/billing/trial/end", {
      method: "POST",
    }),
  store: () => api<StoreCatalogResponse>("/api/billing/store"),
  storeCheckout: (payload: { itemId: string; board?: string }) =>
    api<StoreCheckoutResponse>("/api/billing/store/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const taskApi = {
  list: (params?: { limit?: number; cursor?: number }) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) {
      query.set("limit", String(params.limit));
    }
    if (params?.cursor !== undefined) {
      query.set("cursor", String(params.cursor));
    }
    const suffix = query.toString();
    const path = suffix ? `/api/tasks?${suffix}` : "/api/tasks";
    return api<TaskListResponse>(path);
  },
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
  create: (payload: { id?: string; name: string; isFavorite?: boolean }) =>
    api<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, payload: { name?: string; isFavorite?: boolean }) =>
    api<Project>(`/api/projects/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    api<void>(`/api/projects/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
};

export const parseApi = {
  quickAdd: (text: string, init?: RequestInit) =>
    api<{ parsed: QuickAddParsed }>("/api/quick-add/parse", {
      ...init,
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
  listMembers: (board?: string) =>
    api<{ members: BoardMember[] }>(
      board ? `/api/board/members?board=${encodeURIComponent(board)}` : "/api/board/members",
    ),
  addMember: (userId: string, board?: string) =>
    api<{ member: BoardMember }>(
      board ? `/api/board/members?board=${encodeURIComponent(board)}` : "/api/board/members",
      {
        method: "POST",
        body: JSON.stringify({ userId }),
      },
    ),
  removeMember: (userId: string, board?: string) =>
    api<void>(
      board
        ? `/api/board/members/${encodeURIComponent(userId)}?board=${encodeURIComponent(board)}`
        : `/api/board/members/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
      },
    ),
};

export const calendarApi = {
  listConnections: () => api<{ items: CalendarConnection[] }>("/api/calendar/connections"),
  startConnect: (provider: CalendarProvider) =>
    api<{ provider: string; authUrl: string }>(`/api/calendar/connect/${encodeURIComponent(provider)}`, {
      method: "POST",
    }),
  disconnect: (id: string) =>
    api<void>(`/api/calendar/connections/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  sync: (connectionId?: string) =>
    api<CalendarSyncResponse>("/api/calendar/sync", {
      method: "POST",
      body: JSON.stringify({ connectionId }),
    }),
};

export type ApiClient = {
  public: typeof publicApi;
  auth: typeof authApi;
  team: typeof teamApi;
  billing: typeof billingApi;
  tasks: typeof taskApi;
  projects: typeof projectApi;
  parse: typeof parseApi;
  rrule: typeof rruleApi;
  board: typeof boardApi;
  calendar: typeof calendarApi;
};

export const apiClient: ApiClient = {
  public: publicApi,
  auth: authApi,
  team: teamApi,
  billing: billingApi,
  tasks: taskApi,
  projects: projectApi,
  parse: parseApi,
  rrule: rruleApi,
  board: boardApi,
  calendar: calendarApi,
};
