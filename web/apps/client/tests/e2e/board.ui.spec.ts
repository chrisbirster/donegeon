import { expect, test, type Locator, type Page } from "@playwright/test";

import { inviteTeamMemberAndAccept, parseCounterValue, resetBoard, resetTasks, taskRowByContent } from "./support/api";

const MOBILE_VIEWPORT = { width: 390, height: 844 };

type MockBoardStateResponse = {
  version: string;
  stacks: Record<string, { id: string; pos: { x: number; y: number }; z: number; cards: string[] }>;
  cards: Record<string, { id: string; defId: string; data?: Record<string, unknown> }>;
  meta?: {
    inventory?: Record<string, number>;
    metrics?: Record<string, number>;
    villagers?: Record<
      string,
      {
        stamina?: number;
        xp?: number;
        level?: number;
        perks?: string[];
      }
    >;
  };
};

function stackByTitle(page: Page, title: string) {
  return page.getByTestId("board-stack").filter({
    has: page.getByTestId("board-card-title").filter({ hasText: title }),
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeID(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

async function openMobileSidebar(page: Page) {
  const toggle = page.getByTestId("appshell-mobile-menu");
  await expect(toggle).toBeVisible();
  await toggle.click();
  const visibleSidebar = page.locator("aside:visible").first();
  await expect(visibleSidebar.getByRole("button", { name: "Close" })).toBeVisible();
  return visibleSidebar;
}

async function enableDeckOverflowMock(page: Page) {
  const deckDefs = [
    "deck.first_day",
    "deck.collect",
    "deck.organization",
    "deck.survival",
    "deck.humble_beginnings",
    "deck.seeking_wisdom",
  ];
  await page.route("**/api/board/state**", async (route) => {
    const response = await route.fetch();
    const state = (await response.json()) as {
      cards?: Record<string, { id: string; defId: string; data?: Record<string, unknown> }>;
      stacks?: Record<string, { id: string; pos: { x: number; y: number }; z: number; cards: string[] }>;
    };

    const cards = { ...(state.cards ?? {}) };
    const stacks = { ...(state.stacks ?? {}) };

    deckDefs.forEach((defID, index) => {
      const suffix = normalizeID(defID);
      const cardID = `test-deck-card-${suffix}`;
      const stackID = `test-deck-stack-${suffix}`;
      cards[cardID] = { id: cardID, defId: defID, data: {} };
      stacks[stackID] = {
        id: stackID,
        pos: { x: 80 + index * 110, y: 840 },
        z: 50 + index,
        cards: [cardID],
      };
    });

    await route.fulfill({
      response,
      json: {
        ...state,
        cards,
        stacks,
      },
    });
  });
}

async function optionValueByName(selector: Locator, boardName: string) {
  const optionPattern = new RegExp(`^${escapeRegExp(boardName)}(?:\\s*\\(Team\\))?$`, "i");
  const option = selector.locator("option").filter({ hasText: optionPattern }).first();
  await expect(option).toHaveCount(1);
  const value = await option.getAttribute("value");
  expect(value).toBeTruthy();
  return value as string;
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

function mergedMiningBoardState(stamina: number, version = "52"): MockBoardStateResponse {
  const stackID = "stack-mining";
  const villagerID = "villager-miner";
  const villagerCardID = "card-villager";
  const resourceCardID = "card-resource";

  return {
    version,
    stacks: {
      [stackID]: {
        id: stackID,
        pos: { x: 320, y: 220 },
        z: 12,
        cards: [resourceCardID, villagerCardID],
      },
    },
    cards: {
      [resourceCardID]: {
        id: resourceCardID,
        defId: "resource.tree",
        data: {
          charges: 3,
          gatherTimeS: 1,
        },
      },
      [villagerCardID]: {
        id: villagerCardID,
        defId: "villager.basic",
        data: {
          villagerId: villagerID,
          name: "Pip",
        },
      },
    },
    meta: {
      inventory: { coin: 0, gear: 0, ink: 0, paper: 0, parts: 0 },
      metrics: { day_ticks: 0, overrun_level: 0, tasks_completed: 0, zombies_cleared: 0, zombies_seen: 0 },
      villagers: {
        [villagerID]: {
          stamina,
          xp: 0,
          level: 1,
          perks: [],
        },
      },
    },
  };
}

test.describe("Board UI interactions", () => {
  test.beforeEach(async ({ page, request }) => {
    await resetTasks(request);
    await resetBoard(request);
    await page.goto("/board");
    await expect(page.getByTestId("board-canvas")).toBeVisible();
  });

  test("opens and closes deck hub panel", async ({ page }) => {
    await enableDeckOverflowMock(page);
    await page.reload();

    const toggle = page.getByTestId("board-deck-hub-toggle");
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByTestId("board-deck-hub-panel")).toBeVisible();

    await page.getByTestId("board-deck-hub-panel").getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("board-deck-hub-panel")).toHaveCount(0);
  });

  test("creates and deletes a board from sidebar controls", async ({ page }) => {
    const boardName = `UI Board ${Date.now()}`;
    const sidebar = page.locator("aside").first();
    const boardSection = sidebar.locator("section").first();

    await boardSection.getByPlaceholder("Sprint Board").fill(boardName);
    await boardSection.getByRole("button", { name: "Create" }).click();

    const selector = page.getByTestId("board-selector-sidebar");
    const option = selector.locator("option", { hasText: boardName });
    await expect(option).toHaveCount(1);

    page.once("dialog", (dialog) => dialog.accept());
    await boardSection.getByRole("button", { name: "Delete" }).click();
    await expect(selector.locator("option", { hasText: boardName })).toHaveCount(0);
  });

  test("switches board from header selector and keeps created board options after reload", async ({ page }) => {
    const boardName = `Header Selector ${Date.now()}`;
    const boardSection = page.locator("aside").first().locator("section").first();
    await boardSection.getByPlaceholder("Sprint Board").fill(boardName);
    await boardSection.getByRole("button", { name: "Create" }).click();

    const headerSelector = page.getByTestId("board-selector");
    const boardValue = await optionValueByName(headerSelector, boardName);
    await headerSelector.selectOption(boardValue);
    await expect(page).toHaveURL(new RegExp(`/board\\?board=${escapeRegExp(boardValue)}$`));

    await page.reload();
    await expect(page.getByTestId("board-selector").locator("option", { hasText: boardName })).toHaveCount(1);
  });

  test("header New board prompt validates input, creates board, and Delete board removes it", async ({ page }) => {
    page.once("dialog", (dialog) => dialog.accept("   "));
    await page.getByRole("button", { name: "New board" }).click();
    await expect(page.getByText("Board name is required.").first()).toBeVisible();

    const boardName = `Prompt Board ${Date.now()}`;
    page.once("dialog", (dialog) => dialog.accept(boardName));
    await page.getByRole("button", { name: "New board" }).click();

    const headerSelector = page.getByTestId("board-selector");
    const boardValue = await optionValueByName(headerSelector, boardName);
    await headerSelector.selectOption(boardValue);
    await expect(page).toHaveURL(new RegExp(`/board\\?board=${escapeRegExp(boardValue)}$`));

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete board" }).click();
    const optionPattern = new RegExp(`^${escapeRegExp(boardName)}(?:\\s*\\(Team\\))?$`, "i");
    await expect(headerSelector.locator("option").filter({ hasText: optionPattern })).toHaveCount(0);
  });

  test("mobile board selector and CRUD controls support create, switch, reload persistence, and delete", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/board");
    const mobileSidebar = await openMobileSidebar(page);

    const mobileSelector = page.getByTestId("board-selector-mobile");
    const boardInput = mobileSidebar.getByPlaceholder("Sprint Board");
    const optionCountBeforeInvalidCreate = await mobileSelector.locator("option").count();

    await boardInput.fill("   ");
    await mobileSidebar.getByRole("button", { name: "Create" }).click();
    await expect.poll(() => mobileSelector.locator("option").count()).toBe(optionCountBeforeInvalidCreate);

    const enterBoardName = `Mobile Enter ${Date.now()}`;
    await boardInput.fill(enterBoardName);
    await boardInput.press("Enter");
    const enterBoardValue = await optionValueByName(mobileSelector, enterBoardName);

    const clickBoardName = `Mobile Click ${Date.now()}`;
    await boardInput.fill(clickBoardName);
    await mobileSidebar.getByRole("button", { name: "Create" }).click();
    await optionValueByName(mobileSelector, clickBoardName);

    await mobileSelector.selectOption(enterBoardValue);
    await expect(page).toHaveURL(new RegExp(`/board\\?board=${escapeRegExp(enterBoardValue)}$`));

    await page.reload();
    await openMobileSidebar(page);
    await expect(page.getByTestId("board-selector-mobile").locator("option", { hasText: enterBoardName })).toHaveCount(1);
    await page.getByTestId("board-selector-mobile").selectOption(enterBoardValue);
    await expect(page).toHaveURL(new RegExp(`/board\\?board=${escapeRegExp(enterBoardValue)}$`));

    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("aside:visible").first().getByRole("button", { name: "Delete" }).click();
    const optionPattern = new RegExp(`^${escapeRegExp(enterBoardName)}(?:\\s*\\(Team\\))?$`, "i");
    await expect(page.getByTestId("board-selector-mobile").locator("option").filter({ hasText: optionPattern })).toHaveCount(0);
  });

  test("mobile board access supports add/remove member and persists after reload", async ({ page, request }) => {
    const invitedEmail = `mobile-board-member-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, invitedEmail, "editor");

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/board");
    const mobileSidebar = await openMobileSidebar(page);

    const boardInput = mobileSidebar.getByPlaceholder("Sprint Board");
    const boardName = `Mobile Access ${Date.now()}`;
    await boardInput.fill(boardName);
    await mobileSidebar.getByRole("button", { name: "Create" }).click();
    await expect(page.getByTestId("board-selector-mobile").locator("option", { hasText: boardName })).toHaveCount(1);

    const accessSection = mobileSidebar.locator("section").filter({ hasText: "Board Access" }).first();
    await expect(accessSection).toBeVisible();
    const memberPicker = accessSection.locator("select").first();
    await expect(memberPicker.locator("option", { hasText: invitedEmail })).toHaveCount(1);
    await memberPicker.selectOption({ label: invitedEmail });
    await accessSection.getByRole("button", { name: "Add" }).click();
    await expect(accessSection.locator("p", { hasText: invitedEmail }).first()).toBeVisible();

    await page.reload();
    const mobileSidebarAfterReload = await openMobileSidebar(page);
    const accessAfterReload = mobileSidebarAfterReload.locator("section").filter({ hasText: "Board Access" }).first();
    await expect(accessAfterReload.locator("p", { hasText: invitedEmail }).first()).toBeVisible();

    const memberRow = accessAfterReload.locator("div").filter({ hasText: invitedEmail }).first();
    await memberRow.getByRole("button", { name: "Remove" }).click();
    await expect(accessAfterReload.locator("p", { hasText: invitedEmail })).toHaveCount(0);
  });

  test("desktop sidebar board controls support selector switch, Enter create, click create, and delete", async ({ page }) => {
    const sidebar = page.locator("aside").first();
    const boardSection = sidebar.locator("section").first();
    const boardSelector = page.getByTestId("board-selector-sidebar");
    const boardInput = boardSection.getByPlaceholder("Sprint Board");

    const optionCountBeforeInvalidCreate = await boardSelector.locator("option").count();
    await boardInput.fill("   ");
    await boardInput.press("Enter");
    await expect.poll(() => boardSelector.locator("option").count()).toBe(optionCountBeforeInvalidCreate);

    const enterBoardName = `Desktop Enter ${Date.now()}`;
    await boardInput.fill(enterBoardName);
    await boardInput.press("Enter");
    const enterBoardValue = await optionValueByName(boardSelector, enterBoardName);

    const clickBoardName = `Desktop Click ${Date.now()}`;
    await boardInput.fill(clickBoardName);
    await boardSection.getByRole("button", { name: "Create" }).click();
    const clickBoardValue = await optionValueByName(boardSelector, clickBoardName);

    await boardSelector.selectOption(enterBoardValue);
    await expect(page).toHaveURL(new RegExp(`/board\\?board=${escapeRegExp(enterBoardValue)}$`));
    await boardSelector.selectOption(clickBoardValue);
    await expect(page).toHaveURL(new RegExp(`/board\\?board=${escapeRegExp(clickBoardValue)}$`));

    await page.reload();
    await expect(boardSelector.locator("option", { hasText: enterBoardName })).toHaveCount(1);
    await expect(boardSelector.locator("option", { hasText: clickBoardName })).toHaveCount(1);

    page.once("dialog", (dialog) => dialog.accept());
    await boardSection.getByRole("button", { name: "Delete" }).click();
    await expect(boardSelector.locator("option", { hasText: clickBoardName })).toHaveCount(0);
  });

  test("desktop minimap pointer drag recenters board", async ({ page }) => {
    const minimap = page.getByTestId("board-minimap-desktop");
    await expect(minimap).toBeVisible();

    const canvas = page.getByTestId("board-canvas");
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error("expected canvas bounds");
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.8, canvasBox.y + canvasBox.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(canvasBox.x + canvasBox.width * 0.62, canvasBox.y + canvasBox.height * 0.36);
    await page.mouse.up();

    const beforePan = `${(await canvas.getAttribute("data-pan-x")) ?? ""}:${(await canvas.getAttribute("data-pan-y")) ?? ""}`;
    const box = await minimap.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("expected minimap bounds");

    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.8);
    await page.mouse.up();

    await expect.poll(async () => {
      const panX = await canvas.getAttribute("data-pan-x");
      const panY = await canvas.getAttribute("data-pan-y");
      return `${panX ?? ""}:${panY ?? ""}`;
    }).not.toBe(beforePan);
  });

  test("mobile minimap pointer interactions work with map hub toggle", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/board");
    await page.getByTestId("board-mobile-map-toggle").click();

    const minimap = page.getByTestId("board-minimap-mobile");
    await expect(minimap).toBeVisible();

    const viewport = page.getByTestId("board-minimap-mobile-viewport");
    const beforeStyle = (await viewport.getAttribute("style")) ?? "";

    const box = await minimap.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("expected minimap bounds");

    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.7);
    await page.mouse.up();

    await expect.poll(async () => (await viewport.getAttribute("style")) ?? "").not.toBe(beforeStyle);

    await page.getByTestId("board-mobile-map-toggle").click();
    await expect(page.getByTestId("board-mobile-map-toggle")).toHaveText("Map");
  });

  test("deck hub panel supports backdrop/panel close and row-reserve drag/drop + hide/show actions", async ({ page }) => {
    await enableDeckOverflowMock(page);
    await page.reload();

    const toggle = page.getByTestId("board-deck-hub-toggle");
    await expect(toggle).toBeVisible();
    await toggle.click();

    const panel = page.getByTestId("board-deck-hub-panel");
    await expect(panel).toBeVisible();

    await panel.click({ position: { x: 8, y: 8 } });
    await expect(panel).toBeVisible();

    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).toHaveCount(0);

    await toggle.click();
    await expect(panel).toBeVisible();

    const rowSection = panel.locator("section").nth(0);
    const reserveSection = panel.locator("section").nth(1);
    const rowDropArea = panel.getByTestId("board-deck-hub-row-dropzone");

    const rowItems = panel.getByTestId("board-deck-hub-row-item");
    const reserveItems = panel.getByTestId("board-deck-hub-reserve-item");

    await expect(rowItems).toHaveCount(4);
    await expect(reserveItems).toHaveCount(2);

    if ((await rowItems.count()) > 1) {
      await rowItems.nth(0).dragTo(rowItems.nth(1));
      await expect(rowItems).toHaveCount(4);
    }

    const hiddenDefID = await rowItems.first().getAttribute("data-def-id");
    expect(hiddenDefID).toBeTruthy();
    await panel.getByTestId("board-deck-hub-hide").first().click();
    await expect(
      panel.locator(`[data-testid="board-deck-hub-reserve-item"][data-def-id="${hiddenDefID}"]`),
    ).toHaveCount(1);

    const reserveItemForHiddenDeck = panel.locator(
      `[data-testid="board-deck-hub-reserve-item"][data-def-id="${hiddenDefID}"]`,
    );
    await reserveItemForHiddenDeck.getByTestId("board-deck-hub-show").click();
    await expect(panel.locator(`[data-testid="board-deck-hub-row-item"][data-def-id="${hiddenDefID}"]`)).toHaveCount(1);

    const reserveItemsAfterMove = panel.getByTestId("board-deck-hub-reserve-item");
    if ((await reserveItemsAfterMove.count()) > 0) {
      await reserveItemsAfterMove.nth(0).dragTo(rowDropArea);
    }

    await page.locator("div.absolute.inset-0.z-50").first().click({ position: { x: 5, y: 5 } });
    await expect(panel).toHaveCount(0);
  });

  test("board canvas pointer drag pans the board", async ({ page }) => {
    const canvas = page.getByTestId("board-canvas");
    await expect(canvas).toBeVisible();
    const beforePanX = await canvas.getAttribute("data-pan-x");
    const beforePanY = await canvas.getAttribute("data-pan-y");
    const beforePan = `${beforePanX ?? ""}:${beforePanY ?? ""}`;

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (!box) throw new Error("expected canvas bounds");

    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.36);
    await page.mouse.up();

    await expect.poll(async () => {
      const panX = await canvas.getAttribute("data-pan-x");
      const panY = await canvas.getAttribute("data-pan-y");
      return `${panX ?? ""}:${panY ?? ""}`;
    }).not.toBe(beforePan);
  });

  test("board detail supports close, priority changes, save, mark done, and open in tasks page", async ({ page }) => {
    const taskStack = await spawnBlankTaskStack(page);
    await taskStack.click();
    await expect(page.getByTestId("board-detail-modal")).toBeVisible();

    await page.getByTestId("board-detail-title").fill("Detail Action");
    await page.getByTestId("board-detail-description").fill("Detail action description.");
    await page.getByRole("button", { name: "P3" }).click();
    await page.getByTestId("board-detail-save").click();

    const savedStack = stackByTitle(page, "Detail Action").first();
    await expect(savedStack).toBeVisible();
    await savedStack.click();
    await expect(page.getByTestId("board-detail-modal")).toBeVisible();
    await page.getByRole("button", { name: "✕" }).click();
    await expect(page.getByTestId("board-detail-modal")).toHaveCount(0);

    await savedStack.click();
    await expect(page.getByTestId("board-detail-modal")).toBeVisible();
    await page.getByRole("button", { name: "View in Tasks Page" }).click();
    await expect(page).toHaveURL(/\/task\/project\/board$/);

    await page.goto("/board");
    await expect(stackByTitle(page, "Detail Action").first()).toBeVisible();
    await stackByTitle(page, "Detail Action").first().click();
    await page.getByTestId("board-detail-mark-done").click();
    await expect(stackByTitle(page, "Detail Action")).toHaveCount(0);
  });

  test("claim reward button dispatches quest claim command in desktop and mobile views", async ({ page }) => {
    const questID = `Q_CLAIM_${Date.now()}`;
    await page.route("**/api/board/state?board=*", async (route) => {
      const response = await route.fetch();
      const state = (await response.json()) as Record<string, unknown>;
      const meta = (state.meta ?? {}) as Record<string, unknown>;
      const quests = (meta.quests ?? {}) as Record<string, unknown>;
      const active = Array.isArray(quests.active) ? [...(quests.active as Array<Record<string, unknown>>)] : [];
      const existing = (active[0] ?? {}) as Record<string, unknown>;
      const claimableQuest = {
        ...existing,
        id: questID,
        title: (existing.title as string | undefined) ?? "Claim Test Quest",
        type: (existing.type as string | undefined) ?? "daily",
        scope: (existing.scope as string | undefined) ?? "day",
        objectives:
          (existing.objectives as unknown[] | undefined) && (existing.objectives as unknown[]).length > 0
            ? existing.objectives
            : [{ op: "noop", current: 1, target: 1, complete: true }],
        completed: true,
        claimable: true,
        claimed: false,
      };

      state.meta = {
        ...meta,
        quests: {
          ...quests,
          active: [claimableQuest, ...active.slice(1)],
        },
      };

      await route.fulfill({ response, json: state });
    });

    let claimCalls = 0;
    await page.route("**/api/board/cmd?board=*", async (route) => {
      const payload = route.request().postDataJSON() as { cmd?: string } | null;
      if (payload?.cmd === "quest.claim_reward") {
        claimCalls += 1;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ newVersion: `claim-v${Date.now()}` }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/board");
    await expect(page.locator("aside").first().getByRole("button", { name: "Claim reward" }).first()).toBeVisible();
    await page.locator("aside").first().getByRole("button", { name: "Claim reward" }).first().click();
    await expect.poll(() => claimCalls).toBe(1);

    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.reload();
    const mobileSidebar = await openMobileSidebar(page);
    await expect(mobileSidebar.getByRole("button", { name: "Claim reward" }).first()).toBeVisible();
    await mobileSidebar.getByRole("button", { name: "Claim reward" }).first().click();
    await expect.poll(() => claimCalls).toBe(2);
  });

  test("mobile end day and refresh controls dispatch their actions", async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto("/board");

    const endDayRequest = page.waitForRequest((request) => {
      if (!request.url().includes("/api/board/cmd?board=") || request.method() !== "POST") {
        return false;
      }
      const payload = request.postData() ?? "";
      return payload.includes('"cmd":"world.end_day"');
    });
    await page.getByTestId("board-end-day").click();
    await endDayRequest;

    const refreshResponse = page.waitForResponse((response) => {
      return response.url().includes("/api/board/state?board=") && response.request().method() === "GET";
    });
    await page.getByTestId("board-refresh").click();
    await refreshResponse;
  });

  test("increments day ticks when ending day", async ({ page }) => {
    const before = await parseCounterValue(page.getByTestId("board-day-ticks"));
    await page.getByTestId("board-end-day").click();
    await expect.poll(() => parseCounterValue(page.getByTestId("board-day-ticks"))).toBeGreaterThan(before);
  });

  test("refreshes board without losing stacks", async ({ page }) => {
    await spawnBlankTaskStack(page);
    const countBefore = await page.getByTestId("board-stack").count();

    await page.getByTestId("board-refresh").click();
    await expect.poll(() => page.getByTestId("board-stack").count()).toBeGreaterThanOrEqual(countBefore);
  });

  test("shows schedule parsing guidance in board detail when modifiers are missing", async ({ page }) => {
    const taskStack = await spawnBlankTaskStack(page);
    await taskStack.click();
    await expect(page.getByTestId("board-detail-modal")).toBeVisible();
    await expect(
      page.getByText(
        'Modifiers are earned from card packs. Stack "Recurring" and/or "Deadline Pin" cards on this task to enable schedule parsing; otherwise timing text is kept as plain text.',
      ),
    ).toBeVisible();
  });

  test("can save title and description in board task detail", async ({ page }) => {
    const taskStack = await spawnBlankTaskStack(page);
    await taskStack.click();
    await expect(page.getByTestId("board-detail-modal")).toBeVisible();

    await page.getByTestId("board-detail-title").fill("Board Detail Save Check");
    await page.getByTestId("board-detail-description").fill("Board detail description from e2e.");
    await page.getByTestId("board-detail-save").click();

    await expect(stackByTitle(page, "Board Detail Save Check").first()).toBeVisible();
  });

  test("parses quick-add syntax when saving board task detail title", async ({ page }) => {
    const taskStack = await spawnBlankTaskStack(page);
    await taskStack.click();
    await expect(page.getByTestId("board-detail-modal")).toBeVisible();

    await page.getByTestId("board-detail-title").fill("board parsed task p1 @home // board parsed description");
    await page.getByTestId("board-detail-save").click();

    const savedStack = stackByTitle(page, "board parsed task").first();
    await expect(savedStack).toBeVisible();
    await savedStack.click();
    await page.getByRole("button", { name: "View in Tasks Page" }).click();
    await expect(page).toHaveURL(/\/task\/project\/board$/);

    const row = taskRowByContent(page, "board parsed task");
    await expect(row).toBeVisible();
    await row.hover();
    await row.getByTestId("open-task-details").click();
    await expect(page.getByTestId("task-detail-modal")).toBeVisible();
    await expect(page.getByTestId("task-detail-description")).toHaveValue("board parsed description");
    await expect(page.getByTestId("task-detail-tags")).toHaveValue("@home");
    await expect(page.getByTestId("task-detail-priority")).toHaveValue("1");
  });

  test("supports mobile map hub toggle", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/board");
    await expect(page.getByTestId("board-mobile-map-toggle")).toBeVisible();

    await page.getByTestId("board-mobile-map-toggle").click();
    await expect(page.getByTestId("board-mobile-map-toggle")).toHaveText("Hide Map");

    await page.getByTestId("board-mobile-map-toggle").click();
    await expect(page.getByTestId("board-mobile-map-toggle")).toHaveText("Map");
  });
});

test.describe("Board auto-mining regressions", () => {
  test.beforeEach(async ({ request }) => {
    await resetTasks(request);
    await resetBoard(request);
  });

  test("does not start auto-gather for merged villager/resource stacks with zero stamina", async ({ page }) => {
    let gatherCalls = 0;

    await page.route("**/api/board/state**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mergedMiningBoardState(0)),
      });
    });

    await page.route("**/api/board/cmd?board=**", async (route, request) => {
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as { cmd?: string } | null;
        if (payload?.cmd === "resource.gather") {
          gatherCalls += 1;
        }
      }
      await route.continue();
    });

    await page.goto("/board");
    await expect(page.getByTestId("board-canvas")).toBeVisible();
    await expect(page.getByTestId("board-stack")).toHaveCount(1);

    await page.waitForTimeout(1400);
    expect(gatherCalls).toBe(0);
  });

  test("refreshes after mining conflicts without retrying stale gather commands", async ({ page }) => {
    let gatherCalls = 0;
    let boardStateCalls = 0;

    await page.route("**/api/board/state**", async (route) => {
      boardStateCalls += 1;
      const state = boardStateCalls === 1
        ? mergedMiningBoardState(1, "52")
        : mergedMiningBoardState(0, "53");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(state),
      });
    });

    await page.route("**/api/board/cmd?board=**", async (route, request) => {
      if (request.method() !== "POST") {
        await route.continue();
        return;
      }

      const payload = request.postDataJSON() as { cmd?: string } | null;
      if (payload?.cmd !== "resource.gather") {
        await route.continue();
        return;
      }

      gatherCalls += 1;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: "board version conflict",
          newVersion: "53",
        }),
      });
    });

    await page.goto("/board");
    await expect(page.getByTestId("board-canvas")).toBeVisible();
    await expect(page.getByTestId("board-stack")).toHaveCount(1);

    await expect.poll(() => gatherCalls).toBe(1);
    await expect.poll(() => boardStateCalls).toBeGreaterThanOrEqual(2);

    await page.waitForTimeout(1400);
    expect(gatherCalls).toBe(1);
  });
});
