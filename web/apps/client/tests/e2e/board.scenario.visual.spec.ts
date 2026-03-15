import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

import {
  advanceBoardDays,
  closeTask,
  createTask,
  getBoardState,
  listTasks,
  parseCounterValue,
  resetBoard,
  resetTasks,
  runBoardCommand,
  seedDefaultBoard,
  taskRowByContent,
  updateTask,
  type BoardStateResponse,
  type TaskRecord,
} from "./support/api";

type ScenarioTask = {
  title: string;
  description: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function offsetDateTime(daysFromNow: number, hour: number, minute: number): string {
  const target = new Date();
  target.setDate(target.getDate() + daysFromNow);
  target.setHours(hour, minute, 0, 0);

  const offsetMinutes = -target.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absoluteOffset / 60);
  const offsetRemainder = absoluteOffset % 60;

  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}:00${sign}${pad(offsetHours)}:${pad(offsetRemainder)}`;
}

function cardKind(defID: string | undefined): string {
  if (!defID) return "unknown";
  return defID.split(".", 1)[0] || "unknown";
}

function stackHasKind(state: BoardStateResponse, stackID: string, kind: string): boolean {
  const stack = state.stacks[stackID];
  if (!stack) return false;
  return stack.cards.some((cardID) => cardKind(state.cards[cardID]?.defId) === kind);
}

function firstStackIDByKind(state: BoardStateResponse, kind: string): string {
  for (const stack of Object.values(state.stacks)) {
    if (stackHasKind(state, stack.id, kind)) {
      return stack.id;
    }
  }
  throw new Error(`missing stack for kind "${kind}"`);
}

function zombieStackIDForTask(state: BoardStateResponse, taskID: string): string {
  for (const stack of Object.values(state.stacks)) {
    if (!stackHasKind(state, stack.id, "zombie")) continue;
    for (const cardID of stack.cards) {
      const card = state.cards[cardID];
      if (cardKind(card?.defId) !== "zombie") continue;
      if (String(card?.data?.taskId ?? "") === taskID) {
        return stack.id;
      }
    }
  }
  throw new Error(`missing zombie stack for task "${taskID}"`);
}

async function gotoBoardProjectTasks(page: Page) {
  await page.goto("/task/project/board");
  await expect(page.getByTestId("add-task-input")).toBeVisible();
}

async function gotoBoard(page: Page) {
  await page.goto("/board");
  await expect(page.getByTestId("board-canvas")).toBeVisible();
}

async function captureCheckpoint(page: Page, testInfo: TestInfo, name: string) {
  const screenshotPath = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach(name, { path: screenshotPath, contentType: "image/png" });
}

async function createBoardTask(
  request: APIRequestContext,
  title: string,
  description: string,
  x: number,
  y: number,
) {
  const response = await runBoardCommand(request, "task.create_blank", { x, y, title });
  const payload = (await response.json()) as {
    patch?: {
      card?: { id?: string };
      stack?: { id?: string };
    };
  };
  const taskCardID = String(payload.patch?.card?.id ?? "");
  const stackID = String(payload.patch?.stack?.id ?? "");

  expect(taskCardID).toBeTruthy();
  expect(stackID).toBeTruthy();

  await runBoardCommand(request, "task.set_description", {
    taskCardId: taskCardID,
    description,
  });

  return { stackID, taskCardID };
}

async function clearZombieForTask(request: APIRequestContext, taskID: string) {
  const state = await getBoardState(request);
  const zombieStackID = zombieStackIDForTask(state, taskID);
  const villagerStackID = firstStackIDByKind(state, "villager");
  await runBoardCommand(request, "zombie.clear", {
    zombieStackId: zombieStackID,
    villagerStackId: villagerStackID,
    targetStackId: zombieStackID,
  });
}

async function removeAllZombieStacks(request: APIRequestContext) {
  const state = await getBoardState(request);
  const zombieStackIDs = Object.values(state.stacks)
    .filter((stack) => stackHasKind(state, stack.id, "zombie"))
    .map((stack) => stack.id);

  for (const stackID of zombieStackIDs) {
    await runBoardCommand(request, "stack.remove", { stackId: stackID });
  }
}

async function gatherFirstVisibleResource(request: APIRequestContext) {
  const state = await getBoardState(request);
  const villagerStackID = firstStackIDByKind(state, "villager");
  const resourceStackID = firstStackIDByKind(state, "resource");
  await runBoardCommand(request, "resource.gather", {
    villagerStackId: villagerStackID,
    resourceStackId: resourceStackID,
    targetStackId: resourceStackID,
  });
}

async function taskByTitle(request: APIRequestContext, title: string) {
  const response = await listTasks(request, { limit: 200, projectId: "board" });
  const match = response.items.find((item) => item.content === title);
  expect(match).toBeTruthy();
  return match as TaskRecord;
}

async function createTaskViewTasks(request: APIRequestContext, tasks: ScenarioTask[], dueAssignments: Record<string, string>) {
  const created: TaskRecord[] = [];
  for (const task of tasks) {
    created.push(await createTask(request, {
      content: task.title,
      description: task.description,
      projectId: "board",
      priority: 2,
      dueDeadline: dueAssignments[task.title],
      labels: ["scenario"],
    }));
  }
  return created;
}

function scenarioTasks(prefix: string, count: number, seeds: ScenarioTask[]): ScenarioTask[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = seeds[index % seeds.length];
    return {
      title: `${seed.title} ${prefix}-${pad(index + 1)}`,
      description: seed.description,
    };
  });
}

async function createBoardTasks(request: APIRequestContext, tasks: ScenarioTask[], startX: number, startY: number) {
  for (let index = 0; index < tasks.length; index += 1) {
    const column = index % 4;
    const row = Math.floor(index / 4);
    await createBoardTask(
      request,
      tasks[index].title,
      tasks[index].description,
      startX + column * 110,
      startY + row * 42,
    );
  }
}

test.describe("Board scenario visuals", () => {
  test.beforeEach(async ({ request }) => {
    await resetTasks(request);
    await resetBoard(request);
    await seedDefaultBoard(request);
  });

  test("captures a useful typical day scenario", async ({ page, request }, testInfo) => {
    const invoiceTitle = "Send vendor invoice approval";
    const sprintTitle = "Draft sprint goals for platform team";
    const zombieTitle = "Review zombie alert UX copy";
    const boardTaskTitles = [
      "Prepare Friday demo checklist",
      "Backlog tidy for onboarding bugs",
    ];

    const created = await createTaskViewTasks(request, [
      {
        title: invoiceTitle,
        description: "Review the March invoice, add approval notes, and reply in the finance thread.",
      },
      {
        title: sprintTitle,
        description: "Write the top five goals, note dependencies, and share the draft with engineering leadership.",
      },
      {
        title: zombieTitle,
        description: "Refine the overdue-task message and the villager out-of-stamina wording.",
      },
    ], {
      [invoiceTitle]: offsetDateTime(0, 11, 30),
      [sprintTitle]: offsetDateTime(0, 16, 0),
      [zombieTitle]: offsetDateTime(-1, 15, 0),
    });

    await createBoardTasks(request, [
      {
        title: boardTaskTitles[0],
        description: "List the demo steps, confirm the owner, and record any missing assets.",
      },
      {
        title: boardTaskTitles[1],
        description: "Group duplicate onboarding issues and mark stale reports for follow-up.",
      },
    ], 360, 260);

    await gotoBoardProjectTasks(page);
    await expect(taskRowByContent(page, zombieTitle)).toBeVisible();
    await expect(taskRowByContent(page, boardTaskTitles[0])).toBeVisible();
    await captureCheckpoint(page, testInfo, "typical-day-01-task-view");

    await closeTask(request, created[0].id);
    await updateTask(request, created[1].id, { dueDeadline: offsetDateTime(1, 10, 0) });
    await updateTask(request, created[2].id, { dueDeadline: offsetDateTime(-2, 15, 0) });
    await advanceBoardDays(request, 1);
    await runBoardCommand(request, "card.spawn", {
      defId: "zombie.default",
      x: 860,
      y: 170,
      data: {
        reason: "overdue_task",
        taskId: created[2].id,
      },
    });

    await gotoBoard(page);
    await expect(page.getByTestId("board-card-title").filter({ hasText: boardTaskTitles[0] }).first()).toBeVisible();
    await expect(page.getByTestId("board-card-title").filter({ hasText: /Zombie/i }).first()).toBeVisible();
    await captureCheckpoint(page, testInfo, "typical-day-02-board-zombie");

    await clearZombieForTask(request, created[2].id);
    await closeTask(request, created[2].id);
    await removeAllZombieStacks(request);
    await page.reload();
    await expect(page.getByTestId("board-card-title").filter({ hasText: /Zombie/i })).toHaveCount(0);
    await expect
      .poll(async () => (await listTasks(request, { limit: 200, projectId: "board" })).items.filter((item) => item.checked).length)
      .toBeGreaterThanOrEqual(2);
    await captureCheckpoint(page, testInfo, "typical-day-03-board-recovery");
  });

  test("captures a useful typical week scenario", async ({ page, request }, testInfo) => {
    const taskViewSeeds = scenarioTasks("WEEK-TASK", 11, [
      {
        title: "Plan sprint board",
        description: "Break the week into must-finish outcomes and confirm dependencies.",
      },
      {
        title: "Send customer summary notes",
        description: "Write the action summary and confirm the next milestone.",
      },
      {
        title: "Review backlog labels",
        description: "Normalize stale labels and group duplicates before planning.",
      },
    ]);
    const boardSeeds = scenarioTasks("WEEK-BOARD", 7, [
      {
        title: "Refine demo checklist",
        description: "Confirm the walkthrough, owner, and known risks.",
      },
      {
        title: "Prep roadmap notes",
        description: "Capture blocked items and identify safe next steps.",
      },
    ]);

    const dueAssignments: Record<string, string> = {};
    for (let index = 0; index < taskViewSeeds.length; index += 1) {
      dueAssignments[taskViewSeeds[index].title] = offsetDateTime(index < 3 ? 0 : 3 + index, 10 + (index % 4), 0);
    }

    const createdTasks = await createTaskViewTasks(request, taskViewSeeds, dueAssignments);
    await createBoardTasks(request, boardSeeds, 320, 240);

    await gotoBoardProjectTasks(page);
    await expect(taskRowByContent(page, taskViewSeeds[0].title)).toBeVisible();
    await expect(taskRowByContent(page, boardSeeds[0].title)).toBeVisible();
    await captureCheckpoint(page, testInfo, "typical-week-01-planning");

    const boardTaskRecords = await Promise.all(boardSeeds.map((item) => taskByTitle(request, item.title)));
    const initialClosures = [
      ...createdTasks.slice(4, 11),
      ...boardTaskRecords.slice(0, 2),
    ];
    for (const item of initialClosures) {
      await closeTask(request, item.id);
    }
    await updateTask(request, createdTasks[1].id, { dueDeadline: offsetDateTime(2, 11, 0) });
    await updateTask(request, createdTasks[2].id, { dueDeadline: offsetDateTime(4, 14, 0) });
    await closeTask(request, createdTasks[3].id);
    await gatherFirstVisibleResource(request);
    await advanceBoardDays(request, 7);

    await gotoBoard(page);
    await expect.poll(() => parseCounterValue(page.getByTestId("board-day-ticks"))).toBeGreaterThanOrEqual(7);
    await expect
      .poll(async () => (await listTasks(request, { limit: 200, projectId: "board" })).items.filter((item) => item.checked).length)
      .toBeGreaterThanOrEqual(10);
    await expect(page.getByTestId("board-card-title").filter({ hasText: boardSeeds[0].title }).first()).toBeVisible();
    await captureCheckpoint(page, testInfo, "typical-week-02-closeout");
  });

  test("captures a useful typical month scenario", async ({ page, request }, testInfo) => {
    const taskViewSeeds = scenarioTasks("MONTH-TASK", 24, [
      {
        title: "Finalize stakeholder update",
        description: "Publish the weekly update with wins, risks, and outstanding asks.",
      },
      {
        title: "Clean stale task labels",
        description: "Normalize stale labels and remove duplicates before backlog review.",
      },
      {
        title: "Prepare sprint candidate list",
        description: "Pull likely next tasks into a reviewable shortlist.",
      },
      {
        title: "Close loop on deferred bugs",
        description: "Decide which deferred issues return to active planning.",
      },
    ]);
    const boardSeeds = scenarioTasks("MONTH-BOARD", 14, [
      {
        title: "Build planning deck",
        description: "Stage the next planning cards and keep the board ready for Sunday review.",
      },
      {
        title: "Refill quartermaster notes",
        description: "Track missing resources and confirm food recovery work.",
      },
      {
        title: "Polish roadmap slice",
        description: "Tighten the narrative for the next visible board milestone.",
      },
    ]);

    const dueAssignments: Record<string, string> = {};
    for (let index = 0; index < taskViewSeeds.length; index += 1) {
      dueAssignments[taskViewSeeds[index].title] = offsetDateTime(2 + index, 9 + (index % 5), 0);
    }

    const createdTasks = await createTaskViewTasks(request, taskViewSeeds, dueAssignments);
    await createBoardTasks(request, boardSeeds, 300, 220);

    await gotoBoardProjectTasks(page);
    await expect(taskRowByContent(page, taskViewSeeds[0].title)).toBeVisible();
    await expect(taskRowByContent(page, boardSeeds[0].title)).toBeVisible();
    await captureCheckpoint(page, testInfo, "typical-month-01-planning-load");

    const boardTaskRecords = await Promise.all(boardSeeds.map((item) => taskByTitle(request, item.title)));
    const overdueTasks = createdTasks.slice(0, 3);
    const initialClosures = [
      ...createdTasks.slice(9),
      ...boardTaskRecords.slice(0, 6),
    ];
    for (const item of initialClosures) {
      await closeTask(request, item.id);
    }

    for (const task of createdTasks.slice(3, 9)) {
      await updateTask(request, task.id, { dueDeadline: offsetDateTime(7, 10, 0) });
    }

    for (const task of overdueTasks) {
      await closeTask(request, task.id);
    }

    await gatherFirstVisibleResource(request);
    await gatherFirstVisibleResource(request);
    await advanceBoardDays(request, 30);

    await gotoBoard(page);
    await expect.poll(() => parseCounterValue(page.getByTestId("board-day-ticks"))).toBeGreaterThanOrEqual(30);
    await expect
      .poll(async () => (await listTasks(request, { limit: 200, projectId: "board" })).items.filter((item) => item.checked).length)
      .toBeGreaterThanOrEqual(24);
    await expect(page.getByTestId("board-card-title").filter({ hasText: boardSeeds[0].title }).first()).toBeVisible();
    await captureCheckpoint(page, testInfo, "typical-month-02-board-rollup");
  });
});
