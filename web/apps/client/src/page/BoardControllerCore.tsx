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
} from "../features/board/board-rules";export function createBoardControllerCore() {
  const api = useApi();
  const theme = useTheme();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const isLightTheme = createMemo(() => theme.resolvedTheme() === "light");

  const [state, setState] = createSignal<BoardStateResponse | null>(null);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [busy, setBusy] = createSignal(false);

  const [composerText, setComposerText] = createSignal("");
  const [composerParsed, setComposerParsed] = createSignal<QuickAddParsed | null>(null);
  const [composerParsing, setComposerParsing] = createSignal(false);

  const [selectedStackID, setSelectedStackID] = createSignal<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = createSignal(false);
  const [detailTitle, setDetailTitle] = createSignal("");
  const [detailDescription, setDetailDescription] = createSignal("");
  const [detailPriority, setDetailPriority] = createSignal(4);
  const [detailParsed, setDetailParsed] = createSignal<QuickAddParsed | null>(null);
  const [detailParsing, setDetailParsing] = createSignal(false);

  const [inlineStackID, setInlineStackID] = createSignal<string | null>(null);
  const [inlineTitle, setInlineTitle] = createSignal("");

  const [dragState, setDragState] = createSignal<DragState | null>(null);
  const [panDragState, setPanDragState] = createSignal<PanDragState | null>(null);
  const [dragMoved, setDragMoved] = createSignal(false);
  const [mergeTargetID, setMergeTargetID] = createSignal<string | null>(null);
  const [localPositions, setLocalPositions] = createSignal<Record<string, BoardPoint>>({});
  const [clickSuppress, setClickSuppress] = createSignal<{ stackId: string; until: number } | null>(null);
  const [boardPan, setBoardPan] = createSignal<BoardPoint>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = createSignal({ width: 0, height: 0 });
  const [miningSessionsByStackID, setMiningSessionsByStackID] = createSignal<Record<string, MiningSession>>({});
  const [miningTickMs, setMiningTickMs] = createSignal(Date.now());
  const [miningCompletedCyclesByStackID, setMiningCompletedCyclesByStackID] = createSignal<Record<string, number>>({});
  const [miningPendingByStackID, setMiningPendingByStackID] = createSignal<Record<string, true>>({});
  const [deckOrderPrefs, setDeckOrderPrefs] = createSignal<string[]>([]);
  const [deckHubOpen, setDeckHubOpen] = createSignal(false);
  const [deckHubDragDefID, setDeckHubDragDefID] = createSignal<string | null>(null);
  const [mobileMapHubOpen, setMobileMapHubOpen] = createSignal(false);
  const [questClaimingID, setQuestClaimingID] = createSignal<string | null>(null);
  const [newBoardName, setNewBoardName] = createSignal("");
  const [createBoardModalOpen, setCreateBoardModalOpen] = createSignal(false);
  const [notificationHistoryOpen, setNotificationHistoryOpen] = createSignal(false);
  const [boardCrudBusy, setBoardCrudBusy] = createSignal(false);
  const [boardSelectorValue, setBoardSelectorValue] = createSignal(DEFAULT_BOARD);
  const [managedBoardID, setManagedBoardID] = createSignal(DEFAULT_BOARD);
  const [managedBoardName, setManagedBoardName] = createSignal("");
  const [teamSettings, setTeamSettings] = createSignal<TeamSettings | null>(null);
  const [boardMembers, setBoardMembers] = createSignal<BoardMember[]>([]);
  const [boardMembersLoading, setBoardMembersLoading] = createSignal(false);
  const [boardMembersBusy, setBoardMembersBusy] = createSignal(false);
  const [pendingBoardMemberID, setPendingBoardMemberID] = createSignal("");
  const [boardInviteEmail, setBoardInviteEmail] = createSignal("");
  const [exhaustedVillagerIDs, setExhaustedVillagerIDs] = createSignal<string[]>([]);
  const [exhaustedResourceAssignmentKeys, setExhaustedResourceAssignmentKeys] = createSignal<string[]>([]);

  const runtime = {
    boardRef: undefined as HTMLDivElement | undefined,
    createBoardInputRef: undefined as HTMLInputElement | undefined,
    composerParseTimer: undefined as number | undefined,
    detailParseTimer: undefined as number | undefined,
    composerParseController: undefined as AbortController | undefined,
    detailParseController: undefined as AbortController | undefined,
    composerParseRequestSeq: 0,
    detailParseRequestSeq: 0,
    lastComposerParsedText: "",
    lastDetailParsedText: "",
    hasPrimedExhaustedVillagers: false,
    syncTimer: undefined as ReturnType<typeof setInterval> | undefined,
  };

  function setBoardRef(element: HTMLDivElement) {
    runtime.boardRef = element;
  }

  function setCreateBoardInputRef(element: HTMLInputElement) {
    runtime.createBoardInputRef = element;
  }

  function resetComposerPreview() {
    runtime.composerParseRequestSeq += 1;
    runtime.composerParseController?.abort();
    runtime.composerParseController = undefined;
    runtime.lastComposerParsedText = "";
    setComposerParsed(null);
    setComposerParsing(false);
  }

  function resetDetailPreview() {
    runtime.detailParseRequestSeq += 1;
    runtime.detailParseController?.abort();
    runtime.detailParseController = undefined;
    runtime.lastDetailParsedText = "";
    setDetailParsed(null);
    setDetailParsing(false);
  }

  const activeBoardID = createMemo(() => boardIDFromSearch(location.search));
  const activeBoardProjectID = createMemo(() => boardProjectIDForBoard(activeBoardID()));
  const boardChoices = createMemo(() => boardChoicesFromProjects(projects(), activeBoardID()));
  const activeBoardChoice = createMemo(
    () => boardChoices().find((choice) => choice.boardID === activeBoardID()) ?? null,
  );
  const managedBoardChoice = createMemo(
    () => boardChoices().find((choice) => choice.boardID === managedBoardID()) ?? null,
  );
  const managedBoardProjectID = createMemo(() => boardProjectIDForBoard(managedBoardID()));
  const createBoardSlugHint = createMemo(() => {
    const boardID = boardIDFromName(newBoardName());
    if (!boardID) return "";
    if (boardID === "board") return "board";
    if (boardID.startsWith("board-")) return boardID.slice("board-".length);
    return boardID;
  });
  const teamEntitlements = createMemo(() => {
    const explicit = teamSettings()?.team.entitlements ?? [];
    const fallback = workspacePlanProfile(teamSettings()?.team.plan || "personal").entitlements;
    return explicit.length > 0 ? explicit : fallback;
  });
  const boardMemberManagementEnabled = createMemo(() => {
    return hasEntitlement(teamEntitlements(), "board_member_management");
  });
  const canManageBoardMembers = createMemo(
    () => (teamSettings()?.canManage ?? false) && boardMemberManagementEnabled(),
  );
  const canManageBoardInvites = createMemo(
    () => (teamSettings()?.canManage ?? false) && hasEntitlement(teamEntitlements(), "workspace_invites"),
  );
  const boardMemberManagementNotice = createMemo(() => {
    if ((teamSettings()?.canManage ?? false) && !boardMemberManagementEnabled()) {
      return "Board member management is frozen on Free. Upgrade to Pro to change board access.";
    }
    return "Only owners and admins can change board access.";
  });
  const currentUserID = createMemo(() => teamSettings()?.currentUserId ?? "");
  const boardMemberIDs = createMemo(() => new Set(boardMembers().map((member) => member.userId)));
  const addableBoardMembers = createMemo(() => {
    const settings = teamSettings();
    if (!settings) return [] as TeamMember[];
    const existing = boardMemberIDs();
    return settings.members.filter((member) => !existing.has(member.userId));
  });
  const pendingTeamInvitesByEmail = createMemo(() => {
    const index = new Map<string, string>();
    for (const invitation of teamSettings()?.invitations ?? []) {
      index.set(invitation.email.trim().toLowerCase(), invitation.status);
    }
    return index;
  });

  createTrackedEffect(() => {
    setBoardSelectorValue(activeBoardID());
  });

  createTrackedEffect(() => {
    writeStoredBoardSelection(activeBoardID());
  });

  createTrackedEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("board")) return;
    const storedBoardID = readStoredBoardSelection();
    if (storedBoardID === DEFAULT_BOARD || storedBoardID === activeBoardID()) return;
    navigate(boardHref(storedBoardID), { replace: true });
  });

  return {
    state,
    setState,
    projects,
    setProjects,
    error,
    setError,
    loading,
    setLoading,
    busy,
    setBusy,
    composerText,
    setComposerText,
    composerParsed,
    setComposerParsed,
    composerParsing,
    setComposerParsing,
    selectedStackID,
    setSelectedStackID,
    isDetailOpen,
    setIsDetailOpen,
    detailTitle,
    setDetailTitle,
    detailDescription,
    setDetailDescription,
    detailPriority,
    setDetailPriority,
    detailParsed,
    setDetailParsed,
    detailParsing,
    setDetailParsing,
    inlineStackID,
    setInlineStackID,
    inlineTitle,
    setInlineTitle,
    dragState,
    setDragState,
    panDragState,
    setPanDragState,
    dragMoved,
    setDragMoved,
    mergeTargetID,
    setMergeTargetID,
    localPositions,
    setLocalPositions,
    clickSuppress,
    setClickSuppress,
    boardPan,
    setBoardPan,
    viewportSize,
    setViewportSize,
    miningSessionsByStackID,
    setMiningSessionsByStackID,
    miningTickMs,
    setMiningTickMs,
    miningCompletedCyclesByStackID,
    setMiningCompletedCyclesByStackID,
    miningPendingByStackID,
    setMiningPendingByStackID,
    deckOrderPrefs,
    setDeckOrderPrefs,
    deckHubOpen,
    setDeckHubOpen,
    deckHubDragDefID,
    setDeckHubDragDefID,
    mobileMapHubOpen,
    setMobileMapHubOpen,
    questClaimingID,
    setQuestClaimingID,
    newBoardName,
    setNewBoardName,
    createBoardModalOpen,
    setCreateBoardModalOpen,
    notificationHistoryOpen,
    setNotificationHistoryOpen,
    boardCrudBusy,
    setBoardCrudBusy,
    boardSelectorValue,
    setBoardSelectorValue,
    managedBoardID,
    setManagedBoardID,
    managedBoardName,
    setManagedBoardName,
    teamSettings,
    setTeamSettings,
    boardMembers,
    setBoardMembers,
    boardMembersLoading,
    setBoardMembersLoading,
    boardMembersBusy,
    setBoardMembersBusy,
    pendingBoardMemberID,
    setPendingBoardMemberID,
    boardInviteEmail,
    setBoardInviteEmail,
    exhaustedVillagerIDs,
    setExhaustedVillagerIDs,
    exhaustedResourceAssignmentKeys,
    setExhaustedResourceAssignmentKeys,
    api,
    theme,
    toast,
    location,
    navigate,
    isLightTheme,
    runtime,
    setBoardRef,
    setCreateBoardInputRef,
    activeBoardID,
    activeBoardProjectID,
    boardChoices,
    activeBoardChoice,
    managedBoardChoice,
    managedBoardProjectID,
    createBoardSlugHint,
    teamEntitlements,
    boardMemberManagementEnabled,
    canManageBoardMembers,
    canManageBoardInvites,
    boardMemberManagementNotice,
    currentUserID,
    boardMemberIDs,
    addableBoardMembers,
    pendingTeamInvitesByEmail,
    resetComposerPreview,
    resetDetailPreview,
  };
}

export type BoardControllerCoreContext = ReturnType<typeof createBoardControllerCore>;
