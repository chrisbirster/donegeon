import { expect, test, type Page } from "@playwright/test";

import { addQuickTask, listTasks, resetTasks, taskRowByContent } from "../support/api";

async function openDetail(page: Page, content: string) {
  const row = taskRowByContent(page, content);
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByTestId("open-task-details").click();
  await expect(page.getByTestId("task-detail-modal")).toBeVisible();
  return page.getByTestId("task-detail-modal");
}

async function openTaskTitles(page: Page) {
  return page.getByTestId("task-row").getByTestId("task-content").allTextContents();
}

test.describe("M1 — core lifecycle mirrors the human verification sheet", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("[M1] Create task", async ({ page }) => {
    await addQuickTask(page, "m1 create task");
    await expect(taskRowByContent(page, "m1 create task")).toBeVisible();
  });

  test("[M1] Reload after create", async ({ page }) => {
    await addQuickTask(page, "m1 reload create");
    await expect(taskRowByContent(page, "m1 reload create")).toBeVisible();
    await page.reload();
    await expect(taskRowByContent(page, "m1 reload create")).toBeVisible();
  });

  test("[M1] Open task detail", async ({ page }) => {
    await addQuickTask(page, "m1 detail @focus p2 // detail description");
    const modal = await openDetail(page, "m1 detail");
    await expect(modal.getByTestId("task-detail-title")).toHaveValue("m1 detail");
    await expect(modal.getByTestId("task-detail-description")).toHaveValue("detail description");
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue("@focus");
    await expect(modal.getByTestId("task-detail-priority")).toHaveValue("2");
  });

  test("[M1] Edit title", async ({ page }) => {
    await addQuickTask(page, "m1 old title");
    const modal = await openDetail(page, "m1 old title");
    await modal.getByTestId("task-detail-title").fill("m1 new title");
    await modal.getByTestId("task-detail-save").click();
    await expect(taskRowByContent(page, "m1 new title")).toBeVisible();
    await page.reload();
    await expect(taskRowByContent(page, "m1 new title")).toBeVisible();
    await expect(taskRowByContent(page, "m1 old title")).toHaveCount(0);
  });

  test("[M1] Edit description", async ({ page }) => {
    await addQuickTask(page, "m1 description task");
    const modal = await openDetail(page, "m1 description task");
    await modal.getByTestId("task-detail-description").fill("m1 saved description");
    await modal.getByTestId("task-detail-save").click();
    await expect(taskRowByContent(page, "m1 description task").getByTestId("task-description-summary")).toHaveText(
      "m1 saved description",
    );
    await page.reload();
    await expect(taskRowByContent(page, "m1 description task").getByTestId("task-description-summary")).toHaveText(
      "m1 saved description",
    );
  });

  test("[M1] Cancel an edit", async ({ page }) => {
    await addQuickTask(page, "m1 cancel original");
    const row = taskRowByContent(page, "m1 cancel original");
    await row.hover();
    await row.getByTestId("edit-task-inline").click();
    const input = row.locator("input").first();
    await input.fill("m1 cancel should not save");
    await input.press("Escape");
    await expect(taskRowByContent(page, "m1 cancel original")).toBeVisible();
    await page.reload();
    await expect(taskRowByContent(page, "m1 cancel original")).toBeVisible();
    await expect(taskRowByContent(page, "m1 cancel should not save")).toHaveCount(0);
  });

  test("[M1] Complete task", async ({ page }) => {
    await addQuickTask(page, "m1 complete task");
    await taskRowByContent(page, "m1 complete task").getByRole("button", { name: "Complete task" }).click();
    await expect(taskRowByContent(page, "m1 complete task")).toHaveCount(0);
    await expect(page.getByTestId("completed-task-row").filter({ hasText: "m1 complete task" })).toBeVisible();
  });

  test("[M1] Reload after complete", async ({ page }) => {
    await addQuickTask(page, "m1 durable complete");
    await taskRowByContent(page, "m1 durable complete").getByRole("button", { name: "Complete task" }).click();
    await page.reload();
    await expect(taskRowByContent(page, "m1 durable complete")).toHaveCount(0);
    await expect(page.getByTestId("completed-task-row").filter({ hasText: "m1 durable complete" })).toBeVisible();
  });

  test("[M1] Reopen task", async ({ page }) => {
    await addQuickTask(page, "m1 reopen task @focus p2 // preserve me");
    await taskRowByContent(page, "m1 reopen task").getByRole("button", { name: "Complete task" }).click();
    const completed = page.getByTestId("completed-task-row").filter({ hasText: "m1 reopen task" });
    await completed.getByTestId("reopen-task").click();
    await expect(taskRowByContent(page, "m1 reopen task")).toBeVisible();
    await page.reload();
    const modal = await openDetail(page, "m1 reopen task");
    await expect(modal.getByTestId("task-detail-description")).toHaveValue("preserve me");
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue("@focus");
    await expect(modal.getByTestId("task-detail-priority")).toHaveValue("2");
  });

  test("[M1] Delete task", async ({ page }) => {
    await addQuickTask(page, "m1 delete task");
    const row = taskRowByContent(page, "m1 delete task");
    await row.hover();
    await row.getByTestId("delete-task").click();
    await expect(row).toHaveCount(0);
    await page.getByTestId("open-search").click();
    await page.getByTestId("search-input").fill("m1 delete task");
    await expect(page.getByRole("button", { name: /m1 delete task/i })).toHaveCount(0);
  });

  test("[M1] Reload after delete", async ({ page, request }) => {
    await addQuickTask(page, "m1 durable delete");
    const row = taskRowByContent(page, "m1 durable delete");
    await row.hover();
    await row.getByTestId("delete-task").click();
    await page.reload();
    await expect(taskRowByContent(page, "m1 durable delete")).toHaveCount(0);
    const persisted = await listTasks(request, { limit: 50 });
    expect(persisted.items.some((item) => item.content === "m1 durable delete")).toBeFalsy();
  });

  test("[M1] Reorder tasks", async ({ page }) => {
    await addQuickTask(page, "m1 order one");
    await page.waitForTimeout(5);
    await addQuickTask(page, "m1 order two");
    await page.waitForTimeout(5);
    await addQuickTask(page, "m1 order three");
    await expect.poll(() => openTaskTitles(page)).toEqual(["m1 order three", "m1 order two", "m1 order one"]);

    const rows = page.getByTestId("task-row");
    await rows.nth(2).getByRole("button", { name: "Drag to reorder" }).dragTo(rows.nth(0));
    await expect.poll(() => openTaskTitles(page)).toEqual(["m1 order one", "m1 order three", "m1 order two"]);
  });

  test("[M1] Reload after reorder", async ({ page }) => {
    await addQuickTask(page, "m1 reload order one");
    await page.waitForTimeout(5);
    await addQuickTask(page, "m1 reload order two");
    await page.waitForTimeout(5);
    await addQuickTask(page, "m1 reload order three");

    const rows = page.getByTestId("task-row");
    await rows.nth(2).getByRole("button", { name: "Drag to reorder" }).dragTo(rows.nth(0));
    const expected = ["m1 reload order one", "m1 reload order three", "m1 reload order two"];
    await expect.poll(() => openTaskTitles(page)).toEqual(expected);
    await page.reload();
    await expect.poll(() => openTaskTitles(page)).toEqual(expected);
  });

  test("[M1] Validation", async ({ page, request }) => {
    await page.getByTestId("add-task-input").fill("   ");
    await page.getByTestId("add-task-submit").click();
    await expect(page.getByTestId("task-row")).toHaveCount(0);
    const persisted = await listTasks(request, { limit: 50 });
    expect(persisted.items).toHaveLength(0);
  });
});
