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
} from "../features/board/board-rules";import type { BoardControllerSummaryContext } from "./BoardControllerSummary";

export function createBoardControllerSpatial(context: BoardControllerSummaryContext) {
  const {
    state,
    dragState,
    mergeTargetID,
    localPositions,
    setLocalPositions,
    clickSuppress,
    setClickSuppress,
    boardPan,
    runtime,
    stacks,
    deckWorldPositionByID,
    deckLayerOrderByID,
    isDeckLikeStack,
    topDefID,
    stackHasKind,
  } = context;

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
    if (!runtime.boardRef) return { x: clientX, y: clientY };
    const rect = runtime.boardRef.getBoundingClientRect();
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

  function cardIDsHaveKind(cardIDs: string[], kind: string): boolean {
    const current = state();
    if (!current) return false;
    const normalized = kind.trim().toLowerCase();
    if (!normalized) return false;

    for (const cardID of cardIDs) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (cardKind(card.defId).toLowerCase() === normalized) {
        return true;
      }
    }

    return false;
  }

  function cardIDsHaveDefID(cardIDs: string[], defID: string): boolean {
    const current = state();
    if (!current) return false;
    const normalized = defID.trim().toLowerCase();
    if (!normalized) return false;

    for (const cardID of cardIDs) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (card.defId.trim().toLowerCase() === normalized) {
        return true;
      }
    }

    return false;
  }

  function stackHasUnlinkedBlankTask(stack: BoardStack | null): boolean {
    const current = state();
    if (!current || !stack) return false;

    for (const cardID of stack.cards) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (card.defId.trim().toLowerCase() !== "task.blank") continue;
      if (!dataString(card.data?.taskId)) {
        return true;
      }
    }

    return false;
  }

  function cardIDsHaveUnlinkedBlankTask(cardIDs: string[]): boolean {
    const current = state();
    if (!current) return false;

    for (const cardID of cardIDs) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (card.defId.trim().toLowerCase() !== "task.blank") continue;
      if (!dataString(card.data?.taskId)) {
        return true;
      }
    }

    return false;
  }

  function topDefIDFromCardIDs(cardIDs: string[]): string {
    const top = cardFromCardIDs(cardIDs, state());
    return top?.defId || "";
  }

  function mergeWouldPutVillagerOnLootParts(target: BoardStack | null, sourceCardIDs: string[]): boolean {
    if (!target || sourceCardIDs.length === 0) return false;
    const targetHasVillager = stackHasKind(target, "villager");
    const sourceHasVillager = cardIDsHaveKind(sourceCardIDs, "villager");
    if (!targetHasVillager && !sourceHasVillager) return false;

    return stackHasCardDefID(target, "loot.parts") || cardIDsHaveDefID(sourceCardIDs, "loot.parts");
  }

  function mergeWouldPutModifierOnVillagerWithoutTask(target: BoardStack | null, sourceCardIDs: string[]): boolean {
    if (!target || sourceCardIDs.length === 0) return false;

    const hasModifier = stackHasKind(target, "mod") || cardIDsHaveKind(sourceCardIDs, "mod");
    const hasVillager = stackHasKind(target, "villager") || cardIDsHaveKind(sourceCardIDs, "villager");
    if (!hasModifier || !hasVillager) return false;

    const hasTask = stackHasKind(target, "task") || cardIDsHaveKind(sourceCardIDs, "task");
    return !hasTask;
  }

  function mergeWouldCombineResourceAndBlankTask(target: BoardStack | null, sourceCardIDs: string[]): boolean {
    if (!target || sourceCardIDs.length === 0) return false;

    const hasResource = stackHasKind(target, "resource") || cardIDsHaveKind(sourceCardIDs, "resource");
    if (!hasResource) return false;

    return stackHasUnlinkedBlankTask(target) || cardIDsHaveUnlinkedBlankTask(sourceCardIDs);
  }

  function canMergeDraggedCardsIntoTarget(target: BoardStack | null, sourceCardIDs: string[]): boolean {
    if (!target || sourceCardIDs.length === 0) return false;
    if (mergeWouldPutVillagerOnLootParts(target, sourceCardIDs)) return false;
    if (mergeWouldCombineResourceAndBlankTask(target, sourceCardIDs)) return false;
    if (mergeWouldPutModifierOnVillagerWithoutTask(target, sourceCardIDs)) return false;

    const sourceDef = topDefIDFromCardIDs(sourceCardIDs);
    if (!sourceDef) return false;

    if (isCollectDeck(target)) {
      return !isDeckDef(sourceDef) && !isPackDef(sourceDef);
    }

    const targetDef = topDefID(target);
    if (!targetDef) return false;
    if (isDeckDef(sourceDef) || isPackDef(sourceDef)) return false;
    if (isDeckDef(targetDef) || isPackDef(targetDef)) return false;

    return true;
  }

  function miningDurationMsForStack(stack: BoardStack | null): number | null {
    const resourceCard = firstCardByKind(stack, "resource");
    if (!resourceCard) return null;

    const raw = dataNumber(resourceCard.data?.gatherTimeS);
    if (!raw || raw <= 0) return 6000;
    const seconds = Math.min(Math.max(raw, 1), 180);
    return Math.round(seconds * 1000);
  }

  return {
    draggingOverCollectDeck,
    stackPosition,
    worldFromClient,
    stackCardsForRender,
    draggedCardsForRender,
    dragPreviewPosition,
    clearLocalPosition,
    suppressStackClick,
    isClickSuppressed,
    isCollectDeck,
    stackZIndex,
    stackHasCardDefID,
    firstCardByKind,
    cardIDsHaveKind,
    cardIDsHaveDefID,
    stackHasUnlinkedBlankTask,
    cardIDsHaveUnlinkedBlankTask,
    topDefIDFromCardIDs,
    mergeWouldPutVillagerOnLootParts,
    mergeWouldPutModifierOnVillagerWithoutTask,
    mergeWouldCombineResourceAndBlankTask,
    canMergeDraggedCardsIntoTarget,
    miningDurationMsForStack,
  };
}

export type BoardControllerSpatialContext = BoardControllerSummaryContext & ReturnType<typeof createBoardControllerSpatial>;
