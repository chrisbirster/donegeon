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
  test("local beta toggle switches login into waitlist mode and submits signup", async ({ page }) => {
    await mockAuthMeLoggedOut(page);

    await page.route("**/api/public/config", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          config: {
            openBeta: true,
            openBetaStartsAt: "2026-06-01",
            openBetaStartsLabel: "June 1, 2026",
          },
        }),
      });
    });

    let payload: Record<string, string> | null = null;
    await page.route("**/api/public/waitlist", async (route) => {
      payload = route.request().postDataJSON() as Record<string, string>;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          signup: {
            id: "W_test",
            name: payload?.name || "",
            email: payload?.email || "",
            source: payload?.source || "",
            requestedPlan: payload?.requestedPlan || "",
            createdAt: "2026-03-10T00:00:00Z",
            updatedAt: "2026-03-10T00:00:00Z",
          },
          alreadyJoined: false,
          openBetaStartsAt: "2026-06-01",
          openBetaStartsLabel: "June 1, 2026",
        }),
      });
    });

    await gotoLogin(page);
    await page.getByRole("button", { name: "Waitlist" }).click();

    await expect(page.getByRole("heading", { name: "Donegeon is in closed beta" })).toBeVisible();
    await page.getByPlaceholder("Your name").fill("Local Tester");
    await page.getByPlaceholder("you@company.com").fill("local@example.com");
    await page.getByRole("button", { name: "Join the waitlist" }).click();

    expect(payload).toMatchObject({
      name: "Local Tester",
      email: "local@example.com",
      source: "app-login",
      requestedPlan: "personal",
    });
    await expect(page.getByText(/You're on the Donegeon waitlist/)).toBeVisible();
  });

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
    await expect(page.getByText("Dev OTP (filled automatically):")).toBeVisible();
    await expect(page.getByPlaceholder("000000")).toHaveValue("123456");
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
    await expect(page.getByPlaceholder("000000")).toHaveValue("123456");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page).toHaveURL(/\/onboarding\?plan=personal$/);
    await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
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
});
