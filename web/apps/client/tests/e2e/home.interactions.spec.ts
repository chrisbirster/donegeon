import { expect, test, type Page } from "@playwright/test";

import { addQuickTask, resetTasks, taskRowByContent } from "./support/api";

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

async function openMobileHomeSidebar(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  if ((await page.getByLabel("Close sidebar").count()) === 0) {
    await page.getByTestId("appshell-mobile-menu").click();
  }
  await expect(page.getByLabel("Close sidebar")).toBeVisible();
}

async function closeMobileHomeSidebar(page: Page) {
  const viewport = page.viewportSize() ?? { width: 390, height: 844 };
  await page.getByLabel("Close sidebar").click({
    force: true,
    position: { x: Math.max(1, viewport.width - 8), y: 24 },
  });
  await expect(page.getByLabel("Close sidebar")).toHaveCount(0);
}

function sidebarPanel(page: Page) {
  return page.locator("aside:visible").first();
}

function desktopSidebar(page: Page) {
  return page.locator("aside").filter({ has: page.getByRole("button", { name: "Add Task" }) }).first();
}

function viewHeading(page: Page) {
  return page.locator("section h2.text-4xl").first();
}

function viewNamePattern(name: "Inbox" | "Today" | "Upcomming") {
  if (name === "Upcomming") {
    return /^(Upcomming|Upcoming)$/i;
  }
  return new RegExp(`^${name}$`, "i");
}

function viewButtonPattern(name: "Inbox" | "Today" | "Upcomming") {
  if (name === "Upcomming") {
    return /(Upcomming|Upcoming)/i;
  }
  return new RegExp(name, "i");
}

async function expectView(page: Page, name: "Inbox" | "Today" | "Upcomming") {
  await expect(viewHeading(page)).toHaveText(viewNamePattern(name));
}

function desktopViewsNav(page: Page) {
  return desktopSidebar(page).locator("nav").first();
}

function desktopViewButton(page: Page, name: "Inbox" | "Today" | "Upcomming") {
  return desktopViewsNav(page).getByRole("button", { name: viewButtonPattern(name) }).first();
}

async function openMobileAndTapView(page: Page, name: "Inbox" | "Today" | "Upcomming") {
  await openMobileHomeSidebar(page);
  await sidebarPanel(page).getByRole("button", { name: viewButtonPattern(name) }).first().click();
}

function favoritesList(page: Page) {
  return desktopSidebar(page).locator("p", { hasText: "Favorites" }).locator("xpath=following-sibling::div[1]");
}

function myProjectsList(page: Page) {
  return desktopSidebar(page).locator("p", { hasText: "My Projects" }).locator("xpath=following-sibling::div[1]");
}

function myProjectRow(page: Page, projectTag: string) {
  return myProjectsList(page)
    .locator("div.group")
    .filter({ has: page.getByRole("button", { name: new RegExp(projectTag, "i") }) })
    .first();
}

