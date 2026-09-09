import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(path.join(here, "audit-contract.json"), "utf8"));
const files = readdirSync(here);
const specs = [];

for (const milestone of contract.certifiedBrowserMilestones ?? []) {
  const prefix = `${String(milestone).toLowerCase()}-`;
  const matches = files
    .filter((name) => name.startsWith(prefix) && name.endsWith(".spec.ts"))
    .sort();
  if (matches.length === 0) {
    console.error(`Certified milestone ${milestone} has no ${prefix}*.spec.ts`);
    process.exit(2);
  }
  for (const match of matches) {
    specs.push(`tests/e2e/audit/${match}`);
  }
}

if (specs.length === 0) {
  console.error("No certified browser milestones are configured.");
  process.exit(2);
}

console.log(`Certified browser audit: ${contract.certifiedBrowserMilestones.join(", ")}`);
for (const spec of specs) console.log(`  - ${spec}`);

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(executable, ["--no-install", "playwright", "test", ...specs], {
  cwd: path.resolve(here, "../../.."),
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
