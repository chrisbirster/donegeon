import { css } from "@linaria/core";
import { useLocation, useNavigate } from "@solidjs/router";
import { For, Show, createMemo, createSignal, createTrackedEffect, onCleanup, onSettled, untrack } from "solid-js";

import { hasEntitlement, workspacePlanProfile } from "../../../../../shared/pricing/catalog";
import { useApi } from "../../context/ApiContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import { getCachedBoardState, setCachedBoardState } from "../../lib/boardCache";
import { readStoredBoardSelection, writeStoredBoardSelection } from "../../lib/boardSelection";
import { extractQuickAddLabels, mergeNormalizedLabels, parseQuickAddLabels } from "../../lib/quickAddLabels";
import { isAbortError, shouldPreviewQuickAdd } from "../../lib/quickAddPreview";
import {
  type BoardCard,
  type BoardCommandPayload,
  type BoardMember,
  type BoardPoint,
  type BoardProgressionLevel,
  type BoardQuestObjective,
  type BoardQuestReward,
  type BoardStack,
  type BoardStateResponse,
  type Project,
  type QuickAddParsed,
  type Task,
  type TeamMember,
  type TeamSettings,
} from "../../server/api";
import AppShell from "../../components/AppShell";
import SidebarAccountCard from "../../components/SidebarAccountCard";

export const DEFAULT_BOARD = "default";
export const BOARD_DEV_CONTROLS_ENABLED = import.meta.env.DEV;

export const CARD_WIDTH = 110;
export const CARD_HEIGHT = 165;
export const STACK_OFFSET_Y = 20;
export const DECK_ROW_SIDE_PADDING = 20;
export const DECK_ROW_BOTTOM = 14;
export const MOBILE_DECK_ROW_BOTTOM = 10;
export const DECK_ROW_MIN_STEP = 54;
export const DECK_ROW_MAX_STEP = 112;
export const Z_INDEX_WORLD_MAX = 3999;
export const Z_INDEX_DRAG = 4500;
export const Z_INDEX_DRAG_OVER_COLLECT = 7000;
export const Z_INDEX_DECK_BASE = 5000;
export const MINIMAP_WIDTH = 220;
export const MINIMAP_HEIGHT = 144;
export const MINIMAP_PADDING = 72;
export const DECK_ROW_MAX_VISIBLE = 4;
export const DECK_ROW_PREFS_KEY = "donegeon.board.deck-row.v1";
export const MOBILE_BREAKPOINT = 768;
// Decks and packs use the same physical footprint as every other board card.
// Keep this at 1 so rendering, deck-row layout, hit testing, and minimap bounds agree.
export const MOBILE_DECK_SCALE = 1;
export const DEFAULT_VILLAGER_STAMINA = 8;
export const BOARD_GRID_SPACING = 22;
export const BOARD_GRID_ORIGIN_OFFSET = 1;

export const MERGE_GAP_DISTANCE = 16;
export const MIN_MERGE_OVERLAP = 900;
export const BOARD_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

export type ApiError = Error & {
  status?: number;
  body?: any;
};

export type DragState = {
  stackId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  mode: "stack" | "split";
  splitIndex: number;
  draggedCount: number;
};

export type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type StackPreview = {
  title: string;
  subtitle: string;
  kind: string;
  icon: string;
  shellClass: string;
  titleClass: string;
  isDeck: boolean;
  isPack: boolean;
};

export type WorldRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type BoardSummary = {
  villagerCount: number;
  zombieCount: number;
  activeTaskCount: number;
  deckCount: number;
  completedCount: number;
  dayTicks: number;
  inventory: Record<string, number>;
};

export type VillagerStatus = {
  villagerID: string;
  stackID: string;
  name: string;
  stamina: number;
  maxStamina: number;
  level: number;
  xp: number;
  nextLevel: number;
  nextLevelXP: number;
  xpToNextLevel: number;
  perks: string[];
};

export type PanDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};

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

export type MiningSession = {
  startedAt: number;
  durationMs: number;
};

export type DeckRowSlot =
  | {
      kind: "deck";
      defId: string;
      stack: BoardStack;
    }
  | {
      kind: "hub";
      overflowCount: number;
    };

export type BoardChoice = {
  boardID: string;
  projectID: string;
  name: string;
  isTeamBoard: boolean;
};

