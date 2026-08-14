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
} from "../features/board/board-rules";import type { BoardControllerDeckEffectsContext } from "./BoardControllerDeckEffects";

export function createBoardControllerMinimap(context: BoardControllerDeckEffectsContext) {
  const {
    state,
    busy,
    selectedStackID,
    boardPan,
    setBoardPan,
    viewportSize,
    runtime,
    renderStacks,
    stackHasKind,
    stackPosition,
    stackHasCardDefID,
  } = context;

  const minimapModel = createMemo(() => {
    const viewport = viewportSize();
    const viewportWidth = viewport.width > 0 ? viewport.width : runtime.boardRef?.clientWidth ?? 0;
    const viewportHeight = viewport.height > 0 ? viewport.height : runtime.boardRef?.clientHeight ?? 0;
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
    if (isExhausted) return minimapExhausted;
    if (isNextAction) return minimapNextAction;
    switch (kind) {
      case "task":
        return minimapTask;
      case "villager":
        return minimapVillager;
      case "zombie":
        return minimapZombie;
      case "resource":
        return minimapResource;
      case "food":
        return minimapFood;
      case "deck":
        return minimapDeck;
      default:
        return minimapDefault;
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

  return {
    minimapModel,
    minimapDotClass,
    focusMinimapAt,
    onMinimapPointerDown,
    onMinimapPointerMove,
    onMinimapPointerUp,
    stackPreview,
  };
}

const minimapExhausted = css`background: #f87171; color: #f87171;`;
const minimapNextAction = css`background: #facc15; color: #facc15;`;
const minimapTask = css`background: #ff3f86; color: #ff3f86;`;
const minimapVillager = css`background: #ffb13b; color: #ffb13b;`;
const minimapZombie = css`background: #c98697; color: #c98697;`;
const minimapResource = css`background: #77df49; color: #77df49;`;
const minimapFood = css`background: #ff8a00; color: #ff8a00;`;
const minimapDeck = css`background: #38b2f6; color: #38b2f6;`;
const minimapDefault = css`background: #9aa9c3; color: #9aa9c3;`;

export type BoardControllerMinimapContext = BoardControllerDeckEffectsContext & ReturnType<typeof createBoardControllerMinimap>;
