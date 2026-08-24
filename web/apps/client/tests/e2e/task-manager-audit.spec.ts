import { expect, test, type Page } from "@playwright/test";

import { addQuickTask, listTasks, resetTasks, taskRowByContent } from "./support/api";

function toDatetimeLocalOffset(daysFromNow: number, hour = 9, minute = 0): string {
  const target = new Date();
  target.setDate(target.getDate() + daysFromNow);
  target.setHours(hour, minute, 0, 0);

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
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

test.describe("task-manager audit acceptance", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("desktop journey survives reload across quick add, edit/search, scheduling, completion, and recurrence", async ({ page, request }) => {
    const taskName = `audit launch ${Date.now()}`;
    const recurringName = `audit recurring ${Date.now()}`;

    await addQuickTask(page, `${taskName} @focus p2 // browser persistence`);
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
    await expect(page.getByTestId("task-detail-content")).toHaveValue(taskName);
    await expect(page.getByTestId("task-detail-due")).not.toHaveValue("");
    await closeTaskDetail(page);

    await addQuickTask(page, `${recurringName} every day at 9am`);
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

  test("mobile journey supports add, persisted search/detail, and completion", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const taskName = `mobile audit ${Date.now()}`;

    await openMobileSidebar(page);
    await page.locator("aside:visible").getByRole("button", { name: "Add" }).click();
    await expect(page.getByTestId("add-task-input")).toBeFocused();
    await closeMobileSidebar(page);

    await page.getByTestId("add-task-input").fill(`${taskName} @mobile p3 // mobile persisted`);
    await page.getByTestId("add-task-submit").click();
    await expect(taskRowByContent(page, taskName)).toBeVisible();

    await page.reload();
    await expect(taskRowByContent(page, taskName)).toBeVisible();

    await openMobileSidebar(page);
    await page.locator("aside:visible").getByRole("button", { name: "Search" }).click();
    await expect(page.getByTestId("search-input")).toBeVisible();
    await page.getByTestId("search-input").fill("mobile persisted");
    await page.getByRole("button", { name: new RegExp(taskName, "i") }).click();

    await expect(page.getByTestId("task-detail-description")).toHaveValue("mobile persisted");
    await expect(page.getByTestId("task-detail-tags")).toHaveValue("@mobile");
    await expect(page.getByTestId("task-detail-priority")).toHaveValue("3");
    await page.getByTestId("task-detail-mark-done").click();

    await page.reload();
    await expect(taskRowByContent(page, taskName)).toHaveCount(0);
  });
});
