import {
  For,
  Show,
  createTrackedEffect,
  createMemo,
  createSignal,
  onCleanup,
  onSettled,
} from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";

import {
  type Project,
  type QuickAddParsed,
  type Task,
} from "../../server/api";
import { useApi } from "../../context/ApiContext";
import { useToast } from "../../context/ToastContext";
import { mergeNormalizedLabels } from "../../lib/quickAddLabels";
import { isAbortError, shouldPreviewQuickAdd } from "../../lib/quickAddPreview";
import AppShell from "../../components/AppShell";
import SidebarAccountCard from "../../components/SidebarAccountCard";
import TaskQuickAddComposer from "../../components/task/TaskQuickAddComposer";
import TaskViewHeader from "../../components/task/TaskViewHeader";

export type TokenKind =
  | "project"
  | "label"
  | "assignee"
  | "priority"
  | "deadline"
  | "recurrence"
  | "due"
  | "text";

export type TokenPiece = {
  value: string;
  kind: TokenKind;
};

export type TaskActivationCoinRequirement = {
  currency: string;
  required: number;
  available: number;
  missing: number;
};

export type TaskActivationModifierRequirement = {
  defId: string;
  required: number;
  available: number;
  missing: number;
};

export type TaskActivationPreview = {
  taskId: string;
  stackId?: string;
  alreadyLive: boolean;
  activated: boolean;
  canActivate: boolean;
  requirements: {
    coin?: TaskActivationCoinRequirement;
    modifiers: TaskActivationModifierRequirement[];
  };
  inventory?: Record<string, number>;
};

export const QUICK_ADD_TOKEN_PATTERN =
  /(\{[^{}]+\}|#(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9][A-Za-z0-9_-]*|@[A-Za-z0-9][A-Za-z0-9_-]*|\+[A-Za-z][A-Za-z0-9_-]*|\bp[1-4]\b|\bevery\s+(?:\d+(?:st|nd|rd|th)?|one|two|three|four|five|six|seven|eight|nine|ten|other)\s+(?:day|days|week|weeks|month|months|year|years)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b|\bevery\s+(?:day|week|month|year)\b|\b(?:daily|every\s+day)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bevery\s+(?:weekday|weekdays|weekend|weekends|monday|mondays|tuesday|tuesdays|wednesday|wednesdays|thursday|thursdays|friday|fridays|saturday|saturdays|sunday|sundays)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b|\b(?:weekdays|weekends|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bbiweekly\b|\btwice\s+a\s+month\b|\bevery\s+month\s+on\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\b|\bon\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:each|every)\s+month\b|\b(?:first|second|third|fourth|last)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(?:each|every)\s+month\b|\bdue\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b|\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b|\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b|\b\d+\s+(?:day|days|week|weeks|month|months)\s+from\s+now\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b|\btomorrow\b)/gi;

export const RECURRENCE_TOKEN_PATTERN =
  /^(?:every\b|daily\b|biweekly\b|twice\s+a\s+month\b|weekdays\s+at\b|weekends\s+at\b|mondays\s+at\b|tuesdays\s+at\b|wednesdays\s+at\b|thursdays\s+at\b|fridays\s+at\b|saturdays\s+at\b|sundays\s+at\b|first\b|second\b|third\b|fourth\b|last\b|on\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:each|every)\s+month\b)/i;

export function classifyToken(value: string): TokenKind {
  if (value.startsWith("#")) return "project";
  if (value.startsWith("@")) return "label";
  if (value.startsWith("+")) return "assignee";
  if (/^p[1-4]$/i.test(value)) return "priority";
  if (value.startsWith("{") && value.endsWith("}")) return "deadline";
  if (RECURRENCE_TOKEN_PATTERN.test(value)) return "recurrence";
  return "due";
}

