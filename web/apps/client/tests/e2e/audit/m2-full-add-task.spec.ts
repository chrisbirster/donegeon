import { expect, test } from "@playwright/test";

import { resetTasks, taskRowByContent } from "../support/api";

test.describe("M2 — full task creation mirrors the human verification sheet", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("[M2] Full Add Task", async ({ page }) => {
    const quickAdd = page.getByTestId("add-task-input");
    await expect(quickAdd, "Inline Quick Add remains the separate fast-capture path.").toBeVisible();

    const addTaskButton = page.getByRole("button", { name: /^Add Task$/i });
    await addTaskButton.click();
    const modal = page.getByTestId("task-create-modal");
    await expect(modal).toBeVisible();
    const titleInput = modal.getByTestId("task-create-title");
    await expect(titleInput).toHaveValue("");
    await expect(titleInput, "Opening a modal should move focus into its first task field.").toBeFocused();

    // Shared pickers expose combobox state and work from the keyboard.
    const projectPicker = modal.getByTestId("task-create-project");
    await projectPicker.focus();
    await projectPicker.press("ArrowDown");
    await expect(projectPicker).toHaveAttribute("aria-expanded", "true");
    await expect(modal.getByRole("listbox", { name: "Project" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(projectPicker).toHaveAttribute("aria-expanded", "false");
    await expect(projectPicker).toBeFocused();

    // Full Add Task supports the same smart title grammar as Quick Add.
    await titleInput.fill(
      "m2 full smart due tomorrow at 8pm {Friday at 8am} @m2-created-label p2 // smart description",
    );
    await expect(modal).toContainText("Label: m2-created-label");
    await expect(modal).toContainText(/Due:/);
    await expect(modal).toContainText(/Deadline:/);
    await expect(modal).toContainText("Priority: p2");
    await expect(modal).toContainText("Description detected");
    await expect(modal.getByTestId("task-create-description")).toHaveValue("smart description");
    await expect(modal.getByTestId("task-create-priority")).toContainText("P2");

    // Projects can be created and selected without leaving the full task flow.
    await projectPicker.click();
    await modal.getByRole("button", { name: /Create project/i }).click();
    await modal.getByRole("textbox", { name: /New project name/i }).fill("M2 Created In Task");
    await modal.getByRole("button", { name: /^Create$/i }).click();
    await expect(projectPicker).toContainText("M2 Created In Task");

    // Sections can be created inside the selected project and become selected immediately.
    await modal.getByTestId("task-create-section").click();
    await modal.getByRole("button", { name: /Create section/i }).click();
    await modal.getByRole("textbox", { name: /New section name/i }).fill("M2 Created Section");
    await modal.getByRole("button", { name: /^Create$/i }).click();
    await expect(modal.getByTestId("task-create-section")).toContainText("M2 Created Section");

    // Reusable labels can be created and selected in-context.
    await modal.getByTestId("task-create-tags").click();
    await modal.getByRole("button", { name: /Create label/i }).click();
    await modal.getByRole("textbox", { name: /New label name/i }).fill("m2-created-label");
    await modal.getByRole("button", { name: /Create & select/i }).click();
    await expect(modal.getByTestId("task-create-tags")).toContainText("@m2-created-label");

    await modal.getByRole("button", { name: /^Create Task$/i }).click();
    await expect(modal).toHaveCount(0);

    const project = page.getByRole("button", { name: /^M2 Created In Task\b/i }).first();
    await project.click();
    const row = taskRowByContent(page, "m2 full smart");
    await expect(row).toBeVisible();

    // The assigned section is now a visible organization surface, not hidden metadata.
    const sectionGroup = page.getByTestId("task-section-group").filter({ has: page.getByRole("heading", { name: "M2 Created Section", exact: true }) });
    await expect(sectionGroup).toContainText("m2 full smart");

    await row.getByTestId("open-task-details").click();
    const detail = page.getByTestId("task-detail-modal");
    await expect(detail.getByTestId("task-detail-description")).toHaveValue("smart description");
    await expect(detail.getByTestId("task-detail-project")).toContainText("M2 Created In Task");
    await expect(detail.getByTestId("task-detail-section")).toContainText("M2 Created Section");
    await expect(detail.getByTestId("task-detail-tags")).toContainText("@m2-created-label");
    await expect(detail.getByTestId("task-detail-priority")).toContainText("P2");
    await expect(detail.getByTestId("task-detail-due")).not.toHaveValue("");
    await expect(detail.getByTestId("task-detail-deadline")).not.toHaveValue("");

    // The fast Quick Add path still exists underneath the full editor flow.
    await detail.getByRole("button", { name: /^Close$/i }).click();
    await page.getByRole("button", { name: /^Inbox\b/i }).first().click();
    await expect(quickAdd).toBeVisible();

    // Escape closes the shared dialog and restores focus to its trigger.
    await addTaskButton.click();
    await expect(page.getByTestId("task-create-modal")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("task-create-modal")).toHaveCount(0);
    await expect(addTaskButton).toBeFocused();
  });
});
