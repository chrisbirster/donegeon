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

test.describe("Home task action coverage", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await page.goto("/task/inbox");
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
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
