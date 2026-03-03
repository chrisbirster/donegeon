import { expect, test, type Locator, type Page } from "@playwright/test";

import { resetBoard, resetTasks } from "./support/api";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function optionValueByName(selector: Locator, boardName: string) {
  const optionPattern = new RegExp(`^${escapeRegExp(boardName)}(?:\\s*\\(Team\\))?$`, "i");
  const option = selector.locator("option").filter({ hasText: optionPattern }).first();
  await expect(option).toHaveCount(1);
  const value = await option.getAttribute("value");
  expect(value).toBeTruthy();
  return value as string;
}

async function createBoardFromSidebar(page: Page, boardName: string) {
  const sidebar = page.locator("aside").first();
  const boardSection = sidebar.locator("section").first();
  await boardSection.getByPlaceholder("Sprint Board").fill(boardName);
  await boardSection.getByRole("button", { name: "Create" }).click();
  await expect(page.getByTestId("board-selector-sidebar").locator("option", { hasText: boardName })).toHaveCount(1);
}

test.describe("Profile interactions", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await resetBoard(request);
  });

  test("desktop profile board selector supports switch and reload option persistence", async ({ page }) => {
    const boardOne = `Profile Alpha ${Date.now()}`;
    const boardTwo = `Profile Beta ${Date.now()}`;

    await page.goto("/board");
    await createBoardFromSidebar(page, boardOne);
    await createBoardFromSidebar(page, boardTwo);

    await page.goto("/profile");
    const selector = page.getByTestId("profile-board-selector-desktop");
    await expect(selector).toBeVisible();

    const oneValue = await optionValueByName(selector, boardOne);
    const twoValue = await optionValueByName(selector, boardTwo);

    await selector.selectOption(oneValue);
    await expect(page).toHaveURL(new RegExp(`/profile\\?board=${escapeRegExp(oneValue)}$`));

    await selector.selectOption(twoValue);
    await expect(page).toHaveURL(new RegExp(`/profile\\?board=${escapeRegExp(twoValue)}$`));

    await page.reload();
    await expect(selector.locator("option", { hasText: boardOne })).toHaveCount(1);
    await expect(selector.locator("option", { hasText: boardTwo })).toHaveCount(1);
  });

  test("mobile profile board selector supports switch and remains usable after reload", async ({ page }) => {
    const boardName = `Profile Mobile ${Date.now()}`;
    await page.goto("/board");
    await createBoardFromSidebar(page, boardName);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/profile");
    const selector = page.getByTestId("profile-board-selector-mobile");
    await expect(selector).toBeVisible();

    const boardValue = await optionValueByName(selector, boardName);
    await selector.selectOption(boardValue);
    await expect(page).toHaveURL(new RegExp(`/profile\\?board=${escapeRegExp(boardValue)}$`));

    await page.reload();
    await expect(page.getByTestId("profile-board-selector-mobile").locator("option", { hasText: boardName })).toHaveCount(1);
    await page.getByTestId("profile-board-selector-mobile").selectOption(boardValue);
    await expect(page).toHaveURL(new RegExp(`/profile\\?board=${escapeRegExp(boardValue)}$`));
  });
});
