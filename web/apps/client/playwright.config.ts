import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const apiPort = Number(process.env.PW_API_PORT || "42169");
const webPort = Number(process.env.PW_WEB_PORT || "4173");
const dbPath = path.resolve(repoRoot, "tmp", "playwright-e2e.db");
const dbDir = path.dirname(dbPath);
const outputDir = process.env.PW_OUTPUT_DIR || "test-results";
const realAuth = process.env.PW_REAL_AUTH === "true";

function parseScreenshotMode(value: string | undefined): "off" | "on" | "only-on-failure" {
  if (value === "off" || value === "on" || value === "only-on-failure") return value;
  return "only-on-failure";
}

const screenshotMode = parseScreenshotMode(process.env.PW_SCREENSHOT_MODE);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    channel: process.env.PW_BROWSER_CHANNEL,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://127.0.0.1:${webPort}`,
          localStorage: [{ name: "donegeon.disable_worker_bus", value: "1" }],
        },
      ],
    },
    viewport: {
      width: 1440,
      height: 900,
    },
    trace: "retain-on-failure",
    screenshot: screenshotMode,
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: `sh -c "mkdir -p '${dbDir}' && rm -f '${dbPath}' && DONEGEON_HTTP_PORT=${apiPort} DONEGEON_DB_PATH='${dbPath}' DONEGEON_REQUIRE_AUTH=${realAuth ? "true" : "false"} DONEGEON_AUTH_DEBUG_CODE=true DONEGEON_OPEN_BETA=true go run ."`,
      cwd: repoRoot,
      port: apiPort,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `sh -c "DONEGEON_API_URL='http://127.0.0.1:${apiPort}' VITE_E2E_BYPASS_AUTH=${realAuth ? "false" : "true"} npm run dev -- --host 127.0.0.1 --port ${webPort}"`,
      cwd: __dirname,
      port: webPort,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
