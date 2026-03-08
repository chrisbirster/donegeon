#!/usr/bin/env bun
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();
const envPath = path.join(rootDir, ".env");
const templatePath = path.join(rootDir, ".env.production.example");
const infraEnvPath = path.join(rootDir, "infra", ".env");
const infraOutputsPath = path.join(rootDir, "infra", ".sst", "outputs.json");

const info = [];
const warnings = [];

function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function randomHex(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function parseEnvFile(filePath) {
  const map = {};
  if (!fileExists(filePath)) {
    return map;
  }
  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const idx = rawLine.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const key = rawLine.slice(0, idx).trim();
    if (!key) {
      continue;
    }
    const value = rawLine.slice(idx + 1);
    map[key] = value;
  }
  return map;
}

function commandExists(command) {
  try {
    execFileSync("sh", ["-lc", `command -v ${command} >/dev/null 2>&1`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args, { allowFailure = false } = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return "";
    }
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    const details = stderr || stdout || String(error);
    throw new Error(`${command} ${args.join(" ")} failed: ${details}`);
  }
}

function setIfEmpty(values, key, value) {
  if (isBlank(value)) {
    return;
  }
  if (isBlank(values[key])) {
    values[key] = String(value);
  }
}

function isPlaceholderSecret(key, value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return false;
  }

  const known = {
    DONEGEON_API_TOKEN: new Set(["change-me-in-prod-write-token", "TOKEN_VALID"]),
    DONEGEON_READONLY_API_TOKEN: new Set(["change-me-in-prod-read-token", "TOKEN_READONLY"]),
    DONEGEON_COOKIE_SIGNING_KEY: new Set(["secret-key-at-least-32-chars-long", "change-me-in-prod"]),
    DONEGEON_AUTH_CODE_PEPPER: new Set(["another-secret-pepper-string", "change-me-in-prod"]),
    DONEGEON_EMAIL_SEND_AUTH_VALUE: new Set(["change-me", "replace-me"]),
  };

  if (known[key] && known[key].has(raw)) {
    return true;
  }

  if (/^(change-me|replace-me|your-|example|placeholder)/i.test(raw)) {
    return true;
  }

  return false;
}

function setRandomIfBlankOrPlaceholder(values, key, bytes = 32) {
  if (isBlank(values[key]) || isPlaceholderSecret(key, values[key])) {
    values[key] = randomHex(bytes);
    info.push(`generated secure value for ${key}`);
  }
}

function parseTursoURLFromShow(showOutput) {
  const match = showOutput.match(/^URL:\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function inferTursoDatabaseNameFromList(url) {
  if (isBlank(url) || !commandExists("turso")) {
    return "";
  }
  const listOutput = runCommand("turso", ["db", "list"], { allowFailure: true });
  if (!listOutput) {
    return "";
  }
  for (const line of listOutput.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("NAME")) {
      continue;
    }
    if (!trimmed.includes(url)) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length > 0) {
      return parts[0];
    }
  }
  return "";
}

function ensureTurso(values) {
  const backend = String(values.DONEGEON_DB_BACKEND || "").toLowerCase();
  if (backend !== "turso") {
    return;
  }
  if (!commandExists("turso")) {
    throw new Error("turso CLI not found. Install it and run `turso auth login` first.");
  }

  const location = process.env.DEPLOY_ENV_TURSO_LOCATION || "aws-us-east-1";
  let dbName = (process.env.DEPLOY_ENV_TURSO_DB_NAME || "").trim();
  if (!dbName) {
    dbName = inferTursoDatabaseNameFromList(values.DONEGEON_DB_URL);
  }
  if (!dbName) {
    dbName = "donegeon";
  }

  const refreshURL =
    process.env.DEPLOY_ENV_REFRESH_DB_URL === "1" ||
    isBlank(values.DONEGEON_DB_URL) ||
    String(values.DONEGEON_DB_URL).includes("<org>");

  if (refreshURL) {
    let showOutput = runCommand("turso", ["db", "show", dbName], { allowFailure: true });
    if (!showOutput) {
      info.push(`creating Turso database '${dbName}' (${location})`);
      runCommand("turso", ["db", "create", dbName, "--location", location, "--wait"]);
      showOutput = runCommand("turso", ["db", "show", dbName]);
    }
    const dbURL = parseTursoURLFromShow(showOutput);
    if (isBlank(dbURL)) {
      throw new Error(`failed to resolve Turso URL for '${dbName}'`);
    }
    values.DONEGEON_DB_URL = dbURL;
    info.push(`resolved Turso URL for '${dbName}'`);
  }

  const rotateToken = process.env.DEPLOY_ENV_ROTATE_DB_TOKEN === "1";
  if (isBlank(values.DONEGEON_DB_AUTH_TOKEN) || rotateToken) {
    const token = runCommand("turso", ["db", "tokens", "create", dbName]);
    if (isBlank(token)) {
      throw new Error(`failed to create Turso auth token for '${dbName}'`);
    }
    values.DONEGEON_DB_AUTH_TOKEN = token;
    info.push(rotateToken ? `rotated Turso token for '${dbName}'` : `generated Turso token for '${dbName}'`);
  }
}

