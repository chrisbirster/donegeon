import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(repoRoot, "web/apps/client/src");
const themeFile = join(sourceRoot, "theme.css");
const write = process.argv.includes("--write");
const generatedStart = "/* GENERATED COLOR PALETTE: START */";
const generatedEnd = "/* GENERATED COLOR PALETTE: END */";
const rawColor = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(\s*[-+\d.%,\s]+\)/g;

function filesUnder(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...filesUnder(path));
    else if (/\.(?:ts|tsx|css)$/.test(entry)) files.push(path);
  }
  return files;
}

function isStylingSource(path, content) {
  return path.endsWith(".css") || content.includes("@linaria/core") || content.includes("style=");
}

function tokenFor(literal) {
  const canonical = literal.toLowerCase().replace(/\s+/g, "");
  const readable = canonical
    .replace(/^#/, "hex-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const hash = createHash("sha1").update(canonical).digest("hex").slice(0, 6);
  return `--palette-${readable}-${hash}`;
}

function expandHex(hex) {
  let value = hex.slice(1);
  if (value.length === 3 || value.length === 4) {
    value = value.split("").map((char) => char + char).join("");
  }
  if (value.length !== 6 && value.length !== 8) return null;
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    a: value.length === 8 ? Number.parseInt(value.slice(6, 8), 16) / 255 : 1,
  };
}

function parseRgb(literal) {
  const match = literal.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(/\s*,\s*/);
  if (parts.length < 3 || parts.length > 4) return null;
  const channel = (value) => {
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) return Math.round(Number.parseFloat(trimmed) * 2.55);
    return Math.round(Number.parseFloat(trimmed));
  };
  const r = channel(parts[0]);
  const g = channel(parts[1]);
  const b = channel(parts[2]);
  const a = parts[3] == null ? 1 : Number.parseFloat(parts[3]);
  if (![r, g, b, a].every(Number.isFinite)) return null;
  return { r, g, b, a };
}

function parseColor(literal) {
  if (literal.startsWith("#")) return expandHex(literal);
  return parseRgb(literal);
}

function clamp(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mix(color, target, amount) {
  return {
    r: clamp(color.r + (target.r - color.r) * amount),
    g: clamp(color.g + (target.g - color.g) * amount),
    b: clamp(color.b + (target.b - color.b) * amount),
    a: color.a,
  };
}

function formatAlpha(alpha) {
  return String(Math.round(alpha * 1000) / 1000).replace(/^0\./, ".");
}

function formatColor(color) {
  if (color.a < .999) return `rgba(${color.r}, ${color.g}, ${color.b}, ${formatAlpha(color.a)})`;
  return `#${[color.r, color.g, color.b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function lightVariant(literal) {
  const parsed = parseColor(literal);
  if (!parsed) return literal;

  const luma = (0.2126 * parsed.r + 0.7152 * parsed.g + 0.0722 * parsed.b) / 255;
  const spread = Math.max(parsed.r, parsed.g, parsed.b) - Math.min(parsed.r, parsed.g, parsed.b);
  const neutral = spread < 30;
  let next = { ...parsed };

  if (parsed.a < .999) {
    if (neutral && luma > .72) {
      next = { r: 31, g: 37, b: 52, a: parsed.a };
    } else if (neutral && luma < .28) {
      next = { r: 36, g: 31, b: 46, a: Math.max(.04, parsed.a * .58) };
    } else if (luma < .32) {
      next = mix(parsed, { r: 255, g: 255, b: 255 }, .58);
    } else if (luma > .68) {
      next = mix(parsed, { r: 20, g: 22, b: 28 }, .32);
    } else {
      next = mix(parsed, { r: 20, g: 22, b: 28 }, .12);
    }
  } else if (neutral && luma < .34) {
    next = mix(parsed, { r: 255, g: 255, b: 255 }, .88);
  } else if (neutral && luma > .7) {
    next = mix(parsed, { r: 20, g: 22, b: 28 }, .72);
  } else if (luma > .66) {
    next = mix(parsed, { r: 20, g: 22, b: 28 }, .28);
  } else if (luma < .24) {
    next = mix(parsed, { r: 255, g: 255, b: 255 }, .18);
  } else {
    next = mix(parsed, { r: 20, g: 22, b: 28 }, .12);
  }

  return formatColor(next);
}

const palette = new Map();
const updates = [];

for (const path of filesUnder(sourceRoot)) {
  if (path === themeFile) continue;
  const original = readFileSync(path, "utf8");
  if (!isStylingSource(path, original)) continue;

  const next = original.replace(rawColor, (literal) => {
    const token = tokenFor(literal);
    if (!palette.has(token)) {
      palette.set(token, { dark: literal, light: lightVariant(literal) });
    }
    return `var(${token})`;
  });

  if (next !== original) updates.push({ path, content: next });
}

const paletteEntries = [...palette.entries()].sort(([a], [b]) => a.localeCompare(b));
const darkDeclarations = paletteEntries
  .map(([token, values]) => `  ${token}-dark: ${values.dark};\n  ${token}-light: ${values.light};\n  ${token}: var(${token}-dark);`)
  .join("\n");
const lightDeclarations = paletteEntries
  .map(([token]) => `  ${token}: var(${token}-light);`)
  .join("\n");
const generated = `${generatedStart}\n:root {\n${darkDeclarations}\n}\n\n:root[data-theme="light"] {\n${lightDeclarations}\n}\n${generatedEnd}`;

const currentTheme = readFileSync(themeFile, "utf8");
const generatedPattern = new RegExp(`\\n?${generatedStart.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}[\\s\\S]*?${generatedEnd.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\n?`, "m");
const themeWithoutGenerated = currentTheme.replace(generatedPattern, "\n").trimEnd();
const nextTheme = `${themeWithoutGenerated}\n\n${generated}\n`;

console.log(`Theme migration found ${paletteEntries.length} unique raw color literals in ${updates.length} source files.`);
for (const update of updates) console.log(`  ${relative(repoRoot, update.path)}`);

if (!write) {
  console.log("Run with --write to apply the migration.");
  process.exit(updates.length > 0 ? 1 : 0);
}

for (const update of updates) writeFileSync(update.path, update.content);
writeFileSync(themeFile, nextTheme);
