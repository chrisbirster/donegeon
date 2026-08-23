import type { QuickAddParsed } from "../domain/contracts";

const deadlinePattern = /\{([^{}]+)\}/;
const projectPattern = /^#[A-Za-z0-9][A-Za-z0-9_-]*$/;
const labelPattern = /^@[A-Za-z0-9][A-Za-z0-9_-]*$/;
const assigneePattern = /^\+[A-Za-z][A-Za-z0-9_-]*$/;
const priorityPattern = /^p([1-4])$/i;
const weekday = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";

const duePatterns = [
  new RegExp(`\\bdue\\s+(?:on\\s+)?(?:${weekday})(?:\\s+at\\s+\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?)?\\b`, "i"),
  new RegExp(`\\bnext\\s+(?:${weekday})\\s+at\\s+\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?\\b`, "i"),
  new RegExp(`\\b(?:on\\s+)?(?:${weekday})\\s+at\\s+\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?\\b`, "i"),
  new RegExp(`\\bnext\\s+(?:${weekday}|week)\\b`, "i"),
  /\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b/i,
  /\b\d+\s+(?:day|days|week|weeks|month|months)\s+from\s+now\b/i,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/i,
  /\btomorrow\b/i,
];

const dayCode: Record<string, string> = {
  monday: "MO", mondays: "MO", tuesday: "TU", tuesdays: "TU",
  wednesday: "WE", wednesdays: "WE", thursday: "TH", thursdays: "TH",
  friday: "FR", fridays: "FR", saturday: "SA", saturdays: "SA",
  sunday: "SU", sundays: "SU", weekday: "MO,TU,WE,TH,FR",
  weekdays: "MO,TU,WE,TH,FR", weekend: "SA,SU", weekends: "SA,SU",
};

function spaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function timeSuffix(hourText?: string, minuteText?: string, meridiem?: string): string {
  if (!hourText) return "";
  let hour = Number(hourText);
  const marker = meridiem?.toLowerCase();
  if (marker === "pm" && hour < 12) hour += 12;
  if (marker === "am" && hour === 12) hour = 0;
  return `;BYHOUR=${hour};BYMINUTE=${Number(minuteText || "0")}`;
}

