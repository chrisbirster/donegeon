import { expect, test, type Page } from "@playwright/test";

import { addQuickTask, resetTasks, taskRowByContent } from "../support/api";

function localDateTime(daysFromNow: number, hour = 9, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, minute, 0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function openDetail(page: Page, content: string) {
  const row = taskRowByContent(page, content);
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByTestId("open-task-details").click();
  const modal = page.getByTestId("task-detail-modal");
  await expect(modal).toBeVisible();
  return modal;
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

test.describe("M6 — desktop human browser journey", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("[M6] Quick Add task", async ({ page }) => {
    await addQuickTask(page, "m6 desktop quick add");
    await expect(taskRowByContent(page, "m6 desktop quick add")).toBeVisible();
  });

  test("[M6] Metadata/detail", async ({ page }) => {
    await addQuickTask(page, "m6 metadata @focus p2 // visible metadata");
    const modal = await openDetail(page, "m6 metadata");
    await expect(modal.getByTestId("task-detail-description")).toHaveValue("visible metadata");
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue("@focus");
    await expect(modal.getByTestId("task-detail-priority")).toHaveValue("2");
  });

  test("[M6] Reload", async ({ page }) => {
    await addQuickTask(page, "m6 desktop reload // durable");
    await page.reload();
    await expect(taskRowByContent(page, "m6 desktop reload")).toBeVisible();
    await expect(taskRowByContent(page, "m6 desktop reload").getByTestId("task-description-summary")).toHaveText("durable");
  });

  test("[M6] Search", async ({ page }) => {
    await addQuickTask(page, "m6 desktop searchable // cobalt-context");
    await page.reload();
    await page.getByTestId("open-search").click();
    await page.getByTestId("search-input").fill("cobalt-context");
    await expect(page.getByRole("button", { name: /m6 desktop searchable/i })).toBeVisible();
  });

  test("[M6] Detail from search", async ({ page }) => {
    await addQuickTask(page, "m6 search detail // search-detail-context");
    await page.getByTestId("open-search").click();
    await page.getByTestId("search-input").fill("search-detail-context");
    await page.getByRole("button", { name: /m6 search detail/i }).click();
    const modal = page.getByTestId("task-detail-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId("task-detail-title")).toHaveValue("m6 search detail");
  });

  test("[M6] Scheduling controls", async ({ page }) => {
    await addQuickTask(page, "m6 scheduling controls");
    const modal = await openDetail(page, "m6 scheduling controls");
    await expect(modal.getByTestId("task-detail-due")).toBeVisible();
    await expect(modal.getByTestId("task-detail-deadline")).toBeVisible();
    await expect(modal.getByTestId("task-detail-priority")).toBeVisible();
    await expect(modal.getByTestId("task-detail-recurrence")).toBeVisible();
    await modal.getByTestId("task-detail-due").fill(localDateTime(1, 9, 0));
    await modal.getByTestId("task-detail-recurrence").fill("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO");
    await modal.getByTestId("task-detail-save").click();
    await page.reload();
    const reopened = await openDetail(page, "m6 scheduling controls");
    await expect(reopened.getByTestId("task-detail-due")).not.toHaveValue("");
    await expect(reopened.getByTestId("task-detail-recurrence")).not.toHaveValue("");
  });

  test("[M6] Complete normal task", async ({ page }) => {
    await addQuickTask(page, "m6 normal completion");
    await taskRowByContent(page, "m6 normal completion").getByRole("button", { name: "Complete task" }).click();
    await page.reload();
    await expect(page.getByTestId("completed-task-row").filter({ hasText: "m6 normal completion" })).toBeVisible();
  });

  test("[M6] Complete recurring task", async ({ page }) => {
    await addQuickTask(page, "m6 recurring completion every day at 9am");
    const modal = await openDetail(page, "m6 recurring completion");
    await modal.getByTestId("task-detail-mark-done").click();
    await page.reload();
    await expect(taskRowByContent(page, "m6 recurring completion")).toBeVisible();
    await expect(page.getByTestId("completed-task-row").filter({ hasText: "m6 recurring completion" })).toBeVisible();
  });
});

test.describe("M6 — mobile/responsive human browser journey", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("[M6] Open/close sidebar", async ({ page }) => {
    await openMobileSidebar(page);
    await closeMobileSidebar(page);
    await openMobileSidebar(page);
    await expect(page.getByLabel("Close sidebar")).toBeVisible();
  });

  test("[M6] Quick Add", async ({ page }) => {
    await addQuickTask(page, "m6 mobile quick add");
    await expect(taskRowByContent(page, "m6 mobile quick add")).toBeVisible();
  });

  test("[M6] Reload", async ({ page }) => {
    await addQuickTask(page, "m6 mobile reload");
    await page.reload();
    await expect(taskRowByContent(page, "m6 mobile reload")).toBeVisible();
  });

  test("[M6] Search", async ({ page }) => {
    await addQuickTask(page, "m6 mobile searchable // mobile-search-context");
    await openMobileSidebar(page);
    await page.locator("aside:visible").getByRole("button", { name: /Search/i }).click();
    await expect(page.getByTestId("search-input")).toBeVisible();
    await closeMobileSidebar(page);
    await page.getByTestId("search-input").fill("mobile-search-context");
    await expect(page.getByRole("button", { name: /m6 mobile searchable/i })).toBeVisible();
  });

  test("[M6] Open detail", async ({ page }) => {
    await addQuickTask(page, "m6 mobile detail @mobile p3 // readable mobile fields");
    const modal = await openDetail(page, "m6 mobile detail");
    await expect(modal.getByTestId("task-detail-title")).toBeVisible();
    await expect(modal.getByTestId("task-detail-description")).toHaveValue("readable mobile fields");
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue("@mobile");
    await expect(modal.getByTestId("task-detail-priority")).toHaveValue("3");
  });

  test("[M6] Complete task", async ({ page }) => {
    await addQuickTask(page, "m6 mobile completion");
    await taskRowByContent(page, "m6 mobile completion").getByRole("button", { name: "Complete task" }).click();
    await page.reload();
    await expect(page.getByTestId("completed-task-row").filter({ hasText: "m6 mobile completion" })).toBeVisible();
  });
});
