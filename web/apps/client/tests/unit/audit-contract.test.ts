import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../../..");
const humanDir = path.join(repoRoot, "docs", "audits", "human-verification");
const auditDir = path.resolve(__dirname, "../e2e/audit");
const contractPath = path.join(auditDir, "audit-contract.json");

type Evidence =
  | "playwright"
  | "playwright-provider-stub"
  | "semantic"
  | "semantic-or-external"
  | "external-manual"
  | "human-inventory"
  | "human-support-boundary"
  | "ci-structural";

type MilestoneContract = {
  document: string;
  defaultEvidence: Evidence;
  overrides?: Record<string, Evidence>;
};

type AuditContract = {
  version: number;
  milestones: Record<string, MilestoneContract>;
  certifiedBrowserMilestones: string[];
};

const contract = JSON.parse(readFileSync(contractPath, "utf8")) as AuditContract;

function milestoneFromFile(fileName: string): string {
  const match = fileName.match(/^(M\d+)-/);
  assert.ok(match, `unable to determine milestone from ${fileName}`);
  return match[1];
}

function markdownTableRows(markdown: string): string[] {
  const headerNames = new Set(["Area", "Capability", "Feature", "Flow", "Gate", "Observation"]);
  const rows: string[] = [];

  for (const line of markdown.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;

    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    const first = cells[0] ?? "";
    if (!first || headerNames.has(first) || /^:?-{3,}:?$/.test(first)) continue;
    rows.push(first.replaceAll("`", ""));
  }

  return rows;
}

function auditSpecSource(): string {
  return readdirSync(auditDir)
    .filter((name) => name.endsWith(".spec.ts"))
    .map((name) => readFileSync(path.join(auditDir, name), "utf8"))
    .join("\n");
}

function evidenceFor(milestone: MilestoneContract, row: string): Evidence {
  return milestone.overrides?.[row] ?? milestone.defaultEvidence;
}

test("every human-verification milestone is classified by the audit contract", () => {
  const documents = readdirSync(humanDir)
    .filter((name) => /^M\d+-.*\.md$/.test(name))
    .sort();
  const discovered = documents.map(milestoneFromFile).sort();
  const classified = Object.keys(contract.milestones).sort();

  assert.deepEqual(
    classified,
    discovered,
    "A milestone document was added/removed without updating tests/e2e/audit/audit-contract.json. " +
      "This is intentional: future M9/M10 documents must be explicitly classified before CI can stay green.",
  );

  for (const document of documents) {
    const milestone = milestoneFromFile(document);
    assert.equal(contract.milestones[milestone]?.document, document, `${milestone} points at the wrong human-verification document`);
  }
});

test("every browser-observable human checklist row has an exact Playwright case", () => {
  const source = auditSpecSource();

  for (const [milestone, config] of Object.entries(contract.milestones)) {
    const markdown = readFileSync(path.join(humanDir, config.document), "utf8");
    for (const row of markdownTableRows(markdown)) {
      const evidence = evidenceFor(config, row);
      if (!evidence.startsWith("playwright")) continue;

      const exactTitle = `[${milestone}] ${row}`;
      assert.ok(
        source.includes(JSON.stringify(exactTitle)) || source.includes(`'${exactTitle}'`) || source.includes(`\`${exactTitle}\``),
        `${exactTitle} is classified as ${evidence} but no exact Playwright test title exists under tests/e2e/audit`,
      );

      const escaped = exactTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const disabled = new RegExp(`test\\.(?:skip|fixme|fail)\\([^\\n]*[\"'\\\`]${escaped}[\"'\\\`]`);
      assert.equal(disabled.test(source), false, `${exactTitle} must not be hidden behind test.skip/test.fixme/test.fail`);
    }
  }
});

test("certified browser milestones have a dedicated audit spec", () => {
  const files = readdirSync(auditDir);
  for (const milestone of contract.certifiedBrowserMilestones) {
    const prefix = `${milestone.toLowerCase()}-`;
    assert.ok(
      files.some((name) => name.startsWith(prefix) && name.endsWith(".spec.ts")),
      `${milestone} is certified but has no dedicated ${prefix}*.spec.ts`,
    );
  }
});
