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
} from "../features/board/board-rules";import type { BoardControllerLifecycleContext } from "./BoardControllerLifecycle";

export function createBoardControllerSync(context: BoardControllerLifecycleContext) {
  const {
    setState,
    setError,
    loading,
    setLoading,
    setComposerText,
    setSelectedStackID,
    setIsDetailOpen,
    setInlineStackID,
    setInlineTitle,
    setDeckHubOpen,
    setDeckHubDragDefID,
    setMobileMapHubOpen,
    createBoardModalOpen,
    setBoardMembers,
    isLightTheme,
    runtime,
    activeBoardID,
    boardChoices,
    resetComposerPreview,
    resetDetailPreview,
    loadBoardMembers,
    loadBoard,
  } = context;

  // Periodic background sync — reconcile with server every 2 minutes.
  const SYNC_INTERVAL_MS = 2 * 60 * 1000;
  let syncTimer: ReturnType<typeof setInterval> | undefined;

  onSettled(() => {
    runtime.syncTimer = setInterval(() => {
      void loadBoard({ syncTasks: false });
    }, SYNC_INTERVAL_MS);
  });

  createTrackedEffect(() => {
    const boardID = activeBoardID();
    setError("");
    setSelectedStackID(null);
    setIsDetailOpen(false);
    if (runtime.detailParseTimer !== undefined) {
      window.clearTimeout(runtime.detailParseTimer);
      runtime.detailParseTimer = undefined;
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

  createTrackedEffect(() => {
    if (!createBoardModalOpen()) return;
    window.setTimeout(() => runtime.createBoardInputRef?.focus(), 0);
  });

  const boardSelectorFieldClass = style1;
  const boardChipClass =
    style2;
  const boardSidebarClass =
    style3;
  const boardSidebarSectionClass = style4;
  const boardSidebarHeadingClass = style5;
  const boardSidebarCardClass = style6;
  const boardPerkChipClass =
    style7;
  const boardHeaderButtonClass =
    style8;
  const boardWarningButtonClass =
    style9;
  const boardDangerButtonClass =
    style10;
  const boardModalPanelClass =
    style11;
  const boardModalBackdropClass = () => boardModalBackdrop;
  const boardModalBodyClass = style12;
  const boardModalSubpanelClass = style13;
  const boardModalHeaderBarClass =
    style14;
  const boardModalFooterBarClass =
    style15;
  const boardModalSectionLabelClass = style16;
  const boardModalTextareaClass =
    style17;
  const boardModalSoftNoteClass =
    style18;
  const boardModalWarningNoteClass =
    style19;
  const boardModalChipClass =
    style20;
  const boardModalPrimaryTagClass =
    style21;
  const boardModalAccentTagClass =
    style22;
  const boardModalPriorityButtonClass = (selected: boolean) =>
    selected ? boardPrioritySelected : boardPriorityButton;
  const showDeveloperBoardActions = BOARD_DEV_CONTROLS_ENABLED;
  const boardMapToggleClass = () => boardMapToggle;
  const boardMapPanelClass = () => boardMapPanel;
  const boardMapTitleClass = () => boardMapTitle;
  const boardMapStatusClass = (hasOffscreen: boolean) => hasOffscreen ? boardMapWarning : boardMapStatus;
  const boardMinimapSurfaceClass = () => boardMinimapSurface;
  const boardMinimapGridClass = () => boardMinimapGrid;
  const boardMinimapViewportClass = () => boardMinimapViewport;
  const deckHubBackdropClass = () => deckHubBackdrop;
  const deckHubPanelClass = () => deckHubPanel;
  const deckHubTitleClass = () => deckHubTitle;
  const deckHubTextClass = () => deckHubText;
  const deckHubCloseClass = () => deckHubClose;
  const deckHubSectionTitleClass = () => deckHubSectionTitle;
  const deckHubSectionMetaClass = () => deckHubSectionMeta;
  const deckHubRowZoneClass = () => deckHubRowZone;
  const deckHubReserveZoneClass = () => deckHubReserveZone;
  const boardCanvasClass = () => boardCanvas;
  const boardGridOverlayClass = () => boardGridOverlay;
  const boardCanvasFadeClass = () => boardCanvasFade;

  const renderBoardSelectorOptions = () => (
    <For each={boardChoices()}>
      {(choice) => (
        <option value={choice.boardID}>
          {choice.name}
          {choice.isTeamBoard ? " (Team)" : ""}
        </option>
      )}
    </For>
  );  return {
    SYNC_INTERVAL_MS,
    syncTimer,
    boardSelectorFieldClass,
    boardChipClass,
    boardSidebarClass,
    boardSidebarSectionClass,
    boardSidebarHeadingClass,
    boardSidebarCardClass,
    boardPerkChipClass,
    boardHeaderButtonClass,
    boardWarningButtonClass,
    boardDangerButtonClass,
    boardModalPanelClass,
    boardModalBackdropClass,
    boardModalBodyClass,
    boardModalSubpanelClass,
    boardModalHeaderBarClass,
    boardModalFooterBarClass,
    boardModalSectionLabelClass,
    boardModalTextareaClass,
    boardModalSoftNoteClass,
    boardModalWarningNoteClass,
    boardModalChipClass,
    boardModalPrimaryTagClass,
    boardModalAccentTagClass,
    boardModalPriorityButtonClass,
    showDeveloperBoardActions,
    boardMapToggleClass,
    boardMapPanelClass,
    boardMapTitleClass,
    boardMapStatusClass,
    boardMinimapSurfaceClass,
    boardMinimapGridClass,
    boardMinimapViewportClass,
    deckHubBackdropClass,
    deckHubPanelClass,
    deckHubTitleClass,
    deckHubTextClass,
    deckHubCloseClass,
    deckHubSectionTitleClass,
    deckHubSectionMetaClass,
    deckHubRowZoneClass,
    deckHubReserveZoneClass,
    boardCanvasClass,
    boardGridOverlayClass,
    boardCanvasFadeClass,
    renderBoardSelectorOptions,
  };
}

export type BoardControllerSyncContext = BoardControllerLifecycleContext & ReturnType<typeof createBoardControllerSync>;
const boardModalBackdrop = css`background: var(--palette-rgba-3-6-13-86-9ae547);`;
const boardPriorityButton = css`border: 1px solid var(--border-strong); border-radius: 6px; padding: .6rem .8rem; background: var(--palette-hex-101522-c8c204); color: var(--text-main); font-weight: 700;`;
const boardPrioritySelected = css`border: 1px solid var(--palette-hex-ff8a00-51eaff); border-radius: 6px; padding: .6rem .8rem; background: var(--palette-hex-17121a-3144d2); color: var(--palette-hex-ffb13b-a8378a); font-weight: 700; box-shadow: 0 0 16px var(--palette-rgba-255-138-0-25-7df6dc);`;
const boardMapToggle = css`position: absolute; right: .75rem; top: .75rem; z-index: 40; border: 1px solid var(--palette-hex-ff2072-43b6fd); border-radius: 5px; background: var(--palette-rgba-8-11-20-94-abfb7b); color: var(--palette-hex-fff-d14f90); padding: .35rem .6rem; font: 700 12px 'Bebas Neue', sans-serif; letter-spacing: .12em; text-transform: uppercase; box-shadow: 0 0 18px var(--palette-rgba-255-32-114-24-6d44f3); @media (min-width: 768px) { display: none; }`;
const boardMapPanel = css`pointer-events: auto; border: 1px solid var(--palette-hex-ff2072-43b6fd); border-radius: 9px; padding: .75rem; background: var(--palette-rgba-6-10-20-94-781211); box-shadow: 0 0 0 1px var(--palette-rgba-0-224-255-1-6b2429) inset, 0 16px 40px var(--palette-rgba-0-0-0-6-b597da), 0 0 22px var(--palette-rgba-255-32-114-16-1a6f05); backdrop-filter: blur(8px);`;
const boardMapTitle = css`color: var(--palette-hex-fff2dc-c2092d); font: 700 15px 'Bebas Neue', sans-serif; letter-spacing: .1em; text-transform: uppercase;`;
const boardMapStatus = css`color: var(--palette-hex-8ea0bc-39e74b);`;
const boardMapWarning = css`color: var(--palette-hex-ffb13b-a8378a);`;
const boardMinimapSurface = css`position: relative; width: 220px; height: 144px; overflow: hidden; cursor: crosshair; border: 1px solid var(--palette-hex-00e0ff-93d32f); border-radius: 6px; background: radial-gradient(circle at 30% 0%, var(--palette-rgba-138-43-226-28-c4bbdb), transparent 48%), var(--palette-hex-07111f-f0ecda); box-shadow: 0 0 16px var(--palette-rgba-0-224-255-14-3b917d) inset;`;
const boardMinimapGrid = css`pointer-events: none; position: absolute; inset: 0; opacity: .6; background-size: 15px 15px; background-image: linear-gradient(var(--palette-rgba-96-126-160-13-fdd4a4) 1px, transparent 1px), linear-gradient(90deg, var(--palette-rgba-96-126-160-13-fdd4a4) 1px, transparent 1px);`;
const boardMinimapViewport = css`pointer-events: none; position: absolute; border: 1px solid var(--palette-hex-ff2072-43b6fd); border-radius: 2px; background: var(--palette-rgba-255-32-114-1-740ffb); box-shadow: 0 0 8px var(--palette-rgba-255-32-114-5-0f2a9d);`;
const deckHubBackdrop = css`position: absolute; inset: 0; z-index: 50; background: var(--palette-rgba-2-4-10-64-bc3ab9); backdrop-filter: blur(2px);`;
const deckHubPanel = css`position: absolute; right: .75rem; top: .75rem; width: min(460px, calc(100% - 1.5rem)); border: 1px solid var(--palette-hex-ff2072-43b6fd); border-radius: 10px; padding: .9rem; background: var(--palette-rgba-7-11-21-98-69daaf); box-shadow: 0 20px 60px var(--palette-rgba-0-0-0-72-551182), 0 0 24px var(--palette-rgba-138-43-226-18-600419);`;
const deckHubTitle = css`color: var(--palette-hex-fff2dc-c2092d); font: 700 24px 'Bebas Neue', sans-serif; letter-spacing: .08em; text-transform: uppercase;`;
const deckHubText = css`color: var(--palette-hex-9aabc5-e99449);`;
const deckHubClose = css`border: 1px solid var(--palette-hex-8a2be2-2dbd0f); border-radius: 5px; padding: .3rem .55rem; color: var(--palette-hex-fff-d14f90); background: var(--palette-hex-101522-c8c204); &:hover { border-color: var(--palette-hex-ff2072-43b6fd); box-shadow: 0 0 12px var(--palette-rgba-255-32-114-25-6a3217); }`;
const deckHubSectionTitle = css`color: var(--palette-hex-c8d4e8-a8be71); font: 700 14px 'Bebas Neue', sans-serif; letter-spacing: .08em; text-transform: uppercase;`;
const deckHubSectionMeta = css`color: var(--palette-hex-7487a4-ac1fef);`;
const deckHubRowZone = css`margin-top: .25rem; padding: .55rem; border: 1px solid var(--palette-hex-284c68-c99c87); border-radius: 7px; background: var(--palette-rgba-8-30-44-82-cc286e); & > * + * { margin-top: .25rem; }`;
const deckHubReserveZone = css`margin-top: .25rem; padding: .55rem; border: 1px solid var(--palette-hex-4a2d63-b1209b); border-radius: 7px; background: var(--palette-rgba-25-14-39-82-28280a); & > * + * { margin-top: .25rem; }`;
const boardCanvas = css`position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: none; background-color: var(--palette-hex-050914-9ed8f3); background-image: radial-gradient(circle at 50% 25%, var(--palette-rgba-16-31-52-24-9e483c), transparent 52%), url('/images/donegeon-board-city.png'); background-position: center; background-size: cover;`;
const boardGridOverlay = css`pointer-events: none; position: absolute; inset: 0; opacity: .38; background-size: 24px 24px; background-image: linear-gradient(var(--palette-rgba-80-112-145-13-04dfb7) 1px, transparent 1px), linear-gradient(90deg, var(--palette-rgba-80-112-145-13-04dfb7) 1px, transparent 1px), radial-gradient(circle at center, transparent 40%, var(--palette-rgba-0-0-0-48-c5c38f) 100%);`;
const boardCanvasFade = css`pointer-events: none; position: absolute; left: 0; right: 0; bottom: 0; z-index: 0; height: 170px; background: linear-gradient(to top, var(--palette-rgba-3-5-12-78-4b8c61), transparent);`;
const style1 = css`
border-radius: var(--radius-md);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

const style2 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 2.5);
padding-block: calc(var(--spacing) * 0.5);
font-size: 11px;
color: var(--text-soft);
`;

const style3 = css`
height: 100%;
flex-direction: column;
overflow-y: auto;
border-right-style: var(--tw-border-style);
  border-right-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-strong-start);
color: var(--text-main);
@media (width >= 48rem) {
    display: flex;
  }
`;

const style4 = css`
border-bottom-style: var(--tw-border-style);
  border-bottom-width: 1px;
border-color: var(--border-strong);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
background: linear-gradient(180deg, var(--palette-rgba-8-13-24-92-fd8363), var(--palette-rgba-5-9-17-88-2392b7));
box-shadow: inset -1px 0 var(--palette-rgba-255-32-114-08-dd7e73);
`;

const style5 = css`
font-family: "Permanent Marker", cursive;
font-size: .95rem;
line-height: 1.1;
letter-spacing: .035em;
color: var(--palette-hex-ff4d89-16af87);
text-shadow: 0 0 9px var(--palette-rgba-255-32-114-3-b072eb);
text-transform: uppercase;
`;

const style6 = css`
border-radius: 7px;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
background: linear-gradient(145deg, var(--palette-rgba-8-14-25-96-8b8a7a), var(--palette-rgba-5-9-17-92-a8fc70)); border: 1px solid var(--palette-rgba-255-32-114-42-b4c3f2); box-shadow: inset 0 0 20px var(--palette-rgba-0-0-0-32-78ad00); backdrop-filter: blur(12px);
`;

const style7 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
font-size: 10px;
--tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
color: var(--text-soft);
`;

const style8 = css`
border-radius: var(--radius-md);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
&:disabled {
    opacity: 60%;
  }
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

const style9 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-rgba-223-173-87-0-24-4ece10);
background-color: var(--warning-bg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--warning);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:disabled {
    opacity: 60%;
  }
`;

const style10 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-rgba-196-98-91-0-28-437088);
background-color: var(--danger-bg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--danger);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:disabled {
    opacity: 60%;
  }
`;

const style11 = css`
width: 100%;
max-width: var(--container-6xl);
border-radius: 28px;
padding: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    padding: calc(var(--spacing) * 5);
  }
background: linear-gradient(180deg, var(--panel-strong-start), var(--panel-strong-end)); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style12 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel);
`;

const style13 = css`
border-radius: var(--radius-2xl);
padding: calc(var(--spacing) * 4);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

const style14 = css`
position: sticky;
top: calc(var(--spacing) * 0);
z-index: 10;
display: flex;
align-items: center;
justify-content: space-between;
border-bottom-style: var(--tw-border-style);
  border-bottom-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-overlay);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 4);
--tw-backdrop-blur: blur(var(--blur-sm));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
`;

const style15 = css`
position: sticky;
bottom: calc(var(--spacing) * 0);
display: flex;
align-items: center;
justify-content: space-between;
border-top-style: var(--tw-border-style);
  border-top-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-overlay);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 4);
--tw-backdrop-blur: blur(var(--blur-sm));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
`;

const style16 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.2em;
  letter-spacing: 0.2em;
color: var(--text-dim);
text-transform: uppercase;
`;

const style17 = css`
width: 100%;
resize: none;
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
color: var(--text-main);
--tw-outline-style: none;
  outline-style: none;
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

const style18 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style19 = css`
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-rgba-223-173-87-0-24-4ece10);
background-color: var(--warning-bg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--warning);
`;

const style20 = css`
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
font-size: 11px;
color: var(--text-main);
`;

const style21 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-rgba-103-187-255-0-28-51e811);
background-color: var(--palette-rgba-103-187-255-0-14-b92a76);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
color: var(--text-main);
`;

const style22 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--palette-rgba-255-139-80-0-28-f7bbb1);
background-color: var(--accent-wash);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
color: var(--accent-text);
`;
