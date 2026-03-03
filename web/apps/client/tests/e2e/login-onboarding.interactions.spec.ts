import { expect, test, type Page } from "@playwright/test";

type SessionStub = {
  session: {
    user: {
      id: string;
      email: string;
      name: string;
      showOnboarding: boolean;
      currentWorkspaceId?: string;
    };
    team: {
      id: string;
      name: string;
      plan: string;
      isArchived: boolean;
    };
  };
};

function buildSession(email: string, showOnboarding: boolean, userName = "E2E User"): SessionStub {
  return {
    session: {
      user: {
        id: "user-e2e",
        email,
        name: userName,
        showOnboarding,
        currentWorkspaceId: "ws-e2e",
      },
      team: {
        id: "ws-e2e",
        name: "E2E Team",
        plan: "personal",
        isArchived: false,
      },
    },
  };
}

async function mockAuthMeLoggedOut(page: Page) {
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { message: "unauthorized" } }),
    });
  });
}

async function gotoLogin(page: Page, mobile = false, suffix = "") {
  if (mobile) {
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page.goto(`/login${suffix}`);
}

async function mockOnboardingAuth(
  page: Page,
  options: { email?: string; userName?: string; transitionToComplete?: boolean } = {},
) {
  const email = options.email || "onboard@example.com";
  const userName = options.userName || "E2E User";
  const transitionToComplete = options.transitionToComplete ?? false;

  let calls = 0;
  await page.route("**/api/auth/me", async (route) => {
    calls += 1;
    const showOnboarding = transitionToComplete ? calls === 1 : true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildSession(email, showOnboarding, userName)),
    });
  });
}