test.describe("Home interaction coverage", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("opens and closes search with keyboard", async ({ page }) => {
    await page.getByTestId("open-search").click();
    await expect(page.getByTestId("search-input")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("search-input")).toHaveCount(0);
  });

  test("shows recurrence parsing chips while typing quick add", async ({ page }) => {
    await page.getByTestId("add-task-input").fill("pay rent every Thursday at 7pm");
    await expect(page.getByText(/Recurrence:/)).toBeVisible();
  });

  test("renders parsed quick-add chips for recurrence + due + deadline", async ({ page }) => {
    await page
      .getByTestId("add-task-input")
      .fill("another task every Thursday at 7pm due Thursday { in 2 days } p2 @chore #home");

    await expect(page.getByText(/Recurrence:/)).toBeVisible();
    await expect(page.getByText(/Due:/)).toBeVisible();
    await expect(page.getByText(/Deadline:/)).toBeVisible();
    await expect(page.getByText(/Priority: p2/i)).toBeVisible();
  });

  test("supports inline edit save with Enter", async ({ page }) => {
    await addQuickTask(page, "inline enter task");
    await expect(taskRowByContent(page, "inline enter task")).toBeVisible();
    const row = page.getByTestId("task-row").first();

    await row.hover();
    await row.getByTestId("edit-task-inline").click({ force: true });
    const input = row.locator("input").first();
    await expect(input).toBeVisible();
    await input.fill("inline enter task updated");
    await input.press("Enter");

    await expect(taskRowByContent(page, "inline enter task updated")).toBeVisible();
    await expect(row.locator("input")).toHaveCount(0);
  });

  test("supports inline edit cancel with Escape", async ({ page }) => {
    await addQuickTask(page, "inline escape task");
    await expect(taskRowByContent(page, "inline escape task")).toBeVisible();
    const row = page.getByTestId("task-row").first();

    await row.hover();
    await row.getByTestId("edit-task-inline").click({ force: true });
    const input = row.locator("input").first();
    await expect(input).toBeVisible();
    await input.fill("inline escape changed");
    await input.press("Escape");

    await expect(taskRowByContent(page, "inline escape task")).toBeVisible();
    await expect(taskRowByContent(page, "inline escape changed")).toHaveCount(0);
  });

  test("parses quick-add syntax when saving inline edit", async ({ page }) => {
    const task = `inline quickadd parse ${Date.now()}`;
    await addQuickTask(page, task);
    const row = page.getByTestId("task-row").first();
    await expect(row).toBeVisible();

    await row.hover();
    await row.getByTestId("edit-task-inline").click({ force: true });
    const input = row.locator("input").first();
    await expect(input).toBeVisible();
    await input.fill("inline parsed task every thursday at 7pm due thursday {tomorrow} p1 @home // inline parsed description");
    await input.press("Enter");

    await expect(taskRowByContent(page, "inline parsed task")).toBeVisible();
    await openTaskDetail(page, "inline parsed task");
    await expect(page.getByTestId("task-detail-description")).toHaveValue("inline parsed description");
    await expect(page.getByTestId("task-detail-tags")).toHaveValue("@home");
    await expect(page.getByTestId("task-detail-priority")).toHaveValue("1");
    await expect(page.getByTestId("task-detail-due")).not.toHaveValue("");
    await expect(page.getByTestId("task-detail-deadline")).not.toHaveValue("");
    await expect(page.getByTestId("task-detail-recurrence")).not.toHaveValue("");
  });

  test("creates a new project from task detail and persists it", async ({ page }) => {
    const projectName = `UI Project ${Date.now()}`;
    await addQuickTask(page, "detail project create task");
    await openTaskDetail(page, "detail project create task");

    await page.getByTestId("task-detail-project").selectOption("__create_new__");
    await page.getByTestId("task-detail-new-project").fill(projectName);
    await page.getByTestId("task-detail-new-project").press("Enter");

    await expect(page.getByTestId("task-detail-project")).toHaveValue(projectName);
    await expect(page.getByRole("button", { name: new RegExp(projectName, "i") })).toBeVisible();

    await page.getByTestId("task-detail-modal").getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: new RegExp(projectName, "i") }).first().click();
    await openTaskDetail(page, "detail project create task");
    await expect(page.getByTestId("task-detail-project")).toHaveValue(projectName);
  });

  test("shows schedule warning when deadline resolves before due", async ({ page }) => {
    await addQuickTask(page, "schedule warning task");
    await openTaskDetail(page, "schedule warning task");

    await page.getByTestId("task-detail-due").fill(toDatetimeLocalOffset(3, 9, 0));
    await page.getByTestId("task-detail-deadline").fill(toDatetimeLocalOffset(1, 9, 0));

    await expect(page.getByText(/Schedule check: deadline resolves before due/)).toBeVisible();
  });

  test("clears due and deadline from detail modal", async ({ page }) => {
    await addQuickTask(page, "clear schedule task");
    await openTaskDetail(page, "clear schedule task");

    await page.getByTestId("task-detail-due").fill(toDatetimeLocalOffset(2, 10, 0));
    await page.getByTestId("task-detail-deadline").fill(toDatetimeLocalOffset(1, 10, 0));
    await page.getByTestId("task-detail-save").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await openTaskDetail(page, "clear schedule task");
    const modal = page.getByTestId("task-detail-modal");
    await modal.getByTitle("Clear due date").click();
    await expect(modal.getByTestId("task-detail-due")).toHaveValue("");
    await modal.getByTitle("Clear deadline").click();
    await expect(modal.getByTestId("task-detail-deadline")).toHaveValue("");
    await page.getByTestId("task-detail-save").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await openTaskDetail(page, "clear schedule task");
    await expect(page.getByTestId("task-detail-due")).toHaveValue("");
    await expect(page.getByTestId("task-detail-deadline")).toHaveValue("");
  });

  test("marks a task complete from detail modal", async ({ page }) => {
    await addQuickTask(page, "detail completion task");
    await openTaskDetail(page, "detail completion task");
    await page.getByTestId("task-detail-mark-done").click();

    await expect(taskRowByContent(page, "detail completion task")).toHaveCount(0);
  });

  test("mobile sidebar Add button focuses composer", async ({ page }) => {
    await openMobileHomeSidebar(page);
    await sidebarPanel(page).getByRole("button", { name: "Add" }).click();
    await expect(page.getByTestId("add-task-input")).toBeFocused();
  });

  test("mobile sidebar Add button keeps empty-composer validation behavior", async ({ page }) => {
    await openMobileHomeSidebar(page);
    await sidebarPanel(page).getByRole("button", { name: "Add" }).click();
    await expect(page.getByTestId("add-task-input")).toBeFocused();
    await closeMobileHomeSidebar(page);
    await page.getByTestId("add-task-submit").click();
    await expect(page.getByTestId("task-row")).toHaveCount(0);
  });

  test("mobile sidebar Add focus is not persisted across reload", async ({ page }) => {
    await openMobileHomeSidebar(page);
    await sidebarPanel(page).getByRole("button", { name: "Add" }).click();
    await expect(page.getByTestId("add-task-input")).toBeFocused();
    await page.reload();
    await expect(page.getByTestId("add-task-input")).not.toBeFocused();
  });

  test("mobile sidebar Add button is available in responsive layout", async ({ page }) => {
    await openMobileHomeSidebar(page);
    await expect(sidebarPanel(page).getByRole("button", { name: "Add" })).toBeVisible();
  });

  test("mobile sidebar Search button opens search modal", async ({ page }) => {
    await openMobileHomeSidebar(page);
    await sidebarPanel(page).getByRole("button", { name: "Search" }).click();
    await expect(page.getByTestId("search-input")).toBeVisible();
  });

  test("mobile sidebar Search handles empty and no-match queries", async ({ page }) => {
    await openMobileHomeSidebar(page);
    await sidebarPanel(page).getByRole("button", { name: "Search" }).click();

    await expect(page.getByTestId("search-input")).toBeVisible();
    await expect(page.getByText("Type to search.")).toBeVisible();
    await page.getByTestId("search-input").fill("no-match-query-value");
    await expect(page.getByText("No matching open tasks.")).toBeVisible();
  });

  test("search modal state is cleared after reload and mobile Search remains available", async ({ page }) => {
    await page.getByTestId("open-search").click();
    await expect(page.getByTestId("search-input")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("search-input")).toHaveCount(0);

    await openMobileHomeSidebar(page);
    await expect(sidebarPanel(page).getByRole("button", { name: "Search" })).toBeVisible();
  });

  test("mobile view buttons navigate Inbox, Today, and Upcomming", async ({ page }) => {
    await addQuickTask(page, "nav today task");
    await openTaskDetail(page, "nav today task");
    await page.getByTestId("task-detail-due").fill(toDatetimeLocalOffset(0, 9, 0));
    await page.getByTestId("task-detail-save").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await openMobileAndTapView(page, "Today");
    await expectView(page, "Today");

    await openMobileAndTapView(page, "Upcomming");
    await expectView(page, "Upcomming");

    await openMobileAndTapView(page, "Inbox");
    await expectView(page, "Inbox");
  });

  test("mobile view buttons are stable when selecting the active view", async ({ page }) => {
    await expectView(page, "Inbox");
    await openMobileAndTapView(page, "Inbox");
    await expectView(page, "Inbox");

    await openMobileAndTapView(page, "Today");
    await expectView(page, "Today");
    await openMobileAndTapView(page, "Today");
    await expectView(page, "Today");

    await openMobileAndTapView(page, "Upcomming");
    await expectView(page, "Upcomming");
    await openMobileAndTapView(page, "Upcomming");
    await expectView(page, "Upcomming");
  });

  test("mobile view selection persists after reload", async ({ page }) => {
    await openMobileAndTapView(page, "Today");
    await expectView(page, "Today");
    await page.reload();
    await expectView(page, "Today");

    await openMobileAndTapView(page, "Upcomming");
    await expectView(page, "Upcomming");
    await page.reload();
    await expectView(page, "Upcomming");

    await openMobileAndTapView(page, "Inbox");
    await expectView(page, "Inbox");
    await page.reload();
    await expectView(page, "Inbox");
  });

  test("mobile project button navigates to that project and remains visible in sidebar", async ({ page }) => {
    const projectTag = `mobileproj${Date.now()}`;
    await addQuickTask(page, `mobile project nav seed #${projectTag}`);

    await openMobileHomeSidebar(page);
    const projectButton = sidebarPanel(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first();
    await expect(projectButton).toBeVisible();
    await projectButton.click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));

    await openMobileHomeSidebar(page);
    await expect(sidebarPanel(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first()).toBeVisible();
  });

  test("mobile project button is stable when clicking the active project again", async ({ page }) => {
    const projectTag = `mobileactive${Date.now()}`;
    await addQuickTask(page, `mobile project active seed #${projectTag}`);

    await openMobileHomeSidebar(page);
    const projectButton = sidebarPanel(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first();
    await projectButton.click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));

    await openMobileHomeSidebar(page);
    await projectButton.click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
  });

  test("mobile project selection persists after reload", async ({ page }) => {
    const projectTag = `mobilepersist${Date.now()}`;
    await addQuickTask(page, `mobile project persist seed #${projectTag}`);

    await openMobileHomeSidebar(page);
    await sidebarPanel(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first().click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
    await page.reload();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
  });

  test("desktop Add Task button focuses the composer", async ({ page }) => {
    await page.getByRole("button", { name: "Add Task" }).click();
    await expect(page.getByTestId("add-task-input")).toBeFocused();
  });

  test("desktop Add Task keeps empty-composer validation behavior", async ({ page }) => {
    await page.getByRole("button", { name: "Add Task" }).click();
    await expect(page.getByTestId("add-task-input")).toBeFocused();
    await page.getByTestId("add-task-submit").click();
    await expect(page.getByTestId("task-row")).toHaveCount(0);
  });

  test("desktop Add Task focus does not persist after reload and control is hidden on mobile", async ({ page }) => {
    await page.getByRole("button", { name: "Add Task" }).click();
    await expect(page.getByTestId("add-task-input")).toBeFocused();
    await page.reload();
    await expect(page.getByTestId("add-task-input")).not.toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("button", { name: "Add Task" })).toHaveCount(0);
  });

  test("desktop Search button opens search modal", async ({ page }) => {
    await page.getByTestId("open-search").click();
    await expect(page.getByTestId("search-input")).toBeVisible();
  });

  test("desktop Search button handles empty and no-match query states", async ({ page }) => {
    await page.getByTestId("open-search").click();
    await expect(page.getByText("Type to search.")).toBeVisible();
    await page.getByTestId("search-input").fill("query-with-no-results");
    await expect(page.getByText("No matching open tasks.")).toBeVisible();
  });

  test("desktop view buttons navigate Inbox, Today, and Upcomming", async ({ page }) => {
    await desktopViewButton(page, "Today").click();
    await expectView(page, "Today");

    await desktopViewButton(page, "Upcomming").click();
    await expectView(page, "Upcomming");

    await desktopViewButton(page, "Inbox").click();
    await expectView(page, "Inbox");
  });

  test("desktop view buttons are stable when selecting active view", async ({ page }) => {
    await expectView(page, "Inbox");
    await desktopViewButton(page, "Inbox").click();
    await expectView(page, "Inbox");

    await desktopViewButton(page, "Today").click();
    await expectView(page, "Today");
    await desktopViewButton(page, "Today").click();
    await expectView(page, "Today");

    await desktopViewButton(page, "Upcomming").click();
    await expectView(page, "Upcomming");
    await desktopViewButton(page, "Upcomming").click();
    await expectView(page, "Upcomming");
  });

  test("desktop view selection persists after reload", async ({ page }) => {
    await desktopViewButton(page, "Today").click();
    await expectView(page, "Today");
    await page.reload();
    await expectView(page, "Today");

    await desktopViewButton(page, "Upcomming").click();
    await expectView(page, "Upcomming");
    await page.reload();
    await expectView(page, "Upcomming");

    await desktopViewButton(page, "Inbox").click();
    await expectView(page, "Inbox");
    await page.reload();
    await expectView(page, "Inbox");
  });

  test("desktop view controls are hidden in mobile responsive layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(desktopSidebar(page)).toHaveCount(0);

    await openMobileHomeSidebar(page);
    await expect(sidebarPanel(page).getByRole("button", { name: /^Inbox\b/i }).first()).toBeVisible();
    await expect(sidebarPanel(page).getByRole("button", { name: /^Today\b/i }).first()).toBeVisible();
    await expect(sidebarPanel(page).getByRole("button", { name: /^Upcomming\b/i }).first()).toBeVisible();
  });

  test("desktop Favorites project button navigates to the project", async ({ page }) => {
    const projectTag = `deskfav${Date.now()}`;
    await addQuickTask(page, `desktop favorites seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();
    await row.getByLabel("Add favorite").click();
    await expect(row.getByLabel("Remove favorite")).toBeVisible();

    const favoritesProjectButton = favoritesList(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first();
    await expect(favoritesProjectButton).toBeVisible();
    await favoritesProjectButton.click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
  });

  test("desktop Favorites project click is stable when re-clicking the active project", async ({ page }) => {
    const projectTag = `deskfavactive${Date.now()}`;
    await addQuickTask(page, `desktop favorites active seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();
    await row.getByLabel("Add favorite").click();
    await expect(row.getByLabel("Remove favorite")).toBeVisible();

    const favoritesProjectButton = favoritesList(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first();
    await favoritesProjectButton.click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
    await favoritesProjectButton.click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
  });

  test("desktop Favorites project navigation persists after reload", async ({ page }) => {
    const projectTag = `deskfavpersist${Date.now()}`;
    await addQuickTask(page, `desktop favorites persist seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();
    await row.getByLabel("Add favorite").click();
    await expect(row.getByLabel("Remove favorite")).toBeVisible();

    await favoritesList(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first().click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
    await page.reload();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
    await expect(favoritesList(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first()).toBeVisible();
  });

  test("desktop Favorites controls are hidden in mobile layout while mobile projects remain available", async ({ page }) => {
    const projectTag = `deskfavmobile${Date.now()}`;
    await addQuickTask(page, `desktop favorites mobile seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();
    await row.getByLabel("Add favorite").click();
    await expect(row.getByLabel("Remove favorite")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(desktopSidebar(page)).toHaveCount(0);
    await openMobileHomeSidebar(page);
    await expect(sidebarPanel(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first()).toBeVisible();
  });

  test("desktop My Projects button navigates to the selected project", async ({ page }) => {
    const projectTag = `deskproj${Date.now()}`;
    await addQuickTask(page, `desktop my project seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: new RegExp(projectTag, "i") }).click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
  });

  test("desktop My Projects button is stable on active project re-click", async ({ page }) => {
    const projectTag = `deskprojactive${Date.now()}`;
    await addQuickTask(page, `desktop my project active seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();
    const projectButton = row.getByRole("button", { name: new RegExp(projectTag, "i") });
    await projectButton.click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
    await projectButton.click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
  });

  test("desktop My Projects selection persists after reload", async ({ page }) => {
    const projectTag = `deskprojpersist${Date.now()}`;
    await addQuickTask(page, `desktop my project persist seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: new RegExp(projectTag, "i") }).click();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
    await page.reload();
    await expect(viewHeading(page)).toContainText(new RegExp(projectTag, "i"));
    await expect(myProjectRow(page, projectTag)).toBeVisible();
  });

  test("desktop My Projects controls are hidden in mobile layout", async ({ page }) => {
    const projectTag = `deskprojmobile${Date.now()}`;
    await addQuickTask(page, `desktop my project mobile seed #${projectTag}`);
    await expect(myProjectRow(page, projectTag)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(desktopSidebar(page)).toHaveCount(0);
    await openMobileHomeSidebar(page);
    await expect(sidebarPanel(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first()).toBeVisible();
  });

  test("desktop favorite toggle adds project to Favorites and updates control state", async ({ page }) => {
    const projectTag = `favtoggle${Date.now()}`;
    await addQuickTask(page, `desktop favorite toggle seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();

    await row.getByLabel("Add favorite").click();
    await expect(row.getByLabel("Remove favorite")).toBeVisible();
    await expect(favoritesList(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first()).toBeVisible();
  });

  test("desktop favorite toggle shows API error and keeps previous favorite state", async ({ page }) => {
    const projectTag = `favtoggleerr${Date.now()}`;
    await addQuickTask(page, `desktop favorite toggle error seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();

    await page.route("**/api/projects/*", async (route, request) => {
      if (request.method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "favorite toggle failed" }),
        });
        return;
      }
      await route.continue();
    });

    await row.getByLabel("Add favorite").click();
    await expect(page.getByText("favorite toggle failed")).toBeVisible();
    await expect(row.getByLabel("Add favorite")).toBeVisible();
    await expect(favoritesList(page).getByRole("button", { name: new RegExp(projectTag, "i") })).toHaveCount(0);
  });

  test("desktop favorite toggle persists after reload", async ({ page }) => {
    const projectTag = `favtogglepersist${Date.now()}`;
    await addQuickTask(page, `desktop favorite toggle persist seed #${projectTag}`);
    const row = myProjectRow(page, projectTag);
    await expect(row).toBeVisible();

    await row.getByLabel("Add favorite").click();
    await expect(row.getByLabel("Remove favorite")).toBeVisible();
    await page.reload();
    await expect(myProjectRow(page, projectTag).getByLabel("Remove favorite")).toBeVisible();
    await expect(favoritesList(page).getByRole("button", { name: new RegExp(projectTag, "i") }).first()).toBeVisible();
  });

  test("desktop favorite toggle controls are hidden in mobile layout", async ({ page }) => {
    const projectTag = `favtogglemobile${Date.now()}`;
    await addQuickTask(page, `desktop favorite toggle mobile seed #${projectTag}`);
    await expect(myProjectRow(page, projectTag)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(desktopSidebar(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Add favorite|Remove favorite/i })).toHaveCount(0);
  });
});
