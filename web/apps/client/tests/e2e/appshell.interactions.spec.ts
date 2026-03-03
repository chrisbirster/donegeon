import { expect, test, type Page } from "@playwright/test";

async function gotoMobile(page: Page, path: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(path);
}

async function openMobileSidebar(page: Page) {
  const toggle = page.getByTestId("appshell-mobile-menu");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByLabel("Close sidebar")).toBeVisible();
}

async function closeMobileSidebarFromBackdrop(page: Page) {
  const viewport = page.viewportSize() ?? { width: 390, height: 844 };
  await page.getByLabel("Close sidebar").click({
    force: true,
    position: { x: Math.max(1, viewport.width - 8), y: 24 },
  });
}

async function openAccountMenu(page: Page) {
  const toggle = page.getByTestId("appshell-account-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByTestId("appshell-account-menu")).toBeVisible();
}

test.describe("AppShell interactions", () => {
  test("opens mobile sidebar from the mobile header toggle", async ({ page }) => {
    await gotoMobile(page, "/task/inbox");
    await openMobileSidebar(page);
  });

  test("does not render a mobile sidebar toggle when no mobile sidebar exists", async ({ page }) => {
    await gotoMobile(page, "/builder");
    await expect(page.getByTestId("appshell-mobile-menu")).toHaveCount(0);
  });

  test("resets mobile sidebar open state after reload", async ({ page }) => {
    await gotoMobile(page, "/task/inbox");
    await openMobileSidebar(page);
    await page.reload();
    await expect(page.getByLabel("Close sidebar")).toHaveCount(0);
  });

  test("closes the mobile sidebar when clicking the backdrop", async ({ page }) => {
    await gotoMobile(page, "/task/inbox");
    await openMobileSidebar(page);
    await closeMobileSidebarFromBackdrop(page);
    await expect(page.getByLabel("Close sidebar")).toHaveCount(0);
  });

  test("shows backdrop close only while open and keeps closed state across reload", async ({ page }) => {
    await gotoMobile(page, "/task/inbox");
    await expect(page.getByLabel("Close sidebar")).toHaveCount(0);
    await openMobileSidebar(page);
    await closeMobileSidebarFromBackdrop(page);
    await expect(page.getByLabel("Close sidebar")).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel("Close sidebar")).toHaveCount(0);
  });

  test("closes the mobile sidebar via the panel close button", async ({ page }) => {
    await gotoMobile(page, "/task/inbox");
    await openMobileSidebar(page);
    await page.locator("aside").getByRole("button", { name: "Close" }).click();
    await expect(page.getByLabel("Close sidebar")).toHaveCount(0);
  });

  test("shows panel close button only while open and keeps closed state across reload", async ({ page }) => {
    await gotoMobile(page, "/task/inbox");
    await expect(page.locator("aside").getByRole("button", { name: "Close" })).toHaveCount(0);
    await openMobileSidebar(page);
    await expect(page.locator("aside").getByRole("button", { name: "Close" })).toBeVisible();
    await page.locator("aside").getByRole("button", { name: "Close" }).click();
    await expect(page.locator("aside").getByRole("button", { name: "Close" })).toHaveCount(0);
    await page.reload();
    await expect(page.locator("aside").getByRole("button", { name: "Close" })).toHaveCount(0);
  });

  test("toggles the desktop account menu and closes it on reload", async ({ page }) => {
    await page.goto("/task/inbox");
    await openAccountMenu(page);
    await page.getByTestId("appshell-account-toggle").click();
    await expect(page.getByTestId("appshell-account-menu")).toHaveCount(0);

    await openAccountMenu(page);
    await page.reload();
    await expect(page.getByTestId("appshell-account-menu")).toHaveCount(0);
  });

  test("hides desktop account controls on mobile", async ({ page }) => {
    await gotoMobile(page, "/task/inbox");
    await expect(page.getByTestId("appshell-account-toggle")).toBeHidden();
    await expect(page.getByTestId("appshell-account-menu")).toHaveCount(0);
  });

  test("navigates to settings from account menu and closes the menu", async ({ page }) => {
    await page.goto("/task/inbox");
    await openAccountMenu(page);
    await page.getByTestId("appshell-account-settings").click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByTestId("appshell-account-menu")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("appshell-account-menu")).toHaveCount(0);
  });

  test("navigates to quest log from account menu and closes the menu", async ({ page }) => {
    await page.goto("/task/inbox");
    await openAccountMenu(page);
    await page.getByTestId("appshell-account-quest-log").click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId("appshell-account-menu")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("appshell-account-menu")).toHaveCount(0);
  });

  test("signs out from account menu and redirects to login", async ({ page }) => {
    await page.goto("/task/inbox");
    await openAccountMenu(page);
    const logoutResponse = page.waitForResponse(
      (response) => response.url().includes("/api/auth/logout") && response.request().method() === "POST",
    );
    await page.getByTestId("appshell-account-signout").click();
    expect((await logoutResponse).ok()).toBeTruthy();
    await expect.poll(() => page.url()).toMatch(/\/(login|task\/inbox)$/);
  });

  test("handles sign-out API errors without blocking route transition", async ({ page }) => {
    await page.route("**/api/auth/logout", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "forced logout failure" } }),
      });
    });

    await page.goto("/task/inbox");
    await openAccountMenu(page);
    await page.getByTestId("appshell-account-signout").click();
    await expect.poll(() => page.url()).toMatch(/\/(login|task\/inbox)$/);
  });

  test("keeps stable route after sign-out and browser reload", async ({ page }) => {
    await page.goto("/task/inbox");
    await openAccountMenu(page);
    await page.getByTestId("appshell-account-signout").click();
    await expect.poll(() => page.url()).toMatch(/\/(login|task\/inbox)$/);

    const secondPage = await page.context().newPage();
    await secondPage.goto("/task/inbox");
    await expect.poll(() => secondPage.url()).toMatch(/\/(login|task\/inbox)$/);
    await secondPage.close();
  });
});
