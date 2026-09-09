import { expect, test } from "@playwright/test";

import { resetTasks } from "../support/api";

test.describe("M2 — full task creation mirrors the human verification sheet", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("[M2] Full Add Task", async ({ page }) => {
    const quickAdd = page.getByTestId("add-task-input");
    await expect(quickAdd, "Inline Quick Add remains the separate fast-capture path.").toBeVisible();

    await page.getByRole("button", { name: /^Add Task$/i }).click();

    const modal = page.getByTestId("task-create-modal");
    await expect(
      modal,
      "The sidebar Add Task CTA must open an empty full task editor; merely focusing Quick Add is not sufficient.",
    ).toBeVisible();
    await expect(modal.getByTestId("task-create-title")).toHaveValue("");

    // The full editor is additive: Quick Add still exists underneath as the fast path.
    await expect(quickAdd).toBeVisible();
  });
});
