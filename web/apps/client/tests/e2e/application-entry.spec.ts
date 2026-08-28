import { expect, test, type Locator } from "@playwright/test";

function parseRgb(raw: string): [number, number, number] {
  const match = raw.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (!match) throw new Error(`unable to parse RGB color: ${raw}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function relativeLuminance([red, green, blue]: [number, number, number]): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

async function expectReadableButton(locator: Locator) {
  const colors = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
    };
  });

  expect(
    contrastRatio(parseRgb(colors.color), parseRgb(colors.backgroundColor)),
    `expected readable button contrast, got foreground ${colors.color} on ${colors.backgroundColor}`,
  ).toBeGreaterThanOrEqual(4.5);
}

const realAuthEnabled = process.env.PW_REAL_AUTH === "true";

test.describe("application entry with real auth", () => {
  test.skip(!realAuthEnabled, "run with PW_REAL_AUTH=true so auth is not bypassed");

  test("fresh user signs in, completes onboarding, and reaches Inbox", async ({ page }) => {
    const email = `entry-${Date.now()}@example.com`;

    await page.goto("/task/inbox");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    const emailInput = page.getByPlaceholder("you@company.com");
    const continueButton = page.getByRole("button", { name: "Continue" });

    await expect(continueButton).toBeDisabled();
    await emailInput.fill(email);
    await expect(continueButton).toBeEnabled();

    const requestPromise = page.waitForResponse(
      (response) => response.url().includes("/api/auth/login/request") && response.request().method() === "POST",
    );
    await continueButton.click();
    const requestResponse = await requestPromise;
    expect(requestResponse.ok(), `login request failed with HTTP ${requestResponse.status()}`).toBeTruthy();

    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    const verificationCode = page.getByPlaceholder("000000");
    await expect(verificationCode).toHaveValue(/^\d{6}$/);

    const verifyButton = page.getByRole("button", { name: "Verify" });
    await expect(verifyButton).toBeEnabled();
    await verifyButton.click();

    await expect(page).toHaveURL(/\/onboarding\?plan=personal$/);
    await expect(page.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();

    const finishButton = page.getByRole("button", { name: "Finish onboarding" });
    await expect(finishButton).toBeEnabled();
    await finishButton.click();

    await expect(page).toHaveURL(/\/task\/inbox$/);
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Inbox" })).toBeVisible();
  });

  test("local beta toggle is readable and waitlist submit becomes usable", async ({ page }) => {
    await page.goto("/login?local_beta=open");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    const openBetaButton = page.getByRole("button", { name: "Open beta" });
    const waitlistButton = page.getByRole("button", { name: "Waitlist" });

    await expect(openBetaButton).toHaveAttribute("aria-pressed", "true");
    await expectReadableButton(openBetaButton);

    await waitlistButton.click();
    await expect(waitlistButton).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Donegeon is in closed beta" })).toBeVisible();

    const joinButton = page.getByRole("button", { name: "Join the waitlist" });
    await expect(joinButton).toBeDisabled();

    await page.getByPlaceholder("Your name").fill("Entry Gate Tester");
    await page.getByPlaceholder("you@company.com").fill(`waitlist-${Date.now()}@example.com`);
    await expect(joinButton).toBeEnabled();

    const waitlistPromise = page.waitForResponse(
      (response) => response.url().includes("/api/public/waitlist") && response.request().method() === "POST",
    );
    await joinButton.click();
    const waitlistResponse = await waitlistPromise;
    expect(waitlistResponse.ok(), `waitlist request failed with HTTP ${waitlistResponse.status()}`).toBeTruthy();
    await expect(page.getByText(/You're on the Donegeon waitlist/)).toBeVisible();
  });
});
