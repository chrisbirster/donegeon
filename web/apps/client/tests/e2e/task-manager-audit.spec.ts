import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { listTasks, resetTasks, taskRowByContent } from "./support/api";

function toDatetimeLocalOffset(daysFromNow: number, hour = 9, minute = 0): string {
  const target = new Date();
  target.setDate(target.getDate() + daysFromNow);
  target.setHours(hour, minute, 0, 0);

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
}

async function addQuickTaskAudited(page: Page, request: APIRequestContext, value: string, expectedContent: string) {
  await page.getByTestId("add-task-input").fill(value);
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/tasks/quick-add") && response.request().method() === "POST",
  );
  await page.getByTestId("add-task-submit").click();
  const response = await responsePromise;
  const responseText = await response.text();
  expect(response.ok(), `quick add failed with HTTP ${response.status()}: ${responseText}`).toBeTruthy();

  const persisted = await listTasks(request, { limit: 50 });
  expect(
    persisted.items.some((item) => item.content === expectedContent),
    `quick add returned success but ${JSON.stringify(expectedContent)} was not persisted`,
  ).toBeTruthy();
}

async function openTaskDetail(page: Page, content: string) {
  const row = taskRowByContent(page, content);
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByTestId("open-task-details").click();
  await expect(page.getByTestId("task-detail-modal")).toBeVisible();
}

async function closeTaskDetail(page: Page) {
  await page.getByTestId("task-detail-modal").getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);
}

async function openMobileSidebar(page: Page) {
  if ((await page.getByLabel("Close sidebar").count()) === 0) {
    await page.getByTestId("appshell-mobile-menu").click();
  }
  await expect(page.getByLabel("Close sidebar")).toBeVisible();
}

async function closeMobileSidebar(page: Page) {
  const viewport = page.viewportSize() ?? { width: 390, height: 844 };
  await page.getByLabel("Close sidebar").click({
    force: true,
    position: { x: Math.max(1, viewport.width - 8), y: 24 },
  });
  await expect(page.getByLabel("Close sidebar")).toHaveCount(0);
}

async function openTaskFromSearch(page: Page, query: string, taskName: string) {
  await page.getByTestId("open-search").click();
  await page.getByTestId("search-input").fill(query);
  await page.getByRole("button", { name: new RegExp(taskName, "i") }).click();
  await expect(page.getByTestId("task-detail-modal")).toBeVisible();
}

async function taskTitles(page: Page) {
  return page.getByTestId("task-row").getByTestId("task-content").allTextContents();
}

