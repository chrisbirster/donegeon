import {
  UiActionBusUnavailableError,
  dispatchApiWorkerRequest,
  isUiActionBusEnabled,
} from "../lib/uiEventBus";

export type Task = {
  id: string;
  content: string;
  description: string;
  projectId?: string;
  sectionId?: string;
  sortOrder: number;
  recurrenceRule?: string;
  scheduleInput?: string;
  labels: string[];
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
  isTeamBoard?: boolean;
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

export type BoardQuestObjective = {
  op: string;
  count?: number;
  value?: number;
  ref?: string;
  timeWindow?: string;
  baseline?: number;
  current: number;
  target: number;
  complete: boolean;
};

export type BoardQuestReward = {
  kind: string;
  currency?: string;
  amount?: number;
  tableId?: string;
  cardType?: string;
  cardCount?: number;
  cardCharge?: number;
  xp?: number;
};

export type BoardQuestUnlock = {
  kind: string;
  id: string;
};

export type BoardQuestRuntime = {
  id: string;
  templateId?: string;
  title: string;
  type: string;
  scope: string;
  day?: number;
  week?: number;
  howToComplete?: string;
  definitionOfDone?: string;
  acceptanceCriteria?: string[];
  objectives?: BoardQuestObjective[];
  rewards?: BoardQuestReward[];
  unlocks?: BoardQuestUnlock[];
  completed: boolean;
  claimable: boolean;
  claimed: boolean;
  failed?: boolean;
  completedDay?: number;
  claimedDay?: number;
};

export type BoardQuestHistoryEntry = {
  id: string;
  templateId?: string;
  title: string;
  type: string;
  scope: string;
  day?: number;
  week?: number;
  howToComplete?: string;
  definitionOfDone?: string;
  acceptanceCriteria?: string[];
  completed: boolean;
  claimed: boolean;
  failed?: boolean;
  completedDay?: number;
  claimedDay?: number;
};

export type BoardQuestState = {
  currentDay?: number;
  currentWeek?: number;
  dailyStreak?: number;
  lastDailyRefreshDay?: number;
  lastDailyClaimDay?: number;
  recentDailyTemplateIds?: string[];
  active?: BoardQuestRuntime[];
  history?: BoardQuestHistoryEntry[];
  unlocked?: BoardQuestUnlock[];
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
  quests?: BoardQuestState;
};

export type BoardStateResponse = {
  stacks: Record<string, BoardStack>;
  cards: Record<string, BoardCard>;
  meta?: BoardMeta;
  version: string;
};

export type TaskListResponse = {
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

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  showOnboarding: boolean;
  currentWorkspaceId?: string;
};

export type AuthTeam = {
  id: string;
  name: string;
  plan: string;
  trialEndsAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  isArchived: boolean;
};

export type TeamMember = {
  workspaceId: string;
  userId: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "editor" | "reader";
  createdAt: string;
};

export type TeamInvitation = {
  invitationCode: string;
  workspaceId: string;
  email: string;
  role: "admin" | "editor" | "reader";
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type InvitationForLogin = {
  invitationCode: string;
  email: string;
  teamName: string;
  status: string;
};

export type CompleteOnboardingInput = {
  personalBoardName: string;
  teamBoardName?: string;
  name: string;
  emails: string[];
  plan?: string;
};

export type TeamSettings = {
  team: AuthTeam;
  members: TeamMember[];
  invitations: TeamInvitation[];
  currentUserId: string;
  currentUserRole: "owner" | "admin" | "editor" | "reader";
  canManage: boolean;
};

export type CalendarProvider = "google";

export type CalendarConnection = {
  id: string;
  provider: CalendarProvider | string;
  externalAccountId?: string;
  email: string;
  scope?: string;
  calendarId: string;
  expiresAt?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
  hasRefreshToken: boolean;
};

export type CalendarSyncResult = {
  connectionId: string;
  provider: string;
  pulled: number;
  error?: string;
};

export type CalendarSyncResponse = {
  results: CalendarSyncResult[];
};

export type BoardMember = TeamMember;

export type BillingCheckoutResponse = {
  mode: "trial_started" | "stripe_checkout" | "contact_sales";
  checkoutUrl?: string;
  contactUrl?: string;
  team?: AuthTeam;
};

export type AuthSession = {
  user: AuthUser;
  team?: AuthTeam;
};

export type LoginCodeRequestResponse = {
  challengeId: string;
  expiresAt: string;
  delivery: string;
  debugCode?: string;
  deliveryWarning?: string;
};

type UpdateTaskPayload = {
  content?: string;
  description?: string;
  projectId?: string;
  sectionId?: string;
  sortOrder?: number;
  recurrenceRule?: string;
  scheduleInput?: string;
  labels?: string[];
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

  if (isUiActionBusEnabled()) {
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
