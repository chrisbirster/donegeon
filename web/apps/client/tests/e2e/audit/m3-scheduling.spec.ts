import { expect, test, type Page } from "@playwright/test";

import { addQuickTask, listTasks, resetTasks, taskRowByContent } from "../support/api";

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

async function setDue(page: Page, content: string, value: string) {
  const modal = await openDetail(page, content);
  await modal.getByTestId("task-detail-due").fill(value);
  await modal.getByTestId("task-detail-save").click();
}

async function setRecurrence(page: Page, content: string, rule: string) {
  const modal = await openDetail(page, content);
  await modal.getByTestId("task-detail-recurrence").fill(rule);
  await modal.getByTestId("task-detail-save").click();
}

test.describe("M3 — scheduling mirrors the human verification sheet", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("[M3] Set date-only due date", async ({ page }) => {
    await addQuickTask(page, "m3 date only due tomorrow");
    const modal = await openDetail(page, "m3 date only");
    await expect(modal.getByTestId("task-detail-due")).not.toHaveValue("");
    const before = await modal.getByTestId("task-detail-due").inputValue();
    await modal.getByRole("button", { name: "Close" }).click();
    await page.reload();
    const reopened = await openDetail(page, "m3 date only");
    await expect(reopened.getByTestId("task-detail-due")).toHaveValue(before);
  });

  test("[M3] Set due date/time", async ({ page }) => {
    await addQuickTask(page, "m3 due time");
    const expected = localDateTime(1, 20, 0);
    await setDue(page, "m3 due time", expected);
    await page.reload();
    const modal = await openDetail(page, "m3 due time");
    await expect(modal.getByTestId("task-detail-due")).toHaveValue(expected);
  });

  test("[M3] Set deadline", async ({ page }) => {
    await addQuickTask(page, "m3 deadline task");
    const due = localDateTime(1, 9, 0);
    const deadline = localDateTime(2, 17, 0);
    let modal = await openDetail(page, "m3 deadline task");
    await modal.getByTestId("task-detail-due").fill(due);
    await modal.getByTestId("task-detail-deadline").fill(deadline);
    await modal.getByTestId("task-detail-save").click();
    await page.reload();
    modal = await openDetail(page, "m3 deadline task");
    await expect(modal.getByTestId("task-detail-due")).toHaveValue(due);
    await expect(modal.getByTestId("task-detail-deadline")).toHaveValue(deadline);
    await expect(modal.getByText("Due", { exact: true })).toBeVisible();
    await expect(modal.getByText("Deadline", { exact: true })).toBeVisible();
  });

  test("[M3] Clear due date", async ({ page }) => {
    await addQuickTask(page, "m3 clear due");
    await setDue(page, "m3 clear due", localDateTime(1, 9, 0));
    let modal = await openDetail(page, "m3 clear due");
    await modal.getByTitle("Clear due date").click();
    await modal.getByTestId("task-detail-save").click();
    await page.reload();
    modal = await openDetail(page, "m3 clear due");
    await expect(modal.getByTestId("task-detail-due")).toHaveValue("");
  });

  test("[M3] Clear deadline", async ({ page }) => {
    await addQuickTask(page, "m3 clear deadline");
    let modal = await openDetail(page, "m3 clear deadline");
    await modal.getByTestId("task-detail-deadline").fill(localDateTime(2, 17, 0));
    await modal.getByTestId("task-detail-save").click();
    modal = await openDetail(page, "m3 clear deadline");
    await modal.getByTitle("Clear deadline").click();
    await modal.getByTestId("task-detail-save").click();
    await page.reload();
    modal = await openDetail(page, "m3 clear deadline");
    await expect(modal.getByTestId("task-detail-deadline")).toHaveValue("");
  });

  test("[M3] Create daily recurrence", async ({ page }) => {
    await addQuickTask(page, "m3 daily every day at 9am");
    const modal = await openDetail(page, "m3 daily");
    await expect(modal.getByTestId("task-detail-recurrence")).toHaveValue(/FREQ=DAILY/i);
  });

  test("[M3] Create weekly recurrence", async ({ page }) => {
    await addQuickTask(page, "m3 weekly every Monday at 9am");
    const modal = await openDetail(page, "m3 weekly");
    await expect(modal.getByTestId("task-detail-recurrence")).toHaveValue(/FREQ=WEEKLY/i);
  });

  test("[M3] Create monthly recurrence", async ({ page }) => {
    await addQuickTask(page, "m3 monthly every month on the 1st at 9am");
    const modal = await openDetail(page, "m3 monthly");
    await expect(modal.getByTestId("task-detail-recurrence")).toHaveValue(/FREQ=MONTHLY/i);
  });

  test("[M3] Complete recurring task", async ({ page, request }) => {
    await addQuickTask(page, "m3 recurring complete every day at 9am");
    const modal = await openDetail(page, "m3 recurring complete");
    await modal.getByTestId("task-detail-mark-done").click();
    const tasks = await listTasks(request, { limit: 50 });
    const matching = tasks.items.filter((item) => item.content === "m3 recurring complete");
    expect(matching).toHaveLength(2);
    expect(matching.filter((item) => item.checked)).toHaveLength(1);
    expect(matching.filter((item) => !item.checked)).toHaveLength(1);
  });

  test("[M3] Reload recurring result", async ({ page }) => {
    await addQuickTask(page, "m3 recurring reload every day at 9am");
    const modal = await openDetail(page, "m3 recurring reload");
    await modal.getByTestId("task-detail-mark-done").click();
    await page.reload();
    await expect(taskRowByContent(page, "m3 recurring reload")).toBeVisible();
    await expect(page.getByTestId("completed-task-row").filter({ hasText: "m3 recurring reload" })).toBeVisible();
  });

  test("[M3] Edit recurrence", async ({ page, request }) => {
    await addQuickTask(page, "m3 recurrence edit");
    await setDue(page, "m3 recurrence edit", localDateTime(1, 9, 0));
    await setRecurrence(page, "m3 recurrence edit", "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO");
    const modal = await openDetail(page, "m3 recurrence edit");
    await modal.getByTestId("task-detail-mark-done").click();
    const tasks = await listTasks(request, { limit: 50 });
    const next = tasks.items.find((item) => item.content === "m3 recurrence edit" && !item.checked);
    expect(next?.recurrenceRule).toMatch(/FREQ=WEEKLY/i);
  });

  test("[M3] Clear recurrence", async ({ page, request }) => {
    await addQuickTask(page, "m3 recurrence clear every day at 9am");
    let modal = await openDetail(page, "m3 recurrence clear");
    await modal.getByTestId("task-detail-recurrence").fill("");
    await modal.getByTestId("task-detail-save").click();
    modal = await openDetail(page, "m3 recurrence clear");
    await modal.getByTestId("task-detail-mark-done").click();
    const tasks = await listTasks(request, { limit: 50 });
    expect(tasks.items.filter((item) => item.content === "m3 recurrence clear")).toHaveLength(1);
  });

  test("[M3] Overdue task", async ({ page }) => {
    await addQuickTask(page, "m3 overdue task");
    await setDue(page, "m3 overdue task", localDateTime(-1, 9, 0));
    await page.getByRole("button", { name: /^Today\b/i }).click();
    await expect(taskRowByContent(page, "m3 overdue task")).toBeVisible();
  });

  test("[M3] Today task", async ({ page }) => {
    await addQuickTask(page, "m3 today task");
    await setDue(page, "m3 today task", localDateTime(0, 12, 0));
    await page.getByRole("button", { name: /^Today\b/i }).click();
    await expect(taskRowByContent(page, "m3 today task")).toBeVisible();
    await page.getByRole("button", { name: /^Upcoming\b/i }).click();
    await expect(taskRowByContent(page, "m3 today task")).toHaveCount(0);
  });

  test("[M3] Future task", async ({ page }) => {
    await addQuickTask(page, "m3 future task");
    await setDue(page, "m3 future task", localDateTime(3, 12, 0));
    await page.getByRole("button", { name: /^Upcoming\b/i }).click();
    await expect(taskRowByContent(page, "m3 future task")).toBeVisible();
  });

  test("[M3] Due + deadline together", async ({ page }) => {
    await addQuickTask(page, "m3 due deadline together");
    let modal = await openDetail(page, "m3 due deadline together");
    await modal.getByTestId("task-detail-due").fill(localDateTime(0, 10, 0));
    await modal.getByTestId("task-detail-deadline").fill(localDateTime(2, 18, 0));
    await modal.getByTestId("task-detail-save").click();
    await page.getByRole("button", { name: /^Today\b/i }).click();
    const row = taskRowByContent(page, "m3 due deadline together");
    await expect(row).toBeVisible();
    await expect(row).toContainText(/Due /i);
    await expect(row).toContainText(/Deadline /i);
  });
});