function applyInfraOutputs(values) {
  if (!fileExists(infraOutputsPath)) {
    warnings.push("infra/.sst/outputs.json not found; email send URL/header were not auto-derived from SST outputs.");
    return;
  }
  try {
    const outputs = JSON.parse(fs.readFileSync(infraOutputsPath, "utf8"));
    const base = String(outputs.emailApiBaseUrl || "").trim();
    const authHeader = String(outputs.authHeaderName || "Authorization").trim();
    if (base) {
      setIfEmpty(values, "DONEGEON_EMAIL_SEND_URL", `${base.replace(/\/$/, "")}/send`);
    }
    setIfEmpty(values, "DONEGEON_EMAIL_SEND_AUTH_HEADER", authHeader || "Authorization");
    setIfEmpty(values, "DONEGEON_OTP_MAIL_PROVIDER", "sst");
    setIfEmpty(values, "DONEGEON_TEAM_INVITE_MAIL_PROVIDER", "sst");
  } catch (error) {
    warnings.push(`failed to parse infra outputs: ${String(error.message || error)}`);
  }
}

function buildValues() {
  if (!fileExists(templatePath)) {
    throw new Error(".env.production.example is required for deploy:env");
  }

  const current = parseEnvFile(envPath);
  const infraEnv = parseEnvFile(infraEnvPath);
  const values = {};

  for (const [key, value] of Object.entries(current)) {
    if (!isBlank(value)) {
      values[key] = value;
    }
  }

  // Pull common deploy keys from infra/.env when root .env is missing them.
  const infraAllowlist = [
    "DONEGEON_APP_BASE_URL",
    "DONEGEON_API_TOKEN",
    "DONEGEON_READONLY_API_TOKEN",
    "DONEGEON_COOKIE_SIGNING_KEY",
    "DONEGEON_AUTH_CODE_PEPPER",
    "DONEGEON_COOKIE_DOMAIN",
    "DONEGEON_COOKIE_SECURE",
    "DONEGEON_COOKIE_SAMESITE",
    "DONEGEON_AUTH_SESSION_TTL",
    "DONEGEON_AUTH_CODE_TTL",
    "DONEGEON_AUTH_CODE_LENGTH",
    "DONEGEON_AUTH_MAX_CODE_ATTEMPTS",
    "DONEGEON_AUTH_DEBUG_CODE",
    "DONEGEON_EMAIL_SEND_AUTH_VALUE",
    "DONEGEON_EMAIL_SEND_AUTH_HEADER",
    "DONEGEON_STRIPE_SECRET_KEY",
    "DONEGEON_STRIPE_WEBHOOK_SECRET",
    "DONEGEON_STRIPE_PRICE_PRO",
    "DONEGEON_STRIPE_CHECKOUT_SUCCESS_URL",
    "DONEGEON_STRIPE_CHECKOUT_CANCEL_URL",
    "DONEGEON_GOOGLE_CALENDAR_CLIENT_ID",
    "DONEGEON_GOOGLE_CALENDAR_CLIENT_SECRET",
  ];
  for (const key of infraAllowlist) {
    setIfEmpty(values, key, infraEnv[key]);
  }

  const defaults = {
    DONEGEON_ENV: "production",
    DONEGEON_HTTP_PORT: "42069",
    DONEGEON_LOG_LEVEL: "info",
    DONEGEON_REQUIRE_AUTH: "true",
    DONEGEON_REQUEST_TIMEOUT: "15s",
    DONEGEON_SHUTDOWN_TIMEOUT: "10s",
    DONEGEON_APP_BASE_URL: "https://app.donegeon.com",
    DONEGEON_CORS_ALLOWED_ORIGINS: "https://donegeon.com,https://app.donegeon.com",
    DONEGEON_DB_BACKEND: "turso",
    DONEGEON_DB_PATH: "donegeon.db",
    DONEGEON_COOKIE_SECURE: "true",
    DONEGEON_COOKIE_SAMESITE: "lax",
    DONEGEON_COOKIE_DOMAIN: "app.donegeon.com",
    DONEGEON_AUTH_SESSION_TTL: "720h",
    DONEGEON_AUTH_CODE_TTL: "10m",
    DONEGEON_AUTH_CODE_LENGTH: "6",
    DONEGEON_AUTH_MAX_CODE_ATTEMPTS: "5",
    DONEGEON_AUTH_DEBUG_CODE: "false",
    DONEGEON_OTP_MAIL_PROVIDER: "sst",
    DONEGEON_TEAM_INVITE_MAIL_PROVIDER: "sst",
    DONEGEON_EMAIL_SEND_AUTH_HEADER: "Authorization",
    DONEGEON_STRIPE_CHECKOUT_SUCCESS_URL: "https://app.donegeon.com/team/settings?billing=success",
    DONEGEON_STRIPE_CHECKOUT_CANCEL_URL: "https://app.donegeon.com/team/settings?billing=canceled",
    DONEGEON_CALENDAR_OAUTH_STATE_TTL: "15m",
    DONEGEON_CALENDAR_PROVIDER_TIMEOUT: "15s",
    DONEGEON_CONFIG_PATH: "/app/donegeon_config.yml",
    DONEGEON_DATA_DIR: "/app/data",
    DONEGEON_STATIC_DIR: "/app/static",
  };
  for (const [key, value] of Object.entries(defaults)) {
    setIfEmpty(values, key, value);
  }

  // Generate strong random values for required secrets when absent or still placeholders.
  setRandomIfBlankOrPlaceholder(values, "DONEGEON_API_TOKEN", 32);
  setRandomIfBlankOrPlaceholder(values, "DONEGEON_READONLY_API_TOKEN", 32);
  setRandomIfBlankOrPlaceholder(values, "DONEGEON_COOKIE_SIGNING_KEY", 32);
  setRandomIfBlankOrPlaceholder(values, "DONEGEON_AUTH_CODE_PEPPER", 32);
  setRandomIfBlankOrPlaceholder(values, "DONEGEON_EMAIL_SEND_AUTH_VALUE", 32);

  // Keep legacy runtime config keys if they already exist in root .env.
  setIfEmpty(values, "DONEGEON_BOARD_CONFIG_PATH", current.DONEGEON_BOARD_CONFIG_PATH || "donegeon_config.yml");
  setIfEmpty(values, "DONEGEON_QUEST_CONFIG_PATH", current.DONEGEON_QUEST_CONFIG_PATH || "docs/quests.yaml");

  applyInfraOutputs(values);
  ensureTurso(values);

  return values;
}

