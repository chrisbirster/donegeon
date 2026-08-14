import type { BoardCard, BoardPoint, BoardStack, BoardStateResponse, Project } from "../../domain/contracts";
import {
  BOARD_GRID_ORIGIN_OFFSET,
  BOARD_GRID_SPACING,
  BOARD_ID_PATTERN,
  CARD_HEIGHT,
  CARD_WIDTH,
  DEFAULT_BOARD,
  DEFAULT_VILLAGER_STAMINA,
  STACK_OFFSET_Y,
  dataNumber,
  dataString,
  dataStringArray,
  type BoardChoice,
  type Rect,
  type VillagerStatus,
  type WorldRect,
} from "./board-model";

export function cardKind(defID: string): string {
  const [kind] = defID.split(".");
  return kind || "unknown";
}

export function isDeckDef(defID: string): boolean {
  return cardKind(defID) === "deck" && !defID.endsWith("_pack");
}

export function isPackDef(defID: string): boolean {
  return cardKind(defID) === "deck" && defID.endsWith("_pack");
}

export function prettifyDefID(defID: string): string {
  const normalized = defID.replaceAll(".", " ").replaceAll("_", " ").trim();
  if (!normalized) return "Card";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

export function deckDisplayName(defID: string): string {
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

export function cardIcon(card: BoardCard | null): string {
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

export function cardSkin(kind: string, defID: string): { shellClass: string; titleClass: string } {
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

export function titleFromCard(card: BoardCard | null): string {
  if (!card) return "Unknown";
  const title = dataString(card.data?.title);
  if (title) return title;
  if (card.defId === "task.blank") return "Blank Task";
  if (isDeckDef(card.defId)) return deckDisplayName(card.defId);
  if (isPackDef(card.defId)) return `${deckDisplayName(card.defId)} Pack`;
  return prettifyDefID(card.defId);
}

export function subtitleFromCard(card: BoardCard | null): string {
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

export function descriptionFromCard(card: BoardCard | null): string {
  if (!card) return "";
  return dataString(card.data?.description);
}

export function cardFromStack(stack: BoardStack | null, state: BoardStateResponse | null): BoardCard | null {
  if (!stack || !state || stack.cards.length === 0) return null;
  const topID = stack.cards[stack.cards.length - 1];
  return state.cards[topID] ?? null;
}

export function taskCardFromStack(stack: BoardStack | null, state: BoardStateResponse | null): BoardCard | null {
  if (!stack || !state || stack.cards.length === 0) return null;
  for (let index = stack.cards.length - 1; index >= 0; index -= 1) {
    const card = state.cards[stack.cards[index]];
    if (card && card.defId.startsWith("task.")) {
      return card;
    }
  }
  return null;
}

export function villagerStatusForStack(stack: BoardStack | null, snapshot: BoardStateResponse | null): VillagerStatus | null {
  if (!stack || !snapshot || stack.cards.length === 0) return null;

  for (const cardID of stack.cards) {
    const card = snapshot.cards[cardID];
    if (!card || cardKind(card.defId) !== "villager") continue;

    const villagerID = dataString(card.data?.villagerId) || stack.id;
    const progress = snapshot.meta?.villagers?.[villagerID];
    const stamina = Math.max(0, Math.floor(dataNumber(progress?.stamina) ?? DEFAULT_VILLAGER_STAMINA));
    const maxStamina = Math.max(stamina, Math.floor(dataNumber(progress?.maxStamina) ?? DEFAULT_VILLAGER_STAMINA));
    const level = Math.max(1, Math.floor(dataNumber(progress?.level) ?? 1));
    const xp = Math.max(0, Math.floor(dataNumber(progress?.xp) ?? 0));
    const nextLevel = Math.max(level, Math.floor(dataNumber(progress?.nextLevel) ?? level));
    const nextLevelXP = Math.max(xp, Math.floor(dataNumber(progress?.nextLevelXP) ?? xp));
    const xpToNextLevel = Math.max(0, Math.floor(dataNumber(progress?.xpToNextLevel) ?? 0));
    const perks = dataStringArray(progress?.perks);
    const name = dataString(card.data?.name) || titleFromCard(card) || "Villager";

    return {
      villagerID,
      stackID: stack.id,
      name,
      stamina,
      maxStamina,
      level,
      xp,
      nextLevel,
      nextLevelXP,
      xpToNextLevel,
      perks,
    };
  }

  return null;
}

export function villagerTooltipLabel(status: VillagerStatus | null): string | undefined {
  if (!status) return undefined;
  return `${status.name} • Stamina ${status.stamina}/${status.maxStamina} • Lv ${status.level}`;
}

export function cardFromCardIDs(cardIDs: string[], state: BoardStateResponse | null): BoardCard | null {
  if (!state || cardIDs.length === 0) return null;
  const topID = cardIDs[cardIDs.length - 1];
  return state.cards[topID] ?? null;
}

export function splitCardIDs(cardIDs: string[], index: number): { remaining: string[]; dragged: string[] } {
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

export function snapBoardCoordinate(value: number): number {
  return Math.round((value - BOARD_GRID_ORIGIN_OFFSET) / BOARD_GRID_SPACING) * BOARD_GRID_SPACING + BOARD_GRID_ORIGIN_OFFSET;
}

export function snapBoardPoint(point: BoardPoint): BoardPoint {
  return {
    x: snapBoardCoordinate(point.x),
    y: snapBoardCoordinate(point.y),
  };
}

export function trailingCardIDs(cardIDs: string[], count: number): string[] {
  if (cardIDs.length === 0 || count <= 0) return [];
  const normalizedCount = Math.min(cardIDs.length, Math.max(1, Math.trunc(count)));
  return cardIDs.slice(cardIDs.length - normalizedCount);
}

export function stackHeightPx(cardCount: number): number {
  return CARD_HEIGHT + Math.max(0, cardCount - 1) * STACK_OFFSET_Y;
}

export function stackBounds(pos: BoardPoint, cardCount: number): Rect {
  return {
    left: pos.x,
    top: pos.y,
    right: pos.x + CARD_WIDTH,
    bottom: pos.y + stackHeightPx(cardCount),
  };
}

export function overlapArea(a: Rect, b: Rect): number {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
  return Math.sqrt(dx * dx + dy * dy);
}

export function rectsIntersect(a: WorldRect, b: WorldRect): boolean {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

export function packDeckID(card: BoardCard): string {
  const fromData = dataString(card.data?.deckId);
  if (fromData) return fromData;
  if (card.defId.endsWith("_pack")) {
    return card.defId.slice(0, -"_pack".length);
  }
  return "deck.first_day";
}

export function projectSlug(value: string | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.includes("::") ? normalized.slice(normalized.lastIndexOf("::") + 2) : normalized;
}

export function normalizeBoardID(raw: string | null | undefined): string {
  const normalized = (raw ?? "").trim();
  if (!normalized) return DEFAULT_BOARD;
  if (!BOARD_ID_PATTERN.test(normalized)) return DEFAULT_BOARD;
  return normalized;
}

export function boardProjectIDForBoard(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "board";
  return normalized;
}

export function boardIDFromName(name: string): string | null {
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

export function boardIDFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return normalizeBoardID(params.get("board"));
}

export function boardHref(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "/board";
  return `/board?board=${encodeURIComponent(normalized)}`;
}

export function boardStoreHref(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "/board/store";
  return `/board/store?board=${encodeURIComponent(normalized)}`;
}

export function isBoardProject(projectID: string | undefined): boolean {
  const slug = projectSlug(projectID);
  return slug === "board" || slug.startsWith("board-");
}

export function boardIDForProject(projectID: string | undefined): string | undefined {
  const slug = projectSlug(projectID);
  if (!isBoardProject(slug)) return undefined;
  if (slug === "board") return DEFAULT_BOARD;
  return slug;
}

export function matchesBoardProject(projectID: string | undefined, boardID: string): boolean {
  const slug = projectSlug(projectID);
  return slug === boardProjectIDForBoard(boardID).toLowerCase();
}

export function boardChoicesFromProjects(projects: Project[], activeBoardID: string): BoardChoice[] {
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

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function ensureBoardProjectToken(text: string, projectID: string): string {
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

export function normalizeLabelToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[_\-\s]+/g, "");
}

export function hasBoardLiveLabel(labels: string[] | undefined): boolean {
  if (!labels || labels.length === 0) return false;
  return labels.some((label) => normalizeLabelToken(label) === "boardlive");
}

export function parseEmailEntries(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);
}

export function sameStringArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}
