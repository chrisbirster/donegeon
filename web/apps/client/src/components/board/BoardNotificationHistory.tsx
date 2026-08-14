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
import AppShell from "../AppShell";
import SidebarAccountCard from "../SidebarAccountCard";

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
} from "../../features/board/board-model";
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
} from "../../features/board/board-rules";import { useBoard } from "../../page/BoardContext";

export default function BoardNotificationHistory() {
  const {
    toast,
    notificationHistoryOpen,
    setNotificationHistoryOpen,
    boardHeaderButtonClass,
    boardModalBackdropClass,
    boardModalSoftNoteClass,
  } = useBoard();
  return (
      <Show when={notificationHistoryOpen()}>
        <div
          class={`fixed inset-0 z-[78] flex items-center justify-center p-3 backdrop-blur-sm md:p-4 ${boardModalBackdropClass()}`}
          onClick={() => setNotificationHistoryOpen(false)}
        >
          <div
            class="app-panel-strong w-full max-w-lg rounded-[28px] p-4"
            onClick={(event) => event.stopPropagation()}
            data-testid="board-notification-history"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Recent Notifications</p>
                <p class="mt-1 text-sm text-[var(--text-soft)]">Recent board alerts and status messages for this session.</p>
              </div>
              <button
                type="button"
                class={boardHeaderButtonClass}
                onClick={() => setNotificationHistoryOpen(false)}
              >
                Close
              </button>
            </div>

            <div class="mt-4 space-y-2" data-testid="board-notification-history-list">
              <Show
                when={toast.history().length > 0}
                fallback={
                  <p class={boardModalSoftNoteClass}>
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
                class={boardHeaderButtonClass}
                onClick={() => toast.clearHistory()}
                disabled={toast.history().length === 0}
              >
                Clear history
              </button>
            </div>
          </div>
        </div>
      </Show>
  );
}
