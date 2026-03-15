import { useLocation, useNavigate } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount, untrack } from "solid-js";

import { useApi } from "../context/ApiContext";
import { useToast } from "../context/ToastContext";
import { getCachedBoardState, setCachedBoardState } from "../lib/boardCache";
import { extractQuickAddLabels, mergeNormalizedLabels, parseQuickAddLabels } from "../lib/quickAddLabels";
import { isAbortError, shouldPreviewQuickAdd } from "../lib/quickAddPreview";
import {
  type BoardCard,
  type BoardCommandPayload,
  type BoardMember,
  type BoardPoint,
  type BoardQuestObjective,
  type BoardQuestReward,
  type BoardStack,
  type BoardStateResponse,
  type Project,
  type QuickAddParsed,
  type Task,
  type TeamMember,
  type TeamSettings,
} from "../server/api";
import AppShell from "../components/AppShell";
import SidebarAccountCard from "../components/SidebarAccountCard";

const DEFAULT_BOARD = "default";

const CARD_WIDTH = 92;
const CARD_HEIGHT = 124;
const STACK_OFFSET_Y = 20;
const DECK_ROW_SIDE_PADDING = 20;
const DECK_ROW_BOTTOM = 14;
const MOBILE_DECK_ROW_BOTTOM = 10;
const DECK_ROW_MIN_STEP = 54;
const DECK_ROW_MAX_STEP = 112;
const Z_INDEX_WORLD_MAX = 3999;
const Z_INDEX_DRAG = 4500;
const Z_INDEX_DRAG_OVER_COLLECT = 7000;
const Z_INDEX_DECK_BASE = 5000;
const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 144;
const MINIMAP_PADDING = 72;
const DECK_ROW_MAX_VISIBLE = 4;
const DECK_ROW_PREFS_KEY = "donegeon.board.deck-row.v1";
const MOBILE_BREAKPOINT = 768;
const MOBILE_DECK_SCALE = 0.88;
const DEFAULT_VILLAGER_STAMINA = 6;

const MERGE_GAP_DISTANCE = 16;
const MIN_MERGE_OVERLAP = 900;
const BOARD_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

type ApiError = Error & {
  status?: number;
  body?: any;
};

type DragState = {
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

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type StackPreview = {
  title: string;
  subtitle: string;
  kind: string;
  icon: string;
  shellClass: string;
  titleClass: string;
  isDeck: boolean;
  isPack: boolean;
};

type WorldRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type BoardSummary = {
  villagerCount: number;
  zombieCount: number;
  activeTaskCount: number;
  deckCount: number;
  completedCount: number;
  dayTicks: number;
  inventory: Record<string, number>;
};

type VillagerStatus = {
  villagerID: string;
  stackID: string;
  name: string;
  stamina: number;
  level: number;
  xp: number;
};

type PanDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};

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

type MiningSession = {
  startedAt: number;
  durationMs: number;
};

type DeckRowSlot =
  | {
      kind: "deck";
      defId: string;
      stack: BoardStack;
    }
  | {
      kind: "hub";
      overflowCount: number;
    };

type BoardChoice = {
  boardID: string;
  projectID: string;
  name: string;
  isTeamBoard: boolean;
};

