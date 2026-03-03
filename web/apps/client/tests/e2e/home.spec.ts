import { expect, test, type Page } from "@playwright/test";

import { addQuickTask, resetTasks, taskRowByContent } from "./support/api";

function toDatetimeLocalOffset(daysFromNow: number, hour = 9, minute = 0): string {
  const target = new Date();
  target.setDate(target.getDate() + daysFromNow);
  target.setHours(hour, minute, 0, 0);

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(target.getMinutes())}`;
}

async function setTaskDueByDetail(content: string, dueDaysFromNow: number, page: Page) {
  const row = taskRowByContent(page, content);
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByTestId("open-task-details").click();
  await expect(page.getByTestId("task-detail-modal")).toBeVisible();
  await page.getByTestId("task-detail-due").fill(toDatetimeLocalOffset(dueDaysFromNow, 9, 0));
  await page.getByTestId("task-detail-save").click();
  await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);
}

test.describe("Home task flows", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("creates, enriches, and completes a task", async ({ page }) => {
    await addQuickTask(page, "Ship release candidate");

    const createdRow = taskRowByContent(page, "Ship release candidate");
    await expect(createdRow).toBeVisible();

    await createdRow.hover();
    await createdRow.getByTestId("open-task-details").click();
    await expect(page.getByTestId("task-detail-modal")).toBeVisible();

    await page.getByTestId("task-detail-title").fill("Ship release candidate final");
    await page.getByTestId("task-detail-description").fill("Run release checklist and smoke tests.");
    await page.getByTestId("task-detail-priority").selectOption("1");
    await page.getByTestId("task-detail-due").fill(toDatetimeLocalOffset(2, 10, 0));
    await page.getByTestId("task-detail-deadline").fill(toDatetimeLocalOffset(7, 10, 0));
    await page.getByTestId("task-detail-recurrence").fill("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO");
    await page.getByTestId("task-detail-parse-rrule").click();
    await expect(page.getByText("RRULE is valid.")).toBeVisible();
    await page.getByTestId("task-detail-recurrence").fill("");
    await page.getByTestId("task-detail-save").click();

    const finalRow = taskRowByContent(page, "Ship release candidate final");
    await expect(finalRow).toBeVisible();
    await expect(finalRow).toContainText("p1");

    await finalRow.hover();
    await finalRow.getByTestId("open-task-details").click();
    await expect(page.getByTestId("task-detail-modal")).toBeVisible();
    await page.getByTestId("task-detail-mark-done").click();
    await expect(finalRow).toHaveCount(0);
    await expect(page.getByText("No open tasks in this view.")).toBeVisible();
  });

  test("supports today, upcoming, project navigation, favorites, and search", async ({ page }) => {
    await addQuickTask(page, "Today inbox task");
    await expect(taskRowByContent(page, "Today inbox task")).toBeVisible();

    await addQuickTask(page, "Later inbox task");
    await expect(taskRowByContent(page, "Later inbox task")).toBeVisible();

    await addQuickTask(page, "Alpha project task #alpha");
    await expect(taskRowByContent(page, "Alpha project task")).toHaveCount(0);

    await setTaskDueByDetail("Today inbox task", 0, page);
    await setTaskDueByDetail("Later inbox task", 3, page);

    await page.getByRole("button", { name: /Today/ }).click();
    await expect(taskRowByContent(page, "Today inbox task")).toBeVisible();
    await expect(taskRowByContent(page, "Later inbox task")).toHaveCount(0);

    await page.getByRole("button", { name: /Upcomming/ }).click();
    await expect(taskRowByContent(page, "Later inbox task")).toBeVisible();
    await expect(taskRowByContent(page, "Today inbox task")).toHaveCount(0);

    await page.getByRole("button", { name: /Inbox/ }).click();
    await expect(taskRowByContent(page, "Today inbox task")).toBeVisible();
    await expect(taskRowByContent(page, "Later inbox task")).toBeVisible();

    const alphaProjectRow = page.locator("div.group").filter({ hasText: /alpha/i }).first();
    await alphaProjectRow.getByRole("button", { name: /alpha/i }).click();
    await expect(page.getByRole("heading", { level: 2 })).toContainText(/alpha/i);
    await expect(taskRowByContent(page, "Alpha project task")).toBeVisible();

    await alphaProjectRow.getByLabel("Add favorite").click();
    await expect(alphaProjectRow.getByLabel("Remove favorite")).toBeVisible();

    await page.getByTestId("open-search").click();
    await page.getByTestId("search-input").fill("Alpha project task");
    await page.getByRole("button", { name: /Alpha project task/ }).click();
    await expect(page.getByTestId("task-detail-modal")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
  });

  test("deletes a task from the list actions", async ({ page }) => {
    await addQuickTask(page, "Task to delete");
    const row = taskRowByContent(page, "Task to delete");
    await expect(row).toBeVisible();

    await row.hover();
    await row.getByTestId("delete-task").click();
    await expect(row).toHaveCount(0);
  });
});
