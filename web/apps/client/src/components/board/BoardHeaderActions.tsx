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

export default function BoardHeaderActions() {
  const {
    toast,
    busy,
    setNotificationHistoryOpen,
    activeBoardChoice,
    summary,
    openStorePage,
    refreshBoard,
    endDay,
    boardChipClass,
    boardHeaderButtonClass,
    boardWarningButtonClass,
    boardDangerButtonClass,
    showDeveloperBoardActions,
  } = useBoard();
  return (
        <>
          <div class={style1}>
            <Show when={activeBoardChoice()?.isTeamBoard}>
              <span class={boardChipClass}>
                Team board
              </span>
            </Show>
            <Button
              type="button"
              variant="warning"
              class={boardWarningButtonClass}
              onClick={openStorePage}
              disabled={busy()}
              data-testid="board-open-store-header"
            >
              Store
            </Button>
          </div>

          <div class={style2}>
            <span class={style3} title="Coins">
              <span>🪙</span>
              <span class={style4}>{summary().inventory.coin ?? 0}</span>
            </span>
            <span class={style3} title="Paper">
              <span>📄</span>
              <span class={style4}>{summary().inventory.paper ?? 0}</span>
            </span>
            <span class={style3} title="Ink">
              <span>🖋️</span>
              <span class={style4}>{summary().inventory.ink ?? 0}</span>
            </span>
            <span class={style3} title="Gear">
              <span>⚙️</span>
              <span class={style4}>{summary().inventory.gear ?? 0}</span>
            </span>
            <span class={style3} title="Parts">
              <span>🔩</span>
              <span class={style4}>{summary().inventory.parts ?? 0}</span>
            </span>
          </div>

          <Button
            type="button"
            variant="secondary"
            class={boardHeaderButtonClass}
            onClick={() => setNotificationHistoryOpen(true)}
            data-testid="board-open-notifications"
          >
            Notifications {toast.history().length}
          </Button>
          <Show when={showDeveloperBoardActions}>
            <>
              <Button
                type="button"
                variant="danger"
                class={boardDangerButtonClass}
                onClick={() => void endDay()}
                disabled={busy()}
                data-testid="board-end-day"
              >
                End Day
              </Button>
              <Button
                type="button"
                variant="secondary"
                class={boardHeaderButtonClass}
                onClick={() => void refreshBoard()}
                disabled={busy()}
                data-testid="board-refresh"
              >
                Refresh
              </Button>
            </>
          </Show>
        </>
  );
}


const style1 = css`
display: none;
align-items: center;
gap: calc(var(--spacing) * 2);
@media (width >= 48rem) {
    display: flex;
  }
`;

const style2 = css`
display: none;
align-items: center;
gap: calc(var(--spacing) * 3);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
@media (width >= 64rem) {
    display: flex;
  }
`;

const style3 = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 1);
`;

const style4 = css`
font-variant-numeric: tabular-nums;
`;