test.describe("Login + onboarding interactions", () => {
  test("submits login request form with typed email and enters verify step", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    const email = `login-${Date.now()}@example.com`;
    let capturedEmail = "";
    await page.route("**/api/auth/login/request", async (route) => {
      const payload = route.request().postDataJSON() as { email?: string };
      capturedEmail = payload.email || "";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-1",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "123456",
        }),
      });
    });

    await gotoLogin(page);
    await page.getByPlaceholder("you@company.com").fill(email);
    await page.getByRole("button", { name: "Continue" }).click();

    expect(capturedEmail).toBe(email);
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText("Dev OTP:")).toBeVisible();
  });

  test("prevents submitting invalid email format on login request form", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    let requestCount = 0;
    await page.route("**/api/auth/login/request", async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-2",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "123456",
        }),
      });
    });

    await gotoLogin(page);
    await page.getByPlaceholder("you@company.com").fill("not-an-email");
    await page.getByRole("button", { name: "Continue" }).click();

    expect(requestCount).toBe(0);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("resets login request and email input state on reload", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-3",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "123456",
        }),
      });
    });

    await gotoLogin(page);
    await page.getByPlaceholder("you@company.com").fill("persist@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByPlaceholder("you@company.com")).toHaveValue("");
  });

  test("supports login request and email input on mobile viewport", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-4",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "654321",
        }),
      });
    });

    await gotoLogin(page, true);
    await page.getByPlaceholder("you@company.com").fill("mobile@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  });

  test("keeps invitation-locked email unchanged when typing", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/invitation?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          invitation: {
            invitationCode: "invite-code",
            email: "locked@example.com",
            teamName: "Invite Team",
            status: "pending",
          },
        }),
      });
    });

    await gotoLogin(page, false, "?invite=invite-code");
    const emailInput = page.getByPlaceholder("you@company.com");
    await expect(page.getByText("Email is locked to your invitation address.")).toBeVisible();
    await expect(emailInput).toHaveValue("locked@example.com");
    await expect(emailInput).toHaveAttribute("readonly", "");
  });

  test("submits verification form and reaches onboarding flow", async ({ page }) => {
    let authMeCalls = 0;
    await page.route("**/api/auth/me", async (route) => {
      authMeCalls += 1;
      if (authMeCalls === 1) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "unauthorized" } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildSession("verify@example.com", true)),
      });
    });

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-6",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "123456",
        }),
      });
    });

    await page.route("**/api/auth/login/verify", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildSession("verify@example.com", true)),
      });
    });

    await gotoLogin(page);
    await page.getByPlaceholder("you@company.com").fill("verify@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByPlaceholder("000000").fill("123456");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page).toHaveURL(/\/onboarding\?plan=personal$/);
    await expect(page.getByRole("heading", { name: "Create your team" })).toBeVisible();
  });

  test("shows error when verification form submission fails", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-7",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "222222",
        }),
      });
    });

    await page.route("**/api/auth/login/verify", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Invalid verification code" } }),
      });
    });

    await gotoLogin(page);
    await page.getByPlaceholder("you@company.com").fill("bad-code@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByPlaceholder("000000").fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.getByText("Invalid verification code")).toBeVisible();
  });

  test("resets verification form and code input state after reload", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-8",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "333333",
        }),
      });
    });

    await gotoLogin(page);
    await page.getByPlaceholder("you@company.com").fill("reload-verify@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByPlaceholder("000000").fill("333333");
    await page.reload();

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByPlaceholder("000000")).toHaveCount(0);
  });

  test("supports verification submit and code input on mobile viewport", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-9",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "444444",
        }),
      });
    });

    let submittedCode = "";
    await page.route("**/api/auth/login/verify", async (route) => {
      const payload = route.request().postDataJSON() as { code?: string };
      submittedCode = payload.code || "";
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Invalid verification code" } }),
      });
    });

    await gotoLogin(page, true);
    await page.getByPlaceholder("you@company.com").fill("mobile-verify@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByPlaceholder("000000").fill("444444");
    await page.getByRole("button", { name: "Verify" }).click();

    expect(submittedCode).toBe("444444");
    await expect(page.getByText("Invalid verification code")).toBeVisible();
  });

  test("returns to request form from verify screen via use-different-email", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-10",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "555555",
        }),
      });
    });

    await gotoLogin(page);
    await page.getByPlaceholder("you@company.com").fill("switch@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Use a different email" }).click();

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByPlaceholder("000000")).toHaveCount(0);
  });

  test("hides use-different-email action when invitation email is locked", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/invitation?*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          invitation: {
            invitationCode: "locked-invite",
            email: "locked-action@example.com",
            teamName: "Invite Team",
            status: "pending",
          },
        }),
      });
    });

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-11",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "666666",
        }),
      });
    });

    await gotoLogin(page, false, "?invite=locked-invite");
    await expect(page.getByText("Email is locked to your invitation address.")).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use a different email" })).toHaveCount(0);
  });

  test("keeps request-form state after using different email and reloading", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-12",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "777777",
        }),
      });
    });

    await gotoLogin(page);
    await page.getByPlaceholder("you@company.com").fill("reload-switch@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Use a different email" }).click();
    await page.reload();

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByPlaceholder("000000")).toHaveCount(0);
  });

  test("supports use-different-email action on mobile viewport", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/auth/login/request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challengeId: "challenge-13",
          expiresAt: "2099-01-01T00:00:00Z",
          delivery: "debug",
          debugCode: "888888",
        }),
      });
    });

    await gotoLogin(page, true);
    await page.getByPlaceholder("you@company.com").fill("mobile-switch@example.com");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Use a different email" }).click();

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("submits onboarding form and navigates to inbox", async ({ page }) => {
    let authMeCalls = 0;
    await page.route("**/api/auth/me", async (route) => {
      authMeCalls += 1;
      const payload = authMeCalls === 1 ? buildSession("onboard@example.com", true) : buildSession("onboard@example.com", false);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });

    let onboardingPayload: Record<string, unknown> | null = null;
    await page.route("**/api/auth/onboarding", async (route) => {
      onboardingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: buildSession("onboard@example.com", false).session,
          invitations: [],
        }),
      });
    });

    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { name: "Create your team" })).toBeVisible();
    await page.getByPlaceholder("Your name").fill("Onboard User");
    await page.getByPlaceholder("My Team").fill("Onboard Team");
    await page.getByRole("button", { name: "Finish onboarding" }).click();

    expect(onboardingPayload).toBeTruthy();
    expect(onboardingPayload?.teamName).toBe("Onboard Team");
    expect(onboardingPayload?.name).toBe("Onboard User");
    await expect(page).toHaveURL(/\/task\/inbox$/);
  });

  test("shows onboarding submit error when API returns failure", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildSession("onboard-error@example.com", true)),
      });
    });

    await page.route("**/api/auth/onboarding", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Onboarding service unavailable" } }),
      });
    });

    await page.goto("/onboarding");
    await page.getByPlaceholder("My Team").fill("Broken Team");
    await page.getByRole("button", { name: "Finish onboarding" }).click();

    await expect(page.getByText("Onboarding service unavailable")).toBeVisible();
  });

  test("keeps onboarding completed state after submit and revisit", async ({ page }) => {
    await mockOnboardingAuth(page, { email: "persist-onboard@example.com", transitionToComplete: true });

    await page.route("**/api/auth/onboarding", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: buildSession("persist-onboard@example.com", false).session,
          invitations: [],
        }),
      });
    });

    await page.goto("/onboarding");
    await page.getByPlaceholder("My Team").fill("Persist Team");
    await page.getByRole("button", { name: "Finish onboarding" }).click();
    await expect(page).toHaveURL(/\/task\/inbox$/);

    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/task\/inbox$/);
  });

  test("supports onboarding submit on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockOnboardingAuth(page, { email: "mobile-onboard@example.com", transitionToComplete: true });

    let onboardingPayload: Record<string, unknown> | null = null;
    await page.route("**/api/auth/onboarding", async (route) => {
      onboardingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session: buildSession("mobile-onboard@example.com", false).session,
          invitations: [],
        }),
      });
    });

    await page.goto("/onboarding");
    await page.getByPlaceholder("My Team").fill("Mobile Team");
    await page.getByRole("button", { name: "Finish onboarding" }).click();

    expect(onboardingPayload?.teamName).toBe("Mobile Team");
    await expect(page).toHaveURL(/\/task\/inbox$/);
  });

  test("accepts optional name input and sends trimmed value on submit error", async ({ page }) => {
    await mockOnboardingAuth(page, { userName: "Server Seed" });

    let onboardingPayload: Record<string, unknown> | null = null;
    await page.route("**/api/auth/onboarding", async (route) => {
      onboardingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Name path error" } }),
      });
    });

    await page.goto("/onboarding");
    await page.getByPlaceholder("Your name").fill("  Dungeon Hero  ");
    await page.getByPlaceholder("My Team").fill("Name Team");
    await page.getByRole("button", { name: "Finish onboarding" }).click();

    expect(onboardingPayload?.name).toBe("Dungeon Hero");
    await expect(page.getByText("Name path error")).toBeVisible();
  });

  test("resets unsaved name input to server value after reload", async ({ page }) => {
    await mockOnboardingAuth(page, { userName: "Server Name" });

    await page.goto("/onboarding");
    const nameInput = page.getByPlaceholder("Your name");
    await expect(nameInput).toHaveValue("Server Name");
    await nameInput.fill("Draft Name");
    await page.reload();
    await expect(nameInput).toHaveValue("Server Name");
  });

  test("supports editing name input on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockOnboardingAuth(page, { userName: "Mobile Seed" });

    await page.goto("/onboarding");
    const nameInput = page.getByPlaceholder("Your name");
    await nameInput.fill("Mobile Hero");
    await expect(nameInput).toHaveValue("Mobile Hero");
  });

  test("supports team name input and blocks empty required submit", async ({ page }) => {
    await mockOnboardingAuth(page);

    let requestCount = 0;
    await page.route("**/api/auth/onboarding", async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "should not submit empty team" } }),
      });
    });

    await page.goto("/onboarding");
    const teamInput = page.getByPlaceholder("My Team");
    await teamInput.fill("Team Input Works");
    await expect(teamInput).toHaveValue("Team Input Works");

    await teamInput.clear();
    await page.getByRole("button", { name: "Finish onboarding" }).click();
    expect(requestCount).toBe(0);
  });

  test("resets unsaved team name input after reload", async ({ page }) => {
    await mockOnboardingAuth(page);

    await page.goto("/onboarding");
    const teamInput = page.getByPlaceholder("My Team");
    await teamInput.fill("Draft Team");
    await page.reload();
    await expect(teamInput).toHaveValue("");
  });

  test("supports team name input on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockOnboardingAuth(page);

    await page.goto("/onboarding");
    const teamInput = page.getByPlaceholder("My Team");
    await teamInput.fill("Mobile Team Name");
    await expect(teamInput).toHaveValue("Mobile Team Name");
  });

  test("selects personal plan and submits personal payload", async ({ page }) => {
    await mockOnboardingAuth(page, { email: "personal-plan@example.com" });

    let onboardingPayload: Record<string, unknown> | null = null;
    await page.route("**/api/auth/onboarding", async (route) => {
      onboardingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Personal plan error" } }),
      });
    });

    await page.goto("/onboarding?plan=enterprise");
    const personal = page.locator('input[name="plan"][value="personal"]');
    await personal.check();
    await page.getByPlaceholder("My Team").fill("Personal Plan Team");
    await page.getByRole("button", { name: "Finish onboarding" }).click();

    expect(onboardingPayload?.plan).toBe("personal");
    await expect(page.getByText("Personal plan error")).toBeVisible();
  });

  test("resets personal plan selection from URL default on reload and supports mobile", async ({ page }) => {
    await mockOnboardingAuth(page);

    await page.goto("/onboarding?plan=enterprise");
    const personal = page.locator('input[name="plan"][value="personal"]');
    const enterprise = page.locator('input[name="plan"][value="enterprise"]');
    await personal.check();
    await expect(personal).toBeChecked();
    await page.reload();
    await expect(enterprise).toBeChecked();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding?plan=enterprise");
    await personal.check();
    await expect(personal).toBeChecked();
  });

  test("selects pro trial plan and submits pro trial payload", async ({ page }) => {
    await mockOnboardingAuth(page, { email: "pro-trial@example.com" });

    let onboardingPayload: Record<string, unknown> | null = null;
    await page.route("**/api/auth/onboarding", async (route) => {
      onboardingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Pro trial plan error" } }),
      });
    });

    await page.goto("/onboarding");
    const proTrial = page.locator('input[name="plan"][value="pro_trial"]');
    await proTrial.check();
    await page.getByPlaceholder("My Team").fill("Pro Trial Team");
    await page.getByRole("button", { name: "Finish onboarding" }).click();

    expect(onboardingPayload?.plan).toBe("pro_trial");
    await expect(page.getByText("Pro trial plan error")).toBeVisible();
  });

  test("resets pro trial plan selection on reload and supports mobile", async ({ page }) => {
    await mockOnboardingAuth(page);

    await page.goto("/onboarding");
    const proTrial = page.locator('input[name="plan"][value="pro_trial"]');
    const personal = page.locator('input[name="plan"][value="personal"]');
    await proTrial.check();
    await expect(proTrial).toBeChecked();
    await page.reload();
    await expect(personal).toBeChecked();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding");
    await proTrial.check();
    await expect(proTrial).toBeChecked();
  });

  test("selects enterprise plan and submits enterprise payload", async ({ page }) => {
    await mockOnboardingAuth(page, { email: "enterprise@example.com" });

    let onboardingPayload: Record<string, unknown> | null = null;
    await page.route("**/api/auth/onboarding", async (route) => {
      onboardingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Enterprise plan error" } }),
      });
    });

    await page.goto("/onboarding");
    const enterprise = page.locator('input[name="plan"][value="enterprise"]');
    await enterprise.check();
    await page.getByPlaceholder("My Team").fill("Enterprise Team");
    await page.getByRole("button", { name: "Finish onboarding" }).click();

    expect(onboardingPayload?.plan).toBe("enterprise");
    await expect(page.getByText("Enterprise plan error")).toBeVisible();
  });

  test("resets enterprise plan selection on reload and supports mobile", async ({ page }) => {
    await mockOnboardingAuth(page);

    await page.goto("/onboarding");
    const enterprise = page.locator('input[name="plan"][value="enterprise"]');
    const personal = page.locator('input[name="plan"][value="personal"]');
    await enterprise.check();
    await expect(enterprise).toBeChecked();
    await page.reload();
    await expect(personal).toBeChecked();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/onboarding");
    await enterprise.check();
    await expect(enterprise).toBeChecked();
  });

  test("captures invite input parsing and shows invite validation error", async ({ page }) => {
    await mockOnboardingAuth(page);

    let onboardingPayload: Record<string, unknown> | null = null;
    await page.route("**/api/auth/onboarding", async (route) => {
      onboardingPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "Invalid invite email" } }),
      });
    });

    await page.goto("/onboarding");
    await page.getByPlaceholder("My Team").fill("Invite Team");
    await page
      .getByPlaceholder("teammate1@company.com, teammate2@company.com")
      .fill("a@example.com,\nb@example.com ; invalid-email");
    await page.getByRole("button", { name: "Finish onboarding" }).click();

    expect(onboardingPayload?.emails).toEqual(["a@example.com", "b@example.com", "invalid-email"]);
    await expect(page.getByText("Invalid invite email")).toBeVisible();
  });

  test("resets unsaved invite input after reload", async ({ page }) => {
    await mockOnboardingAuth(page);

    const inviteInput = page.getByPlaceholder("teammate1@company.com, teammate2@company.com");
    await page.goto("/onboarding");
    await inviteInput.fill("draft1@example.com, draft2@example.com");
    await page.reload();
    await expect(inviteInput).toHaveValue("");
  });

  test("supports invite input editing on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockOnboardingAuth(page);

    const inviteInput = page.getByPlaceholder("teammate1@company.com, teammate2@company.com");
    await page.goto("/onboarding");
    await inviteInput.fill("mobile1@example.com,\nmobile2@example.com");
    await expect(inviteInput).toHaveValue("mobile1@example.com,\nmobile2@example.com");
  });
});