function extractRecurrence(value: string): { rule?: string; content: string } {
  const frequency: Record<string, string> = {
    day: "DAILY", days: "DAILY", week: "WEEKLY", weeks: "WEEKLY",
    month: "MONTHLY", months: "MONTHLY", year: "YEARLY", years: "YEARLY",
  };
  const patterns: Array<{ regex: RegExp; rule: (match: RegExpMatchArray) => string | undefined }> = [
    {
      regex: /\bevery\s+month\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i,
      rule: (m) => Number(m[1]) >= 1 && Number(m[1]) <= 31
        ? `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${Number(m[1])}` : undefined,
    },
    {
      regex: /\bon\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:each|every)\s+month\b/i,
      rule: (m) => Number(m[1]) >= 1 && Number(m[1]) <= 31
        ? `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=${Number(m[1])}` : undefined,
    },
    {
      regex: /\b(first|second|third|fourth|last)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(?:each|every)\s+month\b/i,
      rule: (m) => {
        const ordinal: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, last: -1 };
        return `FREQ=MONTHLY;INTERVAL=1;BYDAY=${ordinal[m[1].toLowerCase()]}${dayCode[m[2].toLowerCase()]}`;
      },
    },
    {
      regex: /\bevery\s+(\d+(?:st|nd|rd|th)?|one|two|three|four|five|six|seven|eight|nine|ten|other)\s+(day|days|week|weeks|month|months|year|years)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i,
      rule: (m) => {
        const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, other: 2 };
        const token = m[1].toLowerCase();
        const interval = words[token] ?? Number(token.replace(/(?:st|nd|rd|th)$/i, ""));
        return interval > 0
          ? `FREQ=${frequency[m[2].toLowerCase()]};INTERVAL=${interval}${timeSuffix(m[3], m[4], m[5])}`
          : undefined;
      },
    },
    {
      regex: /\bevery\s+(weekday|weekdays|weekend|weekends|monday|mondays|tuesday|tuesdays|wednesday|wednesdays|thursday|thursdays|friday|fridays|saturday|saturdays|sunday|sundays)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?\b/i,
      rule: (m) => `FREQ=WEEKLY;INTERVAL=1;BYDAY=${dayCode[m[1].toLowerCase()]}${timeSuffix(m[2], m[3], m[4])}`,
    },
    {
      regex: /\b(weekdays|weekends|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      rule: (m) => `FREQ=WEEKLY;INTERVAL=1;BYDAY=${dayCode[m[1].toLowerCase()]}${timeSuffix(m[2], m[3], m[4])}`,
    },
    {
      regex: /\b(?:daily|every\s+day)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
      rule: (m) => `FREQ=DAILY;INTERVAL=1${timeSuffix(m[1], m[2], m[3])}`,
    },
    { regex: /\bbiweekly\b/i, rule: () => "FREQ=WEEKLY;INTERVAL=2" },
    { regex: /\btwice\s+a\s+month\b/i, rule: () => "FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=1,15" },
    { regex: /\bevery\s+morning\b/i, rule: () => "FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0" },
    { regex: /\bevery\s+night\b/i, rule: () => "FREQ=DAILY;INTERVAL=1;BYHOUR=21;BYMINUTE=0" },
    {
      regex: /\bevery\s+(day|week|month|year)\b/i,
      rule: (m) => `FREQ=${frequency[m[1].toLowerCase()]};INTERVAL=1`,
    },
  ];

  for (const candidate of patterns) {
    const match = value.match(candidate.regex);
    if (!match || match.index === undefined) continue;
    const rule = candidate.rule(match);
    if (!rule) continue;
    return {
      rule,
      content: spaces(value.slice(0, match.index) + " " + value.slice(match.index + match[0].length)),
    };
  }
  return { content: spaces(value) };
}

function extractDue(value: string): { dueText?: string; content: string } {
  let best: RegExpMatchArray | null = null;
  for (const pattern of duePatterns) {
    const match = value.match(pattern);
    if (!match || match.index === undefined) continue;
    if (!best || match.index < (best.index ?? Infinity) || (match.index === best.index && match[0].length > best[0].length)) {
      best = match;
    }
  }
  if (!best || best.index === undefined) return { content: spaces(value) };
  const dueText = spaces(best[0].replace(/^due\s+(?:on\s+)?/i, ""));
  return {
    dueText,
    content: spaces(value.slice(0, best.index) + " " + value.slice(best.index + best[0].length)),
  };
}

/** Fast, side-effect-free preview. The server remains authoritative on submission. */
export function parseQuickAddLocally(text: string): QuickAddParsed {
  let working = text.trim();
  let description = "";
  const descriptionIndex = working.indexOf("//");
  if (descriptionIndex >= 0) {
    description = working.slice(descriptionIndex + 2).trim();
    working = working.slice(0, descriptionIndex).trim();
  }

  let deadline: string | undefined;
  working = working.replace(deadlinePattern, (_match, inner: string) => {
    deadline = inner.trim() || undefined;
    return " ";
  });

  let project: string | undefined;
  let assignee: string | undefined;
  let priority: number | undefined;
  const labels: string[] = [];
  const contentParts: string[] = [];
  for (const part of working.split(/\s+/).filter(Boolean)) {
    if (!project && projectPattern.test(part) && /[A-Za-z]/.test(part.slice(1))) project = part.slice(1);
    else if (labelPattern.test(part)) labels.push(part.slice(1));
    else if (!assignee && assigneePattern.test(part)) assignee = part.slice(1);
    else if (priorityPattern.test(part)) priority = Number(part.slice(1));
    else contentParts.push(part);
  }

  const recurrence = extractRecurrence(contentParts.join(" "));
  const due = extractDue(recurrence.content);
  return {
    content: due.content,
    project,
    labels,
    assignee,
    priority,
    deadline,
    dueText: due.dueText,
    recurrenceRule: recurrence.rule,
    description,
  };
}
