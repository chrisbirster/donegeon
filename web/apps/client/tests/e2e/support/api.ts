import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

const TASK_TIMEZONE_HEADERS = {
  "X-Timezone": "America/New_York",
};

export type TaskRecord = {
  id: string;
  content: string;
  description?: string;
  projectId?: string;
  dueText?: string;
  dueDeadline?: string;
  recurrenceRule?: string;
  priority?: number;
  checked: boolean;
  isDeleted?: boolean;
  labels: string[];
};

type TaskListResponse = {
  items: TaskRecord[];
  nextCursor?: number | null;
};

export type BoardStateResponse = {
  version: string;
  stacks: Record<string, { id: string; cards: string[]; pos?: { x: number; y: number }; z?: number }>;
  cards: Record<string, { id: string; defId: string; data?: Record<string, unknown> }>;
  meta?: {
    dayTickCount?: number;
    metrics?: Record<string, number>;
    quests?: {
      currentDay?: number;
      currentWeek?: number;
    };
    villagers?: Record<
      string,
      {
        stamina?: number;
        xp?: number;
        level?: number;
        perks?: string[];
      }
    >;
  };
};

type TaskCreateInput = {
  content: string;
  description?: string;
  projectId?: string;
  recurrenceRule?: string;
  priority?: number;
  dueText?: string;
  dueDeadline?: string;
  scheduleInput?: string;
  labels?: string[];
};

type TaskUpdateInput = Partial<TaskCreateInput>;

type TeamInvitationResponse = {
  invitation: {
    invitationCode: string;
  };
};

type LoginCodeRequestResponse = {
  challengeId: string;
  debugCode?: string;
};

export async function resetTasks(request: APIRequestContext) {
  const response = await request.get("/api/tasks");
  expect(response.ok()).toBeTruthy();

  const data = (await response.json()) as TaskListResponse;
  for (const item of data.items) {
    const removeResponse = await request.delete(`/api/tasks/${item.id}`);
    expect(removeResponse.ok()).toBeTruthy();
  }
}

export async function getBoardState(
  request: APIRequestContext,
  boardID = "default",
): Promise<BoardStateResponse> {
  const response = await request.get(`/api/board/state?board=${encodeURIComponent(boardID)}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as BoardStateResponse;
}

export async function seedDefaultBoard(request: APIRequestContext, boardID = "default") {
  await runBoardCommand(request, "board.seed_default", {}, boardID);
  return getBoardState(request, boardID);
}

export async function runBoardCommand(
  request: APIRequestContext,
  cmd: string,
  args: Record<string, unknown> = {},
  boardID = "default",
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const state = await getBoardState(request, boardID);
    const response = await request.post(`/api/board/cmd?board=${encodeURIComponent(boardID)}`, {
      data: {
        cmd,
        args,
        clientVersion: state.version,
      },
    });

    if (response.status() === 409) {
      continue;
    }

    expect(response.ok()).toBeTruthy();
    return response;
  }

  throw new Error(`failed to run board command "${cmd}" after 10 retries`);
}

export async function resetBoard(request: APIRequestContext) {
  for (let iteration = 0; iteration < 200; iteration += 1) {
    const state = await getBoardState(request);
    const [stack] = Object.values(state.stacks);
    if (!stack) return;

    const response = await request.post("/api/board/cmd?board=default", {
      data: {
        cmd: "stack.remove",
        args: { stackId: stack.id },
        clientVersion: state.version,
      },
    });

    if (response.status() === 409) {
      continue;
    }
    expect(response.ok()).toBeTruthy();
  }

  throw new Error("failed to clear board stacks within 200 iterations");
}

export async function advanceBoardDays(
  request: APIRequestContext,
  days: number,
  boardID = "default",
): Promise<BoardStateResponse> {
  const wholeDays = Math.max(0, Math.trunc(days));
  for (let day = 0; day < wholeDays; day += 1) {
    await runBoardCommand(request, "world.end_day", {}, boardID);
  }
  return getBoardState(request, boardID);
}

export async function listTasks(
  request: APIRequestContext,
  options: { limit?: number; projectId?: string } = {},
) {
  const searchParams = new URLSearchParams();
  if (options.limit) searchParams.set("limit", String(options.limit));
  if (options.projectId) searchParams.set("projectId", options.projectId);

  const suffix = searchParams.toString();
  const response = await request.get(`/api/tasks${suffix ? `?${suffix}` : ""}`, {
    headers: TASK_TIMEZONE_HEADERS,
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as TaskListResponse;
}

export async function createTask(request: APIRequestContext, input: TaskCreateInput) {
  const response = await request.post("/api/tasks", {
    data: input,
    headers: TASK_TIMEZONE_HEADERS,
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as TaskRecord;
}

export async function updateTask(request: APIRequestContext, taskID: string, input: TaskUpdateInput) {
  const response = await request.patch(`/api/tasks/${taskID}`, {
    data: input,
    headers: TASK_TIMEZONE_HEADERS,
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as TaskRecord;
}

export async function closeTask(request: APIRequestContext, taskID: string) {
  const response = await request.post(`/api/tasks/${taskID}/close`, {
    headers: TASK_TIMEZONE_HEADERS,
  });
  expect(response.ok()).toBeTruthy();
}

export async function inviteTeamMemberAndAccept(
  request: APIRequestContext,
  email: string,
  role: "admin" | "editor" | "reader" = "editor",
) {
  const inviteResponse = await request.post("/api/team/invitations", {
    data: { email, role },
  });
  expect(inviteResponse.ok()).toBeTruthy();
  const inviteData = (await inviteResponse.json()) as TeamInvitationResponse;
  const invitationCode = inviteData.invitation?.invitationCode;
  expect(invitationCode).toBeTruthy();

  const loginCodeResponse = await request.post("/api/auth/login/request", {
    data: { email, name: email },
  });
  expect(loginCodeResponse.ok()).toBeTruthy();
  const loginCodeData = (await loginCodeResponse.json()) as LoginCodeRequestResponse;
  expect(loginCodeData.challengeId).toBeTruthy();
  expect(loginCodeData.debugCode).toBeTruthy();

  const verifyResponse = await request.post("/api/auth/login/verify", {
    data: {
      challengeId: loginCodeData.challengeId,
      code: loginCodeData.debugCode,
      invitationCode,
    },
  });
  expect(verifyResponse.ok()).toBeTruthy();
}

export async function addQuickTask(page: Page, value: string) {
  await page.getByTestId("add-task-input").fill(value);
  await page.getByTestId("add-task-submit").click();
}

export function taskRowByContent(page: Page, content: string): Locator {
  return page.getByTestId("task-row").filter({
    has: page.getByTestId("task-content").filter({ hasText: content }),
  });
}

export async function parseCounterValue(locator: Locator): Promise<number> {
  const raw = (await locator.textContent()) ?? "";
  const parsed = Number(raw.replace(/[^\d-]/g, ""));
  if (Number.isNaN(parsed)) {
    throw new Error(`unable to parse counter value from "${raw}"`);
  }
  return parsed;
}
