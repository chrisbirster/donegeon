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
} from "../features/board/board-rules";import type { BoardControllerTasksContext } from "./BoardControllerTasks";

export function createBoardControllerPointer(context: BoardControllerTasksContext) {
  const {
    state,
    busy,
    setSelectedStackID,
    setDragState,
    setPanDragState,
    setDragMoved,
    setMergeTargetID,
    setLocalPositions,
    boardPan,
    deckHubOpen,
    setDeckHubOpen,
    runtime,
    stacks,
    renderStacks,
    isDeckLikeStack,
    stackPosition,
    worldFromClient,
    canMergeDraggedCardsIntoTarget,
  } = context;

  function resolveMergeTarget(sourceID: string, sourcePos: BoardPoint, sourceCardCount: number): string | null {
    const source = state()?.stacks[sourceID];
    if (!source) return null;
    const sourceCardIDs = trailingCardIDs(source.cards, sourceCardCount);
    if (sourceCardIDs.length === 0) return null;

    const sourceRect = stackBounds(sourcePos, sourceCardCount);

    let bestAreaID: string | null = null;
    let bestArea = 0;

    for (const stack of renderStacks()) {
      if (stack.id === sourceID) continue;
      if (!canMergeDraggedCardsIntoTarget(stack, sourceCardIDs)) continue;
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
      if (!canMergeDraggedCardsIntoTarget(stack, sourceCardIDs)) continue;
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
    if (!runtime.boardRef) return;

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

  return {
    resolveMergeTarget,
    stackCardIndexFromPointer,
    onBoardPointerDown,
    onStackPointerDown,
  };
}

export type BoardControllerPointerContext = BoardControllerTasksContext & ReturnType<typeof createBoardControllerPointer>;
