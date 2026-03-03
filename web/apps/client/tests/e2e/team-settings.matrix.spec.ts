import { expect, test, type Page } from "@playwright/test";

import { inviteTeamMemberAndAccept } from "./support/api";

type CheckoutMode = "trial_started" | "stripe_checkout" | "contact_sales";

async function gotoSettings(page: Page, mobile = false) {
  if (mobile) {
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.goto("/settings");
  await expect(page.getByText("Donegeon Command Settings")).toBeVisible();
}

function teamProfile(page: Page) {
  return page.locator("#team-profile");
}

function teamNameInput(page: Page) {
  return teamProfile(page).locator("input").first();
}

function saveTeamButton(page: Page) {
  return teamProfile(page).getByRole("button", { name: "Save team" });
}

async function stubBillingCheckout(page: Page, handler: (plan: string) => { status: number; body: Record<string, unknown> }) {
  await page.route("**/api/billing/checkout", async (route) => {
    const payload = route.request().postDataJSON() as { plan?: string };
    const response = handler(payload.plan || "");
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    });
  });
}

function trialTeam(plan: string) {
  return {
    id: "ws-e2e",
    name: "Matrix Team",
    plan,
    isArchived: false,
  };
}

function billingButton(page: Page, label: "14-day trial" | "Upgrade" | "Talk to Sales") {
  return page.getByRole("button", { name: label });
}

function memberCardByEmail(page: Page, email: string) {
  return page.locator("article").filter({ hasText: email }).first();
}

function invitationsSection(page: Page) {
  return page.getByRole("heading", { name: "Invitations" }).locator("xpath=ancestor::section[1]");
}

function inviteRoleSelect(page: Page) {
  return invitationsSection(page).locator("select").first();
}

function inviteInput(page: Page) {
  return invitationsSection(page).getByPlaceholder("teammate@company.com");
}

function sendInviteButton(page: Page) {
  return invitationsSection(page).getByRole("button", { name: "Send invite" });
}

async function sendPendingInvite(page: Page, email: string, role: "admin" | "editor" | "reader" = "editor") {
  await inviteRoleSelect(page).selectOption(role);
  await inviteInput(page).fill(email);
  await sendInviteButton(page).click();
  await expect(page.getByText(email)).toBeVisible();
}

