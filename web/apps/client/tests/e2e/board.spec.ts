import { expect, test, type Page } from "@playwright/test";

import { parseCounterValue, resetBoard, resetTasks } from "./support/api";

function stackByTitle(page: Page, title: string) {
  return page.getByTestId("board-stack").filter({
    has: page.getByTestId("board-card-title").filter({ hasText: title }),
  });
}

test.describe("Board stack flows", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await resetBoard(request);
    await page.goto("/board");
    await expect(page.getByRole("link", { name: "Board" })).toBeVisible();
  });

  test("creates, edits, and completes a stack task", async ({ page }) => {
    const completedBefore = await parseCounterValue(page.getByTestId("board-completed-count"));

    await page.getByTestId("board-new-stack-title").fill("Board Stack Alpha");
    await page.getByTestId("board-add-stack").click();

    const createdStack = stackByTitle(page, "Board Stack Alpha").first();
    await expect(createdStack).toBeVisible();

    await createdStack.click();
    await expect(page.getByTestId("board-detail-modal")).toBeVisible();
    await page.getByTestId("board-detail-title").fill("Board Stack Alpha Updated");
    await page.getByTestId("board-detail-description").fill("Handle grooming and final QA.");
    await page.getByTestId("board-detail-save").click();

    const updatedStack = stackByTitle(page, "Board Stack Alpha Updated").first();
    await expect(updatedStack).toBeVisible();

    await updatedStack.click();
    await page.getByTestId("board-detail-mark-done").click();
    await expect(updatedStack).toHaveCount(0);

    await expect.poll(() => parseCounterValue(page.getByTestId("board-completed-count"))).toBeGreaterThan(completedBefore);
  });

  test("opens deck packs and advances day tick", async ({ page }) => {
    const firstDayDeck = stackByTitle(page, "First Day").first();
    await expect(firstDayDeck).toBeVisible();

    const stackCountBeforeDeckOpen = await page.getByTestId("board-stack").count();
    await firstDayDeck.click();

    const packStack = page.locator('[data-testid="board-stack"][data-stack-title$="Pack"]').first();
    await expect(packStack).toBeVisible();
    await packStack.click();
    await expect(packStack).toHaveCount(0);

    await expect.poll(() => page.getByTestId("board-stack").count()).toBeGreaterThan(stackCountBeforeDeckOpen);

    const dayTicksBefore = await parseCounterValue(page.getByTestId("board-day-ticks"));
    await page.getByTestId("board-end-day").click();
    await expect.poll(() => parseCounterValue(page.getByTestId("board-day-ticks"))).toBeGreaterThan(dayTicksBefore);
  });

  test("does not allow manual modifier add in detail and completes the stack", async ({ page }) => {
    await page.getByTestId("board-new-stack-title").fill("Modifier target");
    await page.getByTestId("board-add-stack").click();

    const stack = stackByTitle(page, "Modifier target").first();
    await expect(stack).toBeVisible();

    await stack.click();
    await expect(page.getByTestId("board-detail-modal")).toBeVisible();
    await expect(page.getByText("Slot 1: empty")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add modifier" })).toHaveCount(0);
    await page.getByTestId("board-detail-save").click();

    await stackByTitle(page, "Modifier target").first().click();
    await page.getByTestId("board-detail-mark-done").click();
    await expect(stackByTitle(page, "Modifier target")).toHaveCount(0);
  });
});
