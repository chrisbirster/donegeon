import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { listTasks, resetTasks, taskRowByContent } from "./support/api";

async function addTask(page: Page, request: APIRequestContext, value: string, expectedContent: string) {
  await page.getByTestId("add-task-input").fill(value);
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/tasks/quick-add") && response.request().method() === "POST",
  );
  await page.getByTestId("add-task-submit").click();
  const response = await responsePromise;
  expect(response.ok()).toBeTruthy();
  const persisted = await listTasks(request, { limit: 50 });
  expect(persisted.items.some((item) => item.content === expectedContent)).toBeTruthy();
}

async function taskTitles(page: Page) {
  return page.getByTestId("task-row").getByTestId("task-content").allTextContents();
}

test.describe("M0/M1 human-audit regressions", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("new captures lead the list and restore preserves position", async ({ page, request }) => {
    await addTask(page, request, "first captured // first description", "first captured");
    await page.waitForTimeout(5);
    await addTask(page, request, "second captured @focus // second description", "second captured");
    await page.waitForTimeout(5);
    await addTask(page, request, "third captured // third description", "third captured");

    await expect.poll(() => taskTitles(page)).toEqual([
      "third captured",
      "second captured",
      "first captured",
    ]);

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
    await expect.poll(() => taskTitles(page)).toEqual([
      "third captured",
      "second captured",
      "first captured",
    ]);

    await page.reload();
    await expect.poll(() => taskTitles(page)).toEqual([
      "third captured",
      "second captured",
      "first captured",
    ]);
  });

  test("completed tasks can be intentionally reordered", async ({ page, request }) => {
    await addTask(page, request, "completed one", "completed one");
    await page.waitForTimeout(5);
    await addTask(page, request, "completed two", "completed two");

    for (const name of ["completed one", "completed two"]) {
      await taskRowByContent(page, name).getByRole("button", { name: "Complete task" }).click();
    }

    const completedRows = page.getByTestId("completed-task-row");
    await expect(completedRows).toHaveCount(2);
    await completedRows.nth(1).getByRole("button", { name: "Drag completed task to reorder" })
      .dragTo(completedRows.nth(0));

    await page.reload();
    const completedTitles = await page.getByTestId("completed-task-content").allTextContents();
    expect(completedTitles).toEqual(["completed one", "completed two"]);
  });

  test("task detail is dark themed and explains scheduling without debug state", async ({ page, request }) => {
    await addTask(page, request, "detail audit @focus", "detail audit");
    const row = taskRowByContent(page, "detail audit");
    await row.hover();
    await row.getByTestId("open-task-details").click();

    const modal = page.getByTestId("task-detail-modal");
    await expect(modal).toBeVisible();

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

  test("search palette finds descriptions, project names, and labels", async ({ page, request }) => {
    await addTask(page, request, "search target @needle // hidden context", "search target");

    await page.getByTestId("open-search").click();
    await expect(page.getByRole("region", { name: "Task search" })).toBeVisible();
    await expect(page.getByTestId("search-input")).toHaveAttribute("placeholder", "Search the dungeon...");

    await page.getByTestId("search-input").fill("needle");
    await expect(page.getByRole("button", { name: /search target/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /search target/i })).toContainText("hidden context");
  });
});
