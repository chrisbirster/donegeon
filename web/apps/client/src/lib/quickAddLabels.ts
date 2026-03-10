const QUICK_ADD_LABEL_TOKEN_PATTERN = /^@[A-Za-z0-9][A-Za-z0-9_-]*$/;

function normalizeLabel(value: string): string {
  return value.replace(/^@/, "").trim().toLowerCase();
}

export function mergeNormalizedLabels(...groups: Array<readonly string[] | undefined>): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    if (!group) continue;
    for (const raw of group) {
      const normalized = normalizeLabel(raw);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      merged.push(normalized);
    }
  }

  return merged;
}

export function parseQuickAddLabels(text: string): { content: string; labels: string[] } {
  const parts = text.trim().split(/\s+/).filter((part) => part.length > 0);
  const contentParts: string[] = [];
  const labels: string[] = [];

  for (const part of parts) {
    if (QUICK_ADD_LABEL_TOKEN_PATTERN.test(part)) {
      labels.push(part);
      continue;
    }
    contentParts.push(part);
  }

  return {
    content: contentParts.join(" ").trim(),
    labels: mergeNormalizedLabels(labels),
  };
}

export function extractQuickAddLabels(text: string): string[] {
  return parseQuickAddLabels(text).labels;
}
