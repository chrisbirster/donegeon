import type { Project, Task } from "../../domain/contracts";
import {
  toNumber,
  toString,
  type TaskActivationCoinRequirement,
  type TaskActivationModifierRequirement,
  type TaskActivationPreview,
} from "./home-model";

export function parseTaskActivationPreview(patch: unknown): TaskActivationPreview | null {
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

export function isNextActionLabel(value: string): boolean {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[_\-\s]+/g, "");
  return normalized === "nextaction";
}

export function isNextActionTask(task: Task): boolean {
  return (task.labels ?? []).some((label) => isNextActionLabel(label));
}

export type TaskView = "inbox" | "today" | "upcomming" | "project";

export type ViewState = {
  kind: TaskView;
  projectId?: string;
};

export function parseTaskView(pathname: string): ViewState {
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

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

export function parseTaskDateValue(value: string | undefined): Date | null {
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

export function taskScheduledDate(task: Task): Date | null {
  return parseTaskDateValue(task.dueText) ?? parseTaskDateValue(task.dueDeadline);
}

// Home treats overdue work as part of Today. Returning today's local-day bucket
// for an overdue task lets the existing Today/Upcoming counters and filters use
// one consistent scheduling rule while preserving taskScheduledDate for the
// task's actual stored date.
export function taskDueDate(task: Task, now: Date = new Date()): Date | null {
  const scheduled = taskScheduledDate(task);
  if (!scheduled) return null;
  const today = startOfLocalDay(now);
  if (scheduled.getTime() < today.getTime()) {
    return today;
  }
  return scheduled;
}

export const DEFAULT_SIDEBAR_PROJECTS: Project[] = [
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