export const DECK_PRIORITY_ORDER = [
  "deck.first_day",
  "deck.collect",
  "deck.organization",
  "deck.survival",
  "deck.humble_beginnings",
  "deck.seeking_wisdom",
  "deck.reap_sow",
  "deck.armory",
  "deck.explorers",
] as const;

export function dataString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function dataNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function dataStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function dataObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export const QUICK_ADD_TOKEN_PATTERN =
  /(\{[^{}]+\}|#[A-Za-z][A-Za-z0-9_-]*|@[A-Za-z0-9][A-Za-z0-9_-]*|\+[A-Za-z][A-Za-z0-9_-]*|\bp[1-4]\b|\bevery\s+[A-Za-z0-9 ]+\b|\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b|\btomorrow\b)/gi;

export function classifyToken(value: string): TokenKind {
  if (value.startsWith("#")) return "project";
  if (value.startsWith("@")) return "label";
  if (value.startsWith("+")) return "assignee";
  if (/^p[1-4]$/i.test(value)) return "priority";
  if (value.startsWith("{") && value.endsWith("}")) return "deadline";
  if (value.toLowerCase().startsWith("every")) return "recurrence";
  return "due";
}

export function tokenizeQuickAdd(value: string): TokenPiece[] {
  if (!value) return [];

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

const boardTokenProject = css`border-radius:.28rem; background:#7f1d1d; color:#ffd2d2;`;
const boardTokenLabel = css`border-radius:.28rem; background:#6b214d; color:#ffdff5;`;
const boardTokenAssignee = css`border-radius:.28rem; background:#5b2470; color:#fbe2ff;`;
const boardTokenPriority = css`border-radius:.28rem; background:#9a3412; color:#ffe5d5;`;
const boardTokenDeadline = css`border-radius:.28rem; background:#4338ca; color:#e3dcff;`;
const boardTokenRecurrence = css`border-radius:.28rem; background:#14532d; color:#d8ffd4;`;
const boardTokenDue = css`border-radius:.28rem; background:#92400e; color:#ffe6cc;`;
const boardTokenText = css`color:var(--text-main);`;

export function tokenClass(kind: TokenKind): string {
  switch (kind) {
    case "project": return boardTokenProject;
    case "label": return boardTokenLabel;
    case "assignee": return boardTokenAssignee;
    case "priority": return boardTokenPriority;
    case "deadline": return boardTokenDeadline;
    case "recurrence": return boardTokenRecurrence;
    case "due": return boardTokenDue;
    default: return boardTokenText;
  }
}

export function questTypeLabel(value: string): string {
  switch (value.trim().toLowerCase()) {
    case "daily":
      return "Daily";
    case "story":
      return "Story";
    case "seasonal":
      return "Seasonal";
    case "boss":
      return "Boss";
    case "failure":
      return "Failure";
    default:
      return value.trim() || "Quest";
  }
}

export function humanizeToken(value: string): string {
  const normalized = value
    .trim()
    .replaceAll(".", " ")
    .replaceAll("_", " ");
  if (!normalized) return "Unknown";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function questObjectiveLabel(objective: BoardQuestObjective): string {
  const op = objective.op.trim().toLowerCase();
  const count = objective.count ?? objective.target ?? 1;
  switch (op) {
    case "complete_task":
      return `Complete ${count} task${count === 1 ? "" : "s"}`;
    case "create_task":
      return `Create ${count} task${count === 1 ? "" : "s"}`;
    case "assign_villager":
      return `Assign ${count} villager${count === 1 ? "" : "s"}`;
    case "open_deck":
      return objective.ref ? `Open ${humanizeToken(objective.ref)} ${count}x` : `Open a deck ${count}x`;
    case "attach_modifier":
      return `Attach ${count} modifier${count === 1 ? "" : "s"}`;
    case "clear_zombie":
      return `Clear ${count} zombie${count === 1 ? "" : "s"}`;
    case "keep_zombies_below":
      return `Keep zombies <= ${objective.target ?? objective.value ?? 0}`;
    case "reduce_backlog_to":
      return `Reduce backlog to <= ${objective.target ?? objective.value ?? 0}`;
    case "process_inbox_count":
      return `Process inbox ${count}x`;
    default:
      return `${humanizeToken(objective.op)} ${count}x`;
  }
}

export function questObjectiveProgressLabel(objective: BoardQuestObjective): string {
  const op = objective.op.trim().toLowerCase();
  if (op === "keep_zombies_below" || op === "reduce_backlog_to") {
    return `Now ${objective.current}`;
  }
  const target = objective.target > 0 ? objective.target : objective.count ?? objective.value ?? 1;
  const current = Math.max(0, objective.current);
  return `${Math.min(current, target)}/${target}`;
}

export function questRewardLabel(reward: BoardQuestReward): string {
  const kind = reward.kind.trim().toLowerCase();
  switch (kind) {
    case "currency":
      return `+${reward.amount ?? 0} ${reward.currency || "coin"}`;
    case "xp":
      return `+${reward.xp ?? reward.amount ?? 0} XP`;
    case "card":
      return `Card: ${humanizeToken(reward.cardType ?? "unknown")} x${reward.cardCount ?? 1}`;
    case "roll_table":
      return `Drop: ${humanizeToken(reward.tableId ?? "table")}`;
    case "cosmetic":
      return `Cosmetic: ${humanizeToken(reward.cardType ?? reward.tableId ?? "unlock")}`;
    default:
      return humanizeToken(kind || "reward");
  }
}

export function taskCompletionToastMessage(patch: unknown): string {
  const payload = dataObject(patch);
  const reward = dataObject(payload?.reward);
  const villagerProgress = dataObject(payload?.villagerProgress);

  const parts = ["Task completed."];
  const rewardType = dataString(reward?.type);
  const rewardAmount = Math.max(0, Math.floor(dataNumber(reward?.amount) ?? 0));
  const rewardMode = dataString(reward?.mode);
  if (rewardType && rewardAmount > 0) {
    const rewardLabel = `${humanizeToken(rewardType)} x${rewardAmount}`;
    parts.push(rewardMode === "spawned" ? `Reward spawned: ${rewardLabel}.` : `Reward: ${rewardLabel}.`);
  }

  const xpGained = Math.max(0, Math.floor(dataNumber(villagerProgress?.xpGained) ?? 0));
  if (xpGained > 0) {
    parts.push(`Villager XP +${xpGained}.`);
  }

  return parts.join(" ");
}

const notificationSuccess = css`border-color:rgba(70,140,98,.34); background:var(--success-bg); color:var(--success);`;
const notificationError = css`border-color:rgba(196,98,91,.28); background:var(--danger-bg); color:var(--danger);`;
const notificationInfo = css`border-color:var(--border-strong); background:var(--panel-soft); color:var(--text-main);`;

export function notificationToneClass(tone: string | undefined): string {
  switch ((tone ?? "").trim().toLowerCase()) {
    case "success": return notificationSuccess;
    case "error": return notificationError;
    default: return notificationInfo;
  }
}

export function notificationToneLabel(tone: string | undefined): string {
  switch ((tone ?? "").trim().toLowerCase()) {
    case "success":
      return "Success";
    case "error":
      return "Alert";
    default:
      return "Info";
  }
}

export function addChip(value: string | undefined, label: string): string | null {
  if (!value || !value.trim()) return null;
  return `${label}: ${value}`;
}

export const scheduleDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export const notificationTimeFormatter = new Intl.DateTimeFormat(undefined, {
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
    return scheduleDateTimeFormatter.format(dateOnly);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return scheduleDateTimeFormatter.format(parsed);
}

export function formatNotificationTime(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "";
  return notificationTimeFormatter.format(new Date(value));
}

export function scheduleTokenFromInput(
  scheduleInput: string | undefined,
  kind: "due" | "deadline",
): string | undefined {
  const source = (scheduleInput ?? "").trim();
  if (!source) return undefined;
  const token = tokenizeQuickAdd(source)
    .find((item) => item.kind === kind)
    ?.value?.trim();
  if (!token) return undefined;
  if (kind === "deadline" && token.startsWith("{") && token.endsWith("}")) {
    const inner = token.slice(1, -1).trim();
    return inner || undefined;
  }
  return token;
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

export function scheduleValidationWarning(dueValue: string | undefined, deadlineValue: string | undefined): string | null {
  const due = parseScheduleInstant(dueValue);
  const deadline = parseScheduleInstant(deadlineValue);
  if (!due || !deadline) return null;
  if (deadline.getTime() >= due.getTime()) return null;

  const dueLabel = formatScheduleDateTime(dueValue) ?? (dueValue ?? "").trim();
  const deadlineLabel = formatScheduleDateTime(deadlineValue) ?? (deadlineValue ?? "").trim();
  return `Schedule check: deadline resolves before due (${deadlineLabel} < ${dueLabel}).`;
}
