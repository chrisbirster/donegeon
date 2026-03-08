import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";

import {
  type Project,
  type QuickAddParsed,
  type Task,
} from "../server/api";
import { useApi } from "../context/ApiContext";
import { useToast } from "../context/ToastContext";
import AppShell from "../components/AppShell";
import SidebarAccountCard from "../components/SidebarAccountCard";
import TaskQuickAddComposer from "../components/task/TaskQuickAddComposer";
import TaskViewHeader from "../components/task/TaskViewHeader";

type TokenKind =
  | "project"
  | "label"
  | "assignee"
  | "priority"
  | "deadline"
  | "recurrence"
  | "due"
  | "text";

type TokenPiece = {
  value: string;
  kind: TokenKind;
};

type TaskActivationCoinRequirement = {
  currency: string;
  required: number;
  available: number;
  missing: number;
};

type TaskActivationModifierRequirement = {
  defId: string;
  required: number;
  available: number;
  missing: number;
};

type TaskActivationPreview = {
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

const QUICK_ADD_TOKEN_PATTERN =
  /(\{[^{}]+\}|#(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9][A-Za-z0-9_-]*|@[A-Za-z0-9][A-Za-z0-9_-]*|\+[A-Za-z][A-Za-z0-9_-]*|\bp[1-4]\b|\bevery\s+(?:\d+(?:st|nd|rd|th)?|one|two|three|four|five|six|seven|eight|nine|ten|other)\s+(?:day|days|week|weeks|month|months|year|years)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b|\bevery\s+(?:day|week|month|year)\b|\b(?:daily|every\s+day)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bevery\s+(?:weekday|weekdays|weekend|weekends|monday|mondays|tuesday|tuesdays|wednesday|wednesdays|thursday|thursdays|friday|fridays|saturday|saturdays|sunday|sundays)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b|\b(?:weekdays|weekends|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bbiweekly\b|\btwice\s+a\s+month\b|\bevery\s+month\s+on\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\b|\bon\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:each|every)\s+month\b|\b(?:first|second|third|fourth|last)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(?:each|every)\s+month\b|\bdue\s+(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b|\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b|\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b|\b\d+\s+(?:day|days|week|weeks|month|months)\s+from\s+now\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b|\btomorrow\b)/gi;

const RECURRENCE_TOKEN_PATTERN =
  /^(?:every\b|daily\b|biweekly\b|twice\s+a\s+month\b|weekdays\s+at\b|weekends\s+at\b|mondays\s+at\b|tuesdays\s+at\b|wednesdays\s+at\b|thursdays\s+at\b|fridays\s+at\b|saturdays\s+at\b|sundays\s+at\b|first\b|second\b|third\b|fourth\b|last\b|on\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:each|every)\s+month\b)/i;

function classifyToken(value: string): TokenKind {
  if (value.startsWith("#")) return "project";
  if (value.startsWith("@")) return "label";
  if (value.startsWith("+")) return "assignee";
  if (/^p[1-4]$/i.test(value)) return "priority";
  if (value.startsWith("{") && value.endsWith("}")) return "deadline";
  if (RECURRENCE_TOKEN_PATTERN.test(value)) return "recurrence";
  return "due";
}

function tokenizeQuickAdd(value: string): TokenPiece[] {
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

function tokenClass(kind: TokenKind): string {
  switch (kind) {
    case "project":
      return "text-[#ffd2d2] bg-[#7f1d1d]";
    case "label":
      return "text-[#ffdff5] bg-[#6b214d]";
    case "assignee":
      return "text-[#fbe2ff] bg-[#5b2470]";
    case "priority":
      return "text-[#ffe5d5] bg-[#9a3412]";
    case "deadline":
      return "text-[#e3dcff] bg-[#4338ca]";
    case "recurrence":
      return "text-[#d8ffd4] bg-[#14532d]";
    case "due":
      return "text-[#ffe6cc] bg-[#92400e]";
    default:
      return "text-[var(--text-main)]";
  }
}

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatScheduleDateTime(value: string | undefined): string | undefined {
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

function scheduleTokenFromInput(
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

function scheduleBadgeLabel(task: Task, kind: "due" | "deadline"): string | null {
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

function parseScheduleInstant(value: string | undefined): Date | null {
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

function scheduleValidationWarning(task: Task): string | null {
  const due = parseScheduleInstant(task.dueText);
  const deadline = parseScheduleInstant(task.dueDeadline);
  if (!due || !deadline) return null;
  if (deadline.getTime() >= due.getTime()) return null;

  const dueLabel = formatScheduleDateTime(task.dueText) ?? task.dueText ?? "";
  const deadlineLabel = formatScheduleDateTime(task.dueDeadline) ?? task.dueDeadline ?? "";
  return `Deadline is before due (${deadlineLabel} < ${dueLabel}).`;
}

function formatLabelsInput(labels: string[] | undefined): string {
  if (!labels || labels.length === 0) return "";
  const visible = labels.filter((label) => !isBoardLiveLabel(label));
  if (visible.length === 0) return "";
  return visible.map((label) => `@${label}`).join(" ");
}

function parseLabelsInput(value: string): string[] {
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
function toDatetimeLocalValue(value: string | undefined): string {
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
function fromDatetimeLocalValue(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

function slugifyProjectID(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "project";
}

function addChip(value: string | undefined, label: string): string | null {
  if (!value || !value.trim()) return null;
  return `${label}: ${value}`;
}

function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.content.localeCompare(b.content));
}

function prettifyLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeLabelToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[_\-\s]+/g, "");
}

function isBoardLiveLabel(value: string): boolean {
  return normalizeLabelToken(value) === "boardlive";
}

function isBoardLiveTask(task: Task | null | undefined): boolean {
  if (!task) return false;
  return (task.labels ?? []).some((label) => isBoardLiveLabel(label));
}

function projectSlug(projectID: string | undefined): string {
  const normalized = (projectID ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.includes("::") ? normalized.slice(normalized.lastIndexOf("::") + 2) : normalized;
}

function isBoardProject(projectID: string | undefined): boolean {
  const slug = projectSlug(projectID);
  return slug === "board" || slug.startsWith("board-");
}

function isTeamBoardProject(projectID: string | undefined, projectByID?: Map<string, Project>): boolean {
  const id = projectID?.trim();
  if (!id) return false;
  const fromProject = projectByID?.get(id);
  if (fromProject) return fromProject.isTeamBoard === true;
  return false;
}

function boardIDForProject(projectID: string | undefined): string | undefined {
  const slug = projectSlug(projectID);
  if (!isBoardProject(slug)) return undefined;
  if (slug === "board") return "default";
  return slug;
}

function projectQuickAddAlias(project: Project): string | null {
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

function hasExplicitProjectToken(text: string): boolean {
  return /(?:^|\s)#(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9][A-Za-z0-9_-]*(?=\s|$)/.test(text);
}

function projectAliasFromProjectID(projectID: string | undefined): string | null {
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

function visibleTaskLabels(labels: string[] | undefined): string[] {
  return (labels ?? []).filter((label) => !isBoardLiveLabel(label));
}

function formatModifierRequirementName(defID: string): string {
  const normalized = defID.trim().replace(/^mod\./i, "");
  if (!normalized) return "Modifier";
  return prettifyLabel(normalized);
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toString(value: unknown): string {
  if (typeof value === "string") return value;
  return "";
}

function parseTaskActivationPreview(patch: unknown): TaskActivationPreview | null {
  if (!patch || typeof patch !== "object") {
    return null;
  }
  const payload = patch as Record<string, unknown>;
  const taskId = toString(payload.taskId).trim();
  if (!taskId) {
    return null;
  }

  const requirementsPayload =
    payload.requirements && typeof payload.requirements === "object"
      ? (payload.requirements as Record<string, unknown>)
      : {};

  let coin: TaskActivationCoinRequirement | undefined;
  if (requirementsPayload.coin && typeof requirementsPayload.coin === "object") {
    const coinPayload = requirementsPayload.coin as Record<string, unknown>;
    coin = {
      currency: toString(coinPayload.currency).trim() || "coin",
      required: toNumber(coinPayload.required, 0),
      available: toNumber(coinPayload.available, 0),
      missing: toNumber(coinPayload.missing, 0),
    };
  }

  const modifiersRaw = Array.isArray(requirementsPayload.modifiers)
    ? requirementsPayload.modifiers
    : [];
  const modifiers: TaskActivationModifierRequirement[] = [];
  for (const item of modifiersRaw) {
    if (!item || typeof item !== "object") continue;
    const modifier = item as Record<string, unknown>;
    const defId = toString(modifier.defId).trim();
    if (!defId) continue;
    modifiers.push({
      defId,
      required: toNumber(modifier.required, 0),
      available: toNumber(modifier.available, 0),
      missing: toNumber(modifier.missing, 0),
    });
  }

  let inventory: Record<string, number> | undefined;
  if (payload.inventory && typeof payload.inventory === "object") {
    inventory = {};
    for (const [key, value] of Object.entries(payload.inventory as Record<string, unknown>)) {
      inventory[key] = toNumber(value, 0);
    }
  }

  return {
    taskId,
    stackId: toString(payload.stackId).trim() || undefined,
    alreadyLive: payload.alreadyLive === true,
    activated: payload.activated === true,
    canActivate: payload.canActivate === true,
    requirements: {
      coin,
      modifiers,
    },
    inventory,
  };
}

function isNextActionLabel(value: string): boolean {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[_\-\s]+/g, "");
  return normalized === "nextaction";
}

function isNextActionTask(task: Task): boolean {
  return (task.labels ?? []).some((label) => isNextActionLabel(label));
}

type TaskView = "inbox" | "today" | "upcomming" | "project";

type ViewState = {
  kind: TaskView;
  projectId?: string;
};

function parseTaskView(pathname: string): ViewState {
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  const parts = clean.length > 0 ? clean.split("/") : [];

  if (parts.length < 2 || parts[0] !== "task") {
    return { kind: "inbox" };
  }

  const view = parts[1]?.toLowerCase() ?? "";
  if (view === "today") {
    return { kind: "today" };
  }
  if (view === "upcomming" || view === "upcoming") {
    return { kind: "upcomming" };
  }
  if (view === "project" && parts[2]) {
    return { kind: "project", projectId: decodeURIComponent(parts[2]) };
  }
  return { kind: "inbox" };
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function parseTaskDateValue(value: string | undefined): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const today = startOfLocalDay(new Date());
  if (lower === "today") return today;
  if (lower === "tomorrow") return shiftDays(today, 1);

  const inDays = /^in\s+(\d+)\s+days?$/.exec(lower);
  if (inDays) {
    return shiftDays(today, Number(inDays[1]));
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return startOfLocalDay(parsed);
}

function taskDueDate(task: Task): Date | null {
  return parseTaskDateValue(task.dueDeadline) ?? parseTaskDateValue(task.dueText);
}

const DEFAULT_SIDEBAR_PROJECTS: Project[] = [
  {
    id: "board",
    name: "board",
    isInboxProject: false,
    isArchived: false,
    isFavorite: false,
    openTaskCount: 0,
  },
  {
    id: "inbox",
    name: "inbox",
    isInboxProject: true,
    isArchived: false,
    isFavorite: false,
    openTaskCount: 0,
  },
];

export default function HomeRoute() {
  const api = useApi();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [content, setContent] = createSignal("");
  const [parsedInput, setParsedInput] = createSignal<QuickAddParsed | null>(null);
  const [error, setError] = createSignal("");
  const [isSearchOpen, setIsSearchOpen] = createSignal(false);
  const [searchText, setSearchText] = createSignal("");

  const [dragTaskId, setDragTaskId] = createSignal<string | null>(null);
  const [dropTargetId, setDropTargetId] = createSignal<string | null>(null);

  const [editingTaskId, setEditingTaskId] = createSignal<string | null>(null);
  const [editingContent, setEditingContent] = createSignal("");

  const [detailTaskId, setDetailTaskId] = createSignal<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = createSignal(false);
  const [detailContent, setDetailContent] = createSignal("");
  const [detailDescription, setDetailDescription] = createSignal("");
  const [detailPriority, setDetailPriority] = createSignal(4);
  const [detailDueText, setDetailDueText] = createSignal("");
  const [detailDeadline, setDetailDeadline] = createSignal("");
  const [detailProjectId, setDetailProjectId] = createSignal("");
  const [detailTags, setDetailTags] = createSignal("");
  const [detailScheduleOriginal, setDetailScheduleOriginal] = createSignal("");
  const [detailRecurrence, setDetailRecurrence] = createSignal("");
  const [detailRecurrenceCanonical, setDetailRecurrenceCanonical] = createSignal("");
  const [detailRecurrenceError, setDetailRecurrenceError] = createSignal("");
  const [detailActivationPreview, setDetailActivationPreview] = createSignal<TaskActivationPreview | null>(null);
  const [detailActivationLoading, setDetailActivationLoading] = createSignal(false);
  const [detailActivationError, setDetailActivationError] = createSignal("");
  const [detailActivating, setDetailActivating] = createSignal(false);
  const [rowActivatingTaskID, setRowActivatingTaskID] = createSignal<string | null>(null);
  const [detailNewProjectName, setDetailNewProjectName] = createSignal<string | null>(null);

  const tasksQuery = createQuery(() => ({
    queryKey: ["tasks", "list"],
    queryFn: () => api.tasks.list(),
  }));
  const projectsQuery = createQuery(() => ({
    queryKey: ["projects", "list"],
    queryFn: () => api.projects.list(),
  }));

  let mainInputRef: HTMLInputElement | undefined;
  let parseTimer: number | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  let globalKeyHandler: ((event: KeyboardEvent) => void) | undefined;
  let lastParsedText = "";

  const inputTokens = createMemo(() => tokenizeQuickAdd(content()));
  const currentView = createMemo(() => parseTaskView(location.pathname));

  const mergedProjects = createMemo(() => {
    const byID = new Map<string, Project>();
    for (const project of DEFAULT_SIDEBAR_PROJECTS) {
      byID.set(project.id, project);
    }
    for (const project of projects()) {
      byID.set(project.id, project);
    }
    return [...byID.values()];
  });

  const projectMap = createMemo(() => {
    const byID = new Map<string, Project>();
    for (const project of mergedProjects()) {
      byID.set(project.id, project);
    }
    return byID;
  });

  const openTasks = createMemo(() =>
    sortTasks(tasks().filter((task) => !task.checked && !task.isDeleted)),
  );

  const openTaskCountByProjectID = createMemo(() => {
    const counts = new Map<string, number>();
    for (const item of openTasks()) {
      const projectID = item.projectId?.trim();
      if (!projectID) continue;
      counts.set(projectID, (counts.get(projectID) || 0) + 1);
    }
    return counts;
  });

  function isInboxTask(item: Task): boolean {
    const projectID = item.projectId?.trim() ?? "";
    if (!projectID) return true;
    const project = projectMap().get(projectID);
    return !!project?.isInboxProject;
  }

  const inboxCount = createMemo(() =>
    openTasks().filter((task) => isInboxTask(task)).length,
  );

  const todayCount = createMemo(() => {
    const today = startOfLocalDay(new Date());
    return openTasks().filter((task) => {
      const due = taskDueDate(task);
      return due?.getTime() === today.getTime();
    }).length;
  });

  const upcomingCount = createMemo(() => {
    const today = startOfLocalDay(new Date());
    return openTasks().filter((task) => {
      const due = taskDueDate(task);
      return !!due && due.getTime() > today.getTime();
    }).length;
  });

  const favoriteProjects = createMemo(() =>
    mergedProjects()
      .filter((project) => project.isFavorite && !project.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const sidebarProjects = createMemo(() =>
    mergedProjects()
      .filter((project) => !project.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const selectedProject = createMemo(() => {
    const view = currentView();
    if (view.kind !== "project" || !view.projectId) return null;
    return projectMap().get(view.projectId) ?? null;
  });

  const viewTitle = createMemo(() => {
    const view = currentView();
    switch (view.kind) {
      case "today":
        return "Today";
      case "upcomming":
        return "Upcomming";
      case "project":
        return selectedProject()?.name ?? prettifyLabel(view.projectId ?? "Project");
      default:
        return "Inbox";
    }
  });

  const visibleTasks = createMemo(() => {
    const view = currentView();
    if (view.kind === "today") {
      const today = startOfLocalDay(new Date());
      return openTasks().filter((task) => {
        const due = taskDueDate(task);
        return due?.getTime() === today.getTime();
      });
    }
    if (view.kind === "upcomming") {
      const today = startOfLocalDay(new Date());
      return openTasks().filter((task) => {
        const due = taskDueDate(task);
        return !!due && due.getTime() > today.getTime();
      });
    }
    if (view.kind === "project") {
      const projectID = view.projectId?.trim();
      if (!projectID) return [] as Task[];
      return openTasks().filter((task) => task.projectId?.trim() === projectID);
    }
    return openTasks().filter((task) => isInboxTask(task));
  });

  const detailTask = createMemo(() => {
    const id = detailTaskId();
    if (!id) return null;
    return tasks().find((task) => task.id === id) ?? null;
  });

  const detailTaskIsBoardProject = createMemo(() => isBoardProject(detailTask()?.projectId));
  const detailDueInputToken = createMemo(() => scheduleTokenFromInput(detailScheduleOriginal(), "due"));
  const detailDeadlineInputToken = createMemo(() =>
    scheduleTokenFromInput(detailScheduleOriginal(), "deadline"),
  );
  const detailDueStoredValue = createMemo(
    () => formatScheduleDateTime(detailDueText()) ?? detailDueText().trim(),
  );
  const detailDeadlineStoredValue = createMemo(
    () => formatScheduleDateTime(detailDeadline()) ?? detailDeadline().trim(),
  );
  const detailScheduleWarning = createMemo(() => {
    const due = parseScheduleInstant(detailDueText());
    const deadline = parseScheduleInstant(detailDeadline());
    if (!due || !deadline) return "";
    if (deadline.getTime() >= due.getTime()) return "";
    const dueLabel = formatScheduleDateTime(detailDueText()) ?? detailDueText().trim();
    const deadlineLabel = formatScheduleDateTime(detailDeadline()) ?? detailDeadline().trim();
    return `Schedule check: deadline resolves before due (${deadlineLabel} < ${dueLabel}).`;
  });

  const parsedChips = createMemo(() => {
    const parsed = parsedInput();
    if (!parsed) return [] as string[];

    const chips: string[] = [];

    const project = addChip(parsed.project, "Project");
    if (project) chips.push(project);

    for (const label of parsed.labels) {
      chips.push(`Label: ${label}`);
    }

    const assignee = addChip(parsed.assignee, "Assignee");
    if (assignee) chips.push(assignee);

    if (parsed.priority) {
      chips.push(`Priority: p${parsed.priority}`);
    }

    const dueText = addChip(formatScheduleDateTime(parsed.dueText), "Due");
    if (dueText) chips.push(dueText);

    const deadline = addChip(formatScheduleDateTime(parsed.deadline), "Deadline");
    if (deadline) chips.push(deadline);

    const recurrence = addChip(parsed.recurrenceRule, "Recurrence");
    if (recurrence) chips.push(recurrence);

    return chips;
  });

  const parsedGuidance = createMemo(() => {
    const parsed = parsedInput();
    if (!parsed || !parsed.recurrenceRule) return "";
    if (parsed.dueText || parsed.deadline) return "";
    return "Recurrence sets repeat cadence only. Add due text (for example, tomorrow) and/or {deadline} to fill those fields.";
  });

  const searchResults = createMemo(() => {
    const query = searchText().trim().toLowerCase();
    if (!query) return [] as Task[];
    return openTasks().filter((task) => {
      const projectName = task.projectId ? projectMap().get(task.projectId)?.name ?? task.projectId : "";
      return (
        task.content.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        projectName.toLowerCase().includes(query)
      );
    });
  });

  createEffect(() => {
    const taskList = tasksQuery.data;
    if (!taskList) return;
    setTasks(sortTasks(taskList.items));
    setError("");
  });

  createEffect(() => {
    const projectList = projectsQuery.data;
    if (!projectList) return;
    setProjects(projectList.items);
  });

  createEffect(() => {
    const taskErr = tasksQuery.error;
    if (taskErr) {
      setError(taskErr instanceof Error ? taskErr.message : "Failed to load tasks");
      return;
    }
    const projectErr = projectsQuery.error;
    if (projectErr) {
      setError(projectErr instanceof Error ? projectErr.message : "Failed to load projects");
    }
  });

  function projectNameByID(projectID?: string): string | null {
    const id = projectID?.trim();
    if (!id) return null;
    return projectMap().get(id)?.name ?? prettifyLabel(id);
  }

  function sidebarProjectCount(project: Project): number {
    if (project.id === "inbox") {
      return inboxCount();
    }
    return openTaskCountByProjectID().get(project.id) ?? project.openTaskCount ?? 0;
  }

  async function refreshData() {
    try {
      await Promise.all([tasksQuery.refetch(), projectsQuery.refetch()]);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function persistOrder(orderedOpenTasks: Task[]) {
    try {
      await Promise.all(
        orderedOpenTasks.map((item, index) =>
          api.tasks.update(item.id, {
            sortOrder: index + 1,
          }),
        ),
      );
    } catch (err) {
      setError((err as Error).message);
      await refreshData();
    }
  }

  function reorderTasks(sourceId: string, targetId: string) {
    setTasks((current) => {
      const open = sortTasks(current.filter((item) => !item.checked && !item.isDeleted));
      const completed = current.filter((item) => item.checked || item.isDeleted);

      const sourceIndex = open.findIndex((item) => item.id === sourceId);
      const targetIndex = open.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return current;
      }

      const reordered = [...open];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const normalized = reordered.map((item, index) => ({
        ...item,
        sortOrder: index + 1,
      }));

      void persistOrder(normalized);
      return [...normalized, ...completed];
    });
  }

  function focusComposer() {
    mainInputRef?.focus();
  }

  function navigateToView(view: Exclude<TaskView, "project">) {
    navigate(`/task/${view}`);
  }

  function navigateToProject(projectID: string) {
    navigate(`/task/project/${encodeURIComponent(projectID)}`);
  }

  function openSearchModal() {
    setIsSearchOpen(true);
    window.setTimeout(() => searchInputRef?.focus(), 0);
  }

  function closeSearchModal() {
    setIsSearchOpen(false);
    setSearchText("");
  }

  async function toggleProjectFavorite(project: Project) {
    try {
      const updated = await api.projects.update(project.id, {
        name: project.name,
        isFavorite: !project.isFavorite,
      });
      setProjects((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setError("");
      toast.success(updated.isFavorite ? `Added ${updated.name} to favorites.` : `Removed ${updated.name} from favorites.`);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  function isViewActive(view: Exclude<TaskView, "project">): boolean {
    return currentView().kind === view;
  }

  function isProjectActive(projectID: string): boolean {
    const view = currentView();
    return view.kind === "project" && view.projectId === projectID;
  }

  async function parseMainInput(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setParsedInput(null);
      lastParsedText = "";
      return;
    }

    if (trimmed === lastParsedText) {
      return;
    }
    lastParsedText = trimmed;

    try {
      const parsed = await api.parse.quickAdd(trimmed);
      setParsedInput(parsed.parsed);
    } catch {
      setParsedInput(null);
    }
  }

  function onMainInput(value: string) {
    setContent(value);

    if (parseTimer !== undefined) {
      window.clearTimeout(parseTimer);
    }

    parseTimer = window.setTimeout(() => {
      void parseMainInput(value);
    }, 260);
  }

  async function addTask(e: SubmitEvent) {
    e.preventDefault();
    const text = content().trim();
    if (!text) return;
    let quickAddText = text;

    const view = currentView();
    if (view.kind === "project" && !hasExplicitProjectToken(text)) {
      const selected = view.projectId ? projectMap().get(view.projectId) : undefined;
      const alias = selected ? projectQuickAddAlias(selected) : projectAliasFromProjectID(view.projectId);
      if (alias) {
        quickAddText = `${text} #${alias}`;
      }
    }

    try {
      await api.tasks.quickAdd(quickAddText);
      setContent("");
      setParsedInput(null);
      lastParsedText = "";
      setError("");
      await refreshData();
      toast.success("Task added.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  async function completeTask(item: Task) {
    try {
      await api.tasks.close(item.id);
      await refreshData();
      if (detailTaskId() === item.id) {
        closeDetailModal();
      }
      toast.success("Task completed.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  async function removeTask(item: Task) {
    try {
      await api.tasks.remove(item.id);
      setTasks((current) => current.filter((task) => task.id !== item.id));
      if (detailTaskId() === item.id) {
        closeDetailModal();
      }
      toast.info("Task deleted.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  function beginInlineEdit(item: Task) {
    setEditingTaskId(item.id);
    setEditingContent(item.content);
  }

  function cancelInlineEdit() {
    setEditingTaskId(null);
    setEditingContent("");
  }

  async function saveInlineEdit(taskId: string) {
    const nextContent = editingContent().trim();
    if (!nextContent) {
      setError("Task content cannot be empty");
      toast.error("Task content cannot be empty");
      return;
    }

    try {
      const updated = await api.tasks.update(taskId, { content: nextContent });
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updated : task)),
      );
      cancelInlineEdit();
      setError("");
      toast.success("Task updated.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  async function loadDetailActivationPreview(taskId: string, projectID?: string) {
    if (!taskId) return;
    const boardID = boardIDForProject(projectID);
    if (!boardID) return;
    setDetailActivationLoading(true);
    setDetailActivationError("");
    try {
      const response = await api.board.command({
        cmd: "task.activate",
        args: {
          taskId,
          preview: true,
        },
      }, boardID);
      if (detailTaskId() !== taskId) return;
      const preview = parseTaskActivationPreview(response.patch);
      if (!preview) {
        setDetailActivationPreview(null);
        setDetailActivationError("Unable to read activation requirements.");
        return;
      }
      setDetailActivationPreview(preview);
    } catch (err) {
      if (detailTaskId() !== taskId) return;
      setDetailActivationPreview(null);
      setDetailActivationError((err as Error).message);
    } finally {
      if (detailTaskId() === taskId) {
        setDetailActivationLoading(false);
      }
    }
  }

  async function makeDetailTaskLive() {
    const task = detailTask();
    if (!task) return;
    const boardID = boardIDForProject(task.projectId);
    if (!boardID) {
      setDetailActivationError("Task must be in the board project to activate.");
      toast.error("Task must be in the board project to activate.");
      return;
    }

    setDetailActivating(true);
    setDetailActivationError("");
    try {
      const response = await api.board.command({
        cmd: "task.activate",
        args: {
          taskId: task.id,
          preview: false,
        },
      }, boardID);
      const preview = parseTaskActivationPreview(response.patch);
      if (preview) {
        setDetailActivationPreview(preview);
        if (!preview.canActivate && !preview.alreadyLive) {
          setDetailActivationError("Not enough board requirements to activate this task.");
        }
      }
      await refreshData();
      setError("");
      toast.success("Task is now live on the board.");
    } catch (err) {
      const message = (err as Error).message;
      setDetailActivationError(message);
      toast.error(message);
    } finally {
      setDetailActivating(false);
    }
  }

  async function makeRowTaskLive(item: Task) {
    const boardID = boardIDForProject(item.projectId);
    if (!boardID) {
      setError("Task must be in a board project to activate.");
      toast.error("Task must be in a board project to activate.");
      return;
    }

    setRowActivatingTaskID(item.id);
    try {
      await api.board.command({
        cmd: "task.activate",
        args: {
          taskId: item.id,
          preview: false,
        },
      }, boardID);
      await refreshData();
      setError("");
      toast.success("Task is now live on the board.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setRowActivatingTaskID(null);
    }
  }

  function openDetailModal(item: Task) {
    const detailProject = projectNameByID(item.projectId) ?? item.projectId ?? "";
    setDetailTaskId(item.id);
    setDetailContent(item.content);
    setDetailDescription(item.description || "");
    setDetailPriority(item.priority || 4);
    setDetailDueText(item.dueText || "");
    setDetailDeadline(item.dueDeadline || "");
    setDetailProjectId(detailProject);
    setDetailTags(formatLabelsInput(item.labels));
    setDetailScheduleOriginal(item.scheduleInput || "");
    setDetailRecurrence(item.recurrenceRule || "");
    setDetailRecurrenceCanonical(item.recurrenceRule || "");
    setDetailRecurrenceError("");
    setDetailActivationPreview(null);
    setDetailActivationError("");
    setDetailActivationLoading(false);
    setDetailActivating(false);
    setDetailNewProjectName(null);
    setIsDetailOpen(true);
    if (isBoardProject(item.projectId)) {
      void loadDetailActivationPreview(item.id, item.projectId);
    }
  }

  function closeDetailModal() {
    setIsDetailOpen(false);
    setDetailTaskId(null);
    setDetailActivationPreview(null);
    setDetailActivationError("");
    setDetailActivationLoading(false);
    setDetailActivating(false);
  }

  function projectByRef(value: string): Project | undefined {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    return projects().find((project) =>
      project.id.toLowerCase() === normalized || project.name.toLowerCase() === normalized,
    );
  }

  function nextProjectID(baseName: string): string {
    const existing = new Set(projects().map((project) => project.id.toLowerCase()));
    const base = slugifyProjectID(baseName);
    if (!existing.has(base)) return base;

    let index = 2;
    while (existing.has(`${base}-${index}`)) {
      index += 1;
    }
    return `${base}-${index}`;
  }

  async function resolveProjectIDForDetail(value: string): Promise<string | undefined> {
    const raw = value.trim();
    if (!raw) return undefined;

    const existing = projectByRef(raw);
    if (existing) {
      return existing.id;
    }

    const created = await api.projects.update(nextProjectID(raw), { name: raw });
    setProjects((current) => {
      const withoutCreated = current.filter((item) => item.id !== created.id);
      return [...withoutCreated, created];
    });
    return created.id;
  }

  async function saveDetailModal() {
    const taskId = detailTaskId();
    if (!taskId) return;

    const nextContent = detailContent().trim();
    if (!nextContent) {
      setError("Task content cannot be empty");
      toast.error("Task content cannot be empty");
      return;
    }

    try {
      const existingTask = detailTask();
      const resolvedProjectID = await resolveProjectIDForDetail(detailProjectId());
      let labels = parseLabelsInput(detailTags()).filter((label) => !isBoardLiveLabel(label));
      const shouldKeepBoardLive =
        isBoardProject(resolvedProjectID) &&
        (isBoardLiveTask(existingTask) || detailActivationPreview()?.alreadyLive === true);
      if (shouldKeepBoardLive && !labels.some((label) => isBoardLiveLabel(label))) {
        labels = [...labels, "board_live"];
      }
      const updated = await api.tasks.update(taskId, {
        content: nextContent,
        description: detailDescription(),
        projectId: resolvedProjectID ?? "",
        labels,
        recurrenceRule: detailRecurrence().trim() || undefined,
        priority: detailPriority(),
        dueText: detailDueText(),
        dueDeadline: detailDeadline(),
      });

      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updated : task)),
      );
      await refreshData();
      setError("");
      setDetailRecurrenceError("");
      closeDetailModal();
      toast.success("Task details saved.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      if (message.toLowerCase().includes("rrule") || message.toLowerCase().includes("recurrence")) {
        setDetailRecurrenceError(message);
      }
      toast.error(message);
    }
  }

  async function parseDetailRecurrence() {
    const recurrenceRaw = detailRecurrence().trim();
    if (!recurrenceRaw) {
      setDetailRecurrenceCanonical("");
      setDetailRecurrenceError("");
      return;
    }

    try {
      const parsed = await api.rrule.parse(recurrenceRaw);
      setDetailRecurrenceCanonical(parsed.canonical);
      setDetailRecurrenceError("");
      setError("");
    } catch (err) {
      setDetailRecurrenceCanonical("");
      setDetailRecurrenceError((err as Error).message);
    }
  }

  function onDragStart(event: DragEvent, taskId: string) {
    setDragTaskId(taskId);
    setDropTargetId(taskId);
    event.dataTransfer?.setData("text/plain", taskId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      const dragHandle = event.currentTarget as HTMLElement | null;
      const taskRow = dragHandle?.closest("li");
      if (taskRow) {
        const rect = taskRow.getBoundingClientRect();
        event.dataTransfer.setDragImage(taskRow, event.clientX - rect.left, event.clientY - rect.top);
      }
    }
  }

  function onDragOver(event: DragEvent, taskId: string) {
    event.preventDefault();
    setDropTargetId(taskId);
  }

  function onDrop(event: DragEvent, taskId: string) {
    event.preventDefault();
    const sourceId = dragTaskId() ?? event.dataTransfer?.getData("text/plain") ?? null;

    if (sourceId && sourceId !== taskId) {
      reorderTasks(sourceId, taskId);
    }

    setDragTaskId(null);
    setDropTargetId(null);
  }

  function onDragEnd() {
    setDragTaskId(null);
    setDropTargetId(null);
  }

  onCleanup(() => {
    if (parseTimer !== undefined) {
      window.clearTimeout(parseTimer);
    }
    if (globalKeyHandler) {
      window.removeEventListener("keydown", globalKeyHandler);
    }
  });

  onMount(() => {
    globalKeyHandler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        openSearchModal();
        return;
      }
      if (key === "escape" && isSearchOpen()) {
        event.preventDefault();
        closeSearchModal();
      }
    };
    window.addEventListener("keydown", globalKeyHandler);
  });

  return (
    <AppShell
      activeView="task"
      accountPlacement="sidebar"
      mobileSidebar={
        <div class="space-y-5">
          <div class="rounded-xl border border-[#2b3c57] bg-[#0f1728] p-3">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold tracking-tight text-[var(--text-main)]">Tasks</h2>
              <button
                type="button"
                class="rounded-lg border border-[#334660] px-2 py-1 text-xs text-[#d7e4ff] transition hover:border-[var(--accent)]"
                onClick={focusComposer}
              >
                Add
              </button>
            </div>
            <button
              type="button"
              class="mt-3 flex w-full items-center justify-between rounded-lg border border-[#2f3f5d] bg-[#0d1523] px-3 py-2 text-left text-sm text-[var(--text-main)] hover:border-[var(--accent)]"
              onClick={openSearchModal}
            >
              <span>Search</span>
              <span class="text-xs text-[var(--text-dim)]">⌘K</span>
            </button>
          </div>

          <div class="rounded-xl border border-[#2b3c57] bg-[#0f1728] p-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Views</p>
            <div class="mt-2 space-y-1">
              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  isViewActive("inbox")
                    ? "bg-[#5c2525]/65 text-[#ef8680]"
                    : "text-[var(--text-main)] hover:bg-[#17243a]"
                }`}
                onClick={() => navigateToView("inbox")}
              >
                <span>Inbox</span>
                <span class="text-xs text-[var(--text-dim)]">{inboxCount()}</span>
              </button>
              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  isViewActive("today")
                    ? "bg-[#5c2525]/65 text-[#ef8680]"
                    : "text-[var(--text-main)] hover:bg-[#17243a]"
                }`}
                onClick={() => navigateToView("today")}
              >
                <span>Today</span>
                <span class="text-xs text-[var(--text-dim)]">{todayCount()}</span>
              </button>
              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  isViewActive("upcomming")
                    ? "bg-[#5c2525]/65 text-[#ef8680]"
                    : "text-[var(--text-main)] hover:bg-[#17243a]"
                }`}
                onClick={() => navigateToView("upcomming")}
              >
                <span>Upcomming</span>
                <span class="text-xs text-[var(--text-dim)]">{upcomingCount()}</span>
              </button>
            </div>
          </div>

          <div class="rounded-xl border border-[#2b3c57] bg-[#0f1728] p-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Projects</p>
            <div class="mt-2 space-y-1">
              <For each={sidebarProjects()}>
                {(project) => (
                  <button
                    type="button"
                    class={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      isProjectActive(project.id)
                        ? "bg-[#5c2525]/65 text-[#ef8680]"
                        : "text-[var(--text-main)] hover:bg-[#17243a]"
                    }`}
                    onClick={() => navigateToProject(project.id)}
                  >
                    <span class="min-w-0">
                      <span class="block truncate">{project.name}</span>
                      <Show when={projectQuickAddAlias(project)}>
                        {(alias) => (
                          <span class="block text-[10px] uppercase tracking-[0.08em] text-[#8fa3c7]">
                            #{alias()}
                          </span>
                        )}
                      </Show>
                    </span>
                    <span class="ml-2 text-xs text-[var(--text-dim)]">{sidebarProjectCount(project)}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      }
    >
      <div class="h-full overflow-hidden p-3 md:p-6">
        <div class="grid h-full min-h-0 w-full grid-cols-1 gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
          <aside class="hidden h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-[#273248] bg-[linear-gradient(180deg,#101a2c,#0d1523)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:flex">
            <div class="flex h-full min-h-0 flex-col">
            <div class="flex items-center justify-between">
              <h1 class="text-lg font-semibold tracking-tight text-[var(--text-main)]">Tasks</h1>
              <button
                type="button"
                class="rounded-lg border border-[#334660] px-3 py-1.5 text-sm text-[#d7e4ff] transition hover:border-[var(--accent)]"
                onClick={focusComposer}
              >
                Add Task
              </button>
            </div>

            <nav class="mt-4 space-y-1">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[#17243a]"
                onClick={openSearchModal}
                data-testid="open-search"
              >
                <span class="flex items-center gap-2 text-[var(--text-main)]">
                  <span class="text-[#9fb2d3]">⌕</span>
                  <span>Search</span>
                </span>
                <span class="text-xs text-[var(--text-dim)]">⌘K</span>
              </button>

              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  isViewActive("inbox")
                    ? "bg-[#5c2525]/65 text-[#ef8680]"
                    : "text-[var(--text-main)] hover:bg-[#17243a]"
                }`}
                onClick={() => navigateToView("inbox")}
              >
                <span class="flex items-center gap-2">
                  <span class={isViewActive("inbox") ? "text-[#f5b7b1]" : "text-[#9fb2d3]"}>▱</span>
                  <span>Inbox</span>
                </span>
                <span class="text-xs text-[var(--text-dim)]">{inboxCount()}</span>
              </button>

              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  isViewActive("today")
                    ? "bg-[#5c2525]/65 text-[#ef8680]"
                    : "text-[var(--text-main)] hover:bg-[#17243a]"
                }`}
                onClick={() => navigateToView("today")}
              >
                <span class="flex items-center gap-2">
                  <span class={isViewActive("today") ? "text-[#f5b7b1]" : "text-[#9fb2d3]"}>◫</span>
                  <span>Today</span>
                </span>
                <span class="text-xs text-[var(--text-dim)]">{todayCount()}</span>
              </button>

              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  isViewActive("upcomming")
                    ? "bg-[#5c2525]/65 text-[#ef8680]"
                    : "text-[var(--text-main)] hover:bg-[#17243a]"
                }`}
                onClick={() => navigateToView("upcomming")}
              >
                <span class="flex items-center gap-2">
                  <span class={isViewActive("upcomming") ? "text-[#f5b7b1]" : "text-[#9fb2d3]"}>☷</span>
                  <span>Upcomming</span>
                </span>
                <span class="text-xs text-[var(--text-dim)]">{upcomingCount()}</span>
              </button>
            </nav>

            <div class="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
              <div>
                <p class="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Favorites</p>
                <div class="mt-2 space-y-1">
                  <Show
                    when={favoriteProjects().length > 0}
                    fallback={<p class="px-2 py-1 text-sm text-[var(--text-dim)]">No favorite projects yet.</p>}
                  >
                    <For each={favoriteProjects()}>
                      {(project) => (
                        <button
                          type="button"
                          class={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                            isProjectActive(project.id)
                              ? "bg-[#5c2525]/65 text-[#ef8680]"
                              : "text-[var(--text-main)] hover:bg-[#17243a]"
                          }`}
                          onClick={() => navigateToProject(project.id)}
                        >
                          <span class="flex min-w-0 items-center gap-2">
                            <span class="text-[#ffd89c]">★</span>
                            <span class="min-w-0">
                              <span class="block truncate">{project.name}</span>
                              <Show when={projectQuickAddAlias(project)}>
                                {(alias) => (
                                  <span class="block text-[10px] uppercase tracking-[0.08em] text-[#8fa3c7]">
                                    #{alias()}
                                  </span>
                                )}
                              </Show>
                            </span>
                            <Show when={isTeamBoardProject(project.id, projectMap())}>
                              <span class="rounded border border-[#4d62a9] bg-[#202955] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#d5dcff]">
                                Team
                              </span>
                            </Show>
                          </span>
                          <span class="text-xs text-[var(--text-dim)]">{sidebarProjectCount(project)}</span>
                        </button>
                      )}
                    </For>
                  </Show>
                </div>
              </div>

              <div class="mt-6">
                <p class="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">My Projects</p>
                <div class="mt-2 space-y-1">
                  <Show
                    when={sidebarProjects().length > 0}
                    fallback={<p class="px-2 py-1 text-sm text-[var(--text-dim)]">No projects found in database.</p>}
                  >
                    <For each={sidebarProjects()}>
                      {(project) => (
                        <div class="group flex items-center gap-1">
                          <button
                            type="button"
                            class={`min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm transition ${
                              isProjectActive(project.id)
                                ? "bg-[#5c2525]/65 text-[#ef8680]"
                                : "text-[var(--text-main)] hover:bg-[#17243a]"
                            }`}
                            onClick={() => navigateToProject(project.id)}
                          >
                            <span class="flex items-center justify-between gap-2">
                              <span class="flex min-w-0 items-center gap-2">
                                <span class="min-w-0">
                                  <span class="block truncate">{project.name}</span>
                                  <Show when={projectQuickAddAlias(project)}>
                                    {(alias) => (
                                      <span class="block text-[10px] uppercase tracking-[0.08em] text-[#8fa3c7]">
                                        #{alias()}
                                      </span>
                                    )}
                                  </Show>
                                </span>
                                <Show when={isTeamBoardProject(project.id, projectMap())}>
                                  <span class="rounded border border-[#4d62a9] bg-[#202955] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#d5dcff]">
                                    Team
                                  </span>
                                </Show>
                              </span>
                              <span class="ml-3 text-xs text-[var(--text-dim)]">{sidebarProjectCount(project)}</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            class={`rounded-lg border px-2 py-1 text-xs transition ${
                              project.isFavorite
                                ? "border-[#ffbf69] bg-[#3a2a0d] text-[#ffd89c]"
                                : "border-[#334660] text-[#9fb2d3] hover:border-[#ffbf69] hover:text-[#ffd89c]"
                            }`}
                            onClick={() => void toggleProjectFavorite(project)}
                            aria-label={project.isFavorite ? "Remove favorite" : "Add favorite"}
                          >
                            ★
                          </button>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              </div>
            </div>

              <div class="mt-4 border-t border-[#273248] pt-4">
                <SidebarAccountCard />
              </div>
            </div>
          </aside>

          <section class="flex h-full min-h-0 flex-col rounded-3xl border border-[#273248] bg-[linear-gradient(180deg,#101a2c,#0c1423)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
            <TaskViewHeader title={viewTitle()} count={visibleTasks().length} />

            <TaskQuickAddComposer
              content={content()}
              tokens={inputTokens()}
              tokenClass={tokenClass}
              parsedChips={parsedChips()}
              parsedGuidance={parsedGuidance()}
              onInput={onMainInput}
              onSubmit={addTask}
              inputRef={(el) => {
                mainInputRef = el;
              }}
            />

          <Show when={error()}>
            <p class="mb-4 rounded-lg border border-[#5d2f2f] bg-[#2a1111] px-3 py-2 text-sm text-[#ffb5b5]">{error()}</p>
          </Show>

          <div class="min-h-0 flex-1 overflow-y-auto pr-1">
            <Show
              when={visibleTasks().length > 0}
              fallback={<p class="rounded-xl border border-[#23314c] bg-[#101a2c] px-4 py-6 text-sm text-[var(--text-dim)]">No open tasks in this view.</p>}
            >
              <ul class="space-y-2">
                <For each={visibleTasks()}>
                  {(item) => (
                    <li
                      data-testid="task-row"
                      data-task-id={item.id}
                      class={`group flex items-center gap-3 rounded-xl border px-3 py-3 transition ${
                        dropTargetId() === item.id
                          ? "border-[var(--accent)] bg-[#0f192b]"
                          : isNextActionTask(item)
                            ? "border-[#8f6a1c] bg-[#2a1f0c] hover:border-[#d8ac45]"
                            : "border-[#24314a] bg-[#0f192b] hover:border-[#2d3f5f]"
                      }`}
                      onDragOver={(event) => onDragOver(event, item.id)}
                      onDrop={(event) => onDrop(event, item.id)}
                      onClick={() => {
                        if (editingTaskId() === item.id) return;
                        openDetailModal(item);
                      }}
                    >
                      <button
                        type="button"
                        draggable={true}
                        class={`cursor-grab select-none rounded px-1 text-[#91a4c6] transition hover:bg-[#1e2b43] hover:text-white ${
                          dragTaskId() === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        }`}
                        aria-label="Drag to reorder"
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={(event) => onDragStart(event, item.id)}
                        onDragEnd={onDragEnd}
                      >
                        ::
                      </button>

                      <button
                        type="button"
                        class="h-5 w-5 rounded-full border border-[#4b6da5] bg-transparent transition hover:border-[var(--accent)]"
                        aria-label="Complete task"
                        onClick={(event) => {
                          event.stopPropagation();
                          void completeTask(item);
                        }}
                      />

                      <div class="min-w-0 flex-1">
                        <Show
                          when={editingTaskId() === item.id}
                          fallback={
                            <>
                              <p class="truncate text-sm text-[var(--text-main)]" data-testid="task-content">
                                {item.content}
                              </p>
                              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                                <Show when={scheduleBadgeLabel(item, "due")}>
                                  {(label) => (
                                    <span class="rounded-md bg-[#463312] px-2 py-0.5 text-[#ffd89c]">{label()}</span>
                                  )}
                                </Show>
                                <Show when={scheduleBadgeLabel(item, "deadline")}>
                                  {(label) => (
                                    <span class="rounded-md bg-[#2d2c67] px-2 py-0.5 text-[#d8d6ff]">{label()}</span>
                                  )}
                                </Show>
                              <Show when={scheduleValidationWarning(item)}>
                                {(warning) => (
                                  <span class="rounded-md bg-[#4b2a19] px-2 py-0.5 text-[#ffd5b0]">{warning()}</span>
                                )}
                              </Show>
                              <Show when={isBoardProject(item.projectId) && !isBoardLiveTask(item)}>
                                <span class="rounded-md bg-[#2a2238] px-2 py-0.5 text-[#cbb9ff]">Board draft</span>
                              </Show>
                              <Show when={isBoardLiveTask(item)}>
                                <span class="rounded-md bg-[#163328] px-2 py-0.5 text-[#b3f2d5]">Live on board</span>
                              </Show>
                              <For each={visibleTaskLabels(item.labels)}>
                                {(label) => (
                                  <span class="rounded-md bg-[#2f243b] px-2 py-0.5 text-[#e9cbff]">@{label}</span>
                                )}
                              </For>
                                <Show when={projectNameByID(item.projectId)}>
                                  {(projectName) => (
                                    <span class="inline-flex items-center gap-1 rounded-md bg-[#2f243b] px-2 py-0.5 text-[#e9cbff]">
                                      <span>#{projectName()}</span>
                                      <Show when={isTeamBoardProject(item.projectId, projectMap())}>
                                        <span class="rounded border border-[#4d62a9] bg-[#202955] px-1 py-0 text-[10px] uppercase tracking-[0.08em] text-[#d5dcff]">
                                          Team
                                        </span>
                                      </Show>
                                    </span>
                                  )}
                                </Show>
                                <Show when={item.recurrenceRule}>
                                  <span class="rounded-md bg-[#163328] px-2 py-0.5 text-[#b3f2d5]">↻ recurring</span>
                                </Show>
                              </div>
                            </>
                          }
                        >
                          <div class="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                            <input
                              value={editingContent()}
                              onInput={(event) => setEditingContent(event.currentTarget.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void saveInlineEdit(item.id);
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelInlineEdit();
                                }
                              }}
                              class="w-full rounded-lg border border-[#3d537b] bg-[#101d30] px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
                              autofocus
                            />
                            <button
                              type="button"
                              class="rounded-md bg-[#2a3a56] px-2 py-1 text-xs text-white"
                              onClick={() => void saveInlineEdit(item.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              class="rounded-md bg-[#28303d] px-2 py-1 text-xs text-[#d7d9dd]"
                              onClick={cancelInlineEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </Show>
                      </div>

                      <span
                        class={`rounded-md px-2 py-1 text-xs ${
                          item.priority <= 2
                            ? "bg-[#5f201a] text-[#ffcbc2]"
                            : "bg-[#1e2a43] text-[#b5c4df]"
                        }`}
                      >
                        p{item.priority}
                      </span>

                      <div class="ml-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          class="rounded-md border border-[#334660] bg-[#101b2d] px-2 py-1 text-xs text-[#d7e4ff] hover:border-[var(--accent)]"
                          aria-label="Edit inline"
                          data-testid="edit-task-inline"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginInlineEdit(item);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          class="rounded-md border border-[#334660] bg-[#101b2d] px-2 py-1 text-xs text-[#d7e4ff] hover:border-[var(--accent)]"
                          aria-label="Open details"
                          data-testid="open-task-details"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetailModal(item);
                          }}
                          >
                          Open
                        </button>
                        <Show when={isBoardProject(item.projectId) && !isBoardLiveTask(item)}>
                          <button
                            type="button"
                            class="rounded-md border border-[#3b5b37] bg-[#152915] px-2 py-1 text-xs text-[#b8efb3] hover:border-[#6aaa5f] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Make live on board"
                            data-testid="make-task-live"
                            onClick={(event) => {
                              event.stopPropagation();
                              void makeRowTaskLive(item);
                            }}
                            disabled={rowActivatingTaskID() === item.id}
                          >
                            {rowActivatingTaskID() === item.id ? "Activating..." : "Make Live"}
                          </button>
                        </Show>
                        <button
                          type="button"
                          class="rounded-md border border-[#5b2f2f] bg-[#2a1616] px-2 py-1 text-xs text-[#ffbeb7] hover:border-[#ff6a4a]"
                          aria-label="Delete task"
                          data-testid="delete-task"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeTask(item);
                          }}
                        >
                          Del
                        </button>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </div>
        </section>
        </div>

        <Show when={isSearchOpen()}>
        <div
          class="fixed inset-0 z-40 flex items-start justify-center bg-black/55 p-4 pt-20 backdrop-blur-sm"
          onClick={closeSearchModal}
        >
          <div
            class="w-full max-w-2xl rounded-2xl border border-[#29354c] bg-[#111a2a] shadow-[0_25px_70px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="border-b border-[#24314a] px-4 py-3">
              <input
                ref={searchInputRef}
                value={searchText()}
                onInput={(event) => setSearchText(event.currentTarget.value)}
                placeholder="Search tasks, descriptions, projects..."
                aria-label="Search tasks"
                data-testid="search-input"
                class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div class="max-h-[420px] overflow-y-auto px-3 py-3">
              <Show
                when={searchText().trim().length > 0}
                fallback={<p class="px-2 py-2 text-sm text-[var(--text-dim)]">Type to search.</p>}
              >
                <Show
                  when={searchResults().length > 0}
                  fallback={<p class="px-2 py-2 text-sm text-[var(--text-dim)]">No matching open tasks.</p>}
                >
                  <div class="space-y-1">
                    <For each={searchResults()}>
                      {(item) => (
                        <button
                          type="button"
                          class="w-full rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-[#2d3f5f] hover:bg-[#0f192b]"
                          onClick={() => {
                            closeSearchModal();
                            openDetailModal(item);
                          }}
                        >
                          <p class="truncate text-sm text-[var(--text-main)]">{item.content}</p>
                          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                            <Show when={projectNameByID(item.projectId)}>
                              {(projectName) => (
                                <span class="inline-flex items-center gap-1 rounded-md bg-[#2f243b] px-2 py-0.5 text-[#e9cbff]">
                                  <span>#{projectName()}</span>
                                  <Show when={isTeamBoardProject(item.projectId, projectMap())}>
                                    <span class="rounded border border-[#4d62a9] bg-[#202955] px-1 py-0 text-[10px] uppercase tracking-[0.08em] text-[#d5dcff]">
                                      Team
                                    </span>
                                  </Show>
                                </span>
                              )}
                            </Show>
                            <Show when={scheduleBadgeLabel(item, "due")}>
                              {(label) => (
                                <span class="rounded-md bg-[#463312] px-2 py-0.5 text-[#ffd89c]">{label()}</span>
                              )}
                            </Show>
                            <Show when={scheduleBadgeLabel(item, "deadline")}>
                              {(label) => (
                                <span class="rounded-md bg-[#2d2c67] px-2 py-0.5 text-[#d8d6ff]">{label()}</span>
                              )}
                            </Show>
                            <Show when={scheduleValidationWarning(item)}>
                              {(warning) => (
                                <span class="rounded-md bg-[#4b2a19] px-2 py-0.5 text-[#ffd5b0]">{warning()}</span>
                              )}
                            </Show>
                            <For each={visibleTaskLabels(item.labels)}>
                              {(label) => (
                                <span class="rounded-md bg-[#2f243b] px-2 py-0.5 text-[#e9cbff]">@{label}</span>
                              )}
                            </For>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>
          </div>
        </div>
        </Show>

        <Show when={isDetailOpen() && detailTask()}>
        <div
          class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm md:p-4"
          onClick={closeDetailModal}
        >
          <div
            class="my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-[52rem] flex-col overflow-hidden rounded-2xl border border-[#29354c] bg-[#121824] shadow-[0_30px_100px_rgba(0,0,0,0.55)] md:my-4 md:max-h-[calc(100vh-2rem)]"
            onClick={(event) => event.stopPropagation()}
            data-testid="task-detail-modal"
          >
            <div class="flex items-center justify-between border-b border-[#27344d] px-6 py-4">
              <p class="text-sm uppercase tracking-wider text-[var(--text-dim)]">Task Detail</p>
              <button
                type="button"
                class="rounded-md border border-[#344764] px-3 py-1 text-sm text-[#d2e3ff] hover:border-[var(--accent)]"
                onClick={closeDetailModal}
              >
                Close
              </button>
            </div>

            <div class="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1.15fr_0.85fr]">
              <div class="space-y-4 overflow-y-auto p-6">
                <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Task</label>
                <input
                  value={detailContent()}
                  onInput={(event) => setDetailContent(event.currentTarget.value)}
                  class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-lg outline-none focus:border-[var(--accent)]"
                  data-testid="task-detail-title"
                />

                <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Description</label>
                <textarea
                  value={detailDescription()}
                  onInput={(event) => setDetailDescription(event.currentTarget.value)}
                  class="h-40 w-full resize-none rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  data-testid="task-detail-description"
                />
              </div>

              <div class="overflow-y-auto border-t border-[#27344d] p-6 md:border-l md:border-t-0">
                <div class="space-y-4">
                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Project</label>
                  <Show
                    when={detailNewProjectName() === null}
                    fallback={
                      <div class="flex items-center gap-2">
                        <input
                          value={detailNewProjectName() ?? ""}
                          onInput={(event) => setDetailNewProjectName(event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              const name = (detailNewProjectName() ?? "").trim();
                              if (name) {
                                setDetailProjectId(name);
                              }
                              setDetailNewProjectName(null);
                            } else if (event.key === "Escape") {
                              setDetailNewProjectName(null);
                            }
                          }}
                          placeholder="New project name"
                          autofocus
                          class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                          data-testid="task-detail-new-project"
                        />
                        <button
                          type="button"
                          class="shrink-0 rounded-lg border border-[#3a4d6d] bg-[#172033] px-2 py-2 text-xs text-[#d8e6ff] hover:border-[var(--accent)]"
                          onClick={() => {
                            const name = (detailNewProjectName() ?? "").trim();
                            if (name) {
                              setDetailProjectId(name);
                            }
                            setDetailNewProjectName(null);
                          }}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          class="shrink-0 rounded-lg border border-[#3a4d6d] bg-[#172033] px-2 py-2 text-xs text-[#d8e6ff] hover:border-[var(--accent)]"
                          onClick={() => setDetailNewProjectName(null)}
                        >
                          ✕
                        </button>
                      </div>
                    }
                  >
                    <select
                      value={detailProjectId()}
                      onInput={(event) => {
                        const value = event.currentTarget.value;
                        if (value === "__create_new__") {
                          setDetailNewProjectName("");
                          // Reset select to current value so it doesn't stay on the sentinel option.
                          event.currentTarget.value = detailProjectId();
                          return;
                        }
                        setDetailProjectId(value);
                      }}
                      class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                      data-testid="task-detail-project"
                    >
                      <For each={sidebarProjects()}>
                        {(project) => (
                          <option value={project.name} selected={detailProjectId() === project.name || detailProjectId() === project.id}>
                            {project.name}{project.isInboxProject ? " (inbox)" : ""}
                          </option>
                        )}
                      </For>
                      <option value="__create_new__">+ Create new project…</option>
                    </select>
                  </Show>
                  <Show when={isTeamBoardProject(detailTask()?.projectId, projectMap())}>
                    <p class="inline-flex rounded-md border border-[#4d62a9] bg-[#202955] px-2 py-0.5 text-[11px] text-[#d5dcff]">
                      Team board project
                    </p>
                  </Show>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Tags</label>
                  <input
                    value={detailTags()}
                    onInput={(event) => setDetailTags(event.currentTarget.value)}
                    placeholder="@chore @home"
                    class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="task-detail-tags"
                  />
                  <p class="text-xs text-[var(--text-dim)]">
                    Use tags like <code>@chore @home</code>.
                  </p>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Priority</label>
                  <select
                    value={detailPriority()}
                    onInput={(event) => setDetailPriority(Number(event.currentTarget.value))}
                    class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="task-detail-priority"
                  >
                    <option value={1}>P1</option>
                    <option value={2}>P2</option>
                    <option value={3}>P3</option>
                    <option value={4}>P4</option>
                  </select>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Due</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalValue(detailDueText())}
                      onInput={(event) => setDetailDueText(fromDatetimeLocalValue(event.currentTarget.value))}
                      class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] [color-scheme:dark]"
                      data-testid="task-detail-due"
                    />
                    <Show when={detailDueText()}>
                      <button
                        type="button"
                        class="shrink-0 rounded-lg border border-[#3a4d6d] bg-[#172033] px-2 py-2 text-xs text-[#d8e6ff] hover:border-[var(--accent)]"
                        onClick={() => setDetailDueText("")}
                        title="Clear due date"
                      >
                        ✕
                      </button>
                    </Show>
                  </div>
                  <Show when={detailDueInputToken()}>
                    <p class="text-xs text-[#8fa6cb]">Original token: {detailDueInputToken()}</p>
                  </Show>
                  <Show when={detailDueStoredValue()}>
                    <p class="text-xs text-[#9cb2d6]">Stored: {detailDueStoredValue()}</p>
                  </Show>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Deadline</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalValue(detailDeadline())}
                      onInput={(event) => setDetailDeadline(fromDatetimeLocalValue(event.currentTarget.value))}
                      class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] [color-scheme:dark]"
                      data-testid="task-detail-deadline"
                    />
                    <Show when={detailDeadline()}>
                      <button
                        type="button"
                        class="shrink-0 rounded-lg border border-[#3a4d6d] bg-[#172033] px-2 py-2 text-xs text-[#d8e6ff] hover:border-[var(--accent)]"
                        onClick={() => setDetailDeadline("")}
                        title="Clear deadline"
                      >
                        ✕
                      </button>
                    </Show>
                  </div>
                  <Show when={detailDeadlineInputToken()}>
                    <p class="text-xs text-[#8fa6cb]">Original token: {detailDeadlineInputToken()}</p>
                  </Show>
                  <Show when={detailDeadlineStoredValue()}>
                    <p class="text-xs text-[#9cb2d6]">Stored: {detailDeadlineStoredValue()}</p>
                  </Show>
                  <Show when={detailScheduleWarning()}>
                    <p class="rounded-md border border-[#5f4a2a] bg-[#2b2112] px-2.5 py-1.5 text-xs text-[#f7d9a1]">
                      {detailScheduleWarning()}
                    </p>
                  </Show>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Original Schedule Input</label>
                  <input
                    value={detailScheduleOriginal()}
                    readonly
                    placeholder="Not captured for this task."
                    class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="task-detail-schedule-original"
                  />

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Recurrence Rule (RRULE)</label>
                  <input
                    value={detailRecurrence()}
                    onInput={(event) => setDetailRecurrence(event.currentTarget.value)}
                    placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
                    class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    data-testid="task-detail-recurrence"
                  />
                  <button
                    type="button"
                    class="rounded-lg border border-[#3a4d6d] bg-[#172033] px-3 py-2 text-xs text-[#d8e6ff] hover:border-[var(--accent)]"
                    onClick={() => void parseDetailRecurrence()}
                    data-testid="task-detail-parse-rrule"
                  >
                    Validate RRULE
                  </button>
                  <Show when={detailRecurrenceError()}>
                    <p class="rounded-md border border-[#5d2f2f] bg-[#2a1111] px-2 py-1 text-xs text-[#ffb5b5]">
                      {detailRecurrenceError()}
                    </p>
                  </Show>
                  <Show when={detailRecurrenceCanonical()}>
                    <p class="rounded-md border border-[#2d4b37] bg-[#102419] px-2 py-1 text-xs text-[#b4efce]">
                      {detailRecurrenceCanonical().trim().toUpperCase() === detailRecurrence().trim().toUpperCase()
                        ? "RRULE is valid."
                        : detailRecurrenceCanonical()}
                    </p>
                  </Show>

                  <Show when={detailTaskIsBoardProject()}>
                    <div
                      class="space-y-3 rounded-lg border border-[#2a3b58] bg-[#101a2d] p-3"
                      data-testid="task-detail-board-activation"
                    >
                      <div class="flex items-center justify-between">
                        <p class="text-xs uppercase tracking-wider text-[var(--text-dim)]">Board Activation</p>
                        <Show when={detailActivationPreview()?.alreadyLive}>
                          <span class="rounded-md border border-[#2d5d3b] bg-[#163727] px-2 py-0.5 text-[11px] text-[#bbf1cf]">
                            Live
                          </span>
                        </Show>
                      </div>

                      <Show when={detailActivationLoading()}>
                        <p class="text-xs text-[var(--text-dim)]">Checking board requirements...</p>
                      </Show>

                      <Show when={detailActivationError()}>
                        <p class="rounded-md border border-[#5d2f2f] bg-[#2a1111] px-2 py-1 text-xs text-[#ffb5b5]">
                          {detailActivationError()}
                        </p>
                      </Show>

                      <Show when={detailActivationPreview()}>
                        {(preview) => (
                          <>
                            <Show when={preview().requirements.coin}>
                              {(coinRequirement) => (
                                <div class="rounded-md border border-[#2f4364] bg-[#0f1728] px-2 py-2">
                                  <p class="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">Coin</p>
                                  <p class="text-sm text-[var(--text-main)]">
                                    {coinRequirement().currency}: {coinRequirement().available}/{coinRequirement().required}
                                    <Show when={coinRequirement().missing > 0}>
                                      <span class="ml-2 text-[#ffb5b5]">missing {coinRequirement().missing}</span>
                                    </Show>
                                  </p>
                                </div>
                              )}
                            </Show>

                            <Show
                              when={preview().requirements.modifiers.length > 0}
                              fallback={<p class="text-xs text-[var(--text-dim)]">No modifier cards required.</p>}
                            >
                              <div class="space-y-1">
                                <For each={preview().requirements.modifiers}>
                                  {(requirement) => (
                                    <div class="flex items-center justify-between rounded-md border border-[#2f4364] bg-[#0f1728] px-2 py-1.5 text-xs text-[var(--text-main)]">
                                      <span>{formatModifierRequirementName(requirement.defId)}</span>
                                      <span>
                                        {requirement.available}/{requirement.required}
                                        <Show when={requirement.missing > 0}>
                                          <span class="ml-2 text-[#ffb5b5]">missing {requirement.missing}</span>
                                        </Show>
                                      </span>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </Show>

                            <button
                              type="button"
                              class="w-full rounded-lg border border-[#3a4d6d] bg-[#172033] px-3 py-2 text-xs text-[#d8e6ff] hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => void makeDetailTaskLive()}
                              disabled={
                                detailActivating() ||
                                detailActivationLoading() ||
                                preview().alreadyLive ||
                                !preview().canActivate
                              }
                              data-testid="task-detail-make-live"
                            >
                              {preview().alreadyLive
                                ? "Live on board"
                                : detailActivating()
                                  ? "Activating..."
                                  : preview().canActivate
                                    ? "Make Live on Board"
                                    : "Missing requirements"}
                            </button>

                            <Show when={!preview().alreadyLive}>
                              <p class="text-xs text-[var(--text-dim)]">
                                Activation consumes the listed requirements and spawns this task on board.
                              </p>
                            </Show>
                          </>
                        )}
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-[#27344d] px-6 py-4">
              <button
                type="button"
                class="rounded-lg border border-[#3a4d6d] bg-[#172033] px-3 py-2 text-sm text-[#d8e6ff] hover:border-[var(--accent)]"
                onClick={() => {
                  const task = detailTask();
                  if (task) {
                    void completeTask(task);
                  }
                }}
                data-testid="task-detail-mark-done"
              >
                Mark done
              </button>
              <button
                type="button"
                class="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-[#1e0f08] hover:bg-[var(--accent-soft)]"
                onClick={() => void saveDetailModal()}
                data-testid="task-detail-save"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
        </Show>
      </div>
    </AppShell>
  );
}
