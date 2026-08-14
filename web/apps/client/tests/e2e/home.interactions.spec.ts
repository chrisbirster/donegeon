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

  test("quick-add form submit creates a task in desktop happy path", async ({ page }) => {
    const content = `form submit desktop ${Date.now()}`;
    await page.getByTestId("add-task-input").fill(content);
    await page.getByTestId("add-task-submit").click();
    await expect(taskRowByContent(page, content)).toBeVisible();
    await expect(page.getByTestId("add-task-input")).toHaveValue("");
  });

  test("quick-add form submit no-ops on empty input (validation path)", async ({ page }) => {
    await page.getByTestId("add-task-submit").click();
    await expect(page.getByTestId("task-row")).toHaveCount(0);
    await expect(page.getByText("No open tasks in this view.")).toBeVisible();
  });

  test("quick-add submitted task remains after reload", async ({ page }) => {
    const content = `form submit reload ${Date.now()}`;
    await page.getByTestId("add-task-input").fill(content);
    await page.getByTestId("add-task-submit").click();
    await expect(taskRowByContent(page, content)).toBeVisible();

    await page.reload();
    await expect(taskRowByContent(page, content)).toBeVisible();
  });

  test("quick-add form submit works in mobile responsive layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const content = `form submit mobile ${Date.now()}`;
    await page.getByTestId("add-task-input").fill(content);
    await page.getByTestId("add-task-submit").click();
    await expect(taskRowByContent(page, content)).toBeVisible();
  });

  test("quick-add input updates content and parsed chips in desktop happy path", async ({ page }) => {
    await page.getByTestId("add-task-input").fill("input happy every Thursday at 7pm");
    await expect(page.getByTestId("add-task-input")).toHaveValue("input happy every Thursday at 7pm");
    await expect(page.getByText(/Recurrence:/)).toBeVisible();
  });

  test("quick-add input handles parser API failures without showing chips", async ({ page }) => {
    let parseCalls = 0;
    await page.route("**/api/quick-add/parse", async (route) => {
      parseCalls += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "parse failed" }),
      });
    });

    await page.getByTestId("add-task-input").fill("input error every Thursday at 7pm");
    await expect.poll(() => parseCalls, { timeout: 3000 }).toBeGreaterThan(0);
    await expect(page.getByText(/Recurrence:/)).toHaveCount(0);
    await expect(page.getByTestId("add-task-input")).toHaveValue("input error every Thursday at 7pm");
  });

  test("quick-add input value and chips reset after reload", async ({ page }) => {
    await page.getByTestId("add-task-input").fill("input reload every Thursday at 7pm");
    await expect(page.getByText(/Recurrence:/)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("add-task-input")).toHaveValue("");
    await expect(page.getByText(/Recurrence:/)).toHaveCount(0);
  });

  test("quick-add input parsing works in mobile responsive layout", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("add-task-input").fill("input mobile every Thursday at 7pm");
    await expect(page.getByText(/Recurrence:/)).toBeVisible();
  });

  test("task row click opens detail and modal can be closed by overlay and close button", async ({ page }) => {
    const content = `row click detail ${Date.now()}`;
    await addQuickTask(page, content);
    const row = taskRowByContent(page, content);
    await expect(row).toBeVisible();

    await row.click();
    await expect(page.getByTestId("task-detail-modal")).toBeVisible();
    await page.mouse.click(8, 8);
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await row.click();
    await expect(page.getByTestId("task-detail-modal")).toBeVisible();
    await page.getByTestId("task-detail-modal").getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);
  });

  test("drag handle click does not open detail and complete button does not bubble click", async ({ page }) => {
    const content = `row stop propagation ${Date.now()}`;
    await addQuickTask(page, content);
    const row = taskRowByContent(page, content);
    await expect(row).toBeVisible();

    await row.hover();
    await row.getByLabel("Drag to reorder").click({ force: true });
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await row.getByLabel("Complete task").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);
    await expect(taskRowByContent(page, content)).toHaveCount(0);
  });

  test("drag and drop task rows reorders list and persists after reload", async ({ page }) => {
    const first = `drag-alpha-${Date.now()}`;
    const second = `drag-beta-${Date.now()}`;
    const rows = page.getByTestId("task-row");
    const baselineCount = await rows.count();

    await addQuickTask(page, first);
    await expect.poll(() => rows.count()).toBe(baselineCount + 1);
    await addQuickTask(page, second);
    await expect.poll(() => rows.count()).toBe(baselineCount + 2);
    await expect(page.getByTestId("task-content").filter({ hasText: first }).first()).toBeVisible();
    await expect(page.getByTestId("task-content").filter({ hasText: second }).first()).toBeVisible();

    const rowsBefore = page.getByTestId("task-row").getByTestId("task-content");
    const topBeforeText = ((await rowsBefore.nth(0).textContent()) ?? "").trim();
    const secondBeforeText = ((await rowsBefore.nth(1).textContent()) ?? "").trim();
    expect(topBeforeText.length).toBeGreaterThan(0);
    expect(secondBeforeText.length).toBeGreaterThan(0);
    expect(topBeforeText).not.toBe(secondBeforeText);

    const sourceRow =
      topBeforeText === first
        ? taskRowByContent(page, first)
        : taskRowByContent(page, second);
    const targetRow =
      topBeforeText === first
        ? taskRowByContent(page, second)
        : taskRowByContent(page, first);
    await sourceRow.getByLabel("Drag to reorder").dragTo(targetRow);

    const rowsAfter = page.getByTestId("task-row").getByTestId("task-content");
    await expect(rowsAfter.nth(0)).toContainText(secondBeforeText);
    await expect(rowsAfter.nth(1)).toContainText(topBeforeText);

    await page.reload();
    const rowsReloaded = page.getByTestId("task-row").getByTestId("task-content");
    await expect(rowsReloaded.nth(0)).toContainText(secondBeforeText);
    await expect(rowsReloaded.nth(1)).toContainText(topBeforeText);
  });

  test("inline edit buttons save and cancel with click interactions", async ({ page }) => {
    const saveTask = `inline click save ${Date.now()}`;
    await addQuickTask(page, saveTask);
    const saveRow = taskRowByContent(page, saveTask);
    await expect(saveRow).toBeVisible();
    await saveRow.hover();
    await saveRow.getByTestId("edit-task-inline").click({ force: true });
    const saveInput = page.locator('[data-testid="task-row"] input').first();
    await saveInput.fill(`${saveTask} updated`);
    await page.getByRole("button", { name: "Save" }).first().click();
    await expect(taskRowByContent(page, `${saveTask} updated`)).toBeVisible();

    const cancelTask = `inline click cancel ${Date.now()}`;
    await addQuickTask(page, cancelTask);
    const cancelRow = taskRowByContent(page, cancelTask);
    await expect(cancelRow).toBeVisible();
    await cancelRow.hover();
    await cancelRow.getByTestId("edit-task-inline").click({ force: true });
    const cancelInput = page.locator('[data-testid="task-row"] input').first();
    await cancelInput.fill(`${cancelTask} changed`);
    await page.getByRole("button", { name: "Cancel" }).first().click();
    await expect(taskRowByContent(page, cancelTask)).toBeVisible();
    await expect(taskRowByContent(page, `${cancelTask} changed`)).toHaveCount(0);
  });

  test("row open-details action button opens detail modal", async ({ page }) => {
    const openTask = `row action open ${Date.now()}`;
    await addQuickTask(page, openTask);
    const openRow = taskRowByContent(page, openTask);
    await expect(openRow).toBeVisible();
    await openRow.hover();
    await openRow.getByTestId("open-task-details").click();
    await expect(page.getByTestId("task-detail-modal")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);
  });

  test("row delete action button removes task without opening detail modal", async ({ page }) => {
    const deleteTask = `row action delete ${Date.now()}`;
    await addQuickTask(page, deleteTask);
    const deleteRow = taskRowByContent(page, deleteTask);
    await expect(deleteRow).toBeVisible();
    await deleteRow.hover();
    await deleteRow.getByTestId("delete-task").click();
    await expect(taskRowByContent(page, deleteTask)).toHaveCount(0);
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);
  });

  test("search overlay closes on backdrop, stays open on panel click, and opens detail from results", async ({ page }) => {
    const content = `search result row ${Date.now()}`;
    await addQuickTask(page, content);

    await page.getByTestId("open-search").click();
    const input = page.getByTestId("search-input");
    await expect(input).toBeVisible();
    await input.click();
    await expect(input).toBeVisible();

    await page.mouse.click(4, 4);
    await expect(input).toHaveCount(0);

    await page.getByTestId("open-search").click();
    await page.getByTestId("search-input").fill(content);
    await page.getByRole("button", { name: new RegExp(content, "i") }).first().click();
    await expect(page.getByTestId("search-input")).toHaveCount(0);
    await expect(page.getByTestId("task-detail-modal")).toBeVisible();
  });

  test("detail modal project creation controls support enter, check, cancel, and immediate assignment", async ({ page }) => {
    const task = `detail project controls ${Date.now()}`;
    const projectByEnter = `Proj Enter ${Date.now()}`;
    const projectByCheck = `Proj Check ${Date.now()}`;
    await addQuickTask(page, task);
    await openTaskDetail(page, task);

    await page.getByTestId("task-detail-project").selectOption("__create_new__");
    const newProjectInput = page.getByTestId("task-detail-new-project");
    await expect(newProjectInput).toBeVisible();
    await newProjectInput.fill(projectByEnter);
    await newProjectInput.press("Enter");
    await expect(page.getByTestId("task-detail-project")).toHaveValue(projectByEnter);

    await page.getByTestId("task-detail-project").selectOption("__create_new__");
    const cancelInput = page.getByTestId("task-detail-new-project");
    await cancelInput.fill("to-cancel-project");
    await cancelInput.press("Escape");
    await expect(page.getByTestId("task-detail-new-project")).toHaveCount(0);

    await page.getByTestId("task-detail-project").selectOption("__create_new__");
    const checkInput = page.getByTestId("task-detail-new-project");
    await checkInput.fill(projectByCheck);
    await page.getByRole("button", { name: "✓" }).click();

    await expect(page.getByTestId("task-detail-project")).toHaveValue(projectByCheck);
    await expect(page.getByRole("button", { name: new RegExp(projectByCheck, "i") })).toBeVisible();

    await page.getByTestId("task-detail-modal").getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: new RegExp(projectByCheck, "i") }).first().click();
    await openTaskDetail(page, task);
    await expect(page.getByTestId("task-detail-project")).toHaveValue(projectByCheck);
  });

  test("detail tags/priority/due/deadline/rrule inputs save and persist", async ({ page }) => {
    const task = `detail field persist ${Date.now()}`;
    await addQuickTask(page, task);
    await openTaskDetail(page, task);

    await page.getByTestId("task-detail-tags").fill("@chore @home");
    await page.getByTestId("task-detail-priority").selectOption("1");
    await page.getByTestId("task-detail-due").fill(toDatetimeLocalOffset(3, 9, 0));
    await page.getByTestId("task-detail-deadline").fill(toDatetimeLocalOffset(4, 9, 0));
    await page.getByTestId("task-detail-recurrence").fill("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO");
    await page.getByTestId("task-detail-parse-rrule").click();
    await expect(page.getByText("RRULE is valid.")).toBeVisible();
    await page.getByTestId("task-detail-save").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await openTaskDetail(page, task);
    await expect(page.getByTestId("task-detail-tags")).toHaveValue("@chore @home");
    await expect(page.getByTestId("task-detail-priority")).toHaveValue("1");
    await expect(page.getByTestId("task-detail-due")).not.toHaveValue("");
    await expect(page.getByTestId("task-detail-deadline")).not.toHaveValue("");
    await expect(page.getByTestId("task-detail-recurrence")).toHaveValue("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO");
  });

  test("parses quick-add syntax from task detail title on save", async ({ page }) => {
    const task = `detail title quickadd ${Date.now()}`;
    await addQuickTask(page, task);
    await openTaskDetail(page, task);

    await page
      .getByTestId("task-detail-title")
      .fill("detail parsed task every thursday at 7pm due thursday {tomorrow} p2 @chore // detail parsed description");
    await page.getByTestId("task-detail-save").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await expect(taskRowByContent(page, "detail parsed task")).toBeVisible();
    await openTaskDetail(page, "detail parsed task");
    await expect(page.getByTestId("task-detail-description")).toHaveValue("detail parsed description");
    await expect(page.getByTestId("task-detail-tags")).toHaveValue("@chore");
    await expect(page.getByTestId("task-detail-priority")).toHaveValue("2");
    await expect(page.getByTestId("task-detail-due")).not.toHaveValue("");
    await expect(page.getByTestId("task-detail-deadline")).not.toHaveValue("");
    await expect(page.getByTestId("task-detail-recurrence")).not.toHaveValue("");
  });

  test("board activation make-live button handles preview and activation request", async ({ page }) => {
    let activationCalls = 0;
    await page.route("**/api/board/cmd?board=**", async (route, request) => {
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }
      const payload = request.postDataJSON() as { cmd?: string; args?: { preview?: boolean } };
      if (payload?.cmd !== "task.activate") {
        await route.continue();
        return;
      }
      activationCalls += 1;
      const preview = payload.args?.preview === true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          newVersion: `v-${Date.now()}-${activationCalls}`,
          patch: {
            taskId: "task-test",
            alreadyLive: !preview,
            activated: !preview,
            canActivate: true,
            requirements: {
              coin: { currency: "coin", required: 0, available: 1, missing: 0 },
              modifiers: [],
            },
          },
        }),
      });
    });

    const task = `board activation ${Date.now()}`;
    await addQuickTask(page, task);
    await openTaskDetail(page, task);
    const projectSelect = page.getByTestId("task-detail-project");
    const boardProjectValue = await projectSelect.locator("option").evaluateAll((options) => {
      const match = options.find((option) => option.textContent?.trim().toLowerCase().includes("board"));
      return (match as HTMLOptionElement | undefined)?.value ?? "";
    });
    expect(boardProjectValue).toBeTruthy();
    await projectSelect.selectOption(boardProjectValue);
    await page.getByTestId("task-detail-save").click();
    await expect(page.getByTestId("task-detail-modal")).toHaveCount(0);

    await page.getByRole("button", { name: /board/i }).first().click();
    await openTaskDetail(page, task);
    const activationPanel = page.getByTestId("task-detail-board-activation");
    await expect(activationPanel).toBeVisible();
    const makeLiveButton = page.getByTestId("task-detail-make-live");
    await expect(makeLiveButton).toBeVisible();
    await expect(makeLiveButton).toBeEnabled();
    await makeLiveButton.click();

    await expect.poll(() => activationCalls).toBeGreaterThan(1);
  });
});