export function tokenizeQuickAdd(value: string): TokenPiece[] {
  if (value.length === 0) return [];

  const pieces: TokenPiece[] = [];
  let cursor = 0;

  QUICK_ADD_TOKEN_PATTERN.lastIndex = 0;
  for (let match = QUICK_ADD_TOKEN_PATTERN.exec(value); match !== null; match = QUICK_ADD_TOKEN_PATTERN.exec(value)) {
    const token = match[0];
    const start = match.index;
    const end = start + token.length;

    if (start > cursor) {
      pieces.push({
        value: value.slice(cursor, start),
        kind: "text",
      });
    }

    pieces.push({
      value: token,
      kind: classifyToken(token),
    });

    cursor = end;
  }

  if (cursor < value.length) {
    pieces.push({
      value: value.slice(cursor),
      kind: "text",
    });
  }

  return pieces;
}

export function tokenClass(kind: TokenKind): string {
  switch (kind) {
    case "project":
      return "bg-[rgba(120,37,34,0.36)] text-[#ffd4cf]";
    case "label":
      return "bg-[rgba(97,76,132,0.3)] text-[#edd8ff]";
    case "assignee":
      return "bg-[rgba(26,78,95,0.34)] text-[#d2f4ff]";
    case "priority":
      return "bg-[rgba(255,139,80,0.22)] text-[#ffd7b7]";
    case "deadline":
      return "bg-[rgba(74,78,156,0.35)] text-[#ddd9ff]";
    case "recurrence":
      return "bg-[rgba(24,88,57,0.33)] text-[#c7f6d4]";
    case "due":
      return "bg-[rgba(110,78,21,0.34)] text-[#ffd4a1]";
    default:
      return "text-[var(--text-main)]";
  }
}

export const sidebarCardClass = "app-panel rounded-xl p-3";
export const sidebarItemBaseClass =
  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition";
export const sidebarItemActiveClass = "bg-[var(--accent-wash)] text-[var(--accent-text)]";
export const sidebarItemIdleClass = "text-[var(--text-main)] hover:bg-[rgba(255,255,255,0.04)]";
export const searchButtonClass =
  "app-input-surface mt-3 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:border-[var(--border-hover)] hover:bg-[var(--panel-soft)]";
export const panelActionButtonClass = "app-button-secondary rounded-lg px-3 py-1.5 text-sm";
export const smallActionButtonClass = "app-button-secondary rounded-lg px-2 py-1 text-xs";
export const listActionButtonClass = "app-button-secondary rounded-md px-2 py-1 text-xs";
export const successActionButtonClass =
  "rounded-md border border-[rgba(49,122,86,0.42)] bg-[var(--success-bg)] px-2 py-1 text-xs text-[var(--success)] transition hover:border-[rgba(92,173,131,0.48)] disabled:cursor-not-allowed disabled:opacity-60";
export const dangerActionButtonClass =
  "rounded-md border border-[rgba(255,181,173,0.32)] bg-[var(--danger-bg)] px-2 py-1 text-xs text-[var(--danger)] transition hover:border-[var(--accent)]";
export const formFieldClass = "app-input-surface w-full rounded-lg px-3 py-2 text-sm";
export const iconMutedClass = "text-[var(--text-muted)]";
export const iconActiveClass = "text-[#ffd7b7]";
export const teamBadgeClass =
  "rounded border border-[rgba(126,141,214,0.45)] bg-[rgba(84,95,168,0.22)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#d8e1ff]";
export const dueBadgeClass = "rounded-md bg-[rgba(110,78,21,0.34)] px-2 py-0.5 text-[#ffd4a1]";
export const deadlineBadgeClass = "rounded-md bg-[rgba(74,78,156,0.35)] px-2 py-0.5 text-[#ddd9ff]";
export const warningBadgeClass = "rounded-md bg-[rgba(129,61,28,0.35)] px-2 py-0.5 text-[#ffd4b5]";
export const boardDraftBadgeClass = "rounded-md bg-[rgba(97,76,132,0.26)] px-2 py-0.5 text-[#d9c6ff]";
export const boardLiveBadgeClass = "rounded-md bg-[rgba(24,88,57,0.33)] px-2 py-0.5 text-[#c7f6d4]";
export const tagBadgeClass = "rounded-md bg-[rgba(84,95,168,0.22)] px-2 py-0.5 text-[#e0d8ff]";
export const emptyStateClass =
  "rounded-xl border border-[var(--border-soft)] bg-[rgba(255,255,255,0.02)] px-4 py-6 text-sm text-[var(--text-dim)]";
