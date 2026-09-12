import { expect, test, type Locator, type Page } from "@playwright/test";

import { addQuickTask, resetTasks, taskRowByContent } from "../support/api";

async function createProject(page: Page, name: string) {
  const addProject = page.getByRole("button", { name: /^Add project$/i });
  await expect(
    addProject,
    "M2 requires a discoverable project-create control in the Tasks UI; creating a project only as a side effect of editing a task is not sufficient.",
  ).toBeVisible();
  await addProject.click();
  const dialog = page.getByRole("dialog", { name: /project/i });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: /project name/i }).fill(name);
  await dialog.getByRole("button", { name: /^Create$/i }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^${name}\\b`, "i") }).first()).toBeVisible();
}

function projectButton(page: Page, name: string) {
  return page.getByRole("button", { name: new RegExp(`^${name}\\b`, "i") }).first();
}

async function projectActions(page: Page, name: string): Promise<Locator> {
  const actions = page.getByRole("button", { name: new RegExp(`project actions.*${name}`, "i") });
  await expect(
    actions,
    `Project ${name} must expose discoverable rename/archive/delete actions rather than requiring API knowledge.`,
  ).toBeVisible();
  await actions.click();
  return page.getByRole("menu");
}

async function renameProject(page: Page, from: string, to: string) {
  const menu = await projectActions(page, from);
  await menu.getByRole("menuitem", { name: /^Rename$/i }).click();
  const dialog = page.getByRole("dialog", { name: /rename project/i });
  await dialog.getByRole("textbox", { name: /project name/i }).fill(to);
  await dialog.getByRole("button", { name: /^Save$/i }).click();
  await expect(projectButton(page, to)).toBeVisible();
}

async function createSection(page: Page, name: string) {
  const addSection = page.getByRole("button", { name: /^Add section$/i });
  await expect(addSection, "M2 requires section management to be discoverable from a project view.").toBeVisible();
  await addSection.click();
  const dialog = page.getByRole("dialog", { name: /section/i });
  await dialog.getByRole("textbox", { name: /section name/i }).fill(name);
  await dialog.getByRole("button", { name: /^Create$/i }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

async function openTaskDetail(page: Page, content: string) {
  const row = taskRowByContent(page, content);
  await expect(row).toBeVisible();
  await row.hover();
  await row.getByTestId("open-task-details").click();
  const modal = page.getByTestId("task-detail-modal");
  await expect(modal).toBeVisible();
  return modal;
}

async function openLabelsManager(page: Page) {
  const control = page.getByRole("button", { name: /manage labels|labels/i }).first();
  await expect(control, "M2 requires a discoverable way to create, rename, and delete labels.").toBeVisible();
  await control.click();
  const dialog = page.getByRole("dialog", { name: /labels/i });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe("M2 — organization mirrors the human verification sheet", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("[M2] Create project", async ({ page }) => {
    await createProject(page, "M2 Test Project");
    await page.reload();
    await expect(projectButton(page, "M2 Test Project")).toBeVisible();
  });

  test("[M2] Rename project", async ({ page }) => {
    await createProject(page, "M2 Rename Before");
    await renameProject(page, "M2 Rename Before", "M2 Rename After");
    await page.reload();
    await expect(projectButton(page, "M2 Rename After")).toBeVisible();
    await expect(projectButton(page, "M2 Rename Before")).toHaveCount(0);
  });

  test("[M2] Favorite/unfavorite", async ({ page }, testInfo) => {
    const projectName = `M2 Favorite Project ${testInfo.retry}`;
    await createProject(page, projectName);
    const row = projectButton(page, projectName).locator("..");
    await row.getByRole("button", { name: "Add favorite" }).click();
    const favorites = page.locator("section").filter({ hasText: "Favorites" }).first();
    const favoriteProject = favorites.getByRole("button", { name: new RegExp(`^${projectName}\\b`, "i") }).first();
    await expect(favoriteProject).toBeVisible();
    await page.reload();
    await expect(favoriteProject).toBeVisible();

    const remove = favorites.getByRole("button", { name: new RegExp(`^Remove favorite ${projectName}$`, "i") });
    await expect(
      remove,
      "A favorite must be removable from the Favorites area itself; requiring the user to find the duplicate under My Projects is not discoverable enough.",
    ).toBeVisible();
    await remove.click();
    await expect(favoriteProject).toHaveCount(0);
    await page.reload();
    await expect(favoriteProject).toHaveCount(0);
  });

  test("[M2] Archive project", async ({ page }) => {
    await createProject(page, "M2 Archive Project");
    await addQuickTask(page, "m2 archive survivor #m2-archive-project");
    const menu = await projectActions(page, "M2 Archive Project");
    await menu.getByRole("menuitem", { name: /^Archive$/i }).click();
    await expect(projectButton(page, "M2 Archive Project")).toHaveCount(0);
    await page.reload();
    await expect(projectButton(page, "M2 Archive Project")).toHaveCount(0);
  });

  test("[M2] Unarchive project", async ({ page }) => {
    await createProject(page, "M2 Unarchive Project");
    let menu = await projectActions(page, "M2 Unarchive Project");
    await menu.getByRole("menuitem", { name: /^Archive$/i }).click();
    const archived = page.getByRole("button", { name: /Archived projects/i });
    await expect(archived, "Archived projects need a discoverable recovery surface.").toBeVisible();
    await archived.click();
    menu = await projectActions(page, "M2 Unarchive Project");
    await menu.getByRole("menuitem", { name: /^Unarchive$/i }).click();
    await page.reload();
    await expect(projectButton(page, "M2 Unarchive Project")).toBeVisible();
  });

  test("[M2] Delete project", async ({ page }) => {
    await createProject(page, "M2 Delete Project");
    await projectButton(page, "M2 Delete Project").click();
    await addQuickTask(page, "m2 project delete survivor // survives project deletion");
    await createSection(page, "M2 Delete Section");
    const menu = await projectActions(page, "M2 Delete Project");
    await menu.getByRole("menuitem", { name: /^Delete$/i }).click();
    const confirm = page.getByRole("dialog", { name: /delete project/i });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: /^Delete$/i }).click();
    await page.getByRole("button", { name: /^Inbox\b/i }).click();
    await page.getByTestId("open-search").click();
    await page.getByTestId("search-input").fill("m2 project delete survivor");
    const result = page.getByRole("button", { name: /m2 project delete survivor/i });
    await expect(result).toBeVisible();
    await result.click();
    const modal = page.getByTestId("task-detail-modal");
    await expect(modal.getByTestId("task-detail-project")).toHaveValue("");
    await expect(modal.getByTestId("task-detail-section")).toHaveValue("");
  });

  test("[M2] Inbox/default protection", async ({ page }) => {
    const inbox = projectButton(page, "Inbox");
    await expect(inbox).toBeVisible();
    const row = inbox.locator("..");
    await expect(row.getByRole("button", { name: /delete project/i })).toHaveCount(0);
    await expect(row.getByRole("button", { name: /archive project/i })).toHaveCount(0);
  });

  test("[M2] Create section", async ({ page }) => {
    await createProject(page, "M2 Section Project");
    await projectButton(page, "M2 Section Project").click();
    await createSection(page, "Section A");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Section A", exact: true })).toBeVisible();
  });

  test("[M2] Rename section", async ({ page }) => {
    await createProject(page, "M2 Rename Section Project");
    await projectButton(page, "M2 Rename Section Project").click();
    await createSection(page, "Section Before");
    await page.getByRole("button", { name: /section actions.*Section Before/i }).click();
    await page.getByRole("menuitem", { name: /^Rename$/i }).click();
    const dialog = page.getByRole("dialog", { name: /rename section/i });
    await dialog.getByRole("textbox", { name: /section name/i }).fill("Section After");
    await dialog.getByRole("button", { name: /^Save$/i }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Section After", exact: true })).toBeVisible();
  });

  test("[M2] Delete section", async ({ page }) => {
    await createProject(page, "M2 Delete Section Project");
    await projectButton(page, "M2 Delete Section Project").click();
    await createSection(page, "Section Delete Me");
    await addQuickTask(page, "m2 section survivor // section should clear");
    let modal = await openTaskDetail(page, "m2 section survivor");
    await modal.getByTestId("task-detail-section").selectOption({ label: "Section Delete Me" });
    await modal.getByTestId("task-detail-save").click();
    await page.getByRole("button", { name: /section actions.*Section Delete Me/i }).click();
    await page.getByRole("menuitem", { name: /^Delete$/i }).click();
    await page.getByRole("dialog", { name: /delete section/i }).getByRole("button", { name: /^Delete$/i }).click();
    modal = await openTaskDetail(page, "m2 section survivor");
    await expect(modal.getByTestId("task-detail-project")).toHaveValue(/M2 Delete Section Project/i);
    await expect(modal.getByTestId("task-detail-section")).toHaveValue("");
  });

  test("[M2] Create label", async ({ page }) => {
    const dialog = await openLabelsManager(page);
    await dialog.getByRole("button", { name: /^Add label$/i }).click();
    await dialog.getByRole("textbox", { name: /label name/i }).fill("m2-test");
    await dialog.getByRole("button", { name: /^Create$/i }).click();
    await expect(dialog.getByText("m2-test", { exact: true })).toBeVisible();
    await page.reload();
    const reopened = await openLabelsManager(page);
    await expect(reopened.getByText("m2-test", { exact: true })).toBeVisible();
  });

  test("[M2] Rename label", async ({ page }) => {
    let dialog = await openLabelsManager(page);
    await dialog.getByRole("button", { name: /^Add label$/i }).click();
    await dialog.getByRole("textbox", { name: /label name/i }).fill("m2-label-before");
    await dialog.getByRole("button", { name: /^Create$/i }).click();
    await dialog.getByRole("button", { name: /label actions.*m2-label-before/i }).click();
    await page.getByRole("menuitem", { name: /^Rename$/i }).click();
    await page.getByRole("textbox", { name: /label name/i }).fill("m2-label-after");
    await page.getByRole("button", { name: /^Save$/i }).click();
    await page.keyboard.press("Escape");
    await addQuickTask(page, "m2 labeled task @m2-label-after");
    await expect(taskRowByContent(page, "m2 labeled task")).toContainText("@m2-label-after");
    await page.reload();
    dialog = await openLabelsManager(page);
    await expect(dialog.getByText("m2-label-after", { exact: true })).toBeVisible();
  });

  test("[M2] Remove/delete label", async ({ page }) => {
    await addQuickTask(page, "m2 remove label task @m2-remove-label // keep this task");
    let modal = await openTaskDetail(page, "m2 remove label task");
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue(/m2-remove-label/);
    await modal.getByTestId("task-detail-tags").fill("");
    await modal.getByTestId("task-detail-save").click();
    await expect(taskRowByContent(page, "m2 remove label task")).toBeVisible();
    const dialog = await openLabelsManager(page);
    await dialog.getByRole("button", { name: /label actions.*m2-remove-label/i }).click();
    await page.getByRole("menuitem", { name: /^Delete$/i }).click();
    await page.reload();
    modal = await openTaskDetail(page, "m2 remove label task");
    await expect(modal.getByTestId("task-detail-tags")).not.toHaveValue(/m2-remove-label/);
  });

  test("[M2] Move task to project", async ({ page }) => {
    await createProject(page, "M2 Move Target");
    await page.getByRole("button", { name: /^Inbox\b/i }).click();
    await addQuickTask(page, "m2 move task @focus p2 // preserve movement metadata");
    let modal = await openTaskDetail(page, "m2 move task");
    await modal.getByTestId("task-detail-project").selectOption({ label: "M2 Move Target" });
    await modal.getByTestId("task-detail-save").click();
    await projectButton(page, "M2 Move Target").click();
    await expect(taskRowByContent(page, "m2 move task")).toBeVisible();
    await page.reload();
    modal = await openTaskDetail(page, "m2 move task");
    await expect(modal.getByTestId("task-detail-description")).toHaveValue("preserve movement metadata");
    await expect(modal.getByTestId("task-detail-tags")).toHaveValue("@focus");
    await expect(modal.getByTestId("task-detail-priority")).toHaveValue("2");
  });

  test("[M2] Move task to section", async ({ page }) => {
    await createProject(page, "M2 Section Move Project");
    await projectButton(page, "M2 Section Move Project").click();
    await createSection(page, "Section Alpha");
    await addQuickTask(page, "m2 section move task");
    let modal = await openTaskDetail(page, "m2 section move task");
    await modal.getByTestId("task-detail-section").selectOption({ label: "Section Alpha" });
    await modal.getByTestId("task-detail-save").click();
    await page.reload();
    modal = await openTaskDetail(page, "m2 section move task");
    await expect(modal.getByTestId("task-detail-project")).toHaveValue(/M2 Section Move Project/i);
    await expect(modal.getByTestId("task-detail-section")).toHaveValue(/Section Alpha/i);
  });

  test("[M2] Clear project", async ({ page }) => {
    await createProject(page, "M2 Clear Project");
    await projectButton(page, "M2 Clear Project").click();
    await createSection(page, "M2 Clear Section");
    await addQuickTask(page, "m2 clear placement task");
    let modal = await openTaskDetail(page, "m2 clear placement task");
    await modal.getByTestId("task-detail-section").selectOption({ label: "M2 Clear Section" });
    await modal.getByTestId("task-detail-save").click();
    modal = await openTaskDetail(page, "m2 clear placement task");
    await modal.getByTestId("task-detail-project").selectOption("");
    await modal.getByTestId("task-detail-save").click();
    await page.reload();
    await page.getByRole("button", { name: /^Inbox\b/i }).click();
    modal = await openTaskDetail(page, "m2 clear placement task");
    await expect(modal.getByTestId("task-detail-project")).toHaveValue("");
    await expect(modal.getByTestId("task-detail-section")).toHaveValue("");
  });

  test("[M2] Invalid project/section pairing", async ({ page }) => {
    await createProject(page, "M2 Pairing A");
    await projectButton(page, "M2 Pairing A").click();
    await createSection(page, "M2 Section A");
    await createProject(page, "M2 Pairing B");
    await page.getByRole("button", { name: /^Inbox\b/i }).click();
    await addQuickTask(page, "m2 invalid pairing task");
    const modal = await openTaskDetail(page, "m2 invalid pairing task");
    await modal.getByTestId("task-detail-project").selectOption({ label: "M2 Pairing B" });
    await expect(modal.getByTestId("task-detail-section").getByRole("option", { name: "M2 Section A" })).toHaveCount(0);
  });
});