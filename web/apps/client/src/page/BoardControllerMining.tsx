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
} from "../features/board/board-rules";import type { BoardControllerPointerContext } from "./BoardControllerPointer";

export function createBoardControllerMining(context: BoardControllerPointerContext) {
  const {
    state,
    error,
    busy,
    miningSessionsByStackID,
    setMiningSessionsByStackID,
    miningTickMs,
    miningCompletedCyclesByStackID,
    setMiningCompletedCyclesByStackID,
    miningPendingByStackID,
    setMiningPendingByStackID,
    toast,
    stacks,
    stackHasKind,
    miningDurationMsForStack,
    loadBoard,
    sendCommand,
  } = context;

  createTrackedEffect(() => {
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

  createTrackedEffect(() => {
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

  createTrackedEffect(() => {
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

  return {};
}

export type BoardControllerMiningContext = BoardControllerPointerContext & ReturnType<typeof createBoardControllerMining>;
