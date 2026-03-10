const QUICK_ADD_PREVIEW_PATTERN =
  /(^|\s)([#@+][A-Za-z0-9])|(^|\s)p[1-4](?=\s|$)|\{[^{}]*\}?|\/\/|\b(?:due|every|daily|biweekly|twice\s+a\s+month|weekday|weekdays|weekend|weekends|tomorrow|next\s+(?:week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in\s+\d+\s+(?:hour|hours|day|days|week|weeks|month|months)|\d+\s+(?:day|days|week|weeks|month|months)\s+from\s+now|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2})\b/i;

export function shouldPreviewQuickAdd(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return QUICK_ADD_PREVIEW_PATTERN.test(trimmed);
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
