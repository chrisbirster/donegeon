import { expect, test, type Page } from "@playwright/test";

import { addQuickTask, resetTasks, taskRowByContent } from "../support/api";

async function openDetail(page: Page, content: string) {
  const row = taskRowByContent(page, content);
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByTestId("open-task-details").click();
  const modal = page.getByTestId("task-detail-modal");
  await expect(modal).toBeVisible();
  return modal;
}

async function search(page: Page, query: string) {
  await page.getByTestId("open-search").click();
  const input = page.getByTestId("search-input");
  await expect(input).toBeVisible();
  await input.fill(query);
}

test.describe("M4 — Quick Add and search mirror the human verification sheet", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("[M4] Plain Quick Add", async ({ page }) => {
    await addQuickTask(page, "m4 plain capture");
    await expect(taskRowByContent(page, "m4 plain capture")).toBeVisible();
    await page.reload();
    await expect(taskRowByContent(page, "m4 plain capture")).toBeVisible();
  });

  test("[M4] Add description", async ({ page }) => {
    await addQuickTask(page, "m4 description // this is supporting context");
    const row = taskRowByContent(page, "m4 description");
    await expect(row).toBeVisible();
    await expect(row.getByTestId("task-description-summary")).toHaveText("this is supporting context");
    const modal = await openDetail(page, "m4 description");
    await expect(modal.getByTestId("task-detail-title")).toHaveValue("m4 description");
    await expect(modal.getByTestId("task-detail-description")).toHaveValue("this is supporting context");
  });

  test("[M4] Add priority", async ({ page }) => {
    await addQuickTask(page, "m4 priority p2");
    await expect(taskRowByContent(page, "m4 priority")).toContainText("p2");
    await page.reload();
    const modal = await openDetail(page, "m4 priority");
    await expect(modal.getByTestId("task-detail-priority")).toHaveValue("2");
  });

  test("[M4] Add project token", async ({ page }) => {
    await addQuickTask(page, "m4 project placement #m4-project");
    await expect(taskRowByContent(page, "m4 project placement")).toHaveCount(0);
    const project = page.getByRole("button", { name: /^m4-project\b/i }).first();
    await expect(project).toBeVisible();
    await project.click();
    await expect(taskRowByContent(page, "m4 project placement")).toBeVisible();
    await page.reload();
    await expect(taskRowByContent(page, "m4 project placement")).toBeVisible();
  });

  test("[M4] Add label token(s)", async ({ page }) => {
    await addQuickTask(page, "m4 labels @home @chore");
    const row = taskRowByContent(page, "m4 labels");
    await expect(row).toContainText("@home");
    await expect(row).toContainText("@chore");
    await page.reload();
    const modal = await openDetail(page, "m4 labels");
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue(/@home/);
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue(/@chore/);
  });

  test("[M4] Add due expression", async ({ page }) => {
    await page.getByTestId("add-task-input").fill("m4 due expression due tomorrow at 8pm");
    await expect(page.getByText(/Due:/)).toBeVisible();
    await page.getByTestId("add-task-submit").click();
    const modal = await openDetail(page, "m4 due expression");
    const due = await modal.getByTestId("task-detail-due").inputValue();
    expect(due).toMatch(/T20:00$/);
  });

  test("[M4] Add deadline", async ({ page }) => {
    await page.getByTestId("add-task-input").fill("m4 deadline { in 2 days }");
    await expect(page.getByText(/Deadline:/)).toBeVisible();
    await page.getByTestId("add-task-submit").click();
    const modal = await openDetail(page, "m4 deadline");
    await expect(modal.getByTestId("task-detail-deadline")).not.toHaveValue("");
  });

  test("[M4] Add recurrence", async ({ page }) => {
    await page.getByTestId("add-task-input").fill("m4 recurrence every day at 9am");
    await expect(page.getByText(/Recurrence:/)).toBeVisible();
    await page.getByTestId("add-task-submit").click();
    const modal = await openDetail(page, "m4 recurrence");
    await expect(modal.getByTestId("task-detail-recurrence")).toHaveValue(/FREQ=DAILY/i);
  });

  test("[M4] Combined metadata", async ({ page }) => {
    await page
      .getByTestId("add-task-input")
      .fill("m4 combined @home @chore #m4-combined p2 due tomorrow at 8pm { in 2 days } every day at 9am // combined context");
    await expect(page.getByText(/Priority: p2/i)).toBeVisible();
    await expect(page.getByText(/Due:/)).toBeVisible();
    await expect(page.getByText(/Deadline:/)).toBeVisible();
    await expect(page.getByText(/Recurrence:/)).toBeVisible();
    await page.getByTestId("add-task-submit").click();
    await page.getByRole("button", { name: /^m4-combined\b/i }).first().click();
    const modal = await openDetail(page, "m4 combined");
    await expect(modal.getByTestId("task-detail-title")).toHaveValue("m4 combined");
    await expect(modal.getByTestId("task-detail-description")).toHaveValue("combined context");
    await expect(modal.getByTestId("task-detail-priority")).toHaveValue("2");
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue(/@home/);
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue(/@chore/);
    await expect(modal.getByTestId("task-detail-due")).not.toHaveValue("");
    await expect(modal.getByTestId("task-detail-deadline")).not.toHaveValue("");
    await expect(modal.getByTestId("task-detail-recurrence")).not.toHaveValue("");
  });

  test("[M4] Upper/lower-case priority", async ({ page }) => {
    await addQuickTask(page, "m4 lower priority p2");
    await addQuickTask(page, "m4 upper priority P2");
    const lower = await openDetail(page, "m4 lower priority");
    await expect(lower.getByTestId("task-detail-priority")).toHaveValue("2");
    await lower.getByRole("button", { name: "Close" }).click();
    const upper = await openDetail(page, "m4 upper priority");
    await expect(upper.getByTestId("task-detail-priority")).toHaveValue("2");
  });

  test("[M4] Assignee-looking token", async ({ page }) => {
    await addQuickTask(page, "m4 assignee-looking +alex");
    const modal = await openDetail(page, "m4 assignee-looking");
    await expect(modal.getByText(/Assignee/i)).toHaveCount(0);
    await expect(modal.locator('[data-testid*="assignee"]')).toHaveCount(0);
  });

  test("[M4] Search by title", async ({ page }) => {
    await addQuickTask(page, "m4 unique title target");
    await search(page, "unique title target");
    await expect(page.getByRole("button", { name: /m4 unique title target/i })).toBeVisible();
  });

  test("[M4] Search by description", async ({ page }) => {
    await addQuickTask(page, "m4 description search // plutonium-lantern-context");
    await search(page, "plutonium-lantern-context");
    await expect(page.getByRole("button", { name: /m4 description search/i })).toBeVisible();
  });

  test("[M4] Search by project name", async ({ page }) => {
    await addQuickTask(page, "m4 project searchable #obsidian-vault");
    await page.getByRole("button", { name: /^Inbox\b/i }).click();
    await search(page, "obsidian-vault");
    await expect(page.getByRole("button", { name: /m4 project searchable/i })).toBeVisible();
  });

  test("[M4] Search after reload", async ({ page }) => {
    await addQuickTask(page, "m4 persisted search // reload-search-context");
    await page.reload();
    await search(page, "reload-search-context");
    await expect(page.getByRole("button", { name: /m4 persisted search/i })).toBeVisible();
  });

  test("[M4] No-match search", async ({ page }) => {
    await search(page, "definitely-no-task-matches-this-phrase");
    await expect(page.getByRole("region", { name: "Task search" })).toBeVisible();
    await expect(page.getByRole("button", { name: /definitely-no-task/i })).toHaveCount(0);
    await expect(page.getByText(/no .*task|nothing .*found|no match/i).first()).toBeVisible();
  });
});