const DECK_PRIORITY_ORDER = [
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

function dataString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dataNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function dataStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function dataObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

const QUICK_ADD_TOKEN_PATTERN =
  /(\{[^{}]+\}|#[A-Za-z][A-Za-z0-9_-]*|@[A-Za-z0-9][A-Za-z0-9_-]*|\+[A-Za-z][A-Za-z0-9_-]*|\bp[1-4]\b|\bevery\s+[A-Za-z0-9 ]+\b|\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b|\btomorrow\b)/gi;

function classifyToken(value: string): TokenKind {
  if (value.startsWith("#")) return "project";
  if (value.startsWith("@")) return "label";
  if (value.startsWith("+")) return "assignee";
  if (/^p[1-4]$/i.test(value)) return "priority";
  if (value.startsWith("{") && value.endsWith("}")) return "deadline";
  if (value.toLowerCase().startsWith("every")) return "recurrence";
  return "due";
}

function tokenizeQuickAdd(value: string): TokenPiece[] {
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

function questTypeLabel(value: string): string {
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

function humanizeToken(value: string): string {
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

function questObjectiveLabel(objective: BoardQuestObjective): string {
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

function questObjectiveProgressLabel(objective: BoardQuestObjective): string {
  const op = objective.op.trim().toLowerCase();
  if (op === "keep_zombies_below" || op === "reduce_backlog_to") {
    return `Now ${objective.current}`;
  }
  const target = objective.target > 0 ? objective.target : objective.count ?? objective.value ?? 1;
  const current = Math.max(0, objective.current);
  return `${Math.min(current, target)}/${target}`;
}

function questRewardLabel(reward: BoardQuestReward): string {
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

function taskCompletionToastMessage(patch: unknown): string {
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

function notificationToneClass(tone: string | undefined): string {
  switch ((tone ?? "").trim().toLowerCase()) {
    case "success":
      return "border-[#3d6b4e] bg-[#12281d] text-[#baf2cd]";
    case "error":
      return "border-[#734040] bg-[#2b1717] text-[#ffbaba]";
    default:
      return "border-[#415779] bg-[#152238] text-[#d6e6ff]";
  }
}

function notificationToneLabel(tone: string | undefined): string {
  switch ((tone ?? "").trim().toLowerCase()) {
    case "success":
      return "Success";
    case "error":
      return "Alert";
    default:
      return "Info";
  }
}

function addChip(value: string | undefined, label: string): string | null {
  if (!value || !value.trim()) return null;
  return `${label}: ${value}`;
}

const scheduleDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const notificationTimeFormatter = new Intl.DateTimeFormat(undefined, {
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
    return scheduleDateTimeFormatter.format(dateOnly);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return raw;
  }
  return scheduleDateTimeFormatter.format(parsed);
}

function formatNotificationTime(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "";
  return notificationTimeFormatter.format(new Date(value));
}

function scheduleTokenFromInput(
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

function scheduleValidationWarning(dueValue: string | undefined, deadlineValue: string | undefined): string | null {
  const due = parseScheduleInstant(dueValue);
  const deadline = parseScheduleInstant(deadlineValue);
  if (!due || !deadline) return null;
  if (deadline.getTime() >= due.getTime()) return null;

  const dueLabel = formatScheduleDateTime(dueValue) ?? (dueValue ?? "").trim();
  const deadlineLabel = formatScheduleDateTime(deadlineValue) ?? (deadlineValue ?? "").trim();
  return `Schedule check: deadline resolves before due (${deadlineLabel} < ${dueLabel}).`;
}

function cardKind(defID: string): string {
  const [kind] = defID.split(".");
  return kind || "unknown";
}

function isDeckDef(defID: string): boolean {
  return cardKind(defID) === "deck" && !defID.endsWith("_pack");
}

function isPackDef(defID: string): boolean {
  return cardKind(defID) === "deck" && defID.endsWith("_pack");
}

function prettifyDefID(defID: string): string {
  const normalized = defID.replaceAll(".", " ").replaceAll("_", " ").trim();
  if (!normalized) return "Card";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function deckDisplayName(defID: string): string {
  switch (defID) {
    case "deck.first_day":
      return "First Day";
    case "deck.collect":
      return "Collect";
    case "deck.organization":
      return "Organization";
    case "deck.survival":
      return "Survival";
    case "deck.humble_beginnings":
      return "Humble Beginnings";
    case "deck.seeking_wisdom":
      return "Seeking Wisdom";
    case "deck.reap_sow":
      return "Reap & Sow";
    case "deck.armory":
      return "Armory";
    case "deck.explorers":
      return "Explorers";
    default:
      return prettifyDefID(defID.replace(/_pack$/, ""));
  }
}

function cardIcon(card: BoardCard | null): string {
  if (!card) return "·";

  const defID = card.defId;
  if (defID === "resource.tree") return "🌲";
  if (defID === "food.apple") return "🍎";
  if (defID === "villager.basic") return "🧑";
  if (defID === "zombie.basic") return "🧟";
  if (defID === "loot.coin" || defID === "coin") return "🪙";
  if (defID === "loot.paper") return "📄";
  if (defID === "loot.ink") return "🖋️";
  if (defID === "loot.gear") return "⚙️";
  if (defID === "loot.parts") return "🔩";

  const kind = cardKind(defID);
  switch (kind) {
    case "task":
      return "📝";
    case "deck":
      return isPackDef(defID) ? "🎴" : "📦";
    case "resource":
      return "⛏️";
    case "food":
      return "🥫";
    case "villager":
      return "🧑";
    case "zombie":
      return "☠";
    case "loot":
      return "🎁";
    default:
      return "⬡";
  }
}

function cardSkin(kind: string, defID: string): { shellClass: string; titleClass: string } {
  if (isPackDef(defID)) {
    return {
      shellClass: "border-[#6f5d2f] bg-[#efe0b1] text-[#241a08]",
      titleClass: "bg-[#d9c27f] text-[#2b2009]",
    };
  }

  switch (kind) {
    case "task":
      return {
        shellClass: "border-[#714f52] bg-[#e4b5b8] text-[#241417]",
        titleClass: "bg-[#d4979c] text-[#2d1417]",
      };
    case "villager":
      return {
        shellClass: "border-[#6f5a37] bg-[#e2c593] text-[#211609]",
        titleClass: "bg-[#d4ab6d] text-[#2b1b08]",
      };
    case "resource":
      return {
        shellClass: "border-[#4f6b49] bg-[#b5d6aa] text-[#10200c]",
        titleClass: "bg-[#94bd87] text-[#11260d]",
      };
    case "food":
      return {
        shellClass: "border-[#77563a] bg-[#e6b074] text-[#251508]",
        titleClass: "bg-[#d4924d] text-[#2b1809]",
      };
    case "zombie":
      return {
        shellClass: "border-[#6f3f4a] bg-[#cf9ba7] text-[#220e12]",
        titleClass: "bg-[#bb7f8c] text-[#2a0f14]",
      };
    case "deck":
      return {
        shellClass: "border-[#4a5875] bg-[#afb9ca] text-[#121722]",
        titleClass: "bg-[#8f9db3] text-[#111a2b]",
      };
    case "loot":
      return {
        shellClass: "border-[#6d633d] bg-[#ddd0a1] text-[#1d1807]",
        titleClass: "bg-[#c9b774] text-[#201807]",
      };
    default:
      return {
        shellClass: "border-[#4b505a] bg-[#bbc2cc] text-[#141820]",
        titleClass: "bg-[#9ea7b3] text-[#111722]",
      };
  }
}

function titleFromCard(card: BoardCard | null): string {
  if (!card) return "Unknown";
  const title = dataString(card.data?.title);
  if (title) return title;
  if (card.defId === "task.blank") return "Blank Task";
  if (isDeckDef(card.defId)) return deckDisplayName(card.defId);
  if (isPackDef(card.defId)) return `${deckDisplayName(card.defId)} Pack`;
  return prettifyDefID(card.defId);
}

function subtitleFromCard(card: BoardCard | null): string {
  if (!card) return "";
  const kind = cardKind(card.defId);
  if (isDeckDef(card.defId)) return "DECK";
  if (isPackDef(card.defId)) return "PACK";
  if (kind === "task") {
    const priority = dataNumber(card.data?.priority);
    if (priority && priority >= 1 && priority <= 4) {
      return `TASK · P${priority}`;
    }
    return "TASK";
  }
  return kind.toUpperCase();
}

function descriptionFromCard(card: BoardCard | null): string {
  if (!card) return "";
  return dataString(card.data?.description);
}

function cardFromStack(stack: BoardStack | null, state: BoardStateResponse | null): BoardCard | null {
  if (!stack || !state || stack.cards.length === 0) return null;
  const topID = stack.cards[stack.cards.length - 1];
  return state.cards[topID] ?? null;
}

function taskCardFromStack(stack: BoardStack | null, state: BoardStateResponse | null): BoardCard | null {
  if (!stack || !state || stack.cards.length === 0) return null;
  for (let index = stack.cards.length - 1; index >= 0; index -= 1) {
    const card = state.cards[stack.cards[index]];
    if (card && card.defId.startsWith("task.")) {
      return card;
    }
  }
  return null;
}

function villagerStatusForStack(stack: BoardStack | null, snapshot: BoardStateResponse | null): VillagerStatus | null {
  if (!stack || !snapshot || stack.cards.length === 0) return null;

  for (const cardID of stack.cards) {
    const card = snapshot.cards[cardID];
    if (!card || cardKind(card.defId) !== "villager") continue;

    const villagerID = dataString(card.data?.villagerId) || stack.id;
    const progress = snapshot.meta?.villagers?.[villagerID];
    const stamina = Math.max(0, Math.floor(dataNumber(progress?.stamina) ?? DEFAULT_VILLAGER_STAMINA));
    const level = Math.max(1, Math.floor(dataNumber(progress?.level) ?? 1));
    const xp = Math.max(0, Math.floor(dataNumber(progress?.xp) ?? 0));
    const name = dataString(card.data?.name) || titleFromCard(card) || "Villager";

    return {
      villagerID,
      stackID: stack.id,
      name,
      stamina,
      level,
      xp,
    };
  }

  return null;
}

function villagerTooltipLabel(status: VillagerStatus | null): string | undefined {
  if (!status) return undefined;
  return `${status.name} • Stamina ${status.stamina} • Lv ${status.level}`;
}

function cardFromCardIDs(cardIDs: string[], state: BoardStateResponse | null): BoardCard | null {
  if (!state || cardIDs.length === 0) return null;
  const topID = cardIDs[cardIDs.length - 1];
  return state.cards[topID] ?? null;
}

function splitCardIDs(cardIDs: string[], index: number): { remaining: string[]; dragged: string[] } {
  if (cardIDs.length === 0) {
    return {
      remaining: [],
      dragged: [],
    };
  }

  const clamped = Math.max(0, Math.min(cardIDs.length - 1, Math.trunc(index)));
  if (clamped === 0) {
    return {
      remaining: cardIDs.slice(1),
      dragged: cardIDs.slice(0, 1),
    };
  }

  return {
    remaining: cardIDs.slice(0, clamped),
    dragged: cardIDs.slice(clamped),
  };
}

function stackHeightPx(cardCount: number): number {
  return CARD_HEIGHT + Math.max(0, cardCount - 1) * STACK_OFFSET_Y;
}

function stackBounds(pos: BoardPoint, cardCount: number): Rect {
  return {
    left: pos.x,
    top: pos.y,
    right: pos.x + CARD_WIDTH,
    bottom: pos.y + stackHeightPx(cardCount),
  };
}

function overlapArea(a: Rect, b: Rect): number {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
  return Math.sqrt(dx * dx + dy * dy);
}

function rectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function packDeckID(card: BoardCard): string {
  const fromData = dataString(card.data?.deckId);
  if (fromData) return fromData;
  if (card.defId.endsWith("_pack")) {
    return card.defId.slice(0, -"_pack".length);
  }
  return "deck.first_day";
}

function projectSlug(value: string | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.includes("::") ? normalized.slice(normalized.lastIndexOf("::") + 2) : normalized;
}

function normalizeBoardID(raw: string | null | undefined): string {
  const normalized = (raw ?? "").trim();
  if (!normalized) return DEFAULT_BOARD;
  if (!BOARD_ID_PATTERN.test(normalized)) return DEFAULT_BOARD;
  return normalized;
}

function boardProjectIDForBoard(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "board";
  return normalized;
}

function boardIDFromName(name: string): string | null {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!normalized) return null;
  if (normalized === "board") return null;
  if (normalized.startsWith("board-")) return normalized;
  return `board-${normalized}`;
}

function boardIDFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return normalizeBoardID(params.get("board"));
}

function boardHref(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "/board";
  return `/board?board=${encodeURIComponent(normalized)}`;
}

function boardStoreHref(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "/board/store";
  return `/board/store?board=${encodeURIComponent(normalized)}`;
}

function isBoardProject(projectID: string | undefined): boolean {
  const slug = projectSlug(projectID);
  return slug === "board" || slug.startsWith("board-");
}

function boardIDForProject(projectID: string | undefined): string | undefined {
  const slug = projectSlug(projectID);
  if (!isBoardProject(slug)) return undefined;
  if (slug === "board") return DEFAULT_BOARD;
  return slug;
}

function matchesBoardProject(projectID: string | undefined, boardID: string): boolean {
  const slug = projectSlug(projectID);
  return slug === boardProjectIDForBoard(boardID).toLowerCase();
}

function boardChoicesFromProjects(projects: Project[], activeBoardID: string): BoardChoice[] {
  const byBoardID = new Map<string, BoardChoice>();
  byBoardID.set(DEFAULT_BOARD, {
    boardID: DEFAULT_BOARD,
    projectID: "board",
    name: "Board",
    isTeamBoard: false,
  });

  for (const project of projects) {
    const boardID = boardIDForProject(project.id);
    if (!boardID) continue;
    const normalizedBoardID = normalizeBoardID(boardID);
    const existing = byBoardID.get(normalizedBoardID);
    if (existing) {
      if (existing.name === "Board" && project.name.trim()) {
        existing.name = project.name.trim();
      }
      existing.projectID = boardProjectIDForBoard(normalizedBoardID);
      existing.isTeamBoard = existing.isTeamBoard || project.isTeamBoard === true;
      continue;
    }
    byBoardID.set(normalizedBoardID, {
      boardID: normalizedBoardID,
      projectID: boardProjectIDForBoard(normalizedBoardID),
      name: project.name.trim() || boardProjectIDForBoard(normalizedBoardID),
      isTeamBoard: project.isTeamBoard === true,
    });
  }

  const normalizedActive = normalizeBoardID(activeBoardID);
  if (!byBoardID.has(normalizedActive)) {
    byBoardID.set(normalizedActive, {
      boardID: normalizedActive,
      projectID: boardProjectIDForBoard(normalizedActive),
      name: boardProjectIDForBoard(normalizedActive),
      isTeamBoard: false,
    });
  }

  const choices = [...byBoardID.values()];
  choices.sort((a, b) => {
    if (a.boardID === DEFAULT_BOARD && b.boardID !== DEFAULT_BOARD) return -1;
    if (b.boardID === DEFAULT_BOARD && a.boardID !== DEFAULT_BOARD) return 1;
    return a.name.localeCompare(b.name);
  });
  return choices;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureBoardProjectToken(text: string, projectID: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  const normalizedProject = projectID.trim();
  if (!normalizedProject) return trimmed;
  const projectPattern = new RegExp(`(^|\\s)#${escapeRegex(normalizedProject)}\\b`, "i");
  if (projectPattern.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} #${normalizedProject}`;
}

function normalizeLabelToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[_\-\s]+/g, "");
}

function hasBoardLiveLabel(labels: string[] | undefined): boolean {
  if (!labels || labels.length === 0) return false;
  return labels.some((label) => normalizeLabelToken(label) === "boardlive");
}

export default function BoardRoute() {
  const api = useApi();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [state, setState] = createSignal<BoardStateResponse | null>(null);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [busy, setBusy] = createSignal(false);

  const [composerText, setComposerText] = createSignal("");
  const [composerParsed, setComposerParsed] = createSignal<QuickAddParsed | null>(null);
  const [composerParsing, setComposerParsing] = createSignal(false);

  const [selectedStackID, setSelectedStackID] = createSignal<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = createSignal(false);
  const [detailTitle, setDetailTitle] = createSignal("");
  const [detailDescription, setDetailDescription] = createSignal("");
  const [detailPriority, setDetailPriority] = createSignal(4);
  const [detailParsed, setDetailParsed] = createSignal<QuickAddParsed | null>(null);
  const [detailParsing, setDetailParsing] = createSignal(false);

  const [inlineStackID, setInlineStackID] = createSignal<string | null>(null);
  const [inlineTitle, setInlineTitle] = createSignal("");

  const [dragState, setDragState] = createSignal<DragState | null>(null);
  const [panDragState, setPanDragState] = createSignal<PanDragState | null>(null);
  const [dragMoved, setDragMoved] = createSignal(false);
  const [mergeTargetID, setMergeTargetID] = createSignal<string | null>(null);
  const [localPositions, setLocalPositions] = createSignal<Record<string, BoardPoint>>({});
  const [clickSuppress, setClickSuppress] = createSignal<{ stackId: string; until: number } | null>(null);
  const [boardPan, setBoardPan] = createSignal<BoardPoint>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = createSignal({ width: 0, height: 0 });
  const [miningSessionsByStackID, setMiningSessionsByStackID] = createSignal<Record<string, MiningSession>>({});
  const [miningTickMs, setMiningTickMs] = createSignal(Date.now());
  const [miningCompletedCyclesByStackID, setMiningCompletedCyclesByStackID] = createSignal<Record<string, number>>({});
  const [miningPendingByStackID, setMiningPendingByStackID] = createSignal<Record<string, true>>({});
  const [deckOrderPrefs, setDeckOrderPrefs] = createSignal<string[]>([]);
  const [deckHubOpen, setDeckHubOpen] = createSignal(false);
  const [deckHubDragDefID, setDeckHubDragDefID] = createSignal<string | null>(null);
  const [mobileMapHubOpen, setMobileMapHubOpen] = createSignal(false);
  const [questClaimingID, setQuestClaimingID] = createSignal<string | null>(null);
  const [newBoardName, setNewBoardName] = createSignal("");
  const [createBoardModalOpen, setCreateBoardModalOpen] = createSignal(false);
  const [notificationHistoryOpen, setNotificationHistoryOpen] = createSignal(false);
  const [boardCrudBusy, setBoardCrudBusy] = createSignal(false);
  const [teamSettings, setTeamSettings] = createSignal<TeamSettings | null>(null);
  const [boardMembers, setBoardMembers] = createSignal<BoardMember[]>([]);
  const [boardMembersLoading, setBoardMembersLoading] = createSignal(false);
  const [boardMembersBusy, setBoardMembersBusy] = createSignal(false);
  const [pendingBoardMemberID, setPendingBoardMemberID] = createSignal("");
  const [exhaustedVillagerIDs, setExhaustedVillagerIDs] = createSignal<string[]>([]);
  const [exhaustedResourceAssignmentKeys, setExhaustedResourceAssignmentKeys] = createSignal<string[]>([]);

  let boardRef: HTMLDivElement | undefined;
  let createBoardInputRef: HTMLInputElement | undefined;
  let composerParseTimer: number | undefined;
  let detailParseTimer: number | undefined;
  let composerParseController: AbortController | undefined;
  let detailParseController: AbortController | undefined;
  let composerParseRequestSeq = 0;
  let detailParseRequestSeq = 0;
  let lastComposerParsedText = "";
  let lastDetailParsedText = "";
  let hasPrimedExhaustedVillagers = false;

  function resetComposerPreview() {
    composerParseRequestSeq += 1;
    composerParseController?.abort();
    composerParseController = undefined;
    lastComposerParsedText = "";
    setComposerParsed(null);
    setComposerParsing(false);
  }

  function resetDetailPreview() {
    detailParseRequestSeq += 1;
    detailParseController?.abort();
    detailParseController = undefined;
    lastDetailParsedText = "";
    setDetailParsed(null);
    setDetailParsing(false);
  }

  const activeBoardID = createMemo(() => boardIDFromSearch(location.search));
  const activeBoardProjectID = createMemo(() => boardProjectIDForBoard(activeBoardID()));
  const boardChoices = createMemo(() => boardChoicesFromProjects(projects(), activeBoardID()));
  const activeBoardChoice = createMemo(
    () => boardChoices().find((choice) => choice.boardID === activeBoardID()) ?? null,
  );
  const createBoardSlugHint = createMemo(() => {
    const boardID = boardIDFromName(newBoardName());
    if (!boardID) return "";
    if (boardID === "board") return "board";
    if (boardID.startsWith("board-")) return boardID.slice("board-".length);
    return boardID;
  });
  const canManageBoardMembers = createMemo(() => teamSettings()?.canManage ?? false);
  const currentUserID = createMemo(() => teamSettings()?.currentUserId ?? "");
  const boardMemberIDs = createMemo(() => new Set(boardMembers().map((member) => member.userId)));
  const addableBoardMembers = createMemo(() => {
    const settings = teamSettings();
    if (!settings) return [] as TeamMember[];
    const existing = boardMemberIDs();
    return settings.members.filter((member) => !existing.has(member.userId));
  });

  const stacks = createMemo(() => Object.values(state()?.stacks ?? {}).sort((a, b) => a.z - b.z));
  const deckPriorityOrderByDefID = createMemo<Record<string, number>>(() => {
    const order: Record<string, number> = {};
    DECK_PRIORITY_ORDER.forEach((defID, index) => {
      order[defID] = index;
    });
    return order;
  });
  const deckStacks = createMemo(() => stacks().filter((stack) => isDeckLikeStack(stack)));
  const orderedDeckStacks = createMemo(() => {
    const rank = deckPriorityOrderByDefID();
    return [...deckStacks()].sort((a, b) => {
      const aDef = topDefID(a);
      const bDef = topDefID(b);
      const aRank = rank[aDef] ?? DECK_PRIORITY_ORDER.length + 100;
      const bRank = rank[bDef] ?? DECK_PRIORITY_ORDER.length + 100;
      if (aRank !== bRank) return aRank - bRank;
      if (aDef !== bDef) return aDef.localeCompare(bDef);
      return a.id.localeCompare(b.id);
    });
  });
  const deckStackByDefID = createMemo<Record<string, BoardStack>>(() => {
    const index: Record<string, BoardStack> = {};
    for (const stack of orderedDeckStacks()) {
      const defID = topDefID(stack);
      if (!defID || index[defID]) continue;
      index[defID] = stack;
    }
    return index;
  });
  const allDeckDefIDsOrdered = createMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    for (const stack of orderedDeckStacks()) {
      const defID = topDefID(stack);
      if (!defID || seen.has(defID)) continue;
      seen.add(defID);
      ids.push(defID);
    }
    return ids;
  });
  const deckOrderedDefIDs = createMemo(() => {
    const available = allDeckDefIDsOrdered();
    if (available.length === 0) return [] as string[];

    const availableSet = new Set(available);
    const merged: string[] = [];
    const seen = new Set<string>();

    for (const raw of deckOrderPrefs()) {
      const defID = raw.trim();
      if (!defID || !availableSet.has(defID) || seen.has(defID)) continue;
      seen.add(defID);
      merged.push(defID);
    }
    for (const defID of available) {
      if (seen.has(defID)) continue;
      seen.add(defID);
      merged.push(defID);
    }

    return merged;
  });
  const deckVisibleLimit = createMemo(() => Math.min(DECK_ROW_MAX_VISIBLE, deckOrderedDefIDs().length));
  const deckRowDefIDs = createMemo(() => deckOrderedDefIDs().slice(0, deckVisibleLimit()));
  const deckOverflowDefIDs = createMemo(() => deckOrderedDefIDs().slice(deckVisibleLimit()));
  const deckRowSlots = createMemo<DeckRowSlot[]>(() => {
    const slots: DeckRowSlot[] = [];
    const byDefID = deckStackByDefID();
    for (const defID of deckRowDefIDs()) {
      const stack = byDefID[defID];
      if (!stack) continue;
      slots.push({
        kind: "deck",
        defId: defID,
        stack,
      });
    }
    if (deckOverflowDefIDs().length > 0) {
      slots.push({
        kind: "hub",
        overflowCount: deckOverflowDefIDs().length,
      });
    }
    return slots;
  });
  const deckRowLayout = createMemo(() => {
    const slotCount = deckRowSlots().length;
    if (slotCount === 0) return null;

    const rect = boardRef?.getBoundingClientRect();
    const viewport = viewportSize();
    const width = rect?.width && rect.width > 0 ? rect.width : viewport.width;
    const height = rect?.height && rect.height > 0 ? rect.height : viewport.height;
    if (width <= 0 || height <= 0) {
      return null;
    }

    const isMobile = width < MOBILE_BREAKPOINT;
    const deckScale = isMobile ? MOBILE_DECK_SCALE : 1;
    const deckWidth = Math.round(CARD_WIDTH * deckScale);
    const deckHeight = Math.round(CARD_HEIGHT * deckScale);
    const minStep = Math.max(1, Math.round(DECK_ROW_MIN_STEP * deckScale));
    const maxStep = Math.max(minStep, Math.round(DECK_ROW_MAX_STEP * deckScale));
    const usableWidth = Math.max(0, width - DECK_ROW_SIDE_PADDING * 2 - deckWidth);
    const step =
      slotCount <= 1
        ? 0
        : Math.max(minStep, Math.min(maxStep, Math.floor(usableWidth / (slotCount - 1))));
    const totalWidth = deckWidth + step * Math.max(0, slotCount - 1);
    const startX = Math.round((width - totalWidth) / 2);
    const bottomOffset = isMobile ? MOBILE_DECK_ROW_BOTTOM : DECK_ROW_BOTTOM;
    const y = Math.max(0, height - deckHeight - bottomOffset);
    return { startX, y, step };
  });
  const deckWorldPositionByID = createMemo<Record<string, BoardPoint>>(() => {
    const layout = deckRowLayout();
    if (!layout) return {};

    const pan = boardPan();
    const positions: Record<string, BoardPoint> = {};
    deckRowSlots().forEach((slot, index) => {
      if (slot.kind !== "deck") return;
      positions[slot.stack.id] = {
        x: layout.startX + index * layout.step - pan.x,
        y: layout.y - pan.y,
      };
    });
    return positions;
  });
  const deckHubWorldPosition = createMemo<BoardPoint | null>(() => {
    const layout = deckRowLayout();
    if (!layout) return null;

    const hubIndex = deckRowSlots().findIndex((slot) => slot.kind === "hub");
    if (hubIndex < 0) return null;

    const pan = boardPan();
    return {
      x: layout.startX + hubIndex * layout.step - pan.x,
      y: layout.y - pan.y,
    };
  });
  const deckLayerOrderByID = createMemo<Record<string, number>>(() => {
    const order: Record<string, number> = {};
    deckRowSlots().forEach((slot, index) => {
      if (slot.kind === "deck") {
        order[slot.stack.id] = index;
      }
    });
    return order;
  });
  const visibleDeckStackIDs = createMemo(() => {
    const visible = new Set<string>();
    for (const slot of deckRowSlots()) {
      if (slot.kind !== "deck") continue;
      visible.add(slot.stack.id);
    }
    return visible;
  });
  const isMobileBoardViewport = createMemo(() => {
    const viewport = viewportSize();
    const width = viewport.width > 0 ? viewport.width : boardRef?.clientWidth ?? 0;
    return width > 0 && width < MOBILE_BREAKPOINT;
  });
  const renderStacks = createMemo(() => {
    const visibleDecks = visibleDeckStackIDs();
    return stacks().filter((stack) => {
      if (!isDeckLikeStack(stack)) return true;
      return visibleDecks.has(stack.id);
    });
  });

  function persistDeckOrderPrefs(nextPrefs: string[]) {
    const available = allDeckDefIDsOrdered();
    const availableSet = new Set(available);
    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const raw of nextPrefs) {
      const defID = raw.trim();
      if (!defID || !availableSet.has(defID) || seen.has(defID)) continue;
      seen.add(defID);
      normalized.push(defID);
    }
    for (const defID of available) {
      if (seen.has(defID)) continue;
      seen.add(defID);
      normalized.push(defID);
    }

    setDeckOrderPrefs(normalized);
  }

  function moveDeckToAbsoluteIndex(defID: string, absoluteIndex: number) {
    const order = deckOrderedDefIDs();
    if (!order.includes(defID)) return;

    const next = order.filter((id) => id !== defID);
    const boundedIndex = Math.max(0, Math.min(Math.trunc(absoluteIndex), next.length));
    next.splice(boundedIndex, 0, defID);
    persistDeckOrderPrefs(next);
  }

  function moveDeckToRow(defID: string) {
    const rowLimit = deckVisibleLimit();
    if (rowLimit <= 0) return;
    moveDeckToAbsoluteIndex(defID, Math.max(0, rowLimit - 1));
  }

  function moveDeckToReserve(defID: string) {
    if (deckOrderedDefIDs().length <= DECK_ROW_MAX_VISIBLE) return;
    moveDeckToAbsoluteIndex(defID, deckVisibleLimit());
  }

  function draggedDeckDefFromEvent(event: DragEvent): string | null {
    const fromState = deckHubDragDefID();
    if (fromState) return fromState;
    const fromTransfer = event.dataTransfer?.getData("text/plain")?.trim() ?? "";
    if (!fromTransfer) return null;
    if (!allDeckDefIDsOrdered().includes(fromTransfer)) return null;
    return fromTransfer;
  }

  function beginDeckHubDrag(event: DragEvent, defID: string) {
    setDeckHubDragDefID(defID);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", defID);
    }
  }

  function endDeckHubDrag() {
    setDeckHubDragDefID(null);
  }

  function handleDeckHubDropToRow(event: DragEvent, rowIndex?: number) {
    event.preventDefault();
    const defID = draggedDeckDefFromEvent(event);
    if (!defID) return;
    const rowLimit = Math.min(DECK_ROW_MAX_VISIBLE, deckOrderedDefIDs().length);
    if (rowLimit <= 0) return;
    const defaultIndex = Math.max(0, rowLimit - 1);
    const index = rowIndex === undefined ? defaultIndex : Math.max(0, Math.min(Math.trunc(rowIndex), rowLimit - 1));
    moveDeckToAbsoluteIndex(defID, index);
    setDeckHubDragDefID(null);
  }

  function handleDeckHubDropToReserve(event: DragEvent, reserveIndex?: number) {
    event.preventDefault();
    const defID = draggedDeckDefFromEvent(event);
    if (!defID) return;
    const reserveStart = deckVisibleLimit();
    const reserveCount = deckOverflowDefIDs().length;
    const index =
      reserveIndex === undefined
        ? reserveStart
        : Math.max(reserveStart, Math.min(reserveStart + Math.trunc(reserveIndex), reserveStart + reserveCount));
    moveDeckToAbsoluteIndex(defID, index);
    setDeckHubDragDefID(null);
  }

  const selectedStack = createMemo(() => {
    const id = selectedStackID();
    if (!id) return null;
    return state()?.stacks[id] ?? null;
  });

  const selectedTaskCard = createMemo(() => taskCardFromStack(selectedStack(), state()));

  const selectedCard = createMemo(() => cardFromStack(selectedStack(), state()));
  const questState = createMemo(() => state()?.meta?.quests);
  const activeQuests = createMemo(() => questState()?.active ?? []);

  const summary = createMemo<BoardSummary>(() => {
    const current = state();
    if (!current) {
      return {
        villagerCount: 0,
        zombieCount: 0,
        activeTaskCount: 0,
        deckCount: 0,
        completedCount: 0,
        dayTicks: 0,
        inventory: {},
      };
    }

    let villagerCount = 0;
    let zombieCount = 0;
    let activeTaskCount = 0;
    let deckCount = 0;

    for (const stack of Object.values(current.stacks)) {
      if (!stack || stack.cards.length === 0) continue;

      let hasTask = false;
      let hasVillager = false;
      let hasZombie = false;

      for (const cardID of stack.cards) {
        const card = current.cards[cardID];
        if (!card) continue;
        const kind = cardKind(card.defId);
        if (kind === "task") hasTask = true;
        if (kind === "villager") hasVillager = true;
        if (kind === "zombie") hasZombie = true;
      }

      const top = cardFromStack(stack, current);
      if (top && isDeckDef(top.defId)) {
        deckCount += 1;
      }
      if (hasTask) activeTaskCount += 1;
      if (hasVillager) villagerCount += 1;
      if (hasZombie) zombieCount += 1;
    }

    return {
      villagerCount,
      zombieCount,
      activeTaskCount,
      deckCount,
      completedCount: current.meta?.metrics?.tasks_completed ?? 0,
      dayTicks: current.meta?.metrics?.day_ticks ?? 0,
      inventory: current.meta?.inventory ?? {},
    };
  });

  const villagerStatuses = createMemo(() => {
    const current = state();
    if (!current) return [] as VillagerStatus[];

    const byID = new Map<string, VillagerStatus>();
    for (const stack of Object.values(current.stacks)) {
      const status = villagerStatusForStack(stack, current);
      if (!status) continue;
      if (!byID.has(status.villagerID)) {
        byID.set(status.villagerID, status);
      }
    }

    return [...byID.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  createEffect(() => {
    activeBoardID();
    hasPrimedExhaustedVillagers = false;
    setExhaustedVillagerIDs([]);
    setExhaustedResourceAssignmentKeys([]);
    setNotificationHistoryOpen(false);
  });

  createEffect(() => {
    const currentState = state();
    if (!currentState) {
      hasPrimedExhaustedVillagers = false;
      setExhaustedVillagerIDs([]);
      setExhaustedResourceAssignmentKeys([]);
      return;
    }

    const statuses = villagerStatuses();
    const nextExhausted = statuses.filter((status) => status.stamina <= 0);
    const previous = new Set(exhaustedVillagerIDs());
    const previousAssignments = new Set(exhaustedResourceAssignmentKeys());
    const nextAssignments: string[] = [];

    for (const stack of Object.values(currentState.stacks)) {
      const status = villagerStatusForStack(stack, currentState);
      if (!status || status.stamina > 0 || !stackHasKind(stack, "resource")) continue;
      const assignmentKey = `${status.villagerID}:${stack.id}`;
      nextAssignments.push(assignmentKey);
      if (hasPrimedExhaustedVillagers && !previousAssignments.has(assignmentKey) && previous.has(status.villagerID)) {
        toast.error(`${status.name} is assigned but out of stamina.`, 4800);
      }
    }

    if (hasPrimedExhaustedVillagers) {
      for (const status of nextExhausted) {
        if (previous.has(status.villagerID)) continue;
        toast.error(`${status.name} ran out of stamina.`, 4800);
      }
    } else {
      hasPrimedExhaustedVillagers = true;
    }

    setExhaustedVillagerIDs(nextExhausted.map((status) => status.villagerID));
    setExhaustedResourceAssignmentKeys(nextAssignments);
  });

  const composerTokens = createMemo(() => tokenizeQuickAdd(composerText()));
  const detailTokens = createMemo(() => tokenizeQuickAdd(detailTitle()));

  const composerChips = createMemo(() => {
    const parsed = composerParsed();
    if (!parsed) return [] as string[];

    const chips: string[] = [];

    const project = addChip("board", "Project");
    if (project) chips.push(project);

    for (const label of parsed.labels) {
      chips.push(`Label: ${label}`);
    }

    const assignee = addChip(parsed.assignee, "Assignee");
    if (assignee) chips.push(assignee);
    if (parsed.priority) chips.push(`Priority: p${parsed.priority}`);
    const dueText = addChip(formatScheduleDateTime(parsed.dueText), "Due");
    if (dueText) chips.push(dueText);
    const deadline = addChip(formatScheduleDateTime(parsed.deadline), "Deadline");
    if (deadline) chips.push(deadline);
    const recurrence = addChip(parsed.recurrenceRule, "Recurrence");
    if (recurrence) chips.push(recurrence);

    return chips;
  });

  const composerGuidance = createMemo(() => {
    const parsed = composerParsed();
    if (!parsed || !parsed.recurrenceRule) return "";
    if (parsed.dueText || parsed.deadline) return "";
    return "Recurrence sets cadence only. Add due text and/or {deadline} for schedule details.";
  });

  const selectedModifierCards = createMemo(() => {
    const stack = selectedStack();
    const current = state();
    if (!stack || !current) return [] as BoardCard[];

    const cards: BoardCard[] = [];
    for (const cardID of stack.cards) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (card.defId.startsWith("mod.")) {
        cards.push(card);
      }
    }
    return cards;
  });

  const recurringModifierEnabled = createMemo(() =>
    selectedModifierCards().some((card) => card.defId === "mod.recurring"),
  );
  const deadlineModifierEnabled = createMemo(() =>
    selectedModifierCards().some((card) => card.defId === "mod.deadline_pin"),
  );

  const detailParsedChips = createMemo(() => {
    const parsed = detailParsed();
    if (!parsed) return [] as string[];

    const chips: string[] = [];
    if (recurringModifierEnabled() && parsed.recurrenceRule) {
      chips.push(`Recurrence: ${parsed.recurrenceRule}`);
    }
    if (deadlineModifierEnabled() && parsed.dueText) {
      chips.push(`Due: ${formatScheduleDateTime(parsed.dueText) ?? parsed.dueText}`);
    }
    if (deadlineModifierEnabled() && parsed.deadline) {
      chips.push(`Deadline: ${formatScheduleDateTime(parsed.deadline) ?? parsed.deadline}`);
    }
    return chips;
  });

  const detailModifierHints = createMemo(() => {
    const parsed = detailParsed();
    if (!parsed) return [] as string[];

    const hints: string[] = [];
    if (!!parsed.recurrenceRule && !recurringModifierEnabled()) {
      hints.push("Recurrence phrase detected. Add Mod Recurring to parse recurrence.");
    }
    if ((!!parsed.dueText || !!parsed.deadline) && !deadlineModifierEnabled()) {
      hints.push("Due/deadline phrase detected. Add Mod Deadline Pin to parse due/deadline.");
    }
    return hints;
  });

  const detailScheduleInput = createMemo(() => dataString(selectedTaskCard()?.data?.scheduleInput));
  const detailStoredDue = createMemo(() => dataString(selectedTaskCard()?.data?.dueText));
  const detailStoredDeadline = createMemo(() => dataString(selectedTaskCard()?.data?.dueDeadline));
  const detailDueInputToken = createMemo(() => scheduleTokenFromInput(detailScheduleInput(), "due"));
  const detailDeadlineInputToken = createMemo(() => scheduleTokenFromInput(detailScheduleInput(), "deadline"));
  const detailVisibleLabels = createMemo(() =>
    mergeNormalizedLabels(
      dataStringArray(selectedTaskCard()?.data?.labels).filter((label) => !hasBoardLiveLabel([label])),
      extractQuickAddLabels(detailTitle()),
    ).filter((label) => !hasBoardLiveLabel([label])),
  );
  const detailScheduleWarning = createMemo(() =>
    scheduleValidationWarning(detailStoredDue(), detailStoredDeadline()),
  );

  createEffect(() => {
    const candidates = addableBoardMembers();
    const selected = pendingBoardMemberID();
    if (candidates.length === 0) {
      if (selected) setPendingBoardMemberID("");
      return;
    }
    if (!selected || !candidates.some((member) => member.userId === selected)) {
      setPendingBoardMemberID(candidates[0].userId);
    }
  });

  function stackPosition(stack: BoardStack): BoardPoint {
    if (isDeckLikeStack(stack)) {
      const fixedDeckPos = deckWorldPositionByID()[stack.id];
      if (fixedDeckPos) {
        return fixedDeckPos;
      }
    }

    const drag = dragState();
    if (drag && drag.mode === "split" && drag.stackId === stack.id) {
      return stack.pos;
    }
    return localPositions()[stack.id] ?? stack.pos;
  }

  function worldFromClient(clientX: number, clientY: number): BoardPoint {
    if (!boardRef) return { x: clientX, y: clientY };
    const rect = boardRef.getBoundingClientRect();
    const pan = boardPan();
    return {
      x: Math.round(clientX - rect.left - pan.x),
      y: Math.round(clientY - rect.top - pan.y),
    };
  }

  function stackCardsForRender(stack: BoardStack): string[] {
    const drag = dragState();
    if (!drag || drag.mode !== "split" || drag.stackId !== stack.id) {
      return stack.cards;
    }
    return splitCardIDs(stack.cards, drag.splitIndex).remaining;
  }

  function draggedCardsForRender(stack: BoardStack): string[] {
    const drag = dragState();
    if (!drag || drag.mode !== "split" || drag.stackId !== stack.id) {
      return [];
    }
    return splitCardIDs(stack.cards, drag.splitIndex).dragged;
  }

  function dragPreviewPosition(stackID: string): BoardPoint | null {
    const drag = dragState();
    if (!drag || drag.mode !== "split" || drag.stackId !== stackID) {
      return null;
    }
    return localPositions()[stackID] ?? null;
  }

  function clearLocalPosition(stackID: string) {
    setLocalPositions((current) => {
      const next = { ...current };
      delete next[stackID];
      return next;
    });
  }

  function suppressStackClick(stackID: string) {
    setClickSuppress({
      stackId: stackID,
      until: Date.now() + 300,
    });
  }

  function isClickSuppressed(stackID: string): boolean {
    const suppression = clickSuppress();
    if (!suppression) return false;
    return suppression.stackId === stackID && Date.now() < suppression.until;
  }

  function isCollectDeck(stack: BoardStack | null): boolean {
    const top = cardFromStack(stack, state());
    return !!top && top.defId === "deck.collect";
  }

  const draggingOverCollectDeck = createMemo(() => {
    const targetID = mergeTargetID();
    if (!targetID) return false;
    return isCollectDeck(state()?.stacks[targetID] ?? null);
  });

  function stackZIndex(stack: BoardStack, isDraggingStack: boolean): string {
    if (isDeckLikeStack(stack)) {
      const order = deckLayerOrderByID()[stack.id] ?? 0;
      return `${Z_INDEX_DECK_BASE + order}`;
    }

    if (isDraggingStack) {
      return `${draggingOverCollectDeck() ? Z_INDEX_DRAG_OVER_COLLECT : Z_INDEX_DRAG}`;
    }

    return `${Math.min(stack.z, Z_INDEX_WORLD_MAX)}`;
  }

  function topDefID(stack: BoardStack | null): string {
    const top = cardFromStack(stack, state());
    if (!top) return "";
    return top.defId;
  }

  function stackHasCardDefID(stack: BoardStack | null, defID: string): boolean {
    const current = state();
    if (!current || !stack) return false;
    const normalized = defID.trim().toLowerCase();
    if (!normalized) return false;

    for (const cardID of stack.cards) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (card.defId.trim().toLowerCase() === normalized) {
        return true;
      }
    }

    return false;
  }

  function stackHasKind(stack: BoardStack | null, kind: string): boolean {
    const current = state();
    if (!current || !stack) return false;
    const normalized = kind.trim().toLowerCase();
    if (!normalized) return false;

    for (const cardID of stack.cards) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (cardKind(card.defId).toLowerCase() === normalized) {
        return true;
      }
    }

    return false;
  }

  function firstCardByKind(stack: BoardStack | null, kind: string): BoardCard | null {
    const current = state();
    if (!current || !stack) return null;
    const normalized = kind.trim().toLowerCase();
    if (!normalized) return null;

    for (const cardID of stack.cards) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (cardKind(card.defId).toLowerCase() === normalized) {
        return card;
      }
    }
    return null;
  }

  function miningDurationMsForStack(stack: BoardStack | null): number | null {
    const resourceCard = firstCardByKind(stack, "resource");
    if (!resourceCard) return null;

    const raw = dataNumber(resourceCard.data?.gatherTimeS);
    if (!raw || raw <= 0) return 6000;
    const seconds = Math.min(Math.max(raw, 1), 180);
    return Math.round(seconds * 1000);
  }

  createEffect(() => {
    const current = state();
    if (!current) {
      setMiningSessionsByStackID({});
      setMiningCompletedCyclesByStackID({});
      setMiningPendingByStackID({});
      return;
    }

    const now = Date.now();
    setMiningSessionsByStackID((existing) => {
      const next: Record<string, MiningSession> = {};
      for (const stack of Object.values(current.stacks)) {
        if (!stack) continue;
        if (!stackHasKind(stack, "villager") || !stackHasKind(stack, "resource")) {
          continue;
        }
        const villager = villagerStatusForStack(stack, current);
        if (!villager || villager.stamina <= 0) {
          continue;
        }

        const durationMs = miningDurationMsForStack(stack);
        if (!durationMs) continue;

        const previous = existing[stack.id];
        if (previous && previous.durationMs === durationMs) {
          next[stack.id] = previous;
        } else {
          next[stack.id] = {
            startedAt: now,
            durationMs,
          };
        }
      }
      return next;
    });
  });

  createEffect(() => {
    const active = new Set(Object.keys(miningSessionsByStackID()));

    setMiningCompletedCyclesByStackID((existing) => {
      const next: Record<string, number> = {};
      for (const [stackID, cycle] of Object.entries(existing)) {
        if (!active.has(stackID)) continue;
        next[stackID] = cycle;
      }
      return next;
    });

    setMiningPendingByStackID((existing) => {
      const next: Record<string, true> = {};
      for (const stackID of Object.keys(existing)) {
        if (!active.has(stackID)) continue;
        next[stackID] = true;
      }
      return next;
    });
  });

  createEffect(() => {
    const sessions = miningSessionsByStackID();
    const tick = miningTickMs();
    const completedCycles = miningCompletedCyclesByStackID();
    const pending = miningPendingByStackID();

    if (busy()) return;

    for (const [stackID, session] of Object.entries(sessions)) {
      if (!session || session.durationMs <= 0) continue;
      if (pending[stackID]) continue;

      const elapsed = Math.max(0, tick - session.startedAt);
      if (elapsed < session.durationMs) continue;

      const cycle = Math.floor(elapsed / session.durationMs);
      const completedCycle = completedCycles[stackID] ?? 0;
      if (cycle <= completedCycle) continue;
      const nextCompletedCycle = completedCycle + 1;

      setMiningPendingByStackID((existing) => ({
        ...existing,
        [stackID]: true,
      }));

      void (async () => {
        let advanceCycle = false;
        try {
          await sendCommand(
            {
              cmd: "resource.gather",
              args: {
                resourceStackId: stackID,
                villagerStackId: stackID,
              },
            },
            { retryConflict: false },
          );
          advanceCycle = true;
        } catch (err) {
          const apiError = err as ApiError;
          if (apiError.status === 409) {
            await loadBoard({ syncTasks: false, silent: true });
            return;
          }
          const message = apiError.message.toLowerCase();
          if (message.includes("stamina too low")) {
            const status = villagerStatusForStack(state()?.stacks[stackID] ?? null, state());
            toast.error(`${status?.name ?? "Villager"} ran out of stamina.`, 4800);
          }
          if (message.includes("stamina too low") || message.includes("resource stack not found")) {
            setMiningSessionsByStackID((existing) => {
              const next = { ...existing };
              delete next[stackID];
              return next;
            });
            advanceCycle = true;
          }
        } finally {
          setMiningPendingByStackID((existing) => {
            const next = { ...existing };
            delete next[stackID];
            return next;
          });
          if (advanceCycle) {
            setMiningCompletedCyclesByStackID((existing) => ({
              ...existing,
              [stackID]: nextCompletedCycle,
            }));
          }
        }
      })();
    }
  });

  createEffect(() => {
    const prefs = deckOrderPrefs();
    if (typeof window === "undefined") return;
    try {
      if (prefs.length === 0) {
        window.localStorage.removeItem(DECK_ROW_PREFS_KEY);
      } else {
        window.localStorage.setItem(DECK_ROW_PREFS_KEY, JSON.stringify(prefs));
      }
    } catch {
      // Ignore localStorage write errors.
    }
  });

  createEffect(() => {
    if (deckOverflowDefIDs().length === 0 && deckHubOpen()) {
      setDeckHubOpen(false);
    }
  });

  const minimapModel = createMemo(() => {
    const viewport = viewportSize();
    const viewportWidth = viewport.width > 0 ? viewport.width : boardRef?.clientWidth ?? 0;
    const viewportHeight = viewport.height > 0 ? viewport.height : boardRef?.clientHeight ?? 0;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return null;
    }

    const pan = boardPan();
    const viewportWorld: WorldRect = {
      left: -pan.x,
      top: -pan.y,
      right: -pan.x + viewportWidth,
      bottom: -pan.y + viewportHeight,
    };

    let minX = viewportWorld.left;
    let minY = viewportWorld.top;
    let maxX = viewportWorld.right;
    let maxY = viewportWorld.bottom;

    const stackEntries = renderStacks().map((stack) => {
      const pos = stackPosition(stack);
      const bounds = stackBounds(pos, stack.cards.length);
      minX = Math.min(minX, bounds.left);
      minY = Math.min(minY, bounds.top);
      maxX = Math.max(maxX, bounds.right);
      maxY = Math.max(maxY, bounds.bottom);
      const top = cardFromStack(stack, state());
      const villager = villagerStatusForStack(stack, state());
      return {
        id: stack.id,
        kind: top ? cardKind(top.defId) : "unknown",
        bounds,
        centerX: bounds.left + CARD_WIDTH / 2,
        centerY: bounds.top + stackHeightPx(stack.cards.length) / 2,
        isSelected: selectedStackID() === stack.id,
        isExhausted: !!villager && villager.stamina <= 0,
        isNextAction: stackHasKind(stack, "task") && stackHasCardDefID(stack, "mod.next_action"),
      };
    });

    minX -= MINIMAP_PADDING;
    minY -= MINIMAP_PADDING;
    maxX += MINIMAP_PADDING;
    maxY += MINIMAP_PADDING;

    const worldWidth = Math.max(1, maxX - minX);
    const worldHeight = Math.max(1, maxY - minY);
    const scale = Math.min(MINIMAP_WIDTH / worldWidth, MINIMAP_HEIGHT / worldHeight);
    const contentWidth = worldWidth * scale;
    const contentHeight = worldHeight * scale;
    const offsetX = (MINIMAP_WIDTH - contentWidth) / 2;
    const offsetY = (MINIMAP_HEIGHT - contentHeight) / 2;

    const toMapX = (worldX: number) => offsetX + (worldX - minX) * scale;
    const toMapY = (worldY: number) => offsetY + (worldY - minY) * scale;

    const dots = stackEntries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      x: toMapX(entry.centerX),
      y: toMapY(entry.centerY),
      isSelected: entry.isSelected,
      isExhausted: entry.isExhausted,
      isNextAction: entry.isNextAction,
    }));

    const offscreenCount = stackEntries.reduce((count, entry) => {
      if (!rectsIntersect(entry.bounds, viewportWorld)) {
        return count + 1;
      }
      return count;
    }, 0);

    return {
      dots,
      offscreenCount,
      viewportRect: {
        x: toMapX(viewportWorld.left),
        y: toMapY(viewportWorld.top),
        width: Math.max(2, viewportWidth * scale),
        height: Math.max(2, viewportHeight * scale),
      },
      boundsMinX: minX,
      boundsMinY: minY,
      scale,
      offsetX,
      offsetY,
      contentWidth,
      contentHeight,
      viewportWidth,
      viewportHeight,
    };
  });

  function minimapDotClass(kind: string, isNextAction: boolean, isExhausted: boolean): string {
    if (isExhausted) return "bg-[#f87171] shadow-[0_0_8px_rgba(248,113,113,0.9)]";
    if (isNextAction) return "bg-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.9)]";
    switch (kind) {
      case "task":
        return "bg-[#f39aa0]";
      case "villager":
        return "bg-[#f3cc8c]";
      case "zombie":
        return "bg-[#c98697]";
      case "resource":
        return "bg-[#9ece92]";
      case "food":
        return "bg-[#ebb06c]";
      case "deck":
        return "bg-[#b5c2d9]";
      default:
        return "bg-[#96a5bf]";
    }
  }

  function focusMinimapAt(clientX: number, clientY: number, minimapBounds: DOMRect) {
    const model = minimapModel();
    if (!model || !minimapBounds) return;

    const normalizedX = ((clientX - minimapBounds.left) / Math.max(1, minimapBounds.width)) * MINIMAP_WIDTH;
    const normalizedY = ((clientY - minimapBounds.top) / Math.max(1, minimapBounds.height)) * MINIMAP_HEIGHT;
    const localX = Math.max(0, Math.min(MINIMAP_WIDTH, normalizedX));
    const localY = Math.max(0, Math.min(MINIMAP_HEIGHT, normalizedY));
    const clampedX = Math.max(model.offsetX, Math.min(model.offsetX + model.contentWidth, localX));
    const clampedY = Math.max(model.offsetY, Math.min(model.offsetY + model.contentHeight, localY));

    const worldX = model.boundsMinX + (clampedX - model.offsetX) / model.scale;
    const worldY = model.boundsMinY + (clampedY - model.offsetY) / model.scale;

    setBoardPan({
      x: Math.round(model.viewportWidth / 2 - worldX),
      y: Math.round(model.viewportHeight / 2 - worldY),
    });
  }

  function onMinimapPointerDown(event: PointerEvent) {
    if (event.button !== 0 || busy()) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLDivElement | null;
    if (target) {
      target.setPointerCapture(event.pointerId);
      focusMinimapAt(event.clientX, event.clientY, target.getBoundingClientRect());
    }
  }

  function onMinimapPointerMove(event: PointerEvent) {
    if ((event.buttons & 1) !== 1 || busy()) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLDivElement | null;
    if (!target) return;
    focusMinimapAt(event.clientX, event.clientY, target.getBoundingClientRect());
  }

  function onMinimapPointerUp(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLDivElement | null;
    if (target && target.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
  }

  function stackPreview(stack: BoardStack, cardIDs?: string[]): StackPreview {
    const card = cardIDs ? cardFromCardIDs(cardIDs, state()) : cardFromStack(stack, state());
    const kind = card ? cardKind(card.defId) : "unknown";
    const isDeck = card ? isDeckDef(card.defId) : false;
    const isPack = card ? isPackDef(card.defId) : false;
    const skin = cardSkin(kind, card?.defId ?? "");

    let title = titleFromCard(card);
    if (card && isPack) {
      title = `${deckDisplayName(packDeckID(card))} Pack`;
    }

    return {
      title,
      subtitle: subtitleFromCard(card),
      kind,
      icon: cardIcon(card),
      shellClass: skin.shellClass,
      titleClass: skin.titleClass,
      isDeck,
      isPack,
    };
  }

  async function listAllTasks(limit = 100): Promise<Task[]> {
    const items: Task[] = [];
    let cursor = 0;

    for (let page = 0; page < 100; page += 1) {
      const response = await api.tasks.list({ limit, cursor });
      items.push(...response.items);
      if (response.nextCursor === undefined || response.nextCursor === null || response.nextCursor <= cursor) {
        break;
      }
      cursor = response.nextCursor;
    }

    return items;
  }

  function taskIDsOnBoard(snapshot: BoardStateResponse | null): Set<string> {
    const ids = new Set<string>();
    if (!snapshot) return ids;

    for (const stack of Object.values(snapshot.stacks)) {
      if (!stack) continue;
      for (const cardID of stack.cards) {
        const card = snapshot.cards[cardID];
        if (!card || cardKind(card.defId) !== "task") continue;
        const taskID = dataString(card.data?.taskId);
        if (taskID) {
          ids.add(taskID);
        }
      }
    }

    return ids;
  }

  async function syncBoardProjectTasks(snapshot: BoardStateResponse | null, boardID: string): Promise<boolean> {
    if (!snapshot) return false;

    const openBoardTasks = (await listAllTasks()).filter(
      (task) =>
        !task.checked &&
        !task.isDeleted &&
        matchesBoardProject(task.projectId, boardID) &&
        hasBoardLiveLabel(task.labels),
    );
    if (openBoardTasks.length === 0) return false;

    const existingTaskIDs = taskIDsOnBoard(snapshot);
    const missing = openBoardTasks.filter((task) => !existingTaskIDs.has(task.id));
    if (missing.length === 0) return false;

    const rect = boardRef?.getBoundingClientRect();
    const pan = boardPan();
    const baseX = rect ? Math.round(rect.width / 2 - CARD_WIDTH / 2 - pan.x) : 260;
    const baseY = rect ? Math.round(rect.height / 3 - CARD_HEIGHT / 2 - pan.y) : 160;

    for (let index = 0; index < missing.length; index += 1) {
      const x = baseX + (index % 6) * 26;
      const y = baseY + Math.floor(index / 6) * 32;
      try {
        await sendCommand(
          {
            cmd: "task.spawn_existing",
            args: {
              x,
              y,
              taskId: missing[index].id,
            },
          },
          { refresh: false },
        );
      } catch (err) {
        const message = (err as Error).message.toLowerCase();
        if (message.includes("already on the board")) {
          continue;
        }
        throw err;
      }
    }

    return true;
  }

  async function loadProjects() {
    try {
      const response = await api.projects.list();
      setProjects(response.items);
    } catch {
      // Ignore transient project list errors on board view.
    }
  }

  async function loadTeamSettings() {
    try {
      const response = await api.team.getSettings();
      setTeamSettings(response.settings);
    } catch {
      // Ignore transient team settings errors on board view.
    }
  }

  async function loadBoardMembers(boardID = activeBoardID()) {
    setBoardMembersLoading(true);
    try {
      const response = await api.board.listMembers(boardID);
      setBoardMembers(response.members);
    } catch (err) {
      setBoardMembers([]);
      setError((err as Error).message);
    } finally {
      setBoardMembersLoading(false);
    }
  }

  async function addPendingBoardMember() {
    const userID = pendingBoardMemberID().trim();
    if (!userID) {
      toast.info("Select a team member to add.");
      return;
    }
    setBoardMembersBusy(true);
    try {
      await api.board.addMember(userID, activeBoardID());
      await loadBoardMembers(activeBoardID());
      setError("");
      setPendingBoardMemberID("");
      toast.success("Member added to board.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setBoardMembersBusy(false);
    }
  }

  async function removeBoardMember(userID: string) {
    const targetID = userID.trim();
    if (!targetID || targetID === currentUserID()) {
      toast.info("You cannot remove yourself from this board.");
      return;
    }
    setBoardMembersBusy(true);
    try {
      await api.board.removeMember(targetID, activeBoardID());
      await loadBoardMembers(activeBoardID());
      setError("");
      toast.info("Member removed from board.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setBoardMembersBusy(false);
    }
  }

  function switchBoard(nextBoardID: string) {
    const normalized = normalizeBoardID(nextBoardID);
    if (normalized === activeBoardID()) return;
    setState(null); // Reset so the loading spinner shows for the new board.
    navigate(boardHref(normalized));
  }

  function openStorePage() {
    navigate(boardStoreHref(activeBoardID()));
  }

  async function createBoard(): Promise<boolean> {
    const rawName = newBoardName().trim();
    if (!rawName) {
      const message = "Board name is required.";
      setError(message);
      toast.error(message);
      return false;
    }
    const boardID = boardIDFromName(rawName);
    if (!boardID) {
      const message = 'Board name must include letters or numbers and cannot be just "board".';
      setError(message);
      toast.error(message);
      return false;
    }
    if (boardChoices().some((choice) => choice.boardID === boardID)) {
      const message = "A board with that name already exists.";
      setError(message);
      toast.error(message);
      return false;
    }

    setBoardCrudBusy(true);
    try {
      await api.projects.create({
        id: boardProjectIDForBoard(boardID),
        name: rawName,
      });
      setNewBoardName("");
      await loadProjects();
      switchBoard(boardID);
      setError("");
      toast.success(`Board "${rawName}" created.`);
      return true;
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setBoardCrudBusy(false);
    }
  }

  async function deleteActiveBoard() {
    const boardID = activeBoardID();
    if (boardID === DEFAULT_BOARD) {
      const message = "The default board cannot be deleted.";
      setError(message);
      toast.error(message);
      return;
    }
    const boardName = activeBoardChoice()?.name || boardProjectIDForBoard(boardID);
    const ok = window.confirm(`Delete "${boardName}"? This removes the board from your project list.`);
    if (!ok) return;

    setBoardCrudBusy(true);
    try {
      await api.projects.remove(activeBoardProjectID());
      await loadProjects();
      switchBoard(DEFAULT_BOARD);
      setError("");
      toast.info(`Board "${boardName}" deleted.`);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setBoardCrudBusy(false);
    }
  }

  function openCreateBoardModal() {
    setNewBoardName("");
    setCreateBoardModalOpen(true);
  }

  function closeCreateBoardModal() {
    if (boardCrudBusy()) return;
    setCreateBoardModalOpen(false);
  }

  async function submitCreateBoardFromModal() {
    const created = await createBoard();
    if (!created) return;
    setCreateBoardModalOpen(false);
  }

  async function loadBoard(options: { syncTasks?: boolean; boardID?: string; silent?: boolean } = {}) {
    const syncTasks = options.syncTasks ?? false;
    const boardID = normalizeBoardID(options.boardID ?? activeBoardID());
    // Only show full loading spinner on initial load (state is null).
    // Subsequent refreshes update silently to avoid hiding the board.
    // Use untrack to avoid making this a reactive dependency (would cause
    // infinite loops when called from createEffect).
    const silent = options.silent ?? (untrack(() => state()) !== null);
    if (!silent) setLoading(true);
    try {
      let response = await api.board.getState(boardID);
      if (Object.keys(response.stacks ?? {}).length === 0) {
        try {
          await api.board.command(
            {
              cmd: "board.seed_default",
              args: {},
              clientVersion: response.version,
            },
            boardID,
          );
        } catch (err) {
          const apiError = err as ApiError;
          const message = apiError.message.toLowerCase();
          if (apiError.status !== 409 && !message.includes("already_initialized")) {
            throw err;
          }
        }
        response = await api.board.getState(boardID);
      }
      setState(response);
      let syncError = "";

      if (syncTasks) {
        try {
          const changed = await syncBoardProjectTasks(response, boardID);
          if (changed) {
            response = await api.board.getState(boardID);
            setState(response);
          }
        } catch (err) {
          syncError = (err as Error).message;
        }
      }

      if (syncError) {
        setError(syncError);
      } else {
        setError("");
      }
      // Persist to IndexedDB for instant load next time.
      void setCachedBoardState(boardID, response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function sendCommand(
    payload: BoardCommandPayload,
    options: { refresh?: boolean; retryConflict?: boolean; boardID?: string } = {},
  ) {
    const refresh = options.refresh ?? true;
    const retryConflict = options.retryConflict ?? true;
    const boardID = normalizeBoardID(options.boardID ?? activeBoardID());

    setBusy(true);
    try {
      const response = await api.board.command(
        {
          ...payload,
          clientVersion: state()?.version,
        },
        boardID,
      );

      setState((current) => (current ? { ...current, version: response.newVersion } : current));

      if (refresh) {
        await loadBoard({ boardID });
      }
      return response;
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 409 && retryConflict) {
        await loadBoard({ boardID });
        return sendCommand(payload, { refresh, retryConflict: false, boardID });
      }
      setError(apiError.message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function refreshBoard() {
    await loadProjects();
    await loadBoardMembers(activeBoardID());
    await loadBoard({ syncTasks: true });
  }

  async function endDay() {
    try {
      await sendCommand({ cmd: "world.end_day", args: {} });
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function claimQuestReward(questID: string) {
    const trimmed = questID.trim();
    if (!trimmed) return;
    setQuestClaimingID(trimmed);
    try {
      await sendCommand({ cmd: "quest.claim_reward", args: { questId: trimmed } });
      setError("");
    } catch {
      // Error state is set in sendCommand.
    } finally {
      setQuestClaimingID(null);
    }
  }

  function onComposerInput(value: string) {
    setComposerText(value);

    if (composerParseTimer !== undefined) {
      window.clearTimeout(composerParseTimer);
      composerParseTimer = undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      resetComposerPreview();
      return;
    }

    composerParseTimer = window.setTimeout(async () => {
      if (trimmed === lastComposerParsedText) return;
      lastComposerParsedText = trimmed;
      composerParseRequestSeq += 1;
      const requestSeq = composerParseRequestSeq;
      composerParseController?.abort();
      const controller = new AbortController();
      composerParseController = controller;
      setComposerParsing(true);
      try {
        const parsed = await api.parse.quickAdd(ensureBoardProjectToken(trimmed, activeBoardProjectID()), {
          signal: controller.signal,
        });
        if (requestSeq !== composerParseRequestSeq) return;
        setComposerParsed(parsed.parsed);
      } catch (err) {
        if (isAbortError(err) || requestSeq !== composerParseRequestSeq) return;
        setComposerParsed(null);
      } finally {
        if (requestSeq === composerParseRequestSeq) {
          composerParseController = undefined;
          setComposerParsing(false);
        }
      }
    }, 325);
  }

  function queueDetailParse(value: string) {
    if (detailParseTimer !== undefined) {
      window.clearTimeout(detailParseTimer);
      detailParseTimer = undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      resetDetailPreview();
      return;
    }

    detailParseTimer = window.setTimeout(async () => {
      if (trimmed === lastDetailParsedText) return;
      lastDetailParsedText = trimmed;
      detailParseRequestSeq += 1;
      const requestSeq = detailParseRequestSeq;
      detailParseController?.abort();
      const controller = new AbortController();
      detailParseController = controller;
      setDetailParsing(true);
      try {
        const parsed = await api.parse.quickAdd(trimmed, { signal: controller.signal });
        if (requestSeq !== detailParseRequestSeq) return;
        setDetailParsed(parsed.parsed);
      } catch (err) {
        if (isAbortError(err) || requestSeq !== detailParseRequestSeq) return;
        setDetailParsed(null);
      } finally {
        if (requestSeq === detailParseRequestSeq) {
          detailParseController = undefined;
          setDetailParsing(false);
        }
      }
    }, 325);
  }

  function onDetailTitleInput(value: string) {
    setDetailTitle(value);
    queueDetailParse(value);
  }

  async function parseTaskTitleInput(value: string): Promise<QuickAddParsed | null> {
    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      return null;
    }

    const parsed = await api.parse.quickAdd(trimmed);
    return parsed.parsed;
  }

  function hasParsedSchedule(parsed: QuickAddParsed | null): boolean {
    return !!(parsed?.recurrenceRule || parsed?.dueText || parsed?.deadline);
  }

  async function createTaskStack() {
    const text = composerText().trim();
    if (!text) return;

    const boardID = activeBoardID();
    const boardProjectID = boardProjectIDForBoard(boardID);
    const normalizedQuickAdd = ensureBoardProjectToken(text, boardProjectID);

    const rect = boardRef?.getBoundingClientRect();
    const pan = boardPan();
    const x = rect ? Math.round(rect.width / 2 - CARD_WIDTH / 2 - pan.x) : 260;
    const y = rect ? Math.round(rect.height / 2 - CARD_HEIGHT / 2 - pan.y) : 180;

    try {
      const created = await api.tasks.quickAdd(normalizedQuickAdd);
      if (!matchesBoardProject(created.task.projectId, boardID)) {
        await api.tasks.update(created.task.id, { projectId: boardProjectID });
      }

      await sendCommand({
        cmd: "task.spawn_existing",
        args: {
          x,
          y,
          taskId: created.task.id,
          countAsCreated: true,
        },
      });

      setComposerText("");
      resetComposerPreview();
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function openDetail(stackID: string) {
    const stack = state()?.stacks[stackID];
    if (!stack) return;

    const card = cardFromStack(stack, state());
    if (!card || cardKind(card.defId) !== "task") return;

    setSelectedStackID(stackID);
    const title = titleFromCard(card);
    setDetailTitle(title);
    setDetailDescription(descriptionFromCard(card));
    const priority = dataNumber(card.data?.priority);
    setDetailPriority(priority && priority >= 1 && priority <= 4 ? priority : 4);
    queueDetailParse(title);
    setIsDetailOpen(true);
  }

  function closeDetail() {
    setIsDetailOpen(false);
    if (detailParseTimer !== undefined) {
      window.clearTimeout(detailParseTimer);
      detailParseTimer = undefined;
    }
    resetDetailPreview();
  }

  function openInTaskPage() {
    navigate(`/task/project/${encodeURIComponent(activeBoardProjectID())}`);
    closeDetail();
  }

  async function saveDetail() {
    const stack = selectedStack();
    const taskCard = selectedTaskCard();
    if (!stack || !taskCard) {
      setError("Selected stack does not include a task card.");
      return;
    }

    try {
      const recurrenceEnabled = recurringModifierEnabled();
      const deadlineEnabled = deadlineModifierEnabled();
      const rawTitle = detailTitle().trim();
      const parsed = await parseTaskTitleInput(rawTitle);
      if (rawTitle && parsed && !parsed.content.trim()) {
        setError("Task title cannot be empty");
        return;
      }
      let normalizedTitle = (parsed?.content ?? rawTitle).trim();
      const normalizedDescription = (parsed?.description || detailDescription()).trim();
      let normalizedContent = normalizedTitle || "Untitled task";

      let recurrenceRule: string | undefined;
      let scheduleInput: string | undefined;
      let dueText: string | undefined;
      let dueDeadline: string | undefined;

      if ((recurrenceEnabled || deadlineEnabled) && parsed) {
        const parsedRecurrence = parsed.recurrenceRule;
        const parsedDueText = parsed.dueText;
        const parsedDeadline = parsed.deadline;

        const recurrenceParsed = !!parsedRecurrence;
        const deadlineParsed = !!parsedDueText || !!parsedDeadline;

        if (recurrenceEnabled && parsedRecurrence) {
          recurrenceRule = parsedRecurrence;
        }
        if (deadlineEnabled) {
          dueText = parsedDueText;
          dueDeadline = parsedDeadline;
        }

        if ((recurrenceEnabled && recurrenceParsed) || (deadlineEnabled && deadlineParsed)) {
          scheduleInput = rawTitle;
        }
      }

      let taskID = dataString(taskCard.data?.taskId);
      if (!taskID) {
        const created = await api.tasks.create(normalizedContent);
        taskID = created.id;

        await sendCommand(
          {
            cmd: "task.set_task_id",
            args: {
              taskCardId: taskCard.id,
              taskId: taskID,
            },
          },
          { refresh: false },
        );
      }

      await sendCommand(
        {
          cmd: "task.set_title",
          args: {
            taskCardId: taskCard.id,
            title: normalizedTitle,
          },
        },
        { refresh: false },
      );

      await sendCommand(
        {
          cmd: "task.set_description",
          args: {
            taskCardId: taskCard.id,
            description: normalizedDescription,
          },
        },
        { refresh: false },
      );

      await sendCommand(
        {
          cmd: "task.set_priority",
          args: {
            taskCardId: taskCard.id,
            priority: parsed?.priority ?? detailPriority(),
          },
        },
        { refresh: false },
      );

      await api.tasks.update(taskID, {
        content: normalizedContent,
        description: normalizedDescription,
        priority: parsed?.priority ?? detailPriority(),
        projectId: activeBoardProjectID(),
        labels: mergeNormalizedLabels(dataStringArray(taskCard.data?.labels), parsed?.labels),
        recurrenceRule,
        scheduleInput: hasParsedSchedule(parsed) && (recurrenceEnabled || deadlineEnabled) ? scheduleInput : undefined,
        dueText,
        dueDeadline,
      });

      await loadBoard({ syncTasks: false });

      closeDetail();
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function completeStack(stackID: string) {
    try {
      const result = await sendCommand({
        cmd: "task.complete_stack",
        args: { stackId: stackID },
      });
      if (selectedStackID() === stackID) {
        closeDetail();
      }
      setInlineStackID(null);
      setInlineTitle("");
      setError("");
      toast.success(taskCompletionToastMessage(result.patch));
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function removeStack(stackID: string) {
    try {
      await sendCommand({
        cmd: "stack.remove",
        args: { stackId: stackID },
      });
      if (selectedStackID() === stackID) {
        closeDetail();
      }
      setInlineStackID(null);
      setInlineTitle("");
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  function startInlineEdit(stackID: string) {
    const stack = state()?.stacks[stackID];
    if (!stack) return;
    const card = taskCardFromStack(stack, state());
    if (!card) {
      setError("Only task cards can be renamed inline.");
      return;
    }
    setInlineStackID(stackID);
    setInlineTitle(titleFromCard(card));
    setError("");
  }

  function cancelInlineEdit() {
    setInlineStackID(null);
    setInlineTitle("");
  }

  async function saveInlineEdit() {
    const stackID = inlineStackID();
    if (!stackID) return;

    const stack = state()?.stacks[stackID];
    if (!stack) return;

    const taskCard = taskCardFromStack(stack, state());
    if (!taskCard) return;

    try {
      await sendCommand({
        cmd: "task.set_title",
        args: {
          taskCardId: taskCard.id,
          title: inlineTitle().trim(),
        },
      });
      cancelInlineEdit();
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function activateDeckOrPack(stack: BoardStack) {
    const top = cardFromStack(stack, state());
    if (!top) return;

    if (isDeckDef(top.defId)) {
      if (top.defId === "deck.collect") {
        return;
      }
      const pos = stackPosition(stack);
      const spawnX = pos.x + CARD_WIDTH + 26;
      const spawnY = Math.max(24, pos.y - 130);
      try {
        await sendCommand({
          cmd: "deck.spawn_pack",
          args: {
            deckStackId: stack.id,
            x: spawnX,
            y: spawnY,
          },
        });
      } catch {
        // Error state is set in sendCommand.
      }
      return;
    }

    if (isPackDef(top.defId)) {
      try {
        await sendCommand({
          cmd: "deck.open_pack",
          args: {
            packStackId: stack.id,
            deckId: packDeckID(top),
          },
        });
      } catch {
        // Error state is set in sendCommand.
      }
    }
  }

  function isDeckLikeStack(stack: BoardStack): boolean {
    const top = cardFromStack(stack, state());
    return !!top && isDeckDef(top.defId);
  }

  function resolveMergeTarget(sourceID: string, sourcePos: BoardPoint, sourceCardCount: number): string | null {
    const source = state()?.stacks[sourceID];
    if (!source) return null;

    const sourceRect = stackBounds(sourcePos, sourceCardCount);

    let bestAreaID: string | null = null;
    let bestArea = 0;

    for (const stack of renderStacks()) {
      if (stack.id === sourceID) continue;
      const targetRect = stackBounds(stackPosition(stack), stack.cards.length);
      const area = overlapArea(sourceRect, targetRect);
      if (area > bestArea) {
        bestArea = area;
        bestAreaID = stack.id;
      }
    }

    if (bestAreaID && bestArea >= MIN_MERGE_OVERLAP) {
      return bestAreaID;
    }

    let nearestID: string | null = null;
    let nearestGap = Number.POSITIVE_INFINITY;

    for (const stack of renderStacks()) {
      if (stack.id === sourceID) continue;
      const targetRect = stackBounds(stackPosition(stack), stack.cards.length);
      const gap = rectGap(sourceRect, targetRect);
      if (gap <= MERGE_GAP_DISTANCE && gap < nearestGap) {
        nearestGap = gap;
        nearestID = stack.id;
      }
    }

    return nearestID;
  }

  function stackCardIndexFromPointer(event: PointerEvent, stack: BoardStack): number {
    const topIndex = stack.cards.length - 1;
    if (topIndex <= 0) return Math.max(topIndex, 0);

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return topIndex;
    }

    const layer = target.closest<HTMLElement>("[data-card-index]");
    if (!layer) {
      return topIndex;
    }

    const parsed = Number(layer.dataset.cardIndex ?? topIndex);
    if (!Number.isFinite(parsed)) {
      return topIndex;
    }

    return Math.max(0, Math.min(topIndex, Math.trunc(parsed)));
  }

  function onBoardPointerDown(event: PointerEvent) {
    if (event.button !== 0 || busy()) return;
    if (deckHubOpen()) {
      setDeckHubOpen(false);
    }
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("[data-stack-root='true']")) {
      return;
    }

    event.preventDefault();
    const pan = boardPan();
    setPanDragState({
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
    });
  }

  function onStackPointerDown(event: PointerEvent, stack: BoardStack) {
    if (event.button !== 0 || busy()) return;
    if (!boardRef) return;

    event.stopPropagation();
    setSelectedStackID(stack.id);
    setPanDragState(null);

    if (isDeckLikeStack(stack)) {
      setDragState(null);
      setDragMoved(false);
      return;
    }

    event.preventDefault();

    const pos = stackPosition(stack);
    const pointerWorld = worldFromClient(event.clientX, event.clientY);
    const cardIndex = stackCardIndexFromPointer(event, stack);
    const splitMode = stack.cards.length > 1 && cardIndex < stack.cards.length - 1;
    const cardOffsetY = splitMode ? cardIndex * STACK_OFFSET_Y : 0;
    const dragCardCount = splitMode ? splitCardIDs(stack.cards, cardIndex).dragged.length : stack.cards.length;

    setDragMoved(false);
    setMergeTargetID(null);

    setDragState({
      stackId: stack.id,
      pointerId: event.pointerId,
      offsetX: pointerWorld.x - pos.x,
      offsetY: pointerWorld.y - (pos.y + cardOffsetY),
      startX: pos.x,
      startY: pos.y + cardOffsetY,
      mode: splitMode ? "split" : "stack",
      splitIndex: cardIndex,
      draggedCount: Math.max(1, dragCardCount),
    });

    setLocalPositions((current) => ({
      ...current,
      [stack.id]: { x: pos.x, y: pos.y + cardOffsetY },
    }));
  }

  onMount(() => {
    void loadProjects();
    void loadTeamSettings();

    try {
      const raw = window.localStorage.getItem(DECK_ROW_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const prefs = parsed
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0);
          setDeckOrderPrefs(prefs);
        }
      }
    } catch {
      // Ignore malformed local preferences.
    }

    const syncViewport = () => {
      setViewportSize({
        width: boardRef?.clientWidth ?? 0,
        height: boardRef?.clientHeight ?? 0,
      });
    };

    syncViewport();
    const miningTickTimer = window.setInterval(() => setMiningTickMs(Date.now()), 120);

    let resizeObserver: ResizeObserver | undefined;
    if (boardRef && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => syncViewport());
      resizeObserver.observe(boardRef);
    }
    window.addEventListener("resize", syncViewport);

    const onPointerMove = (event: PointerEvent) => {
      const panDrag = panDragState();
      if (panDrag && event.pointerId === panDrag.pointerId) {
        setBoardPan({
          x: Math.round(panDrag.startPanX + (event.clientX - panDrag.startClientX)),
          y: Math.round(panDrag.startPanY + (event.clientY - panDrag.startClientY)),
        });
        return;
      }

      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId || !boardRef) return;

      const pointerWorld = worldFromClient(event.clientX, event.clientY);
      const x = Math.round(pointerWorld.x - drag.offsetX);
      const y = Math.round(pointerWorld.y - drag.offsetY);

      setLocalPositions((current) => ({
        ...current,
        [drag.stackId]: { x, y },
      }));

      if (Math.abs(x - drag.startX) > 3 || Math.abs(y - drag.startY) > 3) {
        setDragMoved(true);
      }

      setMergeTargetID(resolveMergeTarget(drag.stackId, { x, y }, drag.draggedCount));
    };

    const onPointerUp = (event: PointerEvent) => {
      const panDrag = panDragState();
      if (panDrag && event.pointerId === panDrag.pointerId) {
        setPanDragState(null);
        return;
      }

      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId) return;

      const finalPos = localPositions()[drag.stackId] ?? {
        x: drag.startX,
        y: drag.startY,
      };
      const targetID = mergeTargetID();
      const moved = dragMoved();

      setDragState(null);
      setMergeTargetID(null);

      const sourceStack = state()?.stacks[drag.stackId] ?? null;
      const sourceDef = topDefID(sourceStack);

      if (drag.mode === "split") {
        if (!moved) {
          clearLocalPosition(drag.stackId);

          if (sourceStack && sourceDef && isPackDef(sourceDef)) {
            suppressStackClick(drag.stackId);
            void activateDeckOrPack(sourceStack);
            return;
          }

          if (sourceDef && cardKind(sourceDef) === "task") {
            openDetail(drag.stackId);
          }
          return;
        }

        suppressStackClick(drag.stackId);
        void (async () => {
          try {
            const splitResult = await sendCommand(
              {
                cmd: "stack.split",
                args: {
                  stackId: drag.stackId,
                  index: drag.splitIndex,
                  newX: finalPos.x,
                  newY: finalPos.y,
                  offsetX: 0,
                  offsetY: 0,
                },
              },
              { refresh: false },
            );

            const splitPatch = (splitResult?.patch ?? null) as
              | {
                  source?: BoardStack;
                  newStack?: BoardStack;
                }
              | null;
            let newStackID = "";

            setState((current) => {
              if (!current) return current;

              const nextStacks = { ...current.stacks };

              if (splitPatch?.source) {
                if (splitPatch.source.cards.length > 0) {
                  nextStacks[splitPatch.source.id] = splitPatch.source;
                } else {
                  delete nextStacks[splitPatch.source.id];
                }
              }

              if (splitPatch?.newStack) {
                nextStacks[splitPatch.newStack.id] = splitPatch.newStack;
                newStackID = splitPatch.newStack.id;
              }

              return {
                ...current,
                stacks: nextStacks,
                version: splitResult?.newVersion ?? current.version,
              };
            });

            if (!newStackID) {
              await loadBoard();
              return;
            }

            if (targetID && targetID !== drag.stackId) {
              const targetStack = state()?.stacks[targetID] ?? null;
              const targetDef = topDefID(targetStack);

              if (targetStack && isCollectDeck(targetStack)) {
                // Optimistic: remove the newly-split stack before collecting.
                setState((current) => {
                  if (!current) return current;
                  const nextStacks = { ...current.stacks };
                  delete nextStacks[newStackID];
                  return { ...current, stacks: nextStacks };
                });
                await sendCommand({
                  cmd: "loot.collect_stack",
                  args: { stackId: newStackID },
                });
                return;
              }

              if (!targetDef || cardKind(targetDef) !== "deck") {
                // Optimistic: merge new stack cards into target.
                setState((current) => {
                  if (!current) return current;
                  const src = current.stacks[newStackID];
                  const tgt = current.stacks[targetID];
                  if (!src || !tgt) return current;
                  const nextStacks = { ...current.stacks };
                  nextStacks[targetID] = { ...tgt, cards: [...tgt.cards, ...src.cards] };
                  delete nextStacks[newStackID];
                  return { ...current, stacks: nextStacks };
                });
                await sendCommand({
                  cmd: "stack.merge",
                  args: { targetId: targetID, sourceId: newStackID },
                });
              }
            }
          } catch {
            // Error state is set in sendCommand.
          } finally {
            clearLocalPosition(drag.stackId);
          }
        })();
        return;
      }

      if (targetID && targetID !== drag.stackId) {
        const targetStack = state()?.stacks[targetID] ?? null;
        const targetDef = topDefID(targetStack);

        if (targetStack && isCollectDeck(targetStack) && sourceDef && !isDeckDef(sourceDef) && !isPackDef(sourceDef)) {
          suppressStackClick(drag.stackId);
          // Optimistic: remove source stack so the card doesn't flash back.
          setState((current) => {
            if (!current) return current;
            const nextStacks = { ...current.stacks };
            delete nextStacks[drag.stackId];
            return { ...current, stacks: nextStacks };
          });
          clearLocalPosition(drag.stackId);
          void sendCommand({
            cmd: "loot.collect_stack",
            args: { stackId: drag.stackId },
          });
          return;
        }

        if (sourceDef && targetDef && (cardKind(sourceDef) === "deck" || cardKind(targetDef) === "deck")) {
          if (!moved) {
            clearLocalPosition(drag.stackId);
            return;
          }
        } else {
          suppressStackClick(drag.stackId);
          // Optimistic: move cards from source into target so the card
          // doesn't flash back to the source position while the server
          // processes the merge.
          setState((current) => {
            if (!current) return current;
            const src = current.stacks[drag.stackId];
            const tgt = current.stacks[targetID];
            if (!src || !tgt) return current;
            const nextStacks = { ...current.stacks };
            nextStacks[targetID] = { ...tgt, cards: [...tgt.cards, ...src.cards] };
            delete nextStacks[drag.stackId];
            return { ...current, stacks: nextStacks };
          });
          clearLocalPosition(drag.stackId);
          void sendCommand({
            cmd: "stack.merge",
            args: { targetId: targetID, sourceId: drag.stackId },
          });
          return;
        }
      }

      if (moved) {
        suppressStackClick(drag.stackId);
        void (async () => {
          try {
            const result = await sendCommand(
              {
                cmd: "stack.move",
                args: {
                  stackId: drag.stackId,
                  x: finalPos.x,
                  y: finalPos.y,
                },
              },
              { refresh: false },
            );

            setState((current) => {
              if (!current) return current;
              const existing = current.stacks[drag.stackId];
              if (!existing) return current;

              let z = existing.z;
              const patch = result?.patch as { stack?: { z?: number } } | undefined;
              if (patch?.stack && typeof patch.stack.z === "number") {
                z = patch.stack.z;
              }

              return {
                ...current,
                stacks: {
                  ...current.stacks,
                  [drag.stackId]: {
                    ...existing,
                    pos: { x: finalPos.x, y: finalPos.y },
                    z,
                  },
                },
                version: result?.newVersion ?? current.version,
              };
            });
          } catch {
            // Error state is set in sendCommand.
          } finally {
            clearLocalPosition(drag.stackId);
          }
        })();
        return;
      }

      clearLocalPosition(drag.stackId);

      if (sourceStack && sourceDef && isPackDef(sourceDef)) {
        suppressStackClick(drag.stackId);
        void activateDeckOrPack(sourceStack);
        return;
      }

      if (sourceDef && cardKind(sourceDef) === "task") {
        openDetail(drag.stackId);
      }
    };

    const onPointerCancel = (event: PointerEvent) => {
      const panDrag = panDragState();
      if (panDrag && event.pointerId === panDrag.pointerId) {
        setPanDragState(null);
      }

      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId) return;

      setDragState(null);
      setDragMoved(false);
      setMergeTargetID(null);
      clearLocalPosition(drag.stackId);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);

    onCleanup(() => {
      window.clearInterval(miningTickTimer);
      if (syncTimer) window.clearInterval(syncTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("resize", syncViewport);
      resizeObserver?.disconnect();
      if (composerParseTimer !== undefined) {
        window.clearTimeout(composerParseTimer);
      }
      if (detailParseTimer !== undefined) {
        window.clearTimeout(detailParseTimer);
      }
      composerParseController?.abort();
      detailParseController?.abort();
    });
  });

  // Periodic background sync — reconcile with server every 2 minutes.
  const SYNC_INTERVAL_MS = 2 * 60 * 1000;
  let syncTimer: ReturnType<typeof setInterval> | undefined;

  onMount(() => {
    syncTimer = setInterval(() => {
      void loadBoard({ syncTasks: false });
    }, SYNC_INTERVAL_MS);
  });

  createEffect(() => {
    const boardID = activeBoardID();
    setError("");
    setSelectedStackID(null);
    setIsDetailOpen(false);
    if (detailParseTimer !== undefined) {
      window.clearTimeout(detailParseTimer);
      detailParseTimer = undefined;
    }
    resetDetailPreview();
    setInlineStackID(null);
    setInlineTitle("");
    setDeckHubOpen(false);
    setMobileMapHubOpen(false);
    setDeckHubDragDefID(null);
    resetComposerPreview();
    setComposerText("");
    setBoardMembers([]);
    void loadBoardMembers(boardID);

    // Load from IndexedDB cache first for instant render, then sync from server.
    void (async () => {
      const cached = await getCachedBoardState<BoardStateResponse>(boardID);
      if (cached) {
        setState(cached);
        setLoading(false); // Dismiss spinner immediately so the cached board is visible.
      } else {
        setState(null); // Show loading spinner only when there's no cache.
      }
      await loadBoard({ syncTasks: true, boardID });
    })();
  });

  createEffect(() => {
    if (!createBoardModalOpen()) return;
    window.setTimeout(() => createBoardInputRef?.focus(), 0);
  });

  return (
    <AppShell
      activeView="board"
      accountPlacement="sidebar"
      mobileSidebar={
        <div class="space-y-3">
          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Board</p>
            <select
              value={activeBoardID()}
              onInput={(event) => switchBoard(event.currentTarget.value)}
              class="mt-2 w-full rounded-md border border-[#395072] bg-[#0d182b] px-2 py-1.5 text-sm text-[#e0ebff] outline-none focus:border-[var(--accent)]"
              data-testid="board-selector-mobile"
            >
              <For each={boardChoices()}>
                {(choice) => (
                  <option value={choice.boardID}>
                    {choice.name}
                    {choice.isTeamBoard ? " (Team)" : ""}
                  </option>
                )}
              </For>
            </select>
            <Show when={activeBoardChoice()?.isTeamBoard}>
              <p class="mt-2 inline-flex rounded-md border border-[#4b5ea8] bg-[#1f2554] px-2 py-0.5 text-[11px] text-[#d5dcff]">
                Team board
              </p>
            </Show>
            <div class="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                class="rounded-md border border-[#406087] bg-[#162744] px-2 py-1 text-xs text-[#dbe8ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                onClick={openCreateBoardModal}
                disabled={busy() || boardCrudBusy()}
                data-testid="board-open-create-modal-mobile"
              >
                New board
              </button>
              <button
                type="button"
                class="rounded-md border border-[#8b6a32] bg-[#2b2111] px-2 py-1 text-xs text-[#f0d7a4] transition hover:border-[#d3a75a] disabled:opacity-60"
                onClick={openStorePage}
                disabled={busy()}
                data-testid="board-open-store-mobile"
              >
                Store
              </button>
              <button
                type="button"
                class="rounded-md border border-[#4d5f87] bg-[#122038] px-2 py-1 text-xs text-[#dbe8ff] transition hover:border-[var(--accent)]"
                onClick={() => setNotificationHistoryOpen(true)}
                data-testid="board-open-notifications-mobile"
              >
                Notes {toast.history().length}
              </button>
              <button
                type="button"
                class="rounded-md border border-[#6c3d3d] bg-[#2b1618] px-2 py-1 text-xs text-[#ffb8b5] transition hover:border-[#905656] disabled:opacity-60"
                onClick={() => void deleteActiveBoard()}
                disabled={busy() || boardCrudBusy() || activeBoardID() === DEFAULT_BOARD}
              >
                Delete
              </button>
            </div>
          </section>

          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Board Access</p>
              <span class="text-[11px] text-[#9cb3d8]">{boardMembers().length} member(s)</span>
            </div>

            <Show when={!boardMembersLoading()} fallback={<p class="mt-2 text-xs text-[#9cb2d6]">Loading board members...</p>}>
              <div class="mt-2 space-y-1.5">
                <For each={boardMembers()}>
                  {(member) => (
                    <div class="rounded-md border border-[#304767] bg-[#101f35] px-2 py-1.5 text-xs text-[#dce8ff]">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="truncate font-semibold">{member.name || member.email}</p>
                          <p class="truncate text-[11px] text-[#9cb2d6]">{member.email}</p>
                        </div>
                        <div class="flex shrink-0 items-center gap-1">
                          <span class="rounded border border-[#3f567c] px-1 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#cddaf2]">
                            {member.role}
                          </span>
                          <Show when={canManageBoardMembers() && member.userId !== currentUserID()}>
                            <button
                              type="button"
                              class="rounded border border-[#6f3c3c] bg-[#2a1416] px-1.5 py-0.5 text-[10px] text-[#ffb3ad] disabled:opacity-50"
                              onClick={() => void removeBoardMember(member.userId)}
                              disabled={busy() || boardMembersBusy()}
                            >
                              Remove
                            </button>
                          </Show>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={canManageBoardMembers()}>
              <div class="mt-2 flex gap-2">
                <select
                  value={pendingBoardMemberID()}
                  onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}
                  class="min-w-0 flex-1 rounded-md border border-[#3a4d6d] bg-[#0d182b] px-2 py-1.5 text-xs text-[#dce8ff] outline-none focus:border-[var(--accent)]"
                  disabled={busy() || boardMembersBusy() || addableBoardMembers().length === 0}
                >
                  <For each={addableBoardMembers()}>
                    {(member) => (
                      <option value={member.userId}>
                        {member.name || member.email}
                      </option>
                    )}
                  </For>
                </select>
                <button
                  type="button"
                  class="rounded-md border border-[#406087] bg-[#162744] px-2 py-1 text-xs text-[#dbe8ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                  onClick={() => void addPendingBoardMember()}
                  disabled={busy() || boardMembersBusy() || !pendingBoardMemberID() || addableBoardMembers().length === 0}
                >
                  Add
                </button>
              </div>
              <Show when={addableBoardMembers().length === 0}>
                <p class="mt-2 text-[11px] text-[#9cb2d6]">All team members already have access.</p>
              </Show>
            </Show>
            <Show when={!canManageBoardMembers()}>
              <p class="mt-2 text-[11px] text-[#9cb2d6]">Only owners and admins can change board access.</p>
            </Show>
          </section>

          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Task Summary</p>
            <div class="mt-2 space-y-1 text-sm text-[#cfdaee]">
              <p>
                Danger:{" "}
                <span class={summary().zombieCount > 0 ? "text-[#ff8c8c]" : "text-[#7ddf98]"}>
                  {summary().zombieCount > 0 ? "HIGH" : "SAFE"}
                </span>
              </p>
              <p>Villagers: {summary().villagerCount}</p>
              <p>Active stacks: {summary().activeTaskCount}</p>
              <p>Completed tasks: {summary().completedCount}</p>
            </div>
          </section>

          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Villagers</p>
              <span class="text-[11px] text-[#9cb3d8]">{villagerStatuses().length}</span>
            </div>

            <Show
              when={villagerStatuses().length > 0}
              fallback={<p class="mt-2 text-xs text-[#9cb2d6]">No villagers on board.</p>}
            >
              <div class="mt-2 space-y-1.5">
                <For each={villagerStatuses()}>
                  {(villager) => (
                    <div class="rounded-md border border-[#304767] bg-[#101f35] px-2 py-1.5 text-xs text-[#dce8ff]">
                      <div class="flex items-center justify-between gap-2">
                        <span class="truncate font-semibold">{villager.name}</span>
                        <span class={villager.stamina <= 0 ? "text-[#ff9b9b]" : "text-[#f4d8a1]"}>STA {villager.stamina}</span>
                      </div>
                      <p class="mt-0.5 text-[11px] text-[#9cb2d6]">
                        Lv {villager.level} · XP {villager.xp}
                      </p>
                      <Show when={villager.stamina <= 0}>
                        <p class="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#ff9b9b]">Needs action</p>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Quests</p>
              <span class="text-[11px] text-[#9cb3d8]">{activeQuests().length} active</span>
            </div>

            <Show when={activeQuests().length > 0} fallback={<p class="mt-2 text-xs text-[#9cb2d6]">No active quests.</p>}>
              <div class="mt-2 space-y-2">
                <For each={activeQuests().slice(0, 3)}>
                  {(quest) => {
                    const objectives = () => quest.objectives ?? [];
                    const completedCount = () => objectives().filter((objective) => objective.complete).length;
                    const rewardText = () =>
                      (quest.rewards ?? [])
                        .slice(0, 2)
                        .map((reward) => questRewardLabel(reward))
                        .join(" · ");
                    return (
                      <article class="rounded-md border border-[#304767] bg-[#101f35] px-2 py-2">
                        <div class="flex items-start justify-between gap-2">
                          <p class="text-xs font-semibold text-[#e0ebff]">{quest.title}</p>
                          <span class="rounded border border-[#3f567c] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#9fb2d8]">
                            {questTypeLabel(quest.type)}
                          </span>
                        </div>
                        <p class="mt-1 text-[11px] text-[#99add1]">
                          {completedCount()}/{objectives().length || 1} objectives
                        </p>
                        <Show when={quest.howToComplete}>
                          <p class="mt-1 text-[11px] text-[#b7c9e8]">How: {quest.howToComplete}</p>
                        </Show>
                        <Show when={quest.definitionOfDone}>
                          <p class="mt-1 text-[11px] text-[#9ec4b1]">Done when: {quest.definitionOfDone}</p>
                        </Show>
                        <div class="mt-1 space-y-1">
                          <For each={objectives()}>
                            {(objective) => (
                              <div class="flex items-center justify-between gap-2 text-[11px]">
                                <span class={objective.complete ? "text-[#8be39f]" : "text-[#cdd9ef]"}>{questObjectiveLabel(objective)}</span>
                                <span class={objective.complete ? "text-[#7ddf98]" : "text-[#8ca4cf]"}>
                                  {objective.complete ? "Done" : questObjectiveProgressLabel(objective)}
                                </span>
                              </div>
                            )}
                          </For>
                        </div>
                        <Show when={(quest.acceptanceCriteria ?? []).length > 0}>
                          <div class="mt-1 space-y-0.5">
                            <For each={(quest.acceptanceCriteria ?? []).slice(0, 2)}>
                              {(criterion) => (
                                <p class="text-[10px] text-[#88a2c7]">- {criterion}</p>
                              )}
                            </For>
                          </div>
                        </Show>
                        <Show when={rewardText()}>
                          <p class="mt-1 text-[11px] text-[#f1d38e]">Reward: {rewardText()}</p>
                        </Show>
                        <Show when={quest.claimable}>
                          <button
                            type="button"
                            class="mt-2 rounded-md border border-[#4b6d48] bg-[#12301f] px-2 py-1 text-[11px] font-semibold text-[#bff5cb] disabled:opacity-50"
                            onClick={() => void claimQuestReward(quest.id)}
                            disabled={busy() || questClaimingID() === quest.id}
                          >
                            {questClaimingID() === quest.id ? "Claiming..." : "Claim reward"}
                          </button>
                        </Show>
                      </article>
                    );
                  }}
                </For>
              </div>
            </Show>
          </section>

          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Board Stats</p>
            <div class="mt-2 space-y-1 text-sm text-[#cfdaee]">
              <p>Decks: {summary().deckCount}</p>
              <p>Zombies: {summary().zombieCount}</p>
              <p>Day ticks: {summary().dayTicks}</p>
              <p>Total stacks: {stacks().length}</p>
            </div>
          </section>

          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Inventory</p>
            <div class="mt-2 grid grid-cols-2 gap-1.5 text-sm text-[#cfdaee]">
              <p>🪙 {summary().inventory.coin ?? 0}</p>
              <p>📄 {summary().inventory.paper ?? 0}</p>
              <p>🖋️ {summary().inventory.ink ?? 0}</p>
              <p>⚙️ {summary().inventory.gear ?? 0}</p>
              <p>🔩 {summary().inventory.parts ?? 0}</p>
            </div>
          </section>

          <p class="rounded-md border border-[#304767] bg-[#0f1a2f] px-3 py-2 text-xs text-[#9cb2d6]">
            Deck row is pinned above the bottom tab bar on mobile.
          </p>
        </div>
      }
      headerRight={
        <>
          <div class="hidden items-center gap-2 md:flex">
            <select
              value={activeBoardID()}
              onInput={(event) => switchBoard(event.currentTarget.value)}
              class="rounded-md border border-[#394b66] bg-[#131b2b] px-2 py-1 text-xs text-[#dbe7ff] outline-none focus:border-[var(--accent)]"
              data-testid="board-selector"
            >
              <For each={boardChoices()}>
                {(choice) => (
                  <option value={choice.boardID}>
                    {choice.name}
                    {choice.isTeamBoard ? " (Team)" : ""}
                  </option>
                )}
              </For>
            </select>
            <Show when={activeBoardChoice()?.isTeamBoard}>
              <span class="rounded-md border border-[#4b5ea8] bg-[#1f2554] px-2 py-0.5 text-[11px] text-[#d5dcff]">
                Team board
              </span>
            </Show>
            <button
              type="button"
              class="rounded-md border border-[#435f83] bg-[#13253e] px-2 py-1 text-[11px] text-[#dce8ff] transition hover:border-[var(--accent)] disabled:opacity-60"
              onClick={openCreateBoardModal}
              disabled={busy() || boardCrudBusy()}
              data-testid="board-open-create-modal-header"
            >
              New board
            </button>
            <button
              type="button"
              class="rounded-md border border-[#8b6a32] bg-[#2b2111] px-2 py-1 text-[11px] text-[#f0d7a4] transition hover:border-[#d3a75a] disabled:opacity-60"
              onClick={openStorePage}
              disabled={busy()}
              data-testid="board-open-store-header"
            >
              Store
            </button>
            <button
              type="button"
              class="rounded-md border border-[#6f3c3c] bg-[#2a1416] px-2 py-1 text-[11px] text-[#ffb3ad] transition hover:border-[#a55e5a] disabled:opacity-60"
              onClick={() => void deleteActiveBoard()}
              disabled={busy() || boardCrudBusy() || activeBoardID() === DEFAULT_BOARD}
            >
              Delete board
            </button>
          </div>

          <div class="hidden items-center gap-3 text-xs text-[#aeb6c5] lg:flex">
            <span class="flex items-center gap-1" title="Coins">
              <span>🪙</span>
              <span class="tabular-nums">{summary().inventory.coin ?? 0}</span>
            </span>
            <span class="flex items-center gap-1" title="Paper">
              <span>📄</span>
              <span class="tabular-nums">{summary().inventory.paper ?? 0}</span>
            </span>
            <span class="flex items-center gap-1" title="Ink">
              <span>🖋️</span>
              <span class="tabular-nums">{summary().inventory.ink ?? 0}</span>
            </span>
            <span class="flex items-center gap-1" title="Gear">
              <span>⚙️</span>
              <span class="tabular-nums">{summary().inventory.gear ?? 0}</span>
            </span>
            <span class="flex items-center gap-1" title="Parts">
              <span>🔩</span>
              <span class="tabular-nums">{summary().inventory.parts ?? 0}</span>
            </span>
          </div>

          <button
            type="button"
            class="rounded-md border border-[#445f86] bg-[#122038] px-3 py-1 text-xs text-[#dbe8ff] transition hover:border-[var(--accent)]"
            onClick={() => setNotificationHistoryOpen(true)}
            data-testid="board-open-notifications"
          >
            Notifications {toast.history().length}
          </button>
          <button
            type="button"
            class="rounded-md border border-[#7c3737] bg-[#2a1416] px-3 py-1 text-xs text-[#ff857f] transition hover:bg-[#37181b] disabled:opacity-50"
            onClick={() => void endDay()}
            disabled={busy()}
            data-testid="board-end-day"
          >
            End Day
          </button>
          <button
            type="button"
            class="rounded-md border border-[#394357] bg-[#181f2a] px-3 py-1 text-xs text-[#d5dced] transition hover:border-[#546282] disabled:opacity-50"
            onClick={() => void refreshBoard()}
            disabled={busy()}
            data-testid="board-refresh"
          >
            Refresh
          </button>
        </>
      }
    >
      <div class="grid h-full min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
        <aside class="hidden h-full flex-col overflow-y-auto border-r border-[#252c39] bg-[#151a23] md:flex">
          <div class="border-b border-[#252c39] px-4 py-3">
            <p class="text-lg font-semibold tracking-wide">DONEGEON</p>
          </div>

          <section class="border-b border-[#252c39] px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#8794a8]">Board</p>
            <select
              value={activeBoardID()}
              onInput={(event) => switchBoard(event.currentTarget.value)}
              class="mt-2 w-full rounded-md border border-[#3a4d6d] bg-[#0f1728] px-2 py-1.5 text-sm text-[#dce8ff] outline-none focus:border-[var(--accent)]"
              data-testid="board-selector-sidebar"
            >
              <For each={boardChoices()}>
                {(choice) => (
                  <option value={choice.boardID}>
                    {choice.name}
                    {choice.isTeamBoard ? " (Team)" : ""}
                  </option>
                )}
              </For>
            </select>
            <Show when={activeBoardChoice()?.isTeamBoard}>
              <p class="mt-2 inline-flex rounded-md border border-[#4b5ea8] bg-[#1f2554] px-2 py-0.5 text-[11px] text-[#d5dcff]">
                Team board
              </p>
            </Show>
            <div class="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                class="rounded-md border border-[#406087] bg-[#162744] px-2 py-1 text-xs text-[#dbe8ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                onClick={openCreateBoardModal}
                disabled={busy() || boardCrudBusy()}
                data-testid="board-open-create-modal-sidebar"
              >
                New board
              </button>
              <button
                type="button"
                class="rounded-md border border-[#8b6a32] bg-[#2b2111] px-2 py-1 text-xs text-[#f0d7a4] transition hover:border-[#d3a75a] disabled:opacity-60"
                onClick={openStorePage}
                disabled={busy()}
                data-testid="board-open-store-sidebar"
              >
                Store
              </button>
              <button
                type="button"
                class="rounded-md border border-[#6c3d3d] bg-[#2b1618] px-2 py-1 text-xs text-[#ffb8b5] transition hover:border-[#905656] disabled:opacity-60"
                onClick={() => void deleteActiveBoard()}
                disabled={busy() || boardCrudBusy() || activeBoardID() === DEFAULT_BOARD}
              >
                Delete
              </button>
            </div>
          </section>

          <section class="border-b border-[#252c39] px-4 py-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#8794a8]">Board Access</p>
              <span class="text-[11px] text-[#8ea0ba]">{boardMembers().length} member(s)</span>
            </div>

            <Show when={!boardMembersLoading()} fallback={<p class="mt-2 text-xs text-[#8ea0ba]">Loading board members...</p>}>
              <div class="mt-2 space-y-1.5">
                <For each={boardMembers()}>
                  {(member) => (
                    <div class="rounded-md border border-[#304767] bg-[#111e30] px-2.5 py-2">
                      <div class="flex items-start justify-between gap-2 text-xs">
                        <div class="min-w-0">
                          <p class="truncate font-semibold text-[#dce9ff]">{member.name || member.email}</p>
                          <p class="truncate text-[11px] text-[#97a9c7]">{member.email}</p>
                        </div>
                        <div class="flex shrink-0 items-center gap-1">
                          <span class="rounded border border-[#395278] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#9fb3d8]">
                            {member.role}
                          </span>
                          <Show when={canManageBoardMembers() && member.userId !== currentUserID()}>
                            <button
                              type="button"
                              class="rounded border border-[#6f3c3c] bg-[#2a1416] px-1.5 py-0.5 text-[10px] text-[#ffb3ad] disabled:opacity-50"
                              onClick={() => void removeBoardMember(member.userId)}
                              disabled={busy() || boardMembersBusy()}
                            >
                              Remove
                            </button>
                          </Show>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>

            <Show when={canManageBoardMembers()}>
              <div class="mt-2 flex gap-2">
                <select
                  value={pendingBoardMemberID()}
                  onInput={(event) => setPendingBoardMemberID(event.currentTarget.value)}
                  class="min-w-0 flex-1 rounded-md border border-[#3a4d6d] bg-[#0f1728] px-2 py-1.5 text-xs text-[#dce8ff] outline-none focus:border-[var(--accent)]"
                  disabled={busy() || boardMembersBusy() || addableBoardMembers().length === 0}
                >
                  <For each={addableBoardMembers()}>
                    {(member) => (
                      <option value={member.userId}>
                        {member.name || member.email}
                      </option>
                    )}
                  </For>
                </select>
                <button
                  type="button"
                  class="rounded-md border border-[#406087] bg-[#162744] px-2 py-1 text-xs text-[#dbe8ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                  onClick={() => void addPendingBoardMember()}
                  disabled={busy() || boardMembersBusy() || !pendingBoardMemberID() || addableBoardMembers().length === 0}
                >
                  Add
                </button>
              </div>
              <Show when={addableBoardMembers().length === 0}>
                <p class="mt-2 text-[11px] text-[#8ea0ba]">All team members already have access.</p>
              </Show>
            </Show>
            <Show when={!canManageBoardMembers()}>
              <p class="mt-2 text-[11px] text-[#8ea0ba]">Only owners and admins can change board access.</p>
            </Show>
          </section>

          <div class="border-b border-[#252c39] px-4 py-3">
            <p class="text-sm font-semibold uppercase tracking-[0.08em] text-[#d3d9e6]">Today&apos;s Goals</p>
          </div>

          <section class="border-b border-[#252c39] px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#8794a8]">Task Summary</p>
            <div class="mt-2 space-y-1 text-sm text-[#c2cada]">
              <p>
                Danger: <span class={summary().zombieCount > 0 ? "text-[#ff8c8c]" : "text-[#7ddf98]"}>{summary().zombieCount > 0 ? "HIGH" : "SAFE"}</span>
              </p>
              <p>Villagers: {summary().villagerCount}</p>
              <p>Active stacks: {summary().activeTaskCount}</p>
              <p data-testid="board-completed-count">Completed tasks: {summary().completedCount}</p>
            </div>
          </section>

          <section class="border-b border-[#252c39] px-4 py-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#8794a8]">Villagers</p>
              <span class="text-[11px] text-[#8ea0ba]">{villagerStatuses().length}</span>
            </div>

            <Show
              when={villagerStatuses().length > 0}
              fallback={<p class="mt-2 text-xs text-[#8ea0ba]">No villagers on board.</p>}
            >
              <div class="mt-2 space-y-1.5">
                <For each={villagerStatuses()}>
                  {(villager) => (
                    <div class="rounded-md border border-[#304767] bg-[#111e30] px-2.5 py-2">
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="truncate font-semibold text-[#dce9ff]">{villager.name}</span>
                        <span class={villager.stamina <= 0 ? "text-[#ff9b9b]" : "text-[#ebcf8b]"}>STA {villager.stamina}</span>
                      </div>
                      <p class="mt-1 text-[11px] text-[#97a9c7]">
                        Lv {villager.level} · XP {villager.xp}
                      </p>
                      <Show when={villager.stamina <= 0}>
                        <p class="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#ff9b9b]">Needs action</p>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class="border-b border-[#252c39] px-4 py-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#8794a8]">Quests</p>
              <span class="text-[11px] text-[#8ea0ba]">{activeQuests().length} active</span>
            </div>

            <Show when={activeQuests().length > 0} fallback={<p class="mt-2 text-xs text-[#8ea0ba]">No active quests.</p>}>
              <div class="mt-2 space-y-2">
                <For each={activeQuests().slice(0, 4)}>
                  {(quest) => {
                    const objectives = () => quest.objectives ?? [];
                    const completedCount = () => objectives().filter((objective) => objective.complete).length;
                    const rewardText = () =>
                      (quest.rewards ?? [])
                        .slice(0, 2)
                        .map((reward) => questRewardLabel(reward))
                        .join(" · ");
                    return (
                      <article class="rounded-md border border-[#304767] bg-[#111e30] px-2.5 py-2">
                        <div class="flex items-start justify-between gap-2">
                          <p class="text-xs font-semibold text-[#dce9ff]">{quest.title}</p>
                          <span class="rounded border border-[#395278] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#9fb3d8]">
                            {questTypeLabel(quest.type)}
                          </span>
                        </div>
                        <p class="mt-1 text-[11px] text-[#97a9c7]">
                          {completedCount()}/{objectives().length || 1} objectives
                        </p>
                        <Show when={quest.howToComplete}>
                          <p class="mt-1 text-[11px] text-[#b7c9e8]">How: {quest.howToComplete}</p>
                        </Show>
                        <Show when={quest.definitionOfDone}>
                          <p class="mt-1 text-[11px] text-[#9ec4b1]">Done when: {quest.definitionOfDone}</p>
                        </Show>
                        <div class="mt-1 space-y-1">
                          <For each={objectives()}>
                            {(objective) => (
                              <div class="flex items-center justify-between gap-2 text-[11px]">
                                <span class={objective.complete ? "text-[#89dc9a]" : "text-[#c8d3e8]"}>{questObjectiveLabel(objective)}</span>
                                <span class={objective.complete ? "text-[#79d78e]" : "text-[#8ca4cf]"}>
                                  {objective.complete ? "Done" : questObjectiveProgressLabel(objective)}
                                </span>
                              </div>
                            )}
                          </For>
                        </div>
                        <Show when={(quest.acceptanceCriteria ?? []).length > 0}>
                          <div class="mt-1 space-y-0.5">
                            <For each={(quest.acceptanceCriteria ?? []).slice(0, 2)}>
                              {(criterion) => (
                                <p class="text-[10px] text-[#88a2c7]">- {criterion}</p>
                              )}
                            </For>
                          </div>
                        </Show>
                        <Show when={rewardText()}>
                          <p class="mt-1 text-[11px] text-[#ebcf8b]">Reward: {rewardText()}</p>
                        </Show>
                        <Show when={quest.claimable}>
                          <button
                            type="button"
                            class="mt-2 rounded-md border border-[#456a41] bg-[#112a1d] px-2 py-1 text-[11px] font-semibold text-[#b9efc4] disabled:opacity-50"
                            onClick={() => void claimQuestReward(quest.id)}
                            disabled={busy() || questClaimingID() === quest.id}
                          >
                            {questClaimingID() === quest.id ? "Claiming..." : "Claim reward"}
                          </button>
                        </Show>
                      </article>
                    );
                  }}
                </For>
              </div>
            </Show>
          </section>

          <section class="border-b border-[#252c39] px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#8794a8]">Board Stats</p>
            <div class="mt-2 space-y-1 text-sm text-[#c2cada]">
              <p>Decks: {summary().deckCount}</p>
              <p>Zombies: {summary().zombieCount}</p>
              <p data-testid="board-day-ticks">Day ticks: {summary().dayTicks}</p>
              <p>Total stacks: {stacks().length}</p>
            </div>
          </section>

          <div class="mt-auto border-t border-[#252c39] px-4 py-3">
            <SidebarAccountCard />
          </div>

          <Show when={error()}>
            <p class="mx-4 mb-4 rounded-md border border-[#7d3333] bg-[#351719] px-3 py-2 text-xs text-[#ffd0d0]">{error()}</p>
          </Show>
        </aside>

        <section class="relative h-full min-h-0 overflow-hidden bg-[#07090f]">
          <Show when={minimapModel()}>
            {(model) => (
              <>
                <button
                  type="button"
                  class="absolute right-3 top-3 z-40 rounded-md border border-[#3d5273] bg-[#0b1321]/92 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#cfd9ee] shadow-[0_10px_26px_rgba(0,0,0,0.38)] md:hidden"
                  onClick={() => setMobileMapHubOpen((open) => !open)}
                  data-testid="board-mobile-map-toggle"
                >
                  {mobileMapHubOpen() ? "Hide Map" : "Map"}
                </button>

                <Show when={mobileMapHubOpen()}>
                  <div class="pointer-events-none absolute left-1/2 top-3 z-40 w-[min(240px,calc(100%-1.5rem))] -translate-x-1/2 md:hidden">
                    <div class="pointer-events-auto rounded-xl border border-[#334665] bg-[#0b1321]/94 p-2.5 shadow-[0_14px_34px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                      <div class="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.1em]">
                        <span class="text-[#cfd9ee]">Map Hub</span>
                        <span class={model().offscreenCount > 0 ? "text-[#f9c76f]" : "text-[#8fa2c6]"}>
                          {model().offscreenCount > 0 ? `${model().offscreenCount} off-screen` : "All visible"}
                        </span>
                      </div>

                      <div
                        class="relative mx-auto h-[144px] w-[220px] cursor-crosshair overflow-hidden rounded-lg border border-[#415779] bg-[radial-gradient(circle_at_20%_0%,rgba(60,85,125,0.28),rgba(8,14,24,0.95))]"
                        onPointerDown={onMinimapPointerDown}
                        onPointerMove={onMinimapPointerMove}
                        onPointerUp={onMinimapPointerUp}
                        title="Drag or click to recenter board"
                        data-testid="board-minimap-mobile"
                      >
                        <div class="pointer-events-none absolute inset-0 opacity-45 [background-size:12px_12px] [background-image:radial-gradient(circle_at_1px_1px,rgba(188,201,230,0.35)_1px,transparent_1.2px)]" />

                        <For each={model().dots}>
                          {(dot) => (
                            <div
                              class={`pointer-events-none absolute h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                                dot.isSelected ? "ring-2 ring-[#e6edf9]" : ""
                              } ${minimapDotClass(dot.kind, dot.isNextAction, dot.isExhausted)}`}
                              style={{
                                left: `${dot.x}px`,
                                top: `${dot.y}px`,
                              }}
                            />
                          )}
                        </For>

                        <div
                          class="pointer-events-none absolute rounded-[2px] border border-[#f0f4ff] bg-[#dce7ff]/10 shadow-[0_0_0_1px_rgba(220,231,255,0.2)]"
                          data-testid="board-minimap-mobile-viewport"
                          style={{
                            left: `${model().viewportRect.x}px`,
                            top: `${model().viewportRect.y}px`,
                            width: `${model().viewportRect.width}px`,
                            height: `${model().viewportRect.height}px`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Show>

                <div class="pointer-events-none absolute right-3 top-3 z-40 hidden md:block">
                  <div class="pointer-events-auto rounded-xl border border-[#334665] bg-[#0b1321]/94 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.45)] backdrop-blur-sm">
                    <div class="mb-2 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.11em]">
                      <span class="text-[#cfd9ee]">Map Hub</span>
                      <span class={model().offscreenCount > 0 ? "text-[#f9c76f]" : "text-[#8fa2c6]"}>
                        {model().offscreenCount > 0 ? `${model().offscreenCount} off-screen` : "All visible"}
                      </span>
                    </div>

                    <div
                      class="relative h-[144px] w-[220px] cursor-crosshair overflow-hidden rounded-lg border border-[#415779] bg-[radial-gradient(circle_at_20%_0%,rgba(60,85,125,0.28),rgba(8,14,24,0.95))]"
                      onPointerDown={onMinimapPointerDown}
                      onPointerMove={onMinimapPointerMove}
                      onPointerUp={onMinimapPointerUp}
                      title="Drag or click to recenter board"
                      data-testid="board-minimap-desktop"
                    >
                      <div class="pointer-events-none absolute inset-0 opacity-45 [background-size:12px_12px] [background-image:radial-gradient(circle_at_1px_1px,rgba(188,201,230,0.35)_1px,transparent_1.2px)]" />

                      <For each={model().dots}>
                        {(dot) => (
                          <div
                            class={`pointer-events-none absolute h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                              dot.isSelected ? "ring-2 ring-[#e6edf9]" : ""
                            } ${minimapDotClass(dot.kind, dot.isNextAction, dot.isExhausted)}`}
                            style={{
                              left: `${dot.x}px`,
                              top: `${dot.y}px`,
                            }}
                          />
                        )}
                      </For>

                      <div
                        class="pointer-events-none absolute rounded-[2px] border border-[#f0f4ff] bg-[#dce7ff]/10 shadow-[0_0_0_1px_rgba(220,231,255,0.2)]"
                        data-testid="board-minimap-desktop-viewport"
                        style={{
                          left: `${model().viewportRect.x}px`,
                          top: `${model().viewportRect.y}px`,
                          width: `${model().viewportRect.width}px`,
                          height: `${model().viewportRect.height}px`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </Show>

          <Show when={deckHubOpen()}>
            <div
              class="absolute inset-0 z-50 bg-[#03060d]/55 backdrop-blur-[1px]"
              onPointerDown={() => {
                setDeckHubOpen(false);
                setDeckHubDragDefID(null);
              }}
            >
              <div
                class="absolute right-3 top-3 w-[min(460px,calc(100%-1.5rem))] rounded-xl border border-[#334865] bg-[#0c1525]/98 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
                onPointerDown={(event) => event.stopPropagation()}
                data-testid="board-deck-hub-panel"
              >
                <div class="mb-3 flex items-center justify-between">
                  <div>
                    <p class="text-sm font-semibold uppercase tracking-[0.16em] text-[#d4def1]">Deck Hub</p>
                    <p class="text-xs text-[#93a7cc]">Drag decks between row and reserve.</p>
                  </div>
                  <button
                    type="button"
                    class="rounded-md border border-[#435c84] px-2 py-1 text-xs text-[#d5e4ff] hover:border-[var(--accent)]"
                    onClick={() => setDeckHubOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <div class="space-y-3">
                  <section>
                    <div class="mb-1 flex items-center justify-between">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9eb2d5]">Deck Row</p>
                      <p class="text-[11px] text-[#869abe]">Visible: {deckRowDefIDs().length}</p>
                    </div>
                    <div
                      class="space-y-1 rounded-lg border border-[#365073] bg-[#101f35]/85 p-2"
                      data-testid="board-deck-hub-row-dropzone"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDeckHubDropToRow(event)}
                    >
                      <For each={deckRowDefIDs()}>
                        {(defID, index) => (
                          <div
                            draggable
                            data-testid="board-deck-hub-row-item"
                            data-def-id={defID}
                            class={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                              deckHubDragDefID() === defID
                                ? "border-[#8db4ff] bg-[#243a63] text-[#eff5ff]"
                                : "border-[#466288] bg-[#162946] text-[#d9e7ff]"
                            }`}
                            onDragStart={(event) => beginDeckHubDrag(event, defID)}
                            onDragEnd={endDeckHubDrag}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDeckHubDropToRow(event, index())}
                          >
                            <span class="truncate pr-2">{deckDisplayName(defID)}</span>
                            <button
                              type="button"
                              data-testid="board-deck-hub-hide"
                              class="rounded border border-[#55729b] px-1.5 py-0.5 text-[10px] text-[#d2e2ff] hover:border-[var(--accent)]"
                              onClick={() => moveDeckToReserve(defID)}
                            >
                              Hide
                            </button>
                          </div>
                        )}
                      </For>

                      <Show when={deckRowDefIDs().length === 0}>
                        <p class="rounded-md border border-dashed border-[#42628f] bg-[#13223a] px-2 py-2 text-[11px] text-[#8ca5cd]">
                          No decks in row.
                        </p>
                      </Show>
                    </div>
                  </section>

                  <section>
                    <div class="mb-1 flex items-center justify-between">
                      <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9eb2d5]">Reserve</p>
                      <p class="text-[11px] text-[#869abe]">Hidden: {deckOverflowDefIDs().length}</p>
                    </div>
                    <div
                      class="space-y-1 rounded-lg border border-[#304867] bg-[#0f1a2b]/85 p-2"
                      data-testid="board-deck-hub-reserve-dropzone"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDeckHubDropToReserve(event)}
                    >
                      <For each={deckOverflowDefIDs()}>
                        {(defID, index) => (
                          <div
                            draggable
                            data-testid="board-deck-hub-reserve-item"
                            data-def-id={defID}
                            class={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                              deckHubDragDefID() === defID
                                ? "border-[#8db4ff] bg-[#243a63] text-[#eff5ff]"
                                : "border-[#415a80] bg-[#141f34] text-[#cedcf6]"
                            }`}
                            onDragStart={(event) => beginDeckHubDrag(event, defID)}
                            onDragEnd={endDeckHubDrag}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDeckHubDropToReserve(event, index())}
                          >
                            <span class="truncate pr-2">{deckDisplayName(defID)}</span>
                            <button
                              type="button"
                              data-testid="board-deck-hub-show"
                              class="rounded border border-[#4f6c95] px-1.5 py-0.5 text-[10px] text-[#d2e2ff] hover:border-[var(--accent)]"
                              onClick={() => moveDeckToRow(defID)}
                            >
                              Show
                            </button>
                          </div>
                        )}
                      </For>

                      <Show when={deckOverflowDefIDs().length === 0}>
                        <p class="rounded-md border border-dashed border-[#375172] bg-[#121f32] px-2 py-2 text-[11px] text-[#8ca5cd]">
                          No extra decks.
                        </p>
                      </Show>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </Show>

          <div
            ref={boardRef}
            class="relative h-full w-full touch-none overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(60,85,125,0.22),transparent_45%),linear-gradient(180deg,#090b12,#05070d)]"
            onPointerDown={onBoardPointerDown}
            data-testid="board-canvas"
            data-pan-x={String(boardPan().x)}
            data-pan-y={String(boardPan().y)}
          >
            <div
              class="pointer-events-none absolute inset-0 opacity-65 [background-size:22px_22px] [background-image:radial-gradient(circle_at_1px_1px,rgba(207,218,241,0.2)_1px,transparent_1.3px),radial-gradient(circle_at_1px_1px,rgba(207,218,241,0.1)_1px,transparent_1.3px)]"
              style={{
                "background-position": `${boardPan().x}px ${boardPan().y}px, ${boardPan().x + 11}px ${boardPan().y + 11}px`,
              }}
              data-testid="board-grid-overlay"
            />
            <div class="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[170px] bg-gradient-to-t from-[#05070d] via-[#05070ddd] to-transparent" />

            <Show when={!loading()} fallback={<p class="p-4 text-sm text-[#a2adbf]">Loading board...</p>}>
              <div
                class="absolute inset-0"
                data-testid="board-world-layer"
                style={{
                  transform: `translate(${boardPan().x}px, ${boardPan().y}px)`,
                }}
              >
                <For each={renderStacks()}>
                  {(stack) => {
                  const visibleCards = createMemo(() => stackCardsForRender(stack));
                  const draggedCards = createMemo(() => draggedCardsForRender(stack));
                  const preview = createMemo(() => stackPreview(stack, visibleCards()));
                  const position = createMemo(() => stackPosition(stack));
                  const splitDragPosition = createMemo(() => dragPreviewPosition(stack.id));
                  const isMergeTarget = createMemo(() => mergeTargetID() === stack.id);
                  const isInline = createMemo(() => inlineStackID() === stack.id);
                  const topIsDeckLike = createMemo(() => preview().isDeck);
                  const topIsPack = createMemo(() => preview().isPack);
                  const villagerStatus = createMemo(() => villagerStatusForStack(stack, state()));
                  const stackTooltip = createMemo(() => villagerTooltipLabel(villagerStatus()) ?? preview().title);
                  const hasNextActionModifier = createMemo(
                    () => stackHasKind(stack, "task") && stackHasCardDefID(stack, "mod.next_action"),
                  );
                  const isExhaustedVillager = createMemo(() => (villagerStatus()?.stamina ?? 1) <= 0);
                  const miningProgress = createMemo(() => {
                    const session = miningSessionsByStackID()[stack.id];
                    if (!session) return null;
                    const tick = miningTickMs();
                    const elapsed = Math.max(0, tick - session.startedAt);
                    if (session.durationMs <= 0) return null;
                    return (elapsed % session.durationMs) / session.durationMs;
                  });
                  const isDraggingStack = createMemo(() => {
                    const drag = dragState();
                    return drag?.stackId === stack.id && drag.mode === "stack";
                  });
                  const isSplittingStack = createMemo(() => {
                    const drag = dragState();
                    return drag?.stackId === stack.id && drag.mode === "split";
                  });

                  return (
                    <>
                      <article
                        data-testid="board-stack"
                        data-stack-id={stack.id}
                        data-stack-title={preview().title}
                        data-stack-root="true"
                        title={stackTooltip()}
                        class={`group absolute select-none ${
                          topIsDeckLike() ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
                        } ${
                          isMergeTarget()
                            ? "ring-2 ring-[#efb05f] ring-offset-2 ring-offset-[#07090f]"
                            : isExhaustedVillager()
                              ? "ring-2 ring-[#f87171] ring-offset-2 ring-offset-[#07090f] shadow-[0_0_0_1px_rgba(248,113,113,0.34),0_0_26px_rgba(248,113,113,0.28)]"
                              : hasNextActionModifier()
                              ? "ring-2 ring-[#facc15]/90 ring-offset-2 ring-offset-[#07090f] shadow-[0_0_0_1px_rgba(250,204,21,0.36),0_0_26px_rgba(250,204,21,0.34)]"
                              : ""
                        }`}
                        style={{
                          left: `${position().x}px`,
                          top: `${position().y}px`,
                          height: `${stackHeightPx(visibleCards().length)}px`,
                          width: `${CARD_WIDTH}px`,
                          "z-index": stackZIndex(stack, isDraggingStack()),
                          transform:
                            topIsDeckLike() && isMobileBoardViewport()
                              ? `scale(${MOBILE_DECK_SCALE})`
                              : undefined,
                          "transform-origin":
                            topIsDeckLike() && isMobileBoardViewport() ? "top left" : undefined,
                        }}
                        onPointerDown={(event) => onStackPointerDown(event, stack)}
                        onClick={(event) => {
                          if (!(topIsDeckLike() || topIsPack())) return;
                          if (isClickSuppressed(stack.id)) return;
                          event.stopPropagation();
                          void activateDeckOrPack(stack);
                        }}
                      >
                        <Show when={isExhaustedVillager()}>
                          <div
                            class="pointer-events-none absolute -top-3 left-0 rounded-md border border-[#7d3f3f] bg-[#311617]/96 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#ffb3ad] shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                            data-testid="board-stack-exhausted"
                          >
                            No stamina
                          </div>
                        </Show>

                        <Show when={miningProgress() !== null}>
                          <div class="pointer-events-none absolute -bottom-3 left-0 right-0 rounded-md border border-[#335244] bg-[#0c1b14]/92 px-1 py-0.5">
                            <div class="h-1.5 w-full overflow-hidden rounded-full border border-[#2f4a3f] bg-[#13291f]">
                              <div
                                class="h-full bg-gradient-to-r from-[#78cc57] to-[#b8ef90] transition-[width] duration-100"
                                style={{
                                  width: `${Math.round((miningProgress() ?? 0) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </Show>

                        <For each={visibleCards()}>
                          {(cardID, index) => {
                            const card = createMemo(() => state()?.cards[cardID] ?? null);
                            const cardPreview = createMemo(() => {
                              const value = card();
                              const kind = value ? cardKind(value.defId) : "unknown";
                              const skin = cardSkin(kind, value?.defId ?? "");
                              const villagerInfo = kind === "villager" ? villagerStatus() : null;
                              return {
                                title: titleFromCard(value),
                                subtitle: villagerInfo ? `VILLAGER · STA ${villagerInfo.stamina}` : subtitleFromCard(value),
                                icon: cardIcon(value),
                                shellClass: skin.shellClass,
                                titleClass: skin.titleClass,
                              };
                            });
                            const isFace = createMemo(() => index() === visibleCards().length - 1);

                            return (
                              <div
                                data-card-index={index()}
                                class={`absolute left-0 h-[124px] w-[92px] rounded-[3px] border-2 border-black/55 shadow-[2px_2px_0_rgba(0,0,0,0.35)] ${
                                  cardPreview().shellClass
                                }`}
                                style={{
                                  top: `${index() * STACK_OFFSET_Y}px`,
                                  "z-index": `${index() + 1}`,
                                }}
                              >
                                <div
                                  class={`absolute inset-x-0 top-0 flex h-[18px] items-center justify-between border-b-2 border-black/40 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                    cardPreview().titleClass
                                  }`}
                                >
                                  <Show
                                    when={!(isFace() && isInline())}
                                    fallback={
                                      <input
                                        value={inlineTitle()}
                                        onInput={(event) => setInlineTitle(event.currentTarget.value)}
                                        class="h-4 w-full border-none bg-transparent px-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1a1f2a] outline-none"
                                        onClick={(event) => event.stopPropagation()}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            event.preventDefault();
                                            void saveInlineEdit();
                                          }
                                          if (event.key === "Escape") {
                                            event.preventDefault();
                                            cancelInlineEdit();
                                          }
                                        }}
                                        onBlur={() => void saveInlineEdit()}
                                      />
                                    }
                                  >
                                    <span class="truncate" data-testid="board-card-title">
                                      {cardPreview().title}
                                    </span>
                                  </Show>
                                </div>

                                <div class="absolute inset-x-0 top-[18px] bottom-0 flex flex-col items-center justify-center gap-1 px-1">
                                  <div class="flex h-[46px] w-[46px] items-center justify-center rounded-[8px] border-2 border-black/30 bg-white/30 text-[18px]">
                                    {cardPreview().icon}
                                  </div>
                                  <p class="max-w-full truncate text-[9px] uppercase tracking-[0.12em] text-black/75">{cardPreview().subtitle}</p>
                                </div>

                                <Show when={isFace()}>
                                  <span class="absolute bottom-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black/40 bg-white/80 px-1 text-[10px] font-bold text-[#1a1e28]">
                                    {visibleCards().length}
                                  </span>
                                </Show>
                              </div>
                            );
                          }}
                        </For>

                      </article>

                      <Show when={isSplittingStack() && draggedCards().length > 0 && !!splitDragPosition()}>
                        <article
                          class="pointer-events-none absolute select-none"
                          style={{
                            left: `${splitDragPosition()?.x ?? 0}px`,
                            top: `${splitDragPosition()?.y ?? 0}px`,
                            height: `${stackHeightPx(draggedCards().length)}px`,
                            width: `${CARD_WIDTH}px`,
                            "z-index": `${draggingOverCollectDeck() ? Z_INDEX_DRAG_OVER_COLLECT + 1 : Z_INDEX_DRAG + 1}`,
                          }}
                        >
                          <For each={draggedCards()}>
                            {(cardID, index) => {
                              const card = createMemo(() => state()?.cards[cardID] ?? null);
                              const cardPreview = createMemo(() => {
                                const value = card();
                                const kind = value ? cardKind(value.defId) : "unknown";
                                const skin = cardSkin(kind, value?.defId ?? "");
                                const villagerInfo = kind === "villager" ? villagerStatus() : null;
                                return {
                                  title: titleFromCard(value),
                                  subtitle: villagerInfo ? `VILLAGER · STA ${villagerInfo.stamina}` : subtitleFromCard(value),
                                  icon: cardIcon(value),
                                  shellClass: skin.shellClass,
                                  titleClass: skin.titleClass,
                                };
                              });
                              const isFace = createMemo(() => index() === draggedCards().length - 1);

                              return (
                                <div
                                  class={`absolute left-0 h-[124px] w-[92px] rounded-[3px] border-2 border-black/55 shadow-[2px_2px_0_rgba(0,0,0,0.35)] ${
                                    cardPreview().shellClass
                                  }`}
                                  style={{
                                    top: `${index() * STACK_OFFSET_Y}px`,
                                    "z-index": `${index() + 1}`,
                                  }}
                                >
                                  <div
                                    class={`absolute inset-x-0 top-0 flex h-[18px] items-center justify-between border-b-2 border-black/40 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                      cardPreview().titleClass
                                    }`}
                                  >
                                    <span class="truncate">{cardPreview().title}</span>
                                  </div>

                                  <div class="absolute inset-x-0 top-[18px] bottom-0 flex flex-col items-center justify-center gap-1 px-1">
                                    <div class="flex h-[46px] w-[46px] items-center justify-center rounded-[8px] border-2 border-black/30 bg-white/30 text-[18px]">
                                      {cardPreview().icon}
                                    </div>
                                    <p class="max-w-full truncate text-[9px] uppercase tracking-[0.12em] text-black/75">{cardPreview().subtitle}</p>
                                  </div>

                                  <Show when={isFace()}>
                                    <span class="absolute bottom-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black/40 bg-white/80 px-1 text-[10px] font-bold text-[#1a1e28]">
                                      {draggedCards().length}
                                    </span>
                                  </Show>
                                </div>
                              );
                            }}
                          </For>
                        </article>
                      </Show>
                    </>
                  );
                }}
                </For>

                <Show when={deckOverflowDefIDs().length > 0 ? deckHubWorldPosition() : null}>
                  {(position) => (
                    <button
                      type="button"
                      data-stack-root="true"
                      class="group absolute h-[124px] w-[92px] cursor-pointer select-none rounded-[3px] border-2 border-black/55 bg-[#a9b7cf] text-[#121722] shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
                      style={{
                        left: `${position().x}px`,
                        top: `${position().y}px`,
                        "z-index": `${Z_INDEX_DECK_BASE + DECK_ROW_MAX_VISIBLE + 2}`,
                        transform: isMobileBoardViewport() ? `scale(${MOBILE_DECK_SCALE})` : undefined,
                        "transform-origin": isMobileBoardViewport() ? "top left" : undefined,
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeckHubOpen((open) => !open);
                      }}
                      data-testid="board-deck-hub-toggle"
                      title="Open deck hub"
                    >
                      <div class="absolute inset-x-0 top-0 flex h-[18px] items-center justify-center border-b-2 border-black/40 bg-[#8494af] px-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
                        Deck Hub
                      </div>
                      <div class="absolute inset-x-0 top-[18px] bottom-0 flex flex-col items-center justify-center gap-1 px-1">
                        <div class="flex h-[46px] w-[46px] items-center justify-center rounded-[8px] border-2 border-black/30 bg-white/30 text-[20px]">
                          🗂️
                        </div>
                        <p class="text-[9px] uppercase tracking-[0.12em] text-black/75">{deckOverflowDefIDs().length} hidden</p>
                      </div>
                    </button>
                  )}
                </Show>
              </div>
            </Show>
          </div>

          <Show when={error() && !loading()}>
            <div class="absolute bottom-4 left-4 z-40 max-w-md rounded-md border border-[#8d3a3a] bg-[#321417] px-3 py-2 text-xs text-[#ffd2d2] md:hidden">
              {error()}
            </div>
          </Show>
        </section>
      </div>

      <Show when={notificationHistoryOpen()}>
        <div
          class="fixed inset-0 z-[78] flex items-center justify-center bg-[#05070fcc]/90 p-3 md:p-4"
          onClick={() => setNotificationHistoryOpen(false)}
        >
          <div
            class="w-full max-w-lg rounded-2xl border border-[#2b3c57] bg-[linear-gradient(180deg,#101a2c,#0d1523)] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
            data-testid="board-notification-history"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Recent Notifications</p>
                <p class="mt-1 text-sm text-[#b5c7e6]">Recent board alerts and status messages for this session.</p>
              </div>
              <button
                type="button"
                class="rounded-md border border-[#435c84] px-2 py-1 text-xs text-[#d5e4ff] hover:border-[var(--accent)]"
                onClick={() => setNotificationHistoryOpen(false)}
              >
                Close
              </button>
            </div>

            <div class="mt-4 space-y-2" data-testid="board-notification-history-list">
              <Show
                when={toast.history().length > 0}
                fallback={
                  <p class="rounded-lg border border-[#304867] bg-[#101f35]/85 px-3 py-3 text-sm text-[#a8bddf]">
                    No notifications yet.
                  </p>
                }
              >
                <For each={toast.history()}>
                  {(entry) => (
                    <article class={`rounded-lg border px-3 py-2 shadow-[0_12px_28px_rgba(0,0,0,0.25)] ${notificationToneClass(entry.tone)}`}>
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <p class="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">
                            {notificationToneLabel(entry.tone)}
                          </p>
                          <p class="mt-1 text-sm leading-snug">{entry.message}</p>
                        </div>
                        <span class="shrink-0 text-[11px] opacity-75">{formatNotificationTime(entry.createdAt)}</span>
                      </div>
                    </article>
                  )}
                </For>
              </Show>
            </div>

            <div class="mt-4 flex justify-end">
              <button
                type="button"
                class="rounded-md border border-[#3f567c] bg-[#16253f] px-3 py-1.5 text-sm text-[#dbe8ff] transition hover:border-[var(--accent)]"
                onClick={() => toast.clearHistory()}
                disabled={toast.history().length === 0}
              >
                Clear history
              </button>
            </div>
          </div>
        </div>
      </Show>

      <Show when={createBoardModalOpen()}>
        <div
          class="fixed inset-0 z-[80] flex items-center justify-center bg-[#05070fcc]/90 p-3 md:p-4"
          onClick={closeCreateBoardModal}
        >
          <div
            class="w-full max-w-md rounded-2xl border border-[#2b3c57] bg-[linear-gradient(180deg,#101a2c,#0d1523)] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
            data-testid="board-create-modal"
          >
            <p class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Create Board</p>
            <p class="mt-1 text-sm text-[#b5c7e6]">
              Name your board. Spaces are allowed, and quick add will use a slug token.
            </p>

            <form
              class="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void submitCreateBoardFromModal();
              }}
            >
              <label class="block text-xs font-semibold uppercase tracking-[0.1em] text-[#8ca1c5]">
                Board name
                <input
                  ref={createBoardInputRef}
                  value={newBoardName()}
                  onInput={(event) => setNewBoardName(event.currentTarget.value)}
                  placeholder="Sprint Board"
                  class="mt-1 w-full rounded-md border border-[#3a4d6d] bg-[#0f1728] px-2.5 py-2 text-sm text-[#dce8ff] outline-none focus:border-[var(--accent)]"
                  data-testid="board-create-name-input"
                />
              </label>
              <Show when={createBoardSlugHint()}>
                {(slug) => (
                  <p class="rounded-md border border-[#3a4d70] bg-[#121f34] px-2.5 py-1.5 text-xs text-[#d6e5ff]">
                    Quick add token: <span class="font-semibold text-[#ecf3ff]">#{slug()}</span>
                  </p>
                )}
              </Show>
              <div class="flex items-center justify-end gap-2">
                <button
                  type="button"
                  class="rounded-md border border-[#3f567c] bg-[#16253f] px-3 py-1.5 text-sm text-[#dbe8ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                  onClick={closeCreateBoardModal}
                  disabled={boardCrudBusy()}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="rounded-md border border-[#406087] bg-[#1c3153] px-3 py-1.5 text-sm font-semibold text-[#e5efff] transition hover:border-[var(--accent)] disabled:opacity-60"
                  disabled={boardCrudBusy() || !newBoardName().trim()}
                  data-testid="board-create-submit"
                >
                  {boardCrudBusy() ? "Creating..." : "Create board"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </Show>

      <Show when={isDetailOpen() && !!selectedTaskCard()}>
        <div class="fixed inset-0 z-[70] flex items-center justify-center bg-[#05070fcc]/90 p-2 pb-[calc(72px+env(safe-area-inset-bottom))] md:p-4">
          <div
            class="w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-[#2a3242] bg-[linear-gradient(180deg,#101825,#0b121d)] shadow-[0_24px_64px_rgba(0,0,0,0.55)] md:max-h-[92vh]"
            data-testid="board-detail-modal"
          >
            <div class="sticky top-0 z-10 flex items-center justify-between border-b border-[#273247] bg-[#101825]/96 px-5 py-4 backdrop-blur-sm">
              <p class="text-2xl font-semibold tracking-tight">Task Details</p>
              <button
                type="button"
                class="rounded-lg border border-[#466083] px-3 py-1.5 text-sm text-[#dbe7ff] hover:border-[var(--accent)]"
                onClick={closeDetail}
              >
                ✕
              </button>
            </div>

            <div class="space-y-6 p-5 md:p-6">
              <section class="rounded-xl border border-[#2b446d] bg-[#0d172a]/90 p-4">
                <p class="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#8c99af]">Task</p>
                <div class="rounded-xl border border-[#334b73] bg-[#0b1426] p-4">
                  <div class="mb-3 flex items-center gap-3">
                    <div class="flex h-12 w-12 items-center justify-center rounded-lg border border-[#355077] bg-[#121f36] text-xl">📋</div>
                    <div class="min-w-0 flex-1">
                      <textarea
                        rows={3}
                        value={detailTitle()}
                        onInput={(event) => onDetailTitleInput(event.currentTarget.value)}
                        class="w-full resize-none rounded-lg border border-[#355077] bg-[#0f1828] px-3 py-2 text-base leading-tight font-semibold text-[#edf3ff] outline-none focus:border-[var(--accent)] md:text-2xl"
                        data-testid="board-detail-title"
                      />
                    </div>
                  </div>

                  <Show when={detailTokens().length > 0}>
                    <div class="mb-3 rounded-lg border border-[#30496f] bg-[#0e1a30] px-3 py-2 text-sm leading-relaxed text-[#d8e4fb]">
                      <For each={detailTokens()}>
                        {(token) => (
                          <span class={token.kind === "text" ? "" : `rounded-[4px] ${tokenClass(token.kind)}`}>
                            {token.value}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={detailParsing()}>
                    <p class="mb-2 text-xs text-[#8fa6cb]">Parsing schedule…</p>
                  </Show>

                  <Show when={detailParsedChips().length > 0}>
                    <div class="mb-3 flex flex-wrap gap-1.5">
                      <For each={detailParsedChips()}>
                        {(chip) => (
                          <span class="rounded-md border border-[#3a4d70] bg-[#121f34] px-2 py-0.5 text-[11px] text-[var(--text-main)]">
                            {chip}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={detailModifierHints().length > 0}>
                    <div class="mb-3 space-y-1">
                      <For each={detailModifierHints()}>
                        {(hint) => (
                          <p class="rounded-md border border-[#5f4a2a] bg-[#2b2112] px-2.5 py-1.5 text-xs text-[#f7d9a1]">
                            {hint}
                          </p>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={detailScheduleInput() || detailStoredDue() || detailStoredDeadline()}>
                    <div class="mb-3 space-y-1 rounded-md border border-[#2d4b73] bg-[#0d1a30] px-2.5 py-2 text-xs text-[#c9daf8]">
                      <Show when={detailScheduleInput()}>
                        <p>
                          Input: <span class="text-[#e8f1ff]">{detailScheduleInput()}</span>
                        </p>
                      </Show>
                      <Show when={detailDueInputToken() || detailStoredDue()}>
                        <p>
                          Due:
                          <Show when={detailDueInputToken()}>
                            <span class="ml-1 text-[#9ec1ff]">{detailDueInputToken()}</span>
                          </Show>
                          <Show when={detailDueInputToken() && detailStoredDue()}>
                            <span class="mx-1 text-[#88a4d1]">{"->"}</span>
                          </Show>
                          <Show when={detailStoredDue()}>
                            <span class="text-[#e8f1ff]">
                              {formatScheduleDateTime(detailStoredDue()) ?? detailStoredDue()}
                            </span>
                          </Show>
                        </p>
                      </Show>
                      <Show when={detailDeadlineInputToken() || detailStoredDeadline()}>
                        <p>
                          Deadline:
                          <Show when={detailDeadlineInputToken()}>
                            <span class="ml-1 text-[#b8b5ff]">{detailDeadlineInputToken()}</span>
                          </Show>
                          <Show when={detailDeadlineInputToken() && detailStoredDeadline()}>
                            <span class="mx-1 text-[#88a4d1]">{"->"}</span>
                          </Show>
                          <Show when={detailStoredDeadline()}>
                            <span class="text-[#e8f1ff]">
                              {formatScheduleDateTime(detailStoredDeadline()) ?? detailStoredDeadline()}
                            </span>
                          </Show>
                        </p>
                      </Show>
                    </div>
                  </Show>
                  <Show when={detailScheduleWarning()}>
                    <p class="mb-3 rounded-md border border-[#5f4a2a] bg-[#2b2112] px-2.5 py-1.5 text-xs text-[#f7d9a1]">
                      {detailScheduleWarning()}
                    </p>
                  </Show>

                  <textarea
                    rows={5}
                    value={detailDescription()}
                    onInput={(event) => setDetailDescription(event.currentTarget.value)}
                    class="w-full rounded-lg border border-[#355077] bg-[#0f1828] px-3 py-2 text-[15px] text-[#dbe6f8] outline-none focus:border-[var(--accent)]"
                    data-testid="board-detail-description"
                  />

                  <button
                    type="button"
                    class="mt-3 w-full rounded-lg border border-[#3c4f74] bg-[#1b2941] px-4 py-2 text-base font-semibold text-[#e6efff] hover:border-[var(--accent)]"
                    onClick={openInTaskPage}
                  >
                    View in Tasks Page
                  </button>
                </div>
              </section>

              <section>
                <p class="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8c99af]">Priority</p>
                <div class="grid grid-cols-5 gap-2">
                  <For each={[0, 1, 2, 3, 4]}>
                    {(value) => (
                      <button
                        type="button"
                        class={`rounded-lg border px-3 py-2 text-base font-semibold transition ${
                          detailPriority() === value || (value === 0 && detailPriority() <= 0)
                            ? "border-[#6a83ad] bg-[#3b4d6a] text-[#eef3ff]"
                            : "border-[#334763] bg-[#0c1526] text-[#7f90ad] hover:border-[#4a5f83]"
                        }`}
                        onClick={() => setDetailPriority(value === 0 ? 4 : value)}
                      >
                        {value === 0 ? "None" : `P${value}`}
                      </button>
                    )}
                  </For>
                </div>
              </section>

              <section>
                <p class="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8c99af]">Tags</p>
                <div class="flex flex-wrap gap-2">
                  <span class="rounded-lg border border-[#4b5d8e] bg-[#1d2d4a] px-3 py-1 text-lg text-[#d8e5ff]">
                    #{activeBoardProjectID()}
                  </span>
                  <For each={detailVisibleLabels()}>
                    {(tag) => (
                      <span class="rounded-lg border border-[#6243a4] bg-[#281a46] px-3 py-1 text-lg text-[#e4d7ff]">@{tag}</span>
                    )}
                  </For>
                </div>
              </section>

              <section>
                <p class="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8c99af]">Modifier Slots</p>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <For each={[0, 1, 2, 3]}>
                    {(slotIndex) => {
                      const card = createMemo(() => selectedModifierCards()[slotIndex] ?? null);
                      return (
                        <div class="rounded-xl border border-[#324a71] bg-[#0f1a2e] px-3 py-2">
                          <Show
                            when={card()}
                            fallback={<p class="text-sm text-[#7f90ad]">Slot {slotIndex + 1}: empty</p>}
                          >
                            {(value) => (
                              <p class="text-sm font-semibold text-[#d9e8ff]">
                                Slot {slotIndex + 1}: {prettifyDefID(value().defId)}
                              </p>
                            )}
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>

                <p class="mt-3 text-xs text-[#8c99af]">
                  {recurringModifierEnabled() || deadlineModifierEnabled()
                    ? `Parsing enabled on save: ${
                        recurringModifierEnabled() ? "recurrence phrases" : ""
                      }${recurringModifierEnabled() && deadlineModifierEnabled() ? " and " : ""}${
                        deadlineModifierEnabled() ? "due/deadline phrases" : ""
                      } are extracted.`
                    : 'Modifiers are earned from card packs. Stack "Recurring" and/or "Deadline Pin" cards on this task to enable schedule parsing; otherwise timing text is kept as plain text.'}
                </p>
              </section>

              <section>
                <p class="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#8c99af]">Assigned Villager</p>
                <div class="rounded-xl border border-[#304d7c] bg-[#0c1a2f] p-4">
                  <p class="text-lg font-semibold text-[#e3efff]">
                    {dataString(selectedTaskCard()?.data?.assignedVillagerId) || "Unassigned"}
                  </p>
                </div>
              </section>
            </div>

            <div class="sticky bottom-0 flex items-center justify-between border-t border-[#273247] bg-[#101825]/96 px-5 py-4 backdrop-blur-sm">
              <button
                type="button"
                class="rounded-xl border border-[#466083] px-4 py-2 text-sm text-[#dbe7ff] hover:border-[var(--accent)]"
                onClick={() => {
                  const id = selectedStackID();
                  if (id) void completeStack(id);
                }}
                data-testid="board-detail-mark-done"
              >
                Mark done
              </button>

              <button
                type="button"
                class="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#151515] hover:bg-[var(--accent-soft)]"
                onClick={() => void saveDetail()}
                data-testid="board-detail-save"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </Show>
    </AppShell>
  );
}