test.describe("task-manager audit acceptance", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("desktop journey survives reload across quick add, edit/search, scheduling, completion, and recurrence", async ({ page, request }) => {
    const taskName = `audit launch ${Date.now()}`;
    const recurringName = `audit recurring ${Date.now()}`;

    await addQuickTaskAudited(page, request, `${taskName} @focus p2 // browser persistence`, taskName);
    await expect(taskRowByContent(page, taskName)).toBeVisible();

    await openTaskDetail(page, taskName);
    await expect(page.getByTestId("task-detail-description")).toHaveValue("browser persistence");
    await expect(page.getByTestId("task-detail-tags")).toHaveValue("@focus");
    await expect(page.getByTestId("task-detail-priority")).toHaveValue("2");

    await page.getByTestId("task-detail-due").fill(toDatetimeLocalOffset(1, 9, 0));
    await page.getByTestId("task-detail-save").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await page.reload();
    await openTaskFromSearch(page, "browser persistence", taskName);
    await expect(page.getByTestId("task-detail-title")).toHaveValue(taskName);
    await expect(page.getByTestId("task-detail-due")).not.toHaveValue("");
    await closeTaskDetail(page);

    await addQuickTaskAudited(page, request, `${recurringName} every day at 9am`, recurringName);
    await openTaskDetail(page, recurringName);
    await expect(page.getByTestId("task-detail-recurrence")).not.toHaveValue("");
    await page.getByTestId("task-detail-mark-done").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await page.reload();
    await expect(taskRowByContent(page, recurringName)).toBeVisible();
    const persisted = await listTasks(request, { limit: 50 });
    const recurring = persisted.items.filter((item) => item.content === recurringName);
    expect(recurring).toHaveLength(2);
    expect(recurring.filter((item) => item.checked)).toHaveLength(1);
    expect(recurring.filter((item) => !item.checked)).toHaveLength(1);

    await openTaskFromSearch(page, "browser persistence", taskName);
    await page.getByTestId("task-detail-mark-done").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);
    await page.reload();

    await page.getByTestId("open-search").click();
    await page.getByTestId("search-input").fill("browser persistence");
    await expect(page.getByRole("button", { name: new RegExp(taskName, "i") })).toHaveCount(0);
  });

  test("mobile journey supports add, persisted search/detail, and completion", async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const taskName = `mobile audit ${Date.now()}`;

    await openMobileSidebar(page);
    await page.locator("aside:visible").getByRole("button", { name: "Add" }).click();
    await expect(page.getByTestId("add-task-input")).toBeFocused();
    await closeMobileSidebar(page);

    await addQuickTaskAudited(page, request, `${taskName} @mobile p3 // mobile persisted`, taskName);
    await expect(taskRowByContent(page, taskName)).toBeVisible();

    await page.reload();
    await expect(taskRowByContent(page, taskName)).toBeVisible();

    await openMobileSidebar(page);
    await page.locator("aside:visible").getByRole("button", { name: "Search" }).click();
    await expect(page.getByTestId("search-input")).toBeVisible();
    await closeMobileSidebar(page);
    await page.getByTestId("search-input").fill("mobile persisted");
    await page.getByRole("button", { name: new RegExp(taskName, "i") }).click();

    await expect(page.getByTestId("task-detail-description")).toHaveValue("mobile persisted");
    await expect(page.getByTestId("task-detail-tags")).toHaveValue("@mobile");
    await expect(page.getByTestId("task-detail-priority")).toHaveValue("3");
    await page.getByTestId("task-detail-mark-done").click();

    await page.reload();
    await expect(taskRowByContent(page, taskName)).toHaveCount(0);
  });

  test("new captures lead the list and restore preserves position", async ({ page, request }) => {
    await addQuickTaskAudited(page, request, "first captured // first description", "first captured");
    await page.waitForTimeout(5);
    await addQuickTaskAudited(page, request, "second captured @focus // second description", "second captured");
    await page.waitForTimeout(5);
    await addQuickTaskAudited(page, request, "third captured // third description", "third captured");

    await expect.poll(() => taskTitles(page)).toEqual(["third captured", "second captured", "first captured"]);

    const second = taskRowByContent(page, "second captured");
    await expect(second.getByTestId("task-description-summary")).toHaveText("second description");

    const inputBox = await page.getByTestId("add-task-input").boundingBox();
    const rowBox = await page.getByTestId("task-row").first().boundingBox();
    expect(inputBox).not.toBeNull();
    expect(rowBox).not.toBeNull();
    expect(Math.abs((inputBox?.x ?? 0) - (rowBox?.x ?? 0))).toBeLessThanOrEqual(3);
    expect(Math.abs((inputBox?.width ?? 0) - (rowBox?.width ?? 0))).toBeLessThanOrEqual(3);

    await second.getByRole("button", { name: "Complete task" }).click();
    await expect(page.getByRole("heading", { level: 3, name: "Open" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Completed" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Completed 1/ })).toBeVisible();

    const completed = page.getByTestId("completed-task-row").filter({ hasText: "second captured" });
    await expect(completed.getByRole("button", { name: "Drag completed task to reorder" })).toBeVisible();
    await expect(completed.getByRole("button", { name: "Task details" })).toHaveText("Details");
    await expect(completed.getByTestId("reopen-task")).toHaveText("Restore");

    await completed.getByTestId("reopen-task").click();
    await expect.poll(() => taskTitles(page)).toEqual(["third captured", "second captured", "first captured"]);

    await page.reload();
    await expect.poll(() => taskTitles(page)).toEqual(["third captured", "second captured", "first captured"]);
  });

  test("task detail is themed and explains scheduling without debug storage text", async ({ page, request }) => {
    await addQuickTaskAudited(page, request, "detail audit @focus", "detail audit");
    await openTaskDetail(page, "detail audit");

    const modal = page.getByTestId("task-detail-modal");
    for (const testID of [
      "task-detail-project",
      "task-detail-tags",
      "task-detail-priority",
      "task-detail-schedule-original",
      "task-detail-recurrence",
    ]) {
      const background = await modal.getByTestId(testID).evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(background).not.toBe("rgb(255, 255, 255)");
    }

    const dueLabel = modal.getByText("Due", { exact: true });
    const deadlineLabel = modal.getByText("Deadline", { exact: true });
    expect(await dueLabel.evaluate((element) => getComputedStyle(element, "::after").content)).toContain("Scheduled for");
    expect(await deadlineLabel.evaluate((element) => getComputedStyle(element, "::after").content)).toContain("Must be finished by");
    await expect(modal.getByText(/^Stored:/)).toHaveCount(0);
  });

  test("search palette finds labels and previews description context", async ({ page, request }) => {
    await addQuickTaskAudited(page, request, "search target @needle // hidden context", "search target");

    await page.getByTestId("open-search").click();
    await expect(page.getByRole("region", { name: "Task search" })).toBeVisible();
    await expect(page.getByTestId("search-input")).toHaveAttribute("placeholder", "Search the dungeon...");

    await page.getByTestId("search-input").fill("needle");
    const result = page.getByRole("button", { name: /search target/i });
    await expect(result).toBeVisible();
    await expect(result).toContainText("hidden context");
  });
});
