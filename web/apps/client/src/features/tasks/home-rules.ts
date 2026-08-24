import type { Project, Task } from "../../domain/contracts";
import {
  toNumber,
  toString,
  type TaskActivationCoinRequirement,
  type TaskActivationModifierRequirement,
  type TaskActivationPreview,
} from "./home-model";

export {
  startOfLocalDay,
  shiftDays,
  parseTaskDateValue,
  taskScheduledDate,
  taskDueDate,
} from "./home-scheduling";

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