export const errorBannerClass =
  "rounded-lg border border-[rgba(255,181,173,0.35)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]";
export const warningBannerClass =
  "rounded-md border border-[rgba(255,212,161,0.3)] bg-[var(--warning-bg)] px-2.5 py-1.5 text-xs text-[var(--warning)]";
export const successBannerClass =
  "rounded-md border border-[rgba(49,122,86,0.42)] bg-[var(--success-bg)] px-2 py-1 text-xs text-[var(--success)]";
export const taskRowBaseClass = "group flex items-center gap-3 rounded-xl border px-3 py-3 transition";
export const taskRowDropClass = "border-[var(--accent)] bg-[rgba(255,139,80,0.08)]";
export const taskRowNextActionClass = "border-[rgba(255,139,80,0.28)] bg-[rgba(255,139,80,0.08)] hover:border-[#ffb27f]";
export const taskRowDefaultClass =
  "border-[rgba(119,155,187,0.18)] bg-[var(--panel-soft)] hover:border-[rgba(119,155,187,0.32)]";
export const completedTaskRowClass =
  "group flex items-center gap-3 rounded-xl border border-[rgba(119,155,187,0.16)] bg-[var(--panel-soft)] px-3 py-3 text-[var(--text-muted)] transition hover:border-[rgba(119,155,187,0.28)]";

export const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatScheduleDateTime(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const raw = value.trim();
  if (!raw) return undefined;

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    const dateOnly = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 0, 0, 0, 0);
    return dateTimeFormatter.format(dateOnly);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return dateTimeFormatter.format(parsed);
}

export function scheduleTokenFromInput(
  scheduleInput: string | undefined,
  kind: "due" | "deadline",
): string | undefined {
  const source = (scheduleInput ?? "").trim();
  if (!source) return undefined;
  const tokens = tokenizeQuickAdd(source);
  const token = tokens.find((item) => item.kind === kind)?.value?.trim();
  if (!token) return undefined;
  if (kind === "deadline" && token.startsWith("{") && token.endsWith("}")) {
    const inner = token.slice(1, -1).trim();
    return inner || undefined;
  }
  return token;
}

export function scheduleBadgeLabel(task: Task, kind: "due" | "deadline"): string | null {
  const storedRaw = kind === "due" ? task.dueText : task.dueDeadline;
  const storedFormatted = formatScheduleDateTime(storedRaw) ?? storedRaw?.trim();
  const inputToken = scheduleTokenFromInput(task.scheduleInput, kind);
  if (!storedFormatted && !inputToken) return null;

  const prefix = kind === "due" ? "Due" : "Deadline";
  if (storedFormatted && inputToken && storedFormatted.toLowerCase() !== inputToken.toLowerCase()) {
    return `${prefix} ${inputToken} -> ${storedFormatted}`;
  }

  return `${prefix} ${storedFormatted || inputToken}`;
}

export function parseScheduleInstant(value: string | undefined): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 0, 0, 0, 0);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function scheduleValidationWarning(task: Task): string | null {
  const due = parseScheduleInstant(task.dueText);
  const deadline = parseScheduleInstant(task.dueDeadline);
  if (!due || !deadline) return null;
  if (deadline.getTime() >= due.getTime()) return null;

  const dueLabel = formatScheduleDateTime(task.dueText) ?? task.dueText ?? "";
  const deadlineLabel = formatScheduleDateTime(task.dueDeadline) ?? task.dueDeadline ?? "";
  return `Deadline is before due (${deadlineLabel} < ${dueLabel}).`;
}

export function formatLabelsInput(labels: string[] | undefined): string {
  if (!labels || labels.length === 0) return "";
  const visible = labels.filter((label) => !isBoardLiveLabel(label));
  if (visible.length === 0) return "";
  return visible.map((label) => `@${label}`).join(" ");
}

