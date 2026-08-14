import { css } from "@linaria/core";
import { useLocation, useNavigate } from "@solidjs/router";
import { For, Show, createMemo, createSignal, createTrackedEffect, onCleanup, onSettled, untrack } from "solid-js";

import { hasEntitlement, workspacePlanProfile } from "../../../../shared/pricing/catalog";
import { useApi } from "../context/ApiContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { getCachedBoardState, setCachedBoardState } from "../lib/boardCache";
import { readStoredBoardSelection, writeStoredBoardSelection } from "../lib/boardSelection";
import { extractQuickAddLabels, mergeNormalizedLabels, parseQuickAddLabels } from "../lib/quickAddLabels";
import { isAbortError, shouldPreviewQuickAdd } from "../lib/quickAddPreview";
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
} from "../server/api";
import AppShell from "../components/AppShell";
import SidebarAccountCard from "../components/SidebarAccountCard";

import {
  DEFAULT_BOARD,
  BOARD_DEV_CONTROLS_ENABLED,
  CARD_WIDTH,
  CARD_HEIGHT,
  STACK_OFFSET_Y,
  DECK_ROW_SIDE_PADDING,
  DECK_ROW_BOTTOM,
  MOBILE_DECK_ROW_BOTTOM,
  DECK_ROW_MIN_STEP,
  DECK_ROW_MAX_STEP,
  Z_INDEX_WORLD_MAX,
  Z_INDEX_DRAG,
  Z_INDEX_DRAG_OVER_COLLECT,
  Z_INDEX_DECK_BASE,
  MINIMAP_WIDTH,
  MINIMAP_HEIGHT,
  MINIMAP_PADDING,
  DECK_ROW_MAX_VISIBLE,
  DECK_ROW_PREFS_KEY,
  MOBILE_BREAKPOINT,
  MOBILE_DECK_SCALE,
  DEFAULT_VILLAGER_STAMINA,
  BOARD_GRID_SPACING,
  BOARD_GRID_ORIGIN_OFFSET,
  MERGE_GAP_DISTANCE,
  MIN_MERGE_OVERLAP,
  BOARD_ID_PATTERN,
  ApiError,
  DragState,
  Rect,
  StackPreview,
  WorldRect,
  BoardSummary,
  VillagerStatus,
  PanDragState,
  TokenKind,
  TokenPiece,
  MiningSession,
  DeckRowSlot,
  BoardChoice,
  DECK_PRIORITY_ORDER,
  dataString,
  dataNumber,
  dataStringArray,
  dataObject,
  QUICK_ADD_TOKEN_PATTERN,
  classifyToken,
  tokenizeQuickAdd,
  tokenClass,
  questTypeLabel,
  humanizeToken,
  questObjectiveLabel,
  questObjectiveProgressLabel,
  questRewardLabel,
  taskCompletionToastMessage,
  notificationToneClass,
  notificationToneLabel,
  addChip,
  scheduleDateTimeFormatter,
  notificationTimeFormatter,
  formatScheduleDateTime,
  formatNotificationTime,
  scheduleTokenFromInput,
  parseScheduleInstant,
  scheduleValidationWarning,
} from "../features/board/board-model";
import {
  cardKind,
  isDeckDef,
  isPackDef,
  prettifyDefID,
  deckDisplayName,
  cardIcon,
  cardSkin,
  titleFromCard,
  subtitleFromCard,
  descriptionFromCard,
  cardFromStack,
  taskCardFromStack,
  villagerStatusForStack,
  villagerTooltipLabel,
  cardFromCardIDs,
  splitCardIDs,
  snapBoardCoordinate,
  snapBoardPoint,
  trailingCardIDs,
  stackHeightPx,
  stackBounds,
  overlapArea,
  rectGap,
  rectsIntersect,
  packDeckID,
  projectSlug,
  normalizeBoardID,
  boardProjectIDForBoard,
  boardIDFromName,
  boardIDFromSearch,
  boardHref,
  boardStoreHref,
  isBoardProject,
  boardIDForProject,
  matchesBoardProject,
  boardChoicesFromProjects,
  escapeRegex,
  ensureBoardProjectToken,
  normalizeLabelToken,
  hasBoardLiveLabel,
  parseEmailEntries,
  sameStringArray,
} from "../features/board/board-rules";import type { BoardControllerCoreContext } from "./BoardControllerCore";

export function createBoardControllerDeck(context: BoardControllerCoreContext) {
  const {
    state,
    boardPan,
    viewportSize,
    deckOrderPrefs,
    setDeckOrderPrefs,
    deckHubDragDefID,
    setDeckHubDragDefID,
    runtime,
  } = context;

  function isDeckLikeStack(stack: BoardStack): boolean {
    const top = cardFromStack(stack, state());
    return !!top && isDeckDef(top.defId);
  }

  function topDefID(stack: BoardStack | null): string {
    const top = cardFromStack(stack, state());
    if (!top) return "";
    return top.defId;
  }

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
  const deckOverflowDefIDs = createMemo<string[]>(() => deckOrderedDefIDs().slice(deckVisibleLimit()));
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

    const rect = runtime.boardRef?.getBoundingClientRect();
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
    const width = viewport.width > 0 ? viewport.width : runtime.boardRef?.clientWidth ?? 0;
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

  return {
    stacks,
    deckPriorityOrderByDefID,
    deckStacks,
    orderedDeckStacks,
    deckStackByDefID,
    allDeckDefIDsOrdered,
    deckOrderedDefIDs,
    deckVisibleLimit,
    deckRowDefIDs,
    deckOverflowDefIDs,
    deckRowSlots,
    deckRowLayout,
    deckWorldPositionByID,
    deckHubWorldPosition,
    deckLayerOrderByID,
    visibleDeckStackIDs,
    isMobileBoardViewport,
    renderStacks,
    isDeckLikeStack,
    topDefID,
    persistDeckOrderPrefs,
    moveDeckToAbsoluteIndex,
    moveDeckToRow,
    moveDeckToReserve,
    draggedDeckDefFromEvent,
    beginDeckHubDrag,
    endDeckHubDrag,
    handleDeckHubDropToRow,
    handleDeckHubDropToReserve,
  };
}

export type BoardControllerDeckContext = BoardControllerCoreContext & ReturnType<typeof createBoardControllerDeck>;