function writeEnv(values) {
  const templateLines = fs.readFileSync(templatePath, "utf8").split(/\r?\n/);
  const seen = new Set();
  const output = [];

  for (const line of templateLines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      output.push(line);
      continue;
    }
    const key = match[1];
    seen.add(key);
    output.push(`${key}=${isBlank(values[key]) ? "" : values[key]}`);
  }

  const extras = Object.keys(values)
    .filter((key) => key.startsWith("DONEGEON_") && !seen.has(key))
    .sort();

  if (extras.length > 0) {
    output.push("");
    output.push("# Preserved extra keys");
    for (const key of extras) {
      output.push(`${key}=${values[key]}`);
    }
  }

  fs.writeFileSync(envPath, `${output.join("\n").replace(/\n+$/, "\n")}`);
}

function printStatus(values) {
  const reportKeys = [
    "DONEGEON_DB_BACKEND",
    "DONEGEON_DB_URL",
    "DONEGEON_DB_AUTH_TOKEN",
    "DONEGEON_APP_BASE_URL",
    "DONEGEON_EMAIL_SEND_URL",
    "DONEGEON_EMAIL_SEND_AUTH_HEADER",
    "DONEGEON_EMAIL_SEND_AUTH_VALUE",
    "DONEGEON_GOOGLE_CALENDAR_CLIENT_ID",
    "DONEGEON_GOOGLE_CALENDAR_CLIENT_SECRET",
    "DONEGEON_STRIPE_SECRET_KEY",
    "DONEGEON_STRIPE_WEBHOOK_SECRET",
    "DONEGEON_STRIPE_PRICE_PRO",
  ];

  console.log("deploy:env status");
  for (const key of reportKeys) {
    const value = values[key];
    const status = isBlank(value) ? "MISSING" : `SET(len:${String(value).length})`;
    console.log(`- ${key}=${status}`);
  }
}

function validateCritical(values) {
  const critical = ["DONEGEON_DB_BACKEND", "DONEGEON_DB_URL", "DONEGEON_DB_AUTH_TOKEN", "DONEGEON_APP_BASE_URL"];
  const missing = critical.filter((key) => isBlank(values[key]));
  if (missing.length > 0) {
    throw new Error(`critical deploy keys are missing: ${missing.join(", ")}`);
  }
}

function main() {
  const values = buildValues();
  validateCritical(values);
  writeEnv(values);

  if (info.length > 0) {
    for (const line of info) {
      console.log(`info: ${line}`);
    }
  }
  if (warnings.length > 0) {
    for (const line of warnings) {
      console.warn(`warning: ${line}`);
    }
  }

  printStatus(values);
  console.log("wrote .env");
}

try {
  main();
} catch (error) {
  console.error(`deploy:env failed: ${String(error.message || error)}`);
  process.exit(1);
}
