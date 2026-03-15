#!/usr/bin/env bun
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const sstArgs = ["sst", "deploy", ...process.argv.slice(2)];
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

function patchSstCloudflareKvUploader() {
  const providerPath = path.join(
    process.cwd(),
    ".sst/platform/src/components/cloudflare/providers/kv-data.ts",
  );

  if (!fs.existsSync(providerPath)) {
    return;
  }

  let source = fs.readFileSync(providerPath, "utf8");
  if (source.includes("SST_CF_KV_RATE_LIMIT_PATCH")) {
    return;
  }

  const importNeedle = 'import { cfFetch } from "../helpers/fetch.js";\n';
  const importReplacement = `${importNeedle}
const SST_CF_KV_RATE_LIMIT_PATCH = true;
const uploadRetryDelaysMs = [30000, 60000, 120000, 240000];

function isRateLimited(error: any) {
  const text = String(error?.message || error || "");
  return (
    error?.errors?.some((item: any) => item?.code === 10429) ||
    /\\b429\\b/i.test(text) ||
    /rate limited/i.test(text)
  );
}

async function sleep(ms: number) {
  return await new Promise((resolve) => setTimeout(resolve, ms));
}
`;

  const cfFetchNeedle = `      try {
        await cfFetch(
          \`/accounts/\${accountId}/storage/kv/namespaces/\${namespaceId}/values/\${entry.key}\`,
          {
            method: "PUT",
            body: formData,
          },
        );
      } catch (error: any) {
        console.log(error);
        throw error;
      }
`;
  const cfFetchReplacement = `      for (let attempt = 0; ; attempt += 1) {
        try {
          await cfFetch(
            \`/accounts/\${accountId}/storage/kv/namespaces/\${namespaceId}/values/\${entry.key}\`,
            {
              method: "PUT",
              body: formData,
            },
          );
          return;
        } catch (error: any) {
          const delay = uploadRetryDelaysMs[attempt];
          if (!isRateLimited(error) || delay === undefined) {
            console.log(error);
            throw error;
          }
          console.warn(
            \`[sst-cloudflare-kv] rate limited uploading \${entry.key}; retrying in \${Math.round(delay / 1000)}s\`,
          );
          await sleep(delay);
        }
      }
`;

  const parallelNeedle = `    await Promise.all(nonHtmlEntries.map(uploadEntry));
    await Promise.all(htmlEntries.map(uploadEntry));
`;
  const parallelReplacement = `    for (const entry of nonHtmlEntries) {
      await uploadEntry(entry);
    }
    for (const entry of htmlEntries) {
      await uploadEntry(entry);
    }
`;

  if (
    !source.includes(importNeedle) ||
    !source.includes(cfFetchNeedle) ||
    !source.includes(parallelNeedle)
  ) {
    throw new Error("unable to patch SST Cloudflare KV uploader; source layout changed");
  }

  source = source.replace(importNeedle, importReplacement);
  source = source.replace(cfFetchNeedle, cfFetchReplacement);
  source = source.replace(parallelNeedle, parallelReplacement);

  fs.writeFileSync(providerPath, source);
  console.log("[sst-deploy] patched SST Cloudflare KV uploader for serialized rate-limit retries");
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
  console.log(`[sst-deploy] attempt ${attempt}/${maxAttempts}: bunx ${sstArgs.join(" ")}`);

  return await new Promise((resolve) => {
    const child = spawn("bunx", sstArgs, {
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
  patchSstCloudflareKvUploader();

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
