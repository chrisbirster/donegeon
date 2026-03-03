import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

type TaskListResponse = {
  items: Array<{ id: string }>;
};

type BoardStateResponse = {
  version: string;
  stacks: Record<string, { id: string }>;
};

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

async function getBoardState(request: APIRequestContext): Promise<BoardStateResponse> {
  const response = await request.get("/api/board/state?board=default");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as BoardStateResponse;
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
