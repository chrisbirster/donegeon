import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

type TaskListResponse = {
  items: Array<{ id: string }>;
};

type BoardStateResponse = {
  version: string;
  stacks: Record<string, { id: string }>;
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
