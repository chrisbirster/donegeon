import Button from "../Button";
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
          class={` ${style1} ${boardModalBackdropClass()}`}
          onClick={() => setNotificationHistoryOpen(false)}
        >
          <div
            class={style2}
            onClick={(event) => event.stopPropagation()}
            data-testid="board-notification-history"
          >
            <div class={style3}>
              <div>
                <p class={style4}>Recent Notifications</p>
                <p class={style5}>Recent board alerts and status messages for this session.</p>
              </div>
              <Button
                type="button"
                class={boardHeaderButtonClass}
                onClick={() => setNotificationHistoryOpen(false)}
              >
                Close
              </Button>
            </div>

            <div class={style6} data-testid="board-notification-history-list">
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
                    <article class={` ${style7} ${notificationToneClass(entry.tone)}`}>
                      <div class={style8}>
                        <div class={style9}>
                          <p class={style10}>
                            {notificationToneLabel(entry.tone)}
                          </p>
                          <p class={style11}>{entry.message}</p>
                        </div>
                        <span class={style12}>{formatNotificationTime(entry.createdAt)}</span>
                      </div>
                    </article>
                  )}
                </For>
              </Show>
            </div>

            <div class={style13}>
              <Button
                type="button"
                class={boardHeaderButtonClass}
                onClick={() => toast.clearHistory()}
                disabled={toast.history().length === 0}
              >
                Clear history
              </Button>
            </div>
          </div>
        </div>
      </Show>
  );
}


const style1 = css`
position: fixed;
inset: calc(var(--spacing) * 0);
z-index: 78;
display: flex;
align-items: center;
justify-content: center;
padding: calc(var(--spacing) * 3);
--tw-backdrop-blur: blur(var(--blur-sm));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
@media (width >= 48rem) {
    padding: calc(var(--spacing) * 4);
  }
`;

const style2 = css`
width: 100%;
max-width: var(--container-lg);
border-radius: 28px;
padding: calc(var(--spacing) * 4);
background: linear-gradient(180deg, var(--panel-strong-start), var(--panel-strong-end)); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style3 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

const style4 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

const style5 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style6 = css`
margin-top: calc(var(--spacing) * 4);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style7 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
--tw-shadow: 0 12px 28px var(--tw-shadow-color, rgba(0,0,0,0.25));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style8 = css`
display: flex;
align-items: flex-start;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

const style9 = css`
min-width: calc(var(--spacing) * 0);
`;

const style10 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
text-transform: uppercase;
opacity: 80%;
`;

const style11 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: var(--leading-snug);
  line-height: var(--leading-snug);
`;

const style12 = css`
flex-shrink: 0;
font-size: 11px;
opacity: 75%;
`;

const style13 = css`
margin-top: calc(var(--spacing) * 4);
display: flex;
justify-content: flex-end;
`;
