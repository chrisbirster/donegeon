import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  advanceBoardDays,
  getBoardState,
  inviteTeamMemberAndAccept,
  parseCounterValue,
  resetBoard,
  resetTasks,
} from "./support/api";

function stackByTitle(page: Page, title: string) {
  return page.getByTestId("board-stack").filter({
    has: page.getByTestId("board-card-title").filter({ hasText: title }),
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function spawnBlankTaskStack(page: Page) {
  const firstDayDeck = stackByTitle(page, "First Day").first();
  await expect(firstDayDeck).toBeVisible();
  await firstDayDeck.click();

  const packStack = page.locator('[data-testid="board-stack"][data-stack-title$="Pack"]').first();
  await expect(packStack).toBeVisible();
  await packStack.click();

  const blankTaskStack = stackByTitle(page, "Blank Task").first();
  await expect(blankTaskStack).toBeVisible();
  return blankTaskStack;
}

async function createBoardFromHeaderPrompt(page: Page, boardName: string) {
  await expect(page.getByTestId("board-stack").first()).toBeVisible();
  const boardSection = page.locator("aside").first().locator("section").first();
  await boardSection.getByPlaceholder("Sprint Board").fill(boardName);
  await boardSection.getByRole("button", { name: "Create" }).click();

  const selector = page.getByTestId("board-selector");
  const optionPattern = new RegExp(`^${escapeRegExp(boardName)}(?:\\s*\\(Team\\))?$`, "i");
  const boardOption = selector.locator("option").filter({ hasText: optionPattern }).first();
  await expect(boardOption).toHaveCount(1);
  const boardIDValue = await boardOption.getAttribute("value");
  expect(boardIDValue).toBeTruthy();
  const boardID = boardIDValue as string;
  return boardID;
}

async function createBlankTaskViaApi(request: APIRequestContext, boardID: string) {
  const before = await getBoardState(request, boardID);
  const response = await request.post(`/api/board/cmd?board=${encodeURIComponent(boardID)}`, {
    data: {
      cmd: "task.create_blank",
      args: { x: 220, y: 220 },
      clientVersion: before.version,
    },
  });
  expect(response.ok()).toBeTruthy();
}

function boardAccessSection(page: Page) {
  return page.locator("aside").first().locator("section").filter({ hasText: "Board Access" }).first();
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

    const createdStack = await spawnBlankTaskStack(page);
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
    await expect(page.getByTestId("app-toast")).toContainText(/Reward spawned: Coin x1/i);

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
    const stack = await spawnBlankTaskStack(page);
    await expect(stack).toBeVisible();

    await stack.click();
    await expect(page.getByTestId("board-detail-modal")).toBeVisible();
    await page.getByTestId("board-detail-title").fill("Modifier target");
    await expect(page.getByText("Slot 1: empty")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add modifier" })).toHaveCount(0);
    await page.getByTestId("board-detail-save").click();

    await stackByTitle(page, "Modifier target").first().click();
    await page.getByTestId("board-detail-mark-done").click();
    await expect(stackByTitle(page, "Modifier target")).toHaveCount(0);
  });

  test("adds and removes board members on a team board", async ({ page, request }) => {
    const invitedEmail = "qa-member@example.com";
    const boardName = `Team Access Board ${Date.now()}`;
    await inviteTeamMemberAndAccept(request, invitedEmail, "editor");
    await page.reload();
    await expect(page.getByRole("link", { name: "Board" })).toBeVisible();

    await createBoardFromHeaderPrompt(page, boardName);

    const access = boardAccessSection(page);
    await expect(access).toBeVisible();
    await expect(access.getByText(/1 member\(s\)/i)).toBeVisible();
    await expect(access.locator("p", { hasText: invitedEmail })).toHaveCount(0);

    const picker = access.locator("select").first();
    await expect(picker).toBeEnabled();
    await expect(picker.locator("option", { hasText: invitedEmail })).toHaveCount(1);
    await picker.selectOption({ label: invitedEmail });
    await access.getByRole("button", { name: "Add" }).click();

    await expect(access.getByText(/2 member\(s\)/i)).toBeVisible();
    await expect(access.locator("p", { hasText: invitedEmail }).first()).toBeVisible();

    await access.getByRole("button", { name: "Remove" }).first().click();
    await expect(access.getByText(/1 member\(s\)/i)).toBeVisible();
    await expect(access.locator("p", { hasText: invitedEmail })).toHaveCount(0);
  });

  test("opens the board store and starts a Stripe checkout", async ({ page }) => {
    await page.route("**/api/billing/store", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            {
              id: "coin_stash",
              name: "Quartermaster Coin Stash",
              description: "Instantly credits extra coin to the selected board inventory.",
              category: "Currency",
              badge: "Best Value",
              priceCents: 300,
              currency: "usd",
              contents: ["25 coin added directly to board inventory"],
            },
          ],
          checkoutEnabled: true,
        }),
      });
    });
    await page.route("**/api/billing/store/checkout", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toEqual({
        itemId: "coin_stash",
        board: "default",
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "stripe_checkout",
          checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_donegeon_store",
        }),
      });
    });
    await page.route("https://checkout.stripe.com/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>Mock Stripe Checkout</body></html>",
      });
    });

    await page.getByTestId("board-open-store-header").click();
    await expect(page).toHaveURL(/\/board\/store(?:\?.*)?$/);
    await expect(page.getByTestId("board-store-page")).toBeVisible();
    await expect(page.getByTestId("store-item-coin_stash")).toContainText("Quartermaster Coin Stash");

    await page.getByTestId("store-buy-coin_stash").click();
    await expect(page).toHaveURL("https://checkout.stripe.com/c/pay/cs_test_donegeon_store");
    await expect(page.locator("body")).toContainText("Mock Stripe Checkout");
  });

  test("keeps stack state isolated across boards", async ({ page, request }) => {
    const nonce = Date.now();
    const boardAID = await createBoardFromHeaderPrompt(page, `Program Alpha Board ${nonce}`);
    const boardBID = await createBoardFromHeaderPrompt(page, `Program Beta Board ${nonce}`);

    const beforeA = await getBoardState(request, boardAID);
    const beforeB = await getBoardState(request, boardBID);

    await createBlankTaskViaApi(request, boardAID);

    const afterA = await getBoardState(request, boardAID);
    const afterB = await getBoardState(request, boardBID);
    expect(Object.keys(afterA.stacks)).toHaveLength(Object.keys(beforeA.stacks).length + 1);
    expect(Object.keys(afterB.stacks)).toHaveLength(Object.keys(beforeB.stacks).length);
  });
});