test.describe("Team settings matrix interactions", () => {
  test("pro trial billing supports desktop and mobile click paths", async ({ page }) => {
    const calls: string[] = [];
    await stubBillingCheckout(page, (plan) => {
      calls.push(plan);
      return {
        status: 200,
        body: {
          mode: "trial_started" satisfies CheckoutMode,
          team: trialTeam("pro_trial"),
        },
      };
    });

    await gotoSettings(page);
    await billingButton(page, "14-day trial").click();
    await expect(page.getByText("Pro trial activated. Your team now has pro access for 14 days.")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await billingButton(page, "14-day trial").click();

    expect(calls).toEqual(["pro_trial", "pro_trial"]);
  });

  test("pro trial billing shows validation/error response", async ({ page }) => {
    await stubBillingCheckout(page, () => ({
      status: 500,
      body: { error: { message: "Pro trial billing failed" } },
    }));

    await gotoSettings(page);
    await billingButton(page, "14-day trial").click();
    await expect(page.getByText("Pro trial billing failed")).toBeVisible();
  });

  test("pro trial billing action remains usable after reload", async ({ page }) => {
    let callCount = 0;
    await stubBillingCheckout(page, () => {
      callCount += 1;
      return {
        status: 500,
        body: { error: { message: "Try pro trial again" } },
      };
    });

    await gotoSettings(page);
    await billingButton(page, "14-day trial").click();
    await expect(page.getByText("Try pro trial again")).toBeVisible();
    await page.reload();
    await billingButton(page, "14-day trial").click();

    expect(callCount).toBe(2);
  });

  test("pro billing supports desktop and mobile click paths", async ({ page }) => {
    const calls: string[] = [];
    await stubBillingCheckout(page, (plan) => {
      calls.push(plan);
      return {
        status: 200,
        body: {
          mode: "trial_started" satisfies CheckoutMode,
          team: trialTeam("pro"),
        },
      };
    });

    await gotoSettings(page);
    await billingButton(page, "Upgrade").click();
    await expect(page.getByText("Pro trial activated. Your team now has pro access for 14 days.")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await billingButton(page, "Upgrade").click();

    expect(calls).toEqual(["pro", "pro"]);
  });

  test("pro billing shows validation/error response", async ({ page }) => {
    await stubBillingCheckout(page, () => ({
      status: 500,
      body: { error: { message: "Pro upgrade failed" } },
    }));

    await gotoSettings(page);
    await billingButton(page, "Upgrade").click();
    await expect(page.getByText("Pro upgrade failed")).toBeVisible();
  });

  test("pro billing action remains usable after reload", async ({ page }) => {
    let callCount = 0;
    await stubBillingCheckout(page, () => {
      callCount += 1;
      return {
        status: 500,
        body: { error: { message: "Try pro upgrade again" } },
      };
    });

    await gotoSettings(page);
    await billingButton(page, "Upgrade").click();
    await expect(page.getByText("Try pro upgrade again")).toBeVisible();
    await page.reload();
    await billingButton(page, "Upgrade").click();

    expect(callCount).toBe(2);
  });

  test("enterprise billing supports desktop and mobile click paths", async ({ page }) => {
    const calls: string[] = [];
    await stubBillingCheckout(page, (plan) => {
      calls.push(plan);
      return {
        status: 200,
        body: {
          mode: "trial_started" satisfies CheckoutMode,
          team: trialTeam("enterprise"),
        },
      };
    });

    await gotoSettings(page);
    await billingButton(page, "Talk to Sales").click();
    await expect(page.getByText("Pro trial activated. Your team now has pro access for 14 days.")).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await billingButton(page, "Talk to Sales").click();

    expect(calls).toEqual(["enterprise", "enterprise"]);
  });

  test("enterprise billing shows validation/error response", async ({ page }) => {
    await stubBillingCheckout(page, () => ({
      status: 500,
      body: { error: { message: "Enterprise checkout failed" } },
    }));

    await gotoSettings(page);
    await billingButton(page, "Talk to Sales").click();
    await expect(page.getByText("Enterprise checkout failed")).toBeVisible();
  });

  test("enterprise billing action remains usable after reload", async ({ page }) => {
    let callCount = 0;
    await stubBillingCheckout(page, () => {
      callCount += 1;
      return {
        status: 500,
        body: { error: { message: "Try enterprise checkout again" } },
      };
    });

    await gotoSettings(page);
    await billingButton(page, "Talk to Sales").click();
    await expect(page.getByText("Try enterprise checkout again")).toBeVisible();
    await page.reload();
    await billingButton(page, "Talk to Sales").click();

    expect(callCount).toBe(2);
  });

  test("team profile save form supports desktop submit and reload persistence", async ({ page }) => {
    await gotoSettings(page);
    const name = `Matrix Team ${Date.now()}`;

    await teamNameInput(page).fill(name);
    await saveTeamButton(page).click();
    await expect(page.getByText("Team settings updated.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(name) })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(name) })).toBeVisible();
  });

  test("team profile save form validates empty input", async ({ page }) => {
    let patchCount = 0;
    await page.route("**/api/team/settings", async (route) => {
      if (route.request().method() === "PATCH") {
        patchCount += 1;
      }
      await route.continue();
    });

    await gotoSettings(page);
    await teamNameInput(page).fill("   ");
    await saveTeamButton(page).click();

    expect(patchCount).toBe(0);
    await expect(page.getByText("Team name is required.")).toBeVisible();
  });

  test("team profile save form supports mobile submit", async ({ page }) => {
    await gotoSettings(page, true);
    const name = `Mobile Team ${Date.now()}`;

    await teamNameInput(page).fill(name);
    await saveTeamButton(page).click();
    await expect(page.getByText("Team settings updated.")).toBeVisible();
  });

  test("team name input supports desktop edit, validation path, reload reset, and mobile edit", async ({ page }) => {
    await gotoSettings(page);
    const baseline = await teamNameInput(page).inputValue();

    await teamNameInput(page).fill("Desktop Input Name");
    await expect(teamNameInput(page)).toHaveValue("Desktop Input Name");

    await teamNameInput(page).fill("   ");
    await saveTeamButton(page).click();
    await expect(page.getByText("Team name is required.")).toBeVisible();

    await teamNameInput(page).fill("Unsaved Temp Name");
    await page.reload();
    await expect(teamNameInput(page)).toHaveValue(baseline);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await teamNameInput(page).fill("Mobile Input Name");
    await expect(teamNameInput(page)).toHaveValue("Mobile Input Name");
  });

  test("member role change supports desktop happy path", async ({ page, request }) => {
    const email = `matrix-role-happy-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, email, "editor");

    await gotoSettings(page);
    const memberCard = memberCardByEmail(page, email);
    await expect(memberCard).toBeVisible();
    await memberCard.locator("select").selectOption("reader");

    await expect(page.getByText(new RegExp(`${email} is now Reader\\.`))).toBeVisible();
  });

  test("member role change shows error path on API failure", async ({ page, request }) => {
    const email = `matrix-role-error-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, email, "editor");

    await page.route("**/api/team/members/*", async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Role update failed" } }),
        });
        return;
      }
      await route.continue();
    });

    await gotoSettings(page);
    const memberCard = memberCardByEmail(page, email);
    await expect(memberCard).toBeVisible();
    await memberCard.locator("select").selectOption("admin");

    await expect(page.getByText("Role update failed")).toBeVisible();
  });

  test("member role change persists after reload", async ({ page, request }) => {
    const email = `matrix-role-persist-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, email, "editor");

    await gotoSettings(page);
    const memberCard = memberCardByEmail(page, email);
    await expect(memberCard).toBeVisible();
    await memberCard.locator("select").selectOption("reader");
    await expect(page.getByText(new RegExp(`${email} is now Reader\\.`))).toBeVisible();

    await page.reload();
    const reloadedMemberCard = memberCardByEmail(page, email);
    await expect(reloadedMemberCard).toBeVisible();
    await expect(reloadedMemberCard.locator("select")).toHaveValue("reader");
  });

  test("member role change supports mobile interaction", async ({ page, request }) => {
    const email = `matrix-role-mobile-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, email, "editor");

    await gotoSettings(page, true);
    const memberCard = memberCardByEmail(page, email);
    await expect(memberCard).toBeVisible();
    await memberCard.locator("select").selectOption("reader");

    await expect(page.getByText(new RegExp(`${email} is now Reader\\.`))).toBeVisible();
  });

  test("member removal supports desktop happy path", async ({ page, request }) => {
    const email = `matrix-remove-happy-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, email, "editor");

    await gotoSettings(page);
    const memberCard = memberCardByEmail(page, email);
    await expect(memberCard).toBeVisible();
    await memberCard.getByRole("button", { name: "Remove" }).click();

    await expect(page.getByText(new RegExp(`${email} removed from team\\.`))).toBeVisible();
    await expect(memberCardByEmail(page, email)).toHaveCount(0);
  });

  test("member removal shows validation/error response", async ({ page, request }) => {
    const email = `matrix-remove-error-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, email, "editor");

    await page.route("**/api/team/members/*", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Member removal failed" } }),
        });
        return;
      }
      await route.continue();
    });

    await gotoSettings(page);
    const memberCard = memberCardByEmail(page, email);
    await expect(memberCard).toBeVisible();
    await memberCard.getByRole("button", { name: "Remove" }).click();

    await expect(page.getByText("Member removal failed")).toBeVisible();
    await expect(memberCard).toBeVisible();
  });

  test("member removal persists after reload", async ({ page, request }) => {
    const email = `matrix-remove-persist-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, email, "editor");

    await gotoSettings(page);
    const memberCard = memberCardByEmail(page, email);
    await expect(memberCard).toBeVisible();
    await memberCard.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(new RegExp(`${email} removed from team\\.`))).toBeVisible();

    await page.reload();
    await expect(memberCardByEmail(page, email)).toHaveCount(0);
  });

  test("member removal supports mobile interaction", async ({ page, request }) => {
    const email = `matrix-remove-mobile-${Date.now()}@example.com`;
    await inviteTeamMemberAndAccept(request, email, "editor");

    await gotoSettings(page, true);
    const memberCard = memberCardByEmail(page, email);
    await expect(memberCard).toBeVisible();
    await memberCard.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText(new RegExp(`${email} removed from team\\.`))).toBeVisible();
  });

  test("invite form supports desktop happy path", async ({ page }) => {
    const email = `matrix-invite-happy-${Date.now()}@example.com`;
    await gotoSettings(page);
    await sendPendingInvite(page, email, "editor");
    await expect(page.getByText("Invitation sent as Editor.")).toBeVisible();
  });

  test("invite form shows validation/error path", async ({ page }) => {
    let inviteCalls = 0;
    await page.route("**/api/team/invitations", async (route) => {
      if (route.request().method() === "POST") {
        inviteCalls += 1;
      }
      await route.continue();
    });

    await gotoSettings(page);
    await sendInviteButton(page).click();
    expect(inviteCalls).toBe(0);
    await expect(page.getByText("Enter at least one invite email.")).toBeVisible();
  });

  test("invite form submission persists after reload", async ({ page }) => {
    const email = `matrix-invite-persist-${Date.now()}@example.com`;
    await gotoSettings(page);
    await sendPendingInvite(page, email, "editor");
    await page.reload();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("invite form supports mobile submission", async ({ page }) => {
    const email = `matrix-invite-mobile-${Date.now()}@example.com`;
    await gotoSettings(page, true);
    await sendPendingInvite(page, email, "editor");
    await expect(page.getByText("Invitation sent as Editor.")).toBeVisible();
  });

  test("invite role selection supports desktop happy path and mobile", async ({ page }) => {
    const desktopEmail = `matrix-role-select-${Date.now()}@example.com`;
    await gotoSettings(page);
    await inviteRoleSelect(page).selectOption("admin");
    await expect(inviteRoleSelect(page)).toHaveValue("admin");
    await inviteInput(page).fill(desktopEmail);
    await sendInviteButton(page).click();
    await expect(page.getByText(desktopEmail)).toBeVisible();

    const mobileEmail = `matrix-role-select-mobile-${Date.now()}@example.com`;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await inviteRoleSelect(page).selectOption("reader");
    await expect(inviteRoleSelect(page)).toHaveValue("reader");
    await inviteInput(page).fill(mobileEmail);
    await sendInviteButton(page).click();
    await expect(page.getByText(mobileEmail)).toBeVisible();
  });

  test("invite role selection validates invalid values and resets on reload", async ({ page }) => {
    const email = `matrix-role-invalid-${Date.now()}@example.com`;
    await gotoSettings(page);

    await inviteRoleSelect(page).evaluate((element) => {
      const select = element as HTMLSelectElement;
      select.value = "not-a-role";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await inviteInput(page).fill(email);
    await sendInviteButton(page).click();

    await expect(page.getByText("Invitation sent as Editor.")).toBeVisible();

    await inviteRoleSelect(page).selectOption("reader");
    await expect(inviteRoleSelect(page)).toHaveValue("reader");
    await page.reload();
    await expect(inviteRoleSelect(page)).toHaveValue("editor");
  });

  test("invite input supports desktop/mobile editing, validation, and reload reset", async ({ page }) => {
    await gotoSettings(page);

    await inviteInput(page).fill("desktop-input@example.com");
    await expect(inviteInput(page)).toHaveValue("desktop-input@example.com");

    await page.route("**/api/team/invitations", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Invite email invalid" } }),
        });
        return;
      }
      await route.continue();
    });
    await sendInviteButton(page).click();
    await expect(page.getByText("Invite email invalid")).toBeVisible();

    await inviteInput(page).fill("unsaved@example.com");
    await page.reload();
    await expect(inviteInput(page)).toHaveValue("");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await inviteInput(page).fill("mobile-input@example.com");
    await expect(inviteInput(page)).toHaveValue("mobile-input@example.com");
  });

  test("cancel invitation supports desktop happy path", async ({ page }) => {
    const email = `matrix-cancel-happy-${Date.now()}@example.com`;
    await gotoSettings(page);
    await sendPendingInvite(page, email, "editor");

    const inviteRow = page.locator("article").filter({ hasText: email }).first();
    await inviteRow.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(`Canceled invite for ${email}.`)).toBeVisible();
    await expect(page.locator("article").filter({ hasText: email })).toHaveCount(0);
  });

  test("cancel invitation shows validation/error response", async ({ page }) => {
    const email = `matrix-cancel-error-${Date.now()}@example.com`;
    await gotoSettings(page);
    await sendPendingInvite(page, email, "editor");

    await page.route("**/api/team/invitations/*", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Cancel invitation failed" } }),
        });
        return;
      }
      await route.continue();
    });

    const inviteRow = page.locator("article").filter({ hasText: email }).first();
    await inviteRow.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText("Cancel invitation failed")).toBeVisible();
    await expect(inviteRow).toBeVisible();
  });

  test("cancel invitation persists after reload", async ({ page }) => {
    const email = `matrix-cancel-persist-${Date.now()}@example.com`;
    await gotoSettings(page);
    await sendPendingInvite(page, email, "editor");

    await page.locator("article").filter({ hasText: email }).first().getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(`Canceled invite for ${email}.`)).toBeVisible();
    await page.reload();
    await expect(page.locator("article").filter({ hasText: email })).toHaveCount(0);
  });

  test("cancel invitation supports mobile interaction", async ({ page }) => {
    const email = `matrix-cancel-mobile-${Date.now()}@example.com`;
    await gotoSettings(page, true);
    await sendPendingInvite(page, email, "editor");

    await page.locator("article").filter({ hasText: email }).first().getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(`Canceled invite for ${email}.`)).toBeVisible();
  });
});
