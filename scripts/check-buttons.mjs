import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["web/apps/client/src", "web/apps/marketing/src"].map((root) => path.join(repositoryRoot, root));
const violations = [];

async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await inspect(file);
      continue;
    }
    if (!file.endsWith(".tsx") || file.endsWith("/components/Button.tsx")) continue;
    const source = await readFile(file, "utf8");
    source.split("\n").forEach((line, index) => {
      if (/<\/?button\b/.test(line)) violations.push(`${file}:${index + 1}`);
    });
  }
}

for (const root of roots) await inspect(root);

if (violations.length) {
  console.error("Use the shared <Button> component instead of native <button>:");
  console.error(violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Button component guard passed: no native button call sites.");
}
