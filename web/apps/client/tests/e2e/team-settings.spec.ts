import { expect, test } from "@playwright/test";

import { inviteTeamMemberAndAccept } from "./support/api";

test.describe("Team settings interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Donegeon Command Settings")).toBeVisible();
  });

  test("renders entitlement summary and billing cards", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Access & Entitlements" })).toBeVisible();
    await expect(page.getByText("Personal Board", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Active Team Workspace", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Plan Scope", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "14-day trial" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Upgrade" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Talk to Sales" })).toBeVisible();
  });

  test("updates team name", async ({ page }) => {
    const name = `Team ${Date.now()}`;
    const profileSection = page.locator("#team-profile");
    await profileSection.locator("input").first().fill(name);
    await profileSection.getByRole("button", { name: "Save team" }).click();

    await expect(page.getByText("Team settings updated.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(name) })).toBeVisible();
  });

  test("shows validation error when invite form is submitted empty", async ({ page }) => {
    const invitationSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Invitations" }) });
    await invitationSection.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Enter at least one invite email.")).toBeVisible();
  });

  test("invites and cancels pending invitation", async ({ page }) => {
    const email = `invite-${Date.now()}@example.com`;
    const invitationSection = page.locator("section").filter({ has: page.getByRole("heading", { name: "Invitations" }) });

    await invitationSection.getByPlaceholder("teammate@company.com").fill(email);
    await invitationSection.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText(email)).toBeVisible();

    const inviteRow = page
      .locator("article")
      .filter({ has: page.getByText(email) })
      .first();
    await inviteRow.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(`Canceled invite for ${email}.`)).toBeVisible();
    await expect(page.locator("article").filter({ has: page.getByText(email) })).toHaveCount(0);
  });

  test("changes role and removes accepted team member", async ({ page, request }) => {
    const email = `member-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, email, "editor");

    await page.reload();
    await expect(page.getByText("Team Members")).toBeVisible();

    const memberCard = page.locator("article").filter({ has: page.getByText(email) }).first();
    await expect(memberCard).toBeVisible();
    await memberCard.locator("select").selectOption("reader");
    await expect(page.getByText(new RegExp(`${email} is now Reader\\.`))).toBeVisible();

    await memberCard.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(new RegExp(`${email} removed from team\\.`))).toBeVisible();
    await expect(page.locator("article").filter({ has: page.getByText(email) })).toHaveCount(0);
  });
});