export function parseLabelsInput(value: string): string[] {
  const matches = value.match(/@?[A-Za-z0-9][A-Za-z0-9_-]*/g) ?? [];
  const seen = new Set<string>();
  const labels: string[] = [];

  for (const token of matches) {
    const normalized = token.replace(/^@/, "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    labels.push(normalized);
  }

  return labels;
}

/** Convert stored date value (ISO-8601 / YYYY-MM-DD) to the format required by <input type="datetime-local">. */
export function toDatetimeLocalValue(value: string | undefined): string {
  if (!value) return "";
  const raw = value.trim();
  if (!raw) return "";

  // YYYY-MM-DD -> default to midnight
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}T00:00`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

/** Convert a datetime-local value (YYYY-MM-DDTHH:mm) back to a storable ISO string. */
export function fromDatetimeLocalValue(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

export function slugifyProjectID(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

export function addChip(value: string | undefined, label: string): string | null {
  if (!value || !value.trim()) return null;
  return `${label}: ${value}`;
}

export function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.content.localeCompare(b.content));
}

export function sortCompletedTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return b.sortOrder - a.sortOrder;
    return a.content.localeCompare(b.content);
  });
}

export function prettifyLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeLabelToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[_\-\s]+/g, "");
}

export function isBoardLiveLabel(value: string): boolean {
  return normalizeLabelToken(value) === "boardlive";
}

export function isBoardLiveTask(task: Task | null | undefined): boolean {
  if (!task) return false;
  return (task.labels ?? []).some((label) => isBoardLiveLabel(label));
}

export function projectSlug(projectID: string | undefined): string {
  const normalized = (projectID ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.includes("::") ? normalized.slice(normalized.lastIndexOf("::") + 2) : normalized;
}

export function isBoardProject(projectID: string | undefined): boolean {
  const slug = projectSlug(projectID);
  return slug === "board" || slug.startsWith("board-");
}

export function isTeamBoardProject(projectID: string | undefined, projectByID?: Map<string, Project>): boolean {
  const id = projectID?.trim();
  if (!id) return false;
  const fromProject = projectByID?.get(id);
  if (fromProject) return fromProject.isTeamBoard === true;
  return false;
}

export function boardIDForProject(projectID: string | undefined): string | undefined {
  const slug = projectSlug(projectID);
  if (!isBoardProject(slug)) return undefined;
  if (slug === "board") return "default";
  return slug;
}

export function projectQuickAddAlias(project: Project): string | null {
  const slug = projectSlug(project.id);
  if (!slug || slug === "inbox") return null;
  if (slug === "board") return "board";
  if (slug.startsWith("board-")) {
    const boardAlias = slug.slice("board-".length).trim();
    if (boardAlias) return boardAlias;
  }
  const nameAlias = slugifyProjectID(project.name);
  if (nameAlias && nameAlias !== "project") {
    return nameAlias;
  }
  return slug;
}

export function hasExplicitProjectToken(text: string): boolean {
  return /(?:^|\s)#(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9][A-Za-z0-9_-]*(?=\s|$)/.test(text);
}

export function projectAliasFromProjectID(projectID: string | undefined): string | null {
  const slug = projectSlug(projectID);
  if (!slug || slug === "inbox") return null;
  if (slug === "board") return "board";
  if (slug.startsWith("board-")) {
    const boardAlias = slug.slice("board-".length).trim();
    if (boardAlias) return boardAlias;
  }
  const alias = slugifyProjectID(slug);
  return alias && alias !== "project" ? alias : null;
}

export function visibleTaskLabels(labels: string[] | undefined): string[] {
  return (labels ?? []).filter((label) => !isBoardLiveLabel(label));
}

export function formatModifierRequirementName(defID: string): string {
  const normalized = defID.trim().replace(/^mod\./i, "");
  if (!normalized) return "Modifier";
  return prettifyLabel(normalized);
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function toString(value: unknown): string {
  if (typeof value === "string") return value;
  return "";
}

