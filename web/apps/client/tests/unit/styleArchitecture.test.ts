import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const arbitraryUtility = /(?:^|[\s`'"{])(?:bg|text|border|rounded|shadow|ring|outline|tracking|leading|w|h|min-w|max-w|min-h|max-h|p[trblxy]?|m[trblxy]?|gap|grid-cols|z|inset)-\[[^\]]+\]/g;
const tailwindDirective = /@(?:tailwind|apply|config|plugin)\b/;

function sourceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (/\.(?:ts|tsx|css)$/.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

describe("client styling architecture", () => {
  it("does not ship Tailwind arbitrary utility classes or directives in runtime source", () => {
    const root = join(process.cwd(), "src");
    const violations: string[] = [];

    for (const file of sourceFiles(root)) {
      const content = readFileSync(file, "utf8");
      const display = relative(process.cwd(), file);
      for (const match of content.matchAll(arbitraryUtility)) {
        const line = content.slice(0, match.index).split("\n").length;
        violations.push(`${display}:${line}: ${match[0].trim()}`);
      }
      if (tailwindDirective.test(content)) {
        violations.push(`${display}: contains a Tailwind directive`);
      }
    }

    expect(violations, `Runtime styling must stay semantic Linaria/WyW:\n${violations.join("\n")}`).toEqual([]);
  });

  it("does not depend on Tailwind packages in the client workspace", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    const forbidden = Object.keys(dependencies).filter(
      (name) => name === "tailwindcss" || name.startsWith("@tailwindcss/"),
    );
    expect(forbidden).toEqual([]);
  });
});
