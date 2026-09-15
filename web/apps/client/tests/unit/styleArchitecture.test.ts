import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

const arbitraryUtility = /(?:^|[\s`'"{])(?:bg|text|border|rounded|shadow|ring|outline|tracking|leading|w|h|min-w|max-w|min-h|max-h|p[trblxy]?|m[trblxy]?|gap|grid-cols|z|inset)-\[[^\]]+\]/g;
const tailwindDirective = /@(?:tailwind|apply|config|plugin)\b/;
const rawColorPatterns = [
  { name: "hex color", pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { name: "rgb/hsl color", pattern: /\b(?:rgb|rgba|hsl|hsla)\s*\(/g },
  { name: "named black/white color", pattern: /\b(?:black|white)\b/g },
  { name: "transparent color", pattern: /\btransparent\b/g },
  { name: "local color-scheme", pattern: /\bcolor-scheme\s*:/g },
] as const;

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

function lineFor(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

function isStylingSource(file: string, content: string): boolean {
  return file.endsWith(".css") || content.includes("@linaria/core") || content.includes("style=");
}

describe("client styling architecture", () => {
  it("does not ship Tailwind arbitrary utility classes or directives in runtime source", () => {
    const root = join(process.cwd(), "src");
    const violations: string[] = [];

    for (const file of sourceFiles(root)) {
      const content = readFileSync(file, "utf8");
      const display = relative(process.cwd(), file);
      for (const match of content.matchAll(arbitraryUtility)) {
        violations.push(`${display}:${lineFor(content, match.index!)}: ${match[0].trim()}`);
      }
      if (tailwindDirective.test(content)) {
        violations.push(`${display}: contains a Tailwind directive`);
      }
    }

    assert.deepEqual(
      violations,
      [],
      `Runtime styling must stay semantic Linaria/WyW:\n${violations.join("\n")}`,
    );
  });

  it("centralizes every raw client color in src/theme.css", () => {
    const root = join(process.cwd(), "src");
    const themeFile = join(root, "theme.css");
    const violations: string[] = [];

    for (const file of sourceFiles(root)) {
      if (file === themeFile) continue;
      const content = readFileSync(file, "utf8");
      if (!isStylingSource(file, content)) continue;
      const display = relative(process.cwd(), file);

      for (const { name, pattern } of rawColorPatterns) {
        pattern.lastIndex = 0;
        for (const match of content.matchAll(pattern)) {
          violations.push(`${display}:${lineFor(content, match.index!)}: ${name} (${match[0]})`);
        }
      }
    }

    assert.deepEqual(
      violations,
      [],
      `Raw colors belong only in src/theme.css; components must use semantic CSS variables:\n${violations.join("\n")}`,
    );
  });

  it("defines explicit dark and light theme palettes", () => {
    const theme = readFileSync(join(process.cwd(), "src", "theme.css"), "utf8");
    assert.match(theme, /--theme-bg-base-dark:/);
    assert.match(theme, /--theme-bg-base-light:/);
    assert.match(theme, /:root\[data-theme="dark"\]/);
    assert.match(theme, /:root\[data-theme="light"\]/);
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
    assert.deepEqual(forbidden, []);
  });
});