test.describe("Board time simulation", () => {
  test.beforeEach(async ({ request }) => {
    await resetTasks(request);
    await resetBoard(request);
  });

  const scenarios = [
    { label: "1 day", days: 1 },
    { label: "1 week", days: 7 },
    { label: "30-day month", days: 30 },
  ] as const;

  for (const scenario of scenarios) {
    test(`simulates ${scenario.label} through repeated world.end_day ticks`, async ({ page, request }) => {
      const before = await getBoardState(request);
      const beforeTicks = before.meta?.dayTickCount ?? 0;
      const beforeDay = before.meta?.quests?.currentDay ?? beforeTicks + 1;
      const state = await advanceBoardDays(request, scenario.days);
      const expectedTicks = beforeTicks + scenario.days;
      const expectedDay = beforeDay + scenario.days;
      const expectedWeek = Math.floor((expectedDay - 1) / 7) + 1;

      expect(state.meta?.dayTickCount).toBe(expectedTicks);
      expect(state.meta?.quests?.currentDay).toBe(expectedDay);
      expect(state.meta?.quests?.currentWeek).toBe(expectedWeek);

      await page.goto("/board");
      await expect(page.getByRole("link", { name: "Board" })).toBeVisible();
      await expect.poll(() => parseCounterValue(page.getByTestId("board-day-ticks"))).toBe(expectedTicks);
    });
  }
});
