import { expect, test, type Page } from "@playwright/test";

async function ensureTeamAdminEnabled(page: Page) {
  await page.goto("/team/settings");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Command Ledger/i);

  const teamName = page.getByRole("textbox", { name: /Team name/i });
  if (await teamName.isEnabled()) return;

  const startTrial = page.getByRole("button", { name: /Start 14-day trial/i });
  await expect(
    startTrial,
    "The audit account must be able to exercise the owner/admin UI. If Free freezes team administration, the deterministic local trial path must unlock it.",
  ).toBeEnabled();
  await startTrial.click();
  await expect(page.getByRole("main").getByText(/Pro trial activated/i)).toBeVisible();
  await expect(teamName).toBeEnabled();
}

async function expectLightTheme(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() =>
    page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bg-base").trim()),
  ).toBe("#f4f6fa");
}

test.describe("M5 — deterministic collaboration browser surfaces", () => {
  test("[M5] Workspace owner/admin role behavior", async ({ page }) => {
    await ensureTeamAdminEnabled(page);
    const name = `Audit Team ${Date.now()}`;
    const input = page.getByRole("textbox", { name: /Team name/i });
    await input.fill(name);
    await page.getByRole("button", { name: /^Save team$/i }).click();
    await expect(page.getByRole("main").getByText(/Team settings updated/i)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: /Team name/i })).toHaveValue(name);
  });

  test("[M5] Invitation creation", async ({ page }) => {
    await ensureTeamAdminEnabled(page);
    const email = `audit-invite-${Date.now()}@example.com`;
    await page.getByRole("textbox", { name: /Invite by email/i }).fill(email);
    await page.getByRole("button", { name: /^Send invite$/i }).click();
    await expect(page.getByRole("main").getByText(/Invitation sent as/i)).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });

  test("[M5] OAuth callback/failure", async ({ page }) => {
    await page.goto("/profile?calendar=error&message=Provider%20denied%20access");
    await expect(page.getByText("Provider denied access", { exact: true })).toBeVisible();

    const connection = {
      id: "CAL_M5_GOOGLE",
      provider: "google",
      externalAccountId: "google-account-m5",
      email: "m5-calendar@example.com",
      scope: "calendar.readonly",
      calendarId: "primary",
      lastSyncAt: "2026-09-15T12:00:00Z",
      createdAt: "2026-09-15T11:00:00Z",
      updatedAt: "2026-09-15T12:00:00Z",
      hasRefreshToken: true,
    };

    await page.route("**/api/calendar/connections", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [connection] }),
      });
    });
    await page.route("**/api/calendar/sync", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          results: [{ connectionId: connection.id, provider: "google", pulled: 3 }],
        }),
      });
    });

    await page.goto("/profile?calendar=connected&provider=google");
    const calendarPanel = page.getByTestId("profile-calendar-connections");
    await expect(calendarPanel).toContainText("Google Calendar");
    await expect(calendarPanel).toContainText("m5-calendar@example.com");
    await expect(calendarPanel).toContainText(/3 upcoming events fetched/i);
  });

  test("Light theme applies app-wide palette", async ({ page }) => {
    await page.goto("/settings");
    await page.getByTestId("theme-option-light").click();
    await expectLightTheme(page);

    await page.goto("/task/inbox");
    await expectLightTheme(page);

    await page.goto("/board");
    await expectLightTheme(page);
    await expect.poll(() =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--board-chrome-bg").trim()),
    ).toBe("rgba(255,255,255,.94)");
  });
});
