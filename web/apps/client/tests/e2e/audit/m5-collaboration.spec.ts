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
  await expect(page.getByText(/Pro trial activated/i)).toBeVisible();
  await expect(teamName).toBeEnabled();
}

test.describe("M5 — deterministic collaboration browser surfaces", () => {
  test("[M5] Workspace owner/admin role behavior", async ({ page }) => {
    await ensureTeamAdminEnabled(page);
    const name = `Audit Team ${Date.now()}`;
    const input = page.getByRole("textbox", { name: /Team name/i });
    await input.fill(name);
    await page.getByRole("button", { name: /^Save team$/i }).click();
    await expect(page.getByText(/Team settings updated/i)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("textbox", { name: /Team name/i })).toHaveValue(name);
  });

  test("[M5] Invitation creation", async ({ page }) => {
    await ensureTeamAdminEnabled(page);
    const email = `audit-invite-${Date.now()}@example.com`;
    await page.getByRole("textbox", { name: /Invite by email/i }).fill(email);
    await page.getByRole("button", { name: /^Send invite$/i }).click();
    await expect(page.getByText(/Invitation sent as/i)).toBeVisible();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText(email, { exact: true })).toBeVisible();
  });
});
