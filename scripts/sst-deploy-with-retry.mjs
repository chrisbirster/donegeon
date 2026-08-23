#!/usr/bin/env node
import { spawn } from "node:child_process";

const sstArgs = ["--no-install", "sst", "deploy", ...process.argv.slice(2)];
const maxAttempts = parseNumber(process.env.DEPLOY_SST_RETRY_ATTEMPTS, 5);
const initialDelayMs = parseNumber(process.env.DEPLOY_SST_RETRY_DELAY_MS, 30000);
const maxDelayMs = parseNumber(process.env.DEPLOY_SST_RETRY_MAX_DELAY_MS, 300000);
const backoffFactor = parseNumber(process.env.DEPLOY_SST_RETRY_FACTOR, 2);

function parseNumber(raw, fallback) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCloudflareRateLimit(output) {
  return (
    /code:\s*10429/i.test(output) ||
    /rate limited/i.test(output) ||
    /too many requests/i.test(output) ||
    /\b429\b/.test(output)
  );
}

async function runAttempt(attempt) {
  console.log(`[sst-deploy] attempt ${attempt}/${maxAttempts}: npx ${sstArgs.join(" ")}`);

  return await new Promise((resolve) => {
    const child = spawn("npx", sstArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });

    let combined = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      combined += text;
      process.stderr.write(text);
    });

    child.on("close", (code, signal) => {
      resolve({
        code: code ?? 1,
        signal,
        combined,
      });
    });

    child.on("error", (error) => {
      const text = String(error?.message || error);
      combined += text;
      process.stderr.write(`${text}\n`);
      resolve({
        code: 1,
        signal: null,
        combined,
      });
    });
  });
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await runAttempt(attempt);
    if (result.code === 0) {
      return;
    }

    const retryable = isCloudflareRateLimit(result.combined);
    if (!retryable || attempt === maxAttempts) {
      const reason = retryable ? "rate limit persisted after retries" : "non-retryable failure";
      console.error(`[sst-deploy] ${reason}; exiting with code ${result.code}`);
      process.exit(result.code);
    }

    const delayMs = Math.min(initialDelayMs * Math.pow(backoffFactor, attempt - 1), maxDelayMs);
    console.warn(`[sst-deploy] Cloudflare rate limit detected; retrying in ${Math.round(delayMs / 1000)}s`);
    await sleep(delayMs);
  }
}

await main();
