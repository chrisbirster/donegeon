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
} from "../features/board/board-rules";export function createBoardController() {
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

  let boardRef: HTMLDivElement | undefined;
  let createBoardInputRef: HTMLInputElement | undefined;

  function setBoardRef(element: HTMLDivElement) {
    boardRef = element;
  }

  function setCreateBoardInputRef(element: HTMLInputElement) {
    createBoardInputRef = element;
  }
  let composerParseTimer: number | undefined;
  let detailParseTimer: number | undefined;
  let composerParseController: AbortController | undefined;
  let detailParseController: AbortController | undefined;
  let composerParseRequestSeq = 0;
  let detailParseRequestSeq = 0;
  let lastComposerParsedText = "";
  let lastDetailParsedText = "";
  let hasPrimedExhaustedVillagers = false;

  function resetComposerPreview() {
    composerParseRequestSeq += 1;
    composerParseController?.abort();
    composerParseController = undefined;
    lastComposerParsedText = "";
    setComposerParsed(null);
    setComposerParsing(false);
  }

  function resetDetailPreview() {
    detailParseRequestSeq += 1;
    detailParseController?.abort();
    detailParseController = undefined;
    lastDetailParsedText = "";
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

    const rect = boardRef?.getBoundingClientRect();
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
    const width = viewport.width > 0 ? viewport.width : boardRef?.clientWidth ?? 0;
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

  const selectedStack = createMemo(() => {
    const id = selectedStackID();
    if (!id) return null;
    return state()?.stacks[id] ?? null;
  });

  const selectedTaskCard = createMemo(() => taskCardFromStack(selectedStack(), state()));

  const selectedCard = createMemo(() => cardFromStack(selectedStack(), state()));
  const questState = createMemo(() => state()?.meta?.quests);
  const activeQuests = createMemo(() => questState()?.active ?? []);
  const progressionLevels = createMemo<BoardProgressionLevel[]>(() => state()?.meta?.progression?.levels ?? []);
  const progressionPerkMap = createMemo(() => {
    const entries = new Map<string, { label: string; summary: string }>();
    for (const level of progressionLevels()) {
      for (const perk of level.perks ?? []) {
        const perkID = dataString(perk.id);
        if (!perkID) continue;
        entries.set(perkID, {
          label: dataString(perk.label) || humanizeToken(perkID.replace(/^perk[_-]?/i, "")),
          summary: dataString(perk.summary),
        });
      }
    }
    return entries;
  });

  function villagerPerkLabel(perkID: string): string {
    const trimmed = perkID.trim();
    if (!trimmed) return "";
    return progressionPerkMap().get(trimmed)?.label || humanizeToken(trimmed.replace(/^perk[_-]?/i, ""));
  }

  const summary = createMemo<BoardSummary>(() => {
    const current = state();
    if (!current) {
      return {
        villagerCount: 0,
        zombieCount: 0,
        activeTaskCount: 0,
        deckCount: 0,
        completedCount: 0,
        dayTicks: 0,
        inventory: {},
      };
    }

    let villagerCount = 0;
    let zombieCount = 0;
    let activeTaskCount = 0;
    let deckCount = 0;

    for (const stack of Object.values(current.stacks)) {
      if (!stack || stack.cards.length === 0) continue;

      let hasTask = false;
      let hasVillager = false;
      let hasZombie = false;

      for (const cardID of stack.cards) {
        const card = current.cards[cardID];
        if (!card) continue;
        const kind = cardKind(card.defId);
        if (kind === "task") hasTask = true;
        if (kind === "villager") hasVillager = true;
        if (kind === "zombie") hasZombie = true;
      }

      const top = cardFromStack(stack, current);
      if (top && isDeckDef(top.defId)) {
        deckCount += 1;
      }
      if (hasTask) activeTaskCount += 1;
      if (hasVillager) villagerCount += 1;
      if (hasZombie) zombieCount += 1;
    }

    return {
      villagerCount,
      zombieCount,
      activeTaskCount,
      deckCount,
      completedCount: current.meta?.metrics?.tasks_completed ?? 0,
      dayTicks: current.meta?.metrics?.day_ticks ?? 0,
      inventory: current.meta?.inventory ?? {},
    };
  });

  const villagerStatuses = createMemo(() => {
    const current = state();
    if (!current) return [] as VillagerStatus[];

    const byID = new Map<string, VillagerStatus>();
    for (const stack of Object.values(current.stacks)) {
      const status = villagerStatusForStack(stack, current);
      if (!status) continue;
      if (!byID.has(status.villagerID)) {
        byID.set(status.villagerID, status);
      }
    }

    return [...byID.values()].sort((a, b) => a.name.localeCompare(b.name));
  });

  createTrackedEffect(() => {
    activeBoardID();
    hasPrimedExhaustedVillagers = false;
    setExhaustedVillagerIDs([]);
    setExhaustedResourceAssignmentKeys([]);
    setNotificationHistoryOpen(false);
  });

  createTrackedEffect(() => {
    const currentState = state();
    if (!currentState) {
      hasPrimedExhaustedVillagers = false;
      setExhaustedVillagerIDs([]);
      setExhaustedResourceAssignmentKeys([]);
      return;
    }

    const statuses = villagerStatuses();
    const nextExhausted = statuses.filter((status) => status.stamina <= 0);
    const previous = new Set(exhaustedVillagerIDs());
    const previousAssignments = new Set(exhaustedResourceAssignmentKeys());
    const nextAssignments: string[] = [];

    for (const stack of Object.values(currentState.stacks)) {
      const status = villagerStatusForStack(stack, currentState);
      if (!status || status.stamina > 0 || !stackHasKind(stack, "resource")) continue;
      const assignmentKey = `${status.villagerID}:${stack.id}`;
      nextAssignments.push(assignmentKey);
      if (hasPrimedExhaustedVillagers && !previousAssignments.has(assignmentKey) && previous.has(status.villagerID)) {
        toast.error(`${status.name} is assigned but out of stamina.`, 4800);
      }
    }

    if (hasPrimedExhaustedVillagers) {
      for (const status of nextExhausted) {
        if (previous.has(status.villagerID)) continue;
        toast.error(`${status.name} ran out of stamina.`, 4800);
      }
    } else {
      hasPrimedExhaustedVillagers = true;
    }

    const nextExhaustedIDs = nextExhausted.map((status) => status.villagerID);
    if (!sameStringArray(exhaustedVillagerIDs(), nextExhaustedIDs)) {
      setExhaustedVillagerIDs(nextExhaustedIDs);
    }
    if (!sameStringArray(exhaustedResourceAssignmentKeys(), nextAssignments)) {
      setExhaustedResourceAssignmentKeys(nextAssignments);
    }
  });

  const composerTokens = createMemo(() => tokenizeQuickAdd(composerText()));

  const composerChips = createMemo(() => {
    const parsed = composerParsed();
    if (!parsed) return [] as string[];

    const chips: string[] = [];

    const project = addChip("board", "Project");
    if (project) chips.push(project);

    for (const label of parsed.labels) {
      chips.push(`Label: ${label}`);
    }

    const assignee = addChip(parsed.assignee, "Assignee");
    if (assignee) chips.push(assignee);
    if (parsed.priority) chips.push(`Priority: p${parsed.priority}`);
    const dueText = addChip(formatScheduleDateTime(parsed.dueText), "Due");
    if (dueText) chips.push(dueText);
    const deadline = addChip(formatScheduleDateTime(parsed.deadline), "Deadline");
    if (deadline) chips.push(deadline);
    const recurrence = addChip(parsed.recurrenceRule, "Recurrence");
    if (recurrence) chips.push(recurrence);

    return chips;
  });

  const composerGuidance = createMemo(() => {
    const parsed = composerParsed();
    if (!parsed || !parsed.recurrenceRule) return "";
    if (parsed.dueText || parsed.deadline) return "";
    return "Recurrence sets cadence only. Add due text and/or {deadline} for schedule details.";
  });

  const selectedModifierCards = createMemo(() => {
    const stack = selectedStack();
    const current = state();
    if (!stack || !current) return [] as BoardCard[];

    const cards: BoardCard[] = [];
    for (const cardID of stack.cards) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (card.defId.startsWith("mod.")) {
        cards.push(card);
      }
    }
    return cards;
  });

  const recurringModifierEnabled = createMemo(() =>
    selectedModifierCards().some((card) => card.defId === "mod.recurring"),
  );
  const deadlineModifierEnabled = createMemo(() =>
    selectedModifierCards().some((card) => card.defId === "mod.deadline_pin"),
  );

  const detailParsedChips = createMemo(() => {
    const parsed = detailParsed();
    if (!parsed) return [] as string[];

    const chips: string[] = [];
    if (recurringModifierEnabled() && parsed.recurrenceRule) {
      chips.push(`Recurrence: ${parsed.recurrenceRule}`);
    }
    if (deadlineModifierEnabled() && parsed.dueText) {
      chips.push(`Due: ${formatScheduleDateTime(parsed.dueText) ?? parsed.dueText}`);
    }
    if (deadlineModifierEnabled() && parsed.deadline) {
      chips.push(`Deadline: ${formatScheduleDateTime(parsed.deadline) ?? parsed.deadline}`);
    }
    return chips;
  });

  const detailModifierHints = createMemo(() => {
    const parsed = detailParsed();
    if (!parsed) return [] as string[];

    const hints: string[] = [];
    if (!!parsed.recurrenceRule && !recurringModifierEnabled()) {
      hints.push("Recurrence phrase detected. Add Mod Recurring to parse recurrence.");
    }
    if ((!!parsed.dueText || !!parsed.deadline) && !deadlineModifierEnabled()) {
      hints.push("Due/deadline phrase detected. Add Mod Deadline Pin to parse due/deadline.");
    }
    return hints;
  });

  const detailScheduleInput = createMemo(() => dataString(selectedTaskCard()?.data?.scheduleInput));
  const detailStoredDue = createMemo(() => dataString(selectedTaskCard()?.data?.dueText));
  const detailStoredDeadline = createMemo(() => dataString(selectedTaskCard()?.data?.dueDeadline));
  const detailPreviewInput = createMemo(() => {
    const currentTitle = detailTitle().trim();
    const storedTitle = dataString(selectedTaskCard()?.data?.title).trim();
    const storedRaw = detailScheduleInput().trim();
    if (storedRaw && currentTitle === storedTitle) {
      return storedRaw;
    }
    return currentTitle;
  });
  const detailTokens = createMemo(() => tokenizeQuickAdd(detailPreviewInput()));
  const detailDueInputToken = createMemo(() => scheduleTokenFromInput(detailScheduleInput(), "due"));
  const detailDeadlineInputToken = createMemo(() => scheduleTokenFromInput(detailScheduleInput(), "deadline"));
  const detailVisibleLabels = createMemo(() =>
    mergeNormalizedLabels(
      dataStringArray(selectedTaskCard()?.data?.labels).filter((label) => !hasBoardLiveLabel([label])),
      extractQuickAddLabels(detailTitle()),
    ).filter((label) => !hasBoardLiveLabel([label])),
  );
  const detailScheduleWarning = createMemo(() =>
    scheduleValidationWarning(detailStoredDue(), detailStoredDeadline()),
  );

  createTrackedEffect(() => {
    const candidates = addableBoardMembers();
    const selected = pendingBoardMemberID();
    if (candidates.length === 0) {
      if (selected) setPendingBoardMemberID("");
      return;
    }
    if (!selected || !candidates.some((member) => member.userId === selected)) {
      setPendingBoardMemberID(candidates[0].userId);
    }
  });

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
    if (!boardRef) return { x: clientX, y: clientY };
    const rect = boardRef.getBoundingClientRect();
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

  function topDefID(stack: BoardStack | null): string {
    const top = cardFromStack(stack, state());
    if (!top) return "";
    return top.defId;
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

  function stackHasKind(stack: BoardStack | null, kind: string): boolean {
    const current = state();
    if (!current || !stack) return false;
    const normalized = kind.trim().toLowerCase();
    if (!normalized) return false;

    for (const cardID of stack.cards) {
      const card = current.cards[cardID];
      if (!card) continue;
      if (cardKind(card.defId).toLowerCase() === normalized) {
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

  createTrackedEffect(() => {
    const prefs = deckOrderPrefs();
    if (typeof window === "undefined") return;
    try {
      if (prefs.length === 0) {
        window.localStorage.removeItem(DECK_ROW_PREFS_KEY);
      } else {
        window.localStorage.setItem(DECK_ROW_PREFS_KEY, JSON.stringify(prefs));
      }
    } catch {
      // Ignore localStorage write errors.
    }
  });

  createTrackedEffect(() => {
    if (deckOverflowDefIDs().length === 0 && deckHubOpen()) {
      setDeckHubOpen(false);
    }
  });

  const minimapModel = createMemo(() => {
    const viewport = viewportSize();
    const viewportWidth = viewport.width > 0 ? viewport.width : boardRef?.clientWidth ?? 0;
    const viewportHeight = viewport.height > 0 ? viewport.height : boardRef?.clientHeight ?? 0;
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
    if (isExhausted) return "bg-[#f87171] shadow-[0_0_8px_rgba(248,113,113,0.9)]";
    if (isNextAction) return "bg-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.9)]";
    switch (kind) {
      case "task":
        return "bg-[#f39aa0]";
      case "villager":
        return "bg-[#f3cc8c]";
      case "zombie":
        return "bg-[#c98697]";
      case "resource":
        return "bg-[#9ece92]";
      case "food":
        return "bg-[#ebb06c]";
      case "deck":
        return "bg-[#b5c2d9]";
      default:
        return "bg-[#96a5bf]";
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

  async function listAllTasks(limit = 100): Promise<Task[]> {
    const items: Task[] = [];
    let cursor = 0;

    for (let page = 0; page < 100; page += 1) {
      const response = await api.tasks.list({ limit, cursor });
      items.push(...response.items);
      if (response.nextCursor === undefined || response.nextCursor === null || response.nextCursor <= cursor) {
        break;
      }
      cursor = response.nextCursor;
    }

    return items;
  }

  function taskIDsOnBoard(snapshot: BoardStateResponse | null): Set<string> {
    const ids = new Set<string>();
    if (!snapshot) return ids;

    for (const stack of Object.values(snapshot.stacks)) {
      if (!stack) continue;
      for (const cardID of stack.cards) {
        const card = snapshot.cards[cardID];
        if (!card || cardKind(card.defId) !== "task") continue;
        const taskID = dataString(card.data?.taskId);
        if (taskID) {
          ids.add(taskID);
        }
      }
    }

    return ids;
  }

  async function syncBoardProjectTasks(snapshot: BoardStateResponse | null, boardID: string): Promise<boolean> {
    if (!snapshot) return false;

    const openBoardTasks = (await listAllTasks()).filter(
      (task) =>
        !task.checked &&
        !task.isDeleted &&
        matchesBoardProject(task.projectId, boardID) &&
        hasBoardLiveLabel(task.labels),
    );
    if (openBoardTasks.length === 0) return false;

    const existingTaskIDs = taskIDsOnBoard(snapshot);
    const missing = openBoardTasks.filter((task) => !existingTaskIDs.has(task.id));
    if (missing.length === 0) return false;

    const rect = boardRef?.getBoundingClientRect();
    const pan = boardPan();
    const baseX = rect ? Math.round(rect.width / 2 - CARD_WIDTH / 2 - pan.x) : 260;
    const baseY = rect ? Math.round(rect.height / 3 - CARD_HEIGHT / 2 - pan.y) : 160;

    for (let index = 0; index < missing.length; index += 1) {
      const spawnPoint = snapBoardPoint({
        x: baseX + (index % 6) * 26,
        y: baseY + Math.floor(index / 6) * 32,
      });
      try {
        await sendCommand(
          {
            cmd: "task.spawn_existing",
            args: {
              x: spawnPoint.x,
              y: spawnPoint.y,
              taskId: missing[index].id,
            },
          },
          { refresh: false },
        );
      } catch (err) {
        const message = (err as Error).message.toLowerCase();
        if (message.includes("already on the board")) {
          continue;
        }
        throw err;
      }
    }

    return true;
  }

  async function loadProjects() {
    try {
      const response = await api.projects.list();
      setProjects(response.items);
    } catch {
      // Ignore transient project list errors on board view.
    }
  }

  async function loadTeamSettings() {
    try {
      const response = await api.team.getSettings();
      setTeamSettings(response.settings);
    } catch {
      // Ignore transient team settings errors on board view.
    }
  }

  async function loadBoardMembers(boardID = activeBoardID()) {
    setBoardMembersLoading(true);
    try {
      const response = await api.board.listMembers(boardID);
      setBoardMembers(response.members);
    } catch (err) {
      setBoardMembers([]);
      setError((err as Error).message);
    } finally {
      setBoardMembersLoading(false);
    }
  }

  async function addPendingBoardMember(boardID = managedBoardID()) {
    const userID = pendingBoardMemberID().trim();
    if (!userID) {
      toast.info("Select a team member to add.");
      return;
    }
    setBoardMembersBusy(true);
    try {
      await api.board.addMember(userID, boardID);
      await loadBoardMembers(boardID);
      setError("");
      setPendingBoardMemberID("");
      toast.success("Member added to board.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setBoardMembersBusy(false);
    }
  }

  async function removeBoardMember(userID: string, boardID = managedBoardID()) {
    const targetID = userID.trim();
    if (!targetID || targetID === currentUserID()) {
      toast.info("You cannot remove yourself from this board.");
      return;
    }
    setBoardMembersBusy(true);
    try {
      await api.board.removeMember(targetID, boardID);
      await loadBoardMembers(boardID);
      setError("");
      toast.info("Member removed from board.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setBoardMembersBusy(false);
    }
  }

  function setManagedBoard(boardID: string) {
    const normalized = normalizeBoardID(boardID);
    const choice = boardChoices().find((item) => item.boardID === normalized);
    setManagedBoardID(normalized);
    setManagedBoardName(choice?.name || "");
    setPendingBoardMemberID("");
    setBoardInviteEmail("");
    void loadBoardMembers(normalized);
  }

  function handleBoardSelectorInput(nextBoardID: string) {
    const normalized = normalizeBoardID(nextBoardID);
    setBoardSelectorValue(normalized);
    switchBoard(normalized);
  }

  function switchBoard(nextBoardID: string) {
    const normalized = normalizeBoardID(nextBoardID);
    if (normalized === activeBoardID()) return;
    writeStoredBoardSelection(normalized);
    setState(null); // Reset so the loading spinner shows for the new board.
    navigate(boardHref(normalized));
  }

  function openStorePage() {
    navigate(boardStoreHref(activeBoardID()));
  }

  async function createBoard(): Promise<boolean> {
    const rawName = newBoardName().trim();
    if (!rawName) {
      const message = "Board name is required.";
      setError(message);
      toast.error(message);
      return false;
    }
    const boardID = boardIDFromName(rawName);
    if (!boardID) {
      const message = 'Board name must include letters or numbers and cannot be just "board".';
      setError(message);
      toast.error(message);
      return false;
    }
    if (boardChoices().some((choice) => choice.boardID === boardID)) {
      const message = "A board with that name already exists.";
      setError(message);
      toast.error(message);
      return false;
    }

    setBoardCrudBusy(true);
    try {
      await api.projects.create({
        id: boardProjectIDForBoard(boardID),
        name: rawName,
      });
      setNewBoardName("");
      await loadProjects();
      setManagedBoard(boardID);
      switchBoard(boardID);
      setError("");
      toast.success(`Board "${rawName}" created.`);
      return true;
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setBoardCrudBusy(false);
    }
  }

  async function deleteBoard(boardID: string) {
    const normalized = normalizeBoardID(boardID);
    if (normalized === DEFAULT_BOARD) {
      const message = "The default board cannot be deleted.";
      setError(message);
      toast.error(message);
      return false;
    }
    const choice = boardChoices().find((item) => item.boardID === normalized);
    const boardName = choice?.name || boardProjectIDForBoard(normalized);
    const ok = window.confirm(`Delete "${boardName}"? This removes the board from your project list.`);
    if (!ok) return false;

    setBoardCrudBusy(true);
    try {
      await api.projects.remove(boardProjectIDForBoard(normalized));
      await loadProjects();
      if (activeBoardID() === normalized) {
        switchBoard(DEFAULT_BOARD);
      }
      const nextManagedBoard = activeBoardID() === normalized ? DEFAULT_BOARD : activeBoardID();
      setManagedBoard(nextManagedBoard);
      setError("");
      toast.info(`Board "${boardName}" deleted.`);
      return true;
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setBoardCrudBusy(false);
    }
  }

  function openCreateBoardModal() {
    setNewBoardName("");
    setBoardSelectorValue(activeBoardID());
    setManagedBoard(activeBoardID());
    setCreateBoardModalOpen(true);
  }

  function closeCreateBoardModal() {
    if (boardCrudBusy()) return;
    setBoardSelectorValue(activeBoardID());
    setCreateBoardModalOpen(false);
  }

  async function submitCreateBoardFromModal() {
    await createBoard();
  }

  async function renameManagedBoard() {
    const choice = managedBoardChoice();
    if (!choice) return;
    const nextName = managedBoardName().trim();
    if (!nextName) {
      const message = "Board name is required.";
      setError(message);
      toast.error(message);
      return;
    }
    if (nextName === choice.name) {
      toast.info("Board name is unchanged.");
      return;
    }

    setBoardCrudBusy(true);
    try {
      await api.projects.update(managedBoardProjectID(), { name: nextName });
      await loadProjects();
      setManagedBoardName(nextName);
      setError("");
      toast.success(`Board renamed to "${nextName}".`);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setBoardCrudBusy(false);
    }
  }

  async function inviteBoardMembersByEmail() {
    const boardID = managedBoardID();
    const emails = parseEmailEntries(boardInviteEmail());
    if (emails.length === 0) {
      toast.info("Enter at least one email.");
      return;
    }

    const settings = teamSettings();
    if (!settings) {
      toast.error("Team settings are not available yet.");
      return;
    }

    setBoardMembersBusy(true);
    try {
      let addedCount = 0;
      let invitedCount = 0;
      let alreadyCount = 0;

      for (const email of emails) {
        const existingMember = settings.members.find((member) => member.email.trim().toLowerCase() === email);
        if (existingMember) {
          if (boardMemberIDs().has(existingMember.userId)) {
            alreadyCount += 1;
            continue;
          }
          await api.board.addMember(existingMember.userId, boardID);
          addedCount += 1;
          continue;
        }

        if (pendingTeamInvitesByEmail().has(email)) {
          alreadyCount += 1;
          continue;
        }

        if (!canManageBoardInvites()) {
          throw new Error("Invite by email requires team invite access on this workspace.");
        }

        await api.team.invite(email, "editor");
        invitedCount += 1;
      }

      await loadTeamSettings();
      await loadBoardMembers(boardID);
      setBoardInviteEmail("");
      setError("");

      if (addedCount > 0 && invitedCount > 0) {
        toast.success(`Added ${addedCount} board member(s) and sent ${invitedCount} team invite(s).`);
      } else if (addedCount > 0) {
        toast.success(`Added ${addedCount} member(s) to this board.`);
      } else if (invitedCount > 0) {
        toast.success(`Sent ${invitedCount} team invite(s). Add them to this board after they accept.`);
      } else if (alreadyCount > 0) {
        toast.info("Those people already have access or already have pending invitations.");
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setBoardMembersBusy(false);
    }
  }

  async function toggleManagedBoardMember(member: TeamMember, enabled: boolean) {
    if (enabled) {
      setPendingBoardMemberID(member.userId);
      await addPendingBoardMember(managedBoardID());
      return;
    }
    await removeBoardMember(member.userId, managedBoardID());
  }

  async function loadBoard(options: { syncTasks?: boolean; boardID?: string; silent?: boolean } = {}) {
    const syncTasks = options.syncTasks ?? false;
    const boardID = normalizeBoardID(options.boardID ?? activeBoardID());
    // Only show full loading spinner on initial load (state is null).
    // Subsequent refreshes update silently to avoid hiding the board.
    // Use untrack to avoid making this a reactive dependency (would cause
    // infinite loops when called from createEffect).
    const silent = options.silent ?? (untrack(() => state()) !== null);
    if (!silent) setLoading(true);
    try {
      let response = await api.board.getState(boardID);
      if (Object.keys(response.stacks ?? {}).length === 0) {
        try {
          await api.board.command(
            {
              cmd: "board.seed_default",
              args: {},
              clientVersion: response.version,
            },
            boardID,
          );
        } catch (err) {
          const apiError = err as ApiError;
          const message = apiError.message.toLowerCase();
          if (apiError.status !== 409 && !message.includes("already_initialized")) {
            throw err;
          }
        }
        response = await api.board.getState(boardID);
      }
      setState(response);
      let syncError = "";

      if (syncTasks) {
        try {
          const changed = await syncBoardProjectTasks(response, boardID);
          if (changed) {
            response = await api.board.getState(boardID);
            setState(response);
          }
        } catch (err) {
          syncError = (err as Error).message;
        }
      }

      if (syncError) {
        setError(syncError);
      } else {
        setError("");
      }
      // Persist to IndexedDB for instant load next time.
      void setCachedBoardState(boardID, response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function sendCommand(
    payload: BoardCommandPayload,
    options: { refresh?: boolean; retryConflict?: boolean; boardID?: string } = {},
  ) {
    const refresh = options.refresh ?? true;
    const retryConflict = options.retryConflict ?? true;
    const boardID = normalizeBoardID(options.boardID ?? activeBoardID());

    setBusy(true);
    try {
      const response = await api.board.command(
        {
          ...payload,
          clientVersion: state()?.version,
        },
        boardID,
      );

      setState((current) => (current ? { ...current, version: response.newVersion } : current));

      if (refresh) {
        await loadBoard({ boardID });
      }
      return response;
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 409 && retryConflict) {
        await loadBoard({ boardID });
        return sendCommand(payload, { refresh, retryConflict: false, boardID });
      }
      setError(apiError.message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function refreshBoard() {
    await loadProjects();
    await loadBoardMembers(activeBoardID());
    await loadBoard({ syncTasks: true });
  }

  async function endDay() {
    try {
      await sendCommand({ cmd: "world.end_day", args: {} });
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function claimQuestReward(questID: string) {
    const trimmed = questID.trim();
    if (!trimmed) return;
    setQuestClaimingID(trimmed);
    try {
      await sendCommand({ cmd: "quest.claim_reward", args: { questId: trimmed } });
      setError("");
    } catch {
      // Error state is set in sendCommand.
    } finally {
      setQuestClaimingID(null);
    }
  }

  function onComposerInput(value: string) {
    setComposerText(value);

    if (composerParseTimer !== undefined) {
      window.clearTimeout(composerParseTimer);
      composerParseTimer = undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      resetComposerPreview();
      return;
    }

    composerParseTimer = window.setTimeout(async () => {
      if (trimmed === lastComposerParsedText) return;
      lastComposerParsedText = trimmed;
      composerParseRequestSeq += 1;
      const requestSeq = composerParseRequestSeq;
      composerParseController?.abort();
      const controller = new AbortController();
      composerParseController = controller;
      setComposerParsing(true);
      try {
        const parsed = await api.parse.quickAdd(ensureBoardProjectToken(trimmed, activeBoardProjectID()), {
          signal: controller.signal,
        });
        if (requestSeq !== composerParseRequestSeq) return;
        setComposerParsed(parsed.parsed);
      } catch (err) {
        if (isAbortError(err) || requestSeq !== composerParseRequestSeq) return;
        setComposerParsed(null);
      } finally {
        if (requestSeq === composerParseRequestSeq) {
          composerParseController = undefined;
          setComposerParsing(false);
        }
      }
    }, 325);
  }

  function queueDetailParse(value: string) {
    if (detailParseTimer !== undefined) {
      window.clearTimeout(detailParseTimer);
      detailParseTimer = undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      resetDetailPreview();
      return;
    }

    detailParseTimer = window.setTimeout(async () => {
      if (trimmed === lastDetailParsedText) return;
      lastDetailParsedText = trimmed;
      detailParseRequestSeq += 1;
      const requestSeq = detailParseRequestSeq;
      detailParseController?.abort();
      const controller = new AbortController();
      detailParseController = controller;
      setDetailParsing(true);
      try {
        const parsed = await api.parse.quickAdd(trimmed, { signal: controller.signal });
        if (requestSeq !== detailParseRequestSeq) return;
        setDetailParsed(parsed.parsed);
      } catch (err) {
        if (isAbortError(err) || requestSeq !== detailParseRequestSeq) return;
        setDetailParsed(null);
      } finally {
        if (requestSeq === detailParseRequestSeq) {
          detailParseController = undefined;
          setDetailParsing(false);
        }
      }
    }, 325);
  }

  function onDetailTitleInput(value: string) {
    setDetailTitle(value);
    queueDetailParse(value);
  }

  async function parseTaskTitleInput(value: string): Promise<QuickAddParsed | null> {
    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      return null;
    }

    const parsed = await api.parse.quickAdd(trimmed);
    return parsed.parsed;
  }

  function hasParsedSchedule(parsed: QuickAddParsed | null): boolean {
    return !!(parsed?.recurrenceRule || parsed?.dueText || parsed?.deadline);
  }

  async function createTaskStack() {
    const text = composerText().trim();
    if (!text) return;

    const boardID = activeBoardID();
    const boardProjectID = boardProjectIDForBoard(boardID);
    const normalizedQuickAdd = ensureBoardProjectToken(text, boardProjectID);

    const rect = boardRef?.getBoundingClientRect();
    const pan = boardPan();
    const spawnPoint = snapBoardPoint({
      x: rect ? Math.round(rect.width / 2 - CARD_WIDTH / 2 - pan.x) : 260,
      y: rect ? Math.round(rect.height / 2 - CARD_HEIGHT / 2 - pan.y) : 180,
    });

    try {
      const created = await api.tasks.quickAdd(normalizedQuickAdd);
      if (!matchesBoardProject(created.task.projectId, boardID)) {
        await api.tasks.update(created.task.id, { projectId: boardProjectID });
      }

      await sendCommand({
        cmd: "task.spawn_existing",
        args: {
          x: spawnPoint.x,
          y: spawnPoint.y,
          taskId: created.task.id,
          countAsCreated: true,
        },
      });

      setComposerText("");
      resetComposerPreview();
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function openDetail(stackID: string) {
    const stack = state()?.stacks[stackID];
    if (!stack) return;

    const card = cardFromStack(stack, state());
    if (!card || cardKind(card.defId) !== "task") return;

    setSelectedStackID(stackID);
    const title = titleFromCard(card);
    setDetailTitle(title);
    setDetailDescription(descriptionFromCard(card));
    const priority = dataNumber(card.data?.priority);
    setDetailPriority(priority && priority >= 1 && priority <= 4 ? priority : 4);
    queueDetailParse(dataString(card.data?.scheduleInput).trim() || title);
    setIsDetailOpen(true);
  }

  function closeDetail() {
    setIsDetailOpen(false);
    if (detailParseTimer !== undefined) {
      window.clearTimeout(detailParseTimer);
      detailParseTimer = undefined;
    }
    resetDetailPreview();
  }

  function openInTaskPage() {
    navigate(`/task/project/${encodeURIComponent(activeBoardProjectID())}`);
    closeDetail();
  }

  async function saveDetail() {
    const stack = selectedStack();
    const taskCard = selectedTaskCard();
    if (!stack || !taskCard) {
      setError("Selected stack does not include a task card.");
      return;
    }

    try {
      const recurrenceEnabled = recurringModifierEnabled();
      const deadlineEnabled = deadlineModifierEnabled();
      const rawInput = detailPreviewInput().trim();
      const parsed = await parseTaskTitleInput(rawInput);
      if (rawInput && parsed && !parsed.content.trim()) {
        setError("Task title cannot be empty");
        return;
      }
      let normalizedTitle = (parsed?.content ?? rawInput).trim();
      const normalizedDescription = (parsed?.description || detailDescription()).trim();
      let normalizedContent = normalizedTitle || "Untitled task";

      let recurrenceRule: string | undefined;
      let scheduleInput: string | undefined;
      let dueText: string | undefined;
      let dueDeadline: string | undefined;

      if ((recurrenceEnabled || deadlineEnabled) && parsed) {
        const parsedRecurrence = parsed.recurrenceRule;
        const parsedDueText = parsed.dueText;
        const parsedDeadline = parsed.deadline;

        const recurrenceParsed = !!parsedRecurrence;
        const deadlineParsed = !!parsedDueText || !!parsedDeadline;

        if (recurrenceEnabled && parsedRecurrence) {
          recurrenceRule = parsedRecurrence;
        }
        if (deadlineEnabled) {
          dueText = parsedDueText;
          dueDeadline = parsedDeadline;
        }

        if ((recurrenceEnabled && recurrenceParsed) || (deadlineEnabled && deadlineParsed)) {
          scheduleInput = rawInput;
        }
      }

      let taskID = dataString(taskCard.data?.taskId);
      if (!taskID) {
        const created = await api.tasks.create(normalizedContent);
        taskID = created.id;

        await sendCommand(
          {
            cmd: "task.set_task_id",
            args: {
              taskCardId: taskCard.id,
              taskId: taskID,
            },
          },
          { refresh: false },
        );
      }

      await sendCommand(
        {
          cmd: "task.set_title",
          args: {
            taskCardId: taskCard.id,
            title: normalizedTitle,
          },
        },
        { refresh: false },
      );

      await sendCommand(
        {
          cmd: "task.set_description",
          args: {
            taskCardId: taskCard.id,
            description: normalizedDescription,
          },
        },
        { refresh: false },
      );

      await sendCommand(
        {
          cmd: "task.set_priority",
          args: {
            taskCardId: taskCard.id,
            priority: parsed?.priority ?? detailPriority(),
          },
        },
        { refresh: false },
      );

      await api.tasks.update(taskID, {
        content: normalizedContent,
        description: normalizedDescription,
        priority: parsed?.priority ?? detailPriority(),
        projectId: activeBoardProjectID(),
        labels: mergeNormalizedLabels(dataStringArray(taskCard.data?.labels), parsed?.labels),
        recurrenceRule,
        scheduleInput: hasParsedSchedule(parsed) && (recurrenceEnabled || deadlineEnabled) ? scheduleInput : undefined,
        dueText,
        dueDeadline,
      });

      await sendCommand(
        {
          cmd: "task.sync_from_task",
          args: {
            taskCardId: taskCard.id,
          },
        },
        { refresh: false },
      );

      await loadBoard({ syncTasks: false });

      closeDetail();
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function completeStack(stackID: string) {
    try {
      const result = await sendCommand({
        cmd: "task.complete_stack",
        args: { stackId: stackID },
      });
      if (selectedStackID() === stackID) {
        closeDetail();
      }
      setInlineStackID(null);
      setInlineTitle("");
      setError("");
      toast.success(taskCompletionToastMessage(result.patch));
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function removeStack(stackID: string) {
    try {
      await sendCommand({
        cmd: "stack.remove",
        args: { stackId: stackID },
      });
      if (selectedStackID() === stackID) {
        closeDetail();
      }
      setInlineStackID(null);
      setInlineTitle("");
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  function startInlineEdit(stackID: string) {
    const stack = state()?.stacks[stackID];
    if (!stack) return;
    const card = taskCardFromStack(stack, state());
    if (!card) {
      setError("Only task cards can be renamed inline.");
      return;
    }
    setInlineStackID(stackID);
    setInlineTitle(titleFromCard(card));
    setError("");
  }

  function cancelInlineEdit() {
    setInlineStackID(null);
    setInlineTitle("");
  }

  async function saveInlineEdit() {
    const stackID = inlineStackID();
    if (!stackID) return;

    const stack = state()?.stacks[stackID];
    if (!stack) return;

    const taskCard = taskCardFromStack(stack, state());
    if (!taskCard) return;

    try {
      await sendCommand({
        cmd: "task.set_title",
        args: {
          taskCardId: taskCard.id,
          title: inlineTitle().trim(),
        },
      });
      cancelInlineEdit();
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function activateDeckOrPack(stack: BoardStack) {
    const top = cardFromStack(stack, state());
    if (!top) return;

    if (isDeckDef(top.defId)) {
      if (top.defId === "deck.collect") {
        return;
      }
      const pos = stackPosition(stack);
      const spawnPoint = snapBoardPoint({
        x: pos.x + CARD_WIDTH + 26,
        y: Math.max(24, pos.y - 130),
      });
      try {
        await sendCommand({
          cmd: "deck.spawn_pack",
          args: {
            deckStackId: stack.id,
            x: spawnPoint.x,
            y: spawnPoint.y,
          },
        });
      } catch {
        // Error state is set in sendCommand.
      }
      return;
    }

    if (isPackDef(top.defId)) {
      try {
        await sendCommand({
          cmd: "deck.open_pack",
          args: {
            packStackId: stack.id,
            deckId: packDeckID(top),
          },
        });
      } catch {
        // Error state is set in sendCommand.
      }
    }
  }

  function isDeckLikeStack(stack: BoardStack): boolean {
    const top = cardFromStack(stack, state());
    return !!top && isDeckDef(top.defId);
  }

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
    if (!boardRef) return;

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

  onSettled(() => {
    void loadProjects();
    void loadTeamSettings();

    try {
      const raw = window.localStorage.getItem(DECK_ROW_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const prefs = parsed
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0);
          setDeckOrderPrefs(prefs);
        }
      }
    } catch {
      // Ignore malformed local preferences.
    }

    const syncViewport = () => {
      setViewportSize({
        width: boardRef?.clientWidth ?? 0,
        height: boardRef?.clientHeight ?? 0,
      });
    };

    syncViewport();
    const miningTickTimer = window.setInterval(() => setMiningTickMs(Date.now()), 120);

    let resizeObserver: ResizeObserver | undefined;
    if (boardRef && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => syncViewport());
      resizeObserver.observe(boardRef!);
    }
    window.addEventListener("resize", syncViewport);

    const onPointerMove = (event: PointerEvent) => {
      const panDrag = panDragState();
      if (panDrag && event.pointerId === panDrag.pointerId) {
        setBoardPan({
          x: Math.round(panDrag.startPanX + (event.clientX - panDrag.startClientX)),
          y: Math.round(panDrag.startPanY + (event.clientY - panDrag.startClientY)),
        });
        return;
      }

      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId || !boardRef) return;

      const pointerWorld = worldFromClient(event.clientX, event.clientY);
      const snapped = snapBoardPoint({
        x: Math.round(pointerWorld.x - drag.offsetX),
        y: Math.round(pointerWorld.y - drag.offsetY),
      });

      setLocalPositions((current) => ({
        ...current,
        [drag.stackId]: snapped,
      }));

      if (Math.abs(snapped.x - drag.startX) > 3 || Math.abs(snapped.y - drag.startY) > 3) {
        setDragMoved(true);
      }

      setMergeTargetID(resolveMergeTarget(drag.stackId, snapped, drag.draggedCount));
    };

    const onPointerUp = (event: PointerEvent) => {
      const panDrag = panDragState();
      if (panDrag && event.pointerId === panDrag.pointerId) {
        setPanDragState(null);
        return;
      }

      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId) return;

      const finalPos = localPositions()[drag.stackId] ?? {
        x: drag.startX,
        y: drag.startY,
      };
      const targetID = mergeTargetID();
      const moved = dragMoved();

      setDragState(null);
      setMergeTargetID(null);

      const sourceStack = state()?.stacks[drag.stackId] ?? null;
      const sourceDef = topDefID(sourceStack);
      const draggedSourceCardIDs =
        drag.mode === "split" && sourceStack
          ? splitCardIDs(sourceStack.cards, drag.splitIndex).dragged
          : (sourceStack?.cards ?? []);

      if (drag.mode === "split") {
        if (!moved) {
          clearLocalPosition(drag.stackId);

          if (sourceStack && sourceDef && isPackDef(sourceDef)) {
            suppressStackClick(drag.stackId);
            void activateDeckOrPack(sourceStack);
            return;
          }

          if (sourceDef && cardKind(sourceDef) === "task") {
            openDetail(drag.stackId);
          }
          return;
        }

        suppressStackClick(drag.stackId);
        void (async () => {
          try {
            const splitResult = await sendCommand(
              {
                cmd: "stack.split",
                args: {
                  stackId: drag.stackId,
                  index: drag.splitIndex,
                  newX: finalPos.x,
                  newY: finalPos.y,
                  offsetX: 0,
                  offsetY: 0,
                },
              },
              { refresh: false },
            );

            const splitPatch = (splitResult?.patch ?? null) as
              | {
                  source?: BoardStack;
                  newStack?: BoardStack;
                }
              | null;
            let newStackID = "";

            setState((current) => {
              if (!current) return current;

              const nextStacks = { ...current.stacks };

              if (splitPatch?.source) {
                if (splitPatch.source.cards.length > 0) {
                  nextStacks[splitPatch.source.id] = splitPatch.source;
                } else {
                  delete nextStacks[splitPatch.source.id];
                }
              }

              if (splitPatch?.newStack) {
                nextStacks[splitPatch.newStack.id] = splitPatch.newStack;
                newStackID = splitPatch.newStack.id;
              }

              return {
                ...current,
                stacks: nextStacks,
                version: splitResult?.newVersion ?? current.version,
              };
            });

            if (!newStackID) {
              await loadBoard();
              return;
            }

            if (targetID && targetID !== drag.stackId) {
              const targetStack = state()?.stacks[targetID] ?? null;
              const targetDef = topDefID(targetStack);
              const newStack = state()?.stacks[newStackID] ?? null;
              const newStackCardIDs = newStack?.cards ?? [];

              if (targetStack && canMergeDraggedCardsIntoTarget(targetStack, newStackCardIDs) && isCollectDeck(targetStack)) {
                // Optimistic: remove the newly-split stack before collecting.
                setState((current) => {
                  if (!current) return current;
                  const nextStacks = { ...current.stacks };
                  delete nextStacks[newStackID];
                  return { ...current, stacks: nextStacks };
                });
                await sendCommand({
                  cmd: "loot.collect_stack",
                  args: { stackId: newStackID },
                });
                return;
              }

              if (targetStack && canMergeDraggedCardsIntoTarget(targetStack, newStackCardIDs) && (!targetDef || cardKind(targetDef) !== "deck")) {
                // Optimistic: merge new stack cards into target.
                setState((current) => {
                  if (!current) return current;
                  const src = current.stacks[newStackID];
                  const tgt = current.stacks[targetID];
                  if (!src || !tgt) return current;
                  const nextStacks = { ...current.stacks };
                  nextStacks[targetID] = { ...tgt, cards: [...tgt.cards, ...src.cards] };
                  delete nextStacks[newStackID];
                  return { ...current, stacks: nextStacks };
                });
                await sendCommand({
                  cmd: "stack.merge",
                  args: { targetId: targetID, sourceId: newStackID },
                });
              }
            }
          } catch {
            // Error state is set in sendCommand.
          } finally {
            clearLocalPosition(drag.stackId);
          }
        })();
        return;
      }

      if (targetID && targetID !== drag.stackId) {
        const targetStack = state()?.stacks[targetID] ?? null;
        const targetDef = topDefID(targetStack);
        const canMergeIntoTarget = canMergeDraggedCardsIntoTarget(targetStack, draggedSourceCardIDs);

        if (targetStack && canMergeIntoTarget && isCollectDeck(targetStack) && sourceDef && !isDeckDef(sourceDef) && !isPackDef(sourceDef)) {
          suppressStackClick(drag.stackId);
          // Optimistic: remove source stack so the card doesn't flash back.
          setState((current) => {
            if (!current) return current;
            const nextStacks = { ...current.stacks };
            delete nextStacks[drag.stackId];
            return { ...current, stacks: nextStacks };
          });
          clearLocalPosition(drag.stackId);
          void sendCommand({
            cmd: "loot.collect_stack",
            args: { stackId: drag.stackId },
          });
          return;
        }

        if (!canMergeIntoTarget || (sourceDef && targetDef && (cardKind(sourceDef) === "deck" || cardKind(targetDef) === "deck"))) {
          if (!moved) {
            clearLocalPosition(drag.stackId);
            return;
          }
        } else {
          suppressStackClick(drag.stackId);
          // Optimistic: move cards from source into target so the card
          // doesn't flash back to the source position while the server
          // processes the merge.
          setState((current) => {
            if (!current) return current;
            const src = current.stacks[drag.stackId];
            const tgt = current.stacks[targetID];
            if (!src || !tgt) return current;
            const nextStacks = { ...current.stacks };
            nextStacks[targetID] = { ...tgt, cards: [...tgt.cards, ...src.cards] };
            delete nextStacks[drag.stackId];
            return { ...current, stacks: nextStacks };
          });
          clearLocalPosition(drag.stackId);
          void sendCommand({
            cmd: "stack.merge",
            args: { targetId: targetID, sourceId: drag.stackId },
          });
          return;
        }
      }

      if (moved) {
        suppressStackClick(drag.stackId);
        void (async () => {
          try {
            const result = await sendCommand(
              {
                cmd: "stack.move",
                args: {
                  stackId: drag.stackId,
                  x: finalPos.x,
                  y: finalPos.y,
                },
              },
              { refresh: false },
            );

            setState((current) => {
              if (!current) return current;
              const existing = current.stacks[drag.stackId];
              if (!existing) return current;

              let z = existing.z;
              const patch = result?.patch as { stack?: { z?: number } } | undefined;
              if (patch?.stack && typeof patch.stack.z === "number") {
                z = patch.stack.z;
              }

              return {
                ...current,
                stacks: {
                  ...current.stacks,
                  [drag.stackId]: {
                    ...existing,
                    pos: { x: finalPos.x, y: finalPos.y },
                    z,
                  },
                },
                version: result?.newVersion ?? current.version,
              };
            });
          } catch {
            // Error state is set in sendCommand.
          } finally {
            clearLocalPosition(drag.stackId);
          }
        })();
        return;
      }

      clearLocalPosition(drag.stackId);

      if (sourceStack && sourceDef && isPackDef(sourceDef)) {
        suppressStackClick(drag.stackId);
        void activateDeckOrPack(sourceStack);
        return;
      }

      if (sourceDef && cardKind(sourceDef) === "task") {
        openDetail(drag.stackId);
      }
    };

    const onPointerCancel = (event: PointerEvent) => {
      const panDrag = panDragState();
      if (panDrag && event.pointerId === panDrag.pointerId) {
        setPanDragState(null);
      }

      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId) return;

      setDragState(null);
      setDragMoved(false);
      setMergeTargetID(null);
      clearLocalPosition(drag.stackId);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);

    return () => {
      window.clearInterval(miningTickTimer);
      if (syncTimer) window.clearInterval(syncTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("resize", syncViewport);
      resizeObserver?.disconnect();
      if (composerParseTimer !== undefined) {
        window.clearTimeout(composerParseTimer);
      }
      if (detailParseTimer !== undefined) {
        window.clearTimeout(detailParseTimer);
      }
      composerParseController?.abort();
      detailParseController?.abort();
    };
  });

  // Periodic background sync — reconcile with server every 2 minutes.
  const SYNC_INTERVAL_MS = 2 * 60 * 1000;
  let syncTimer: ReturnType<typeof setInterval> | undefined;

  onSettled(() => {
    syncTimer = setInterval(() => {
      void loadBoard({ syncTasks: false });
    }, SYNC_INTERVAL_MS);
  });

  createTrackedEffect(() => {
    const boardID = activeBoardID();
    setError("");
    setSelectedStackID(null);
    setIsDetailOpen(false);
    if (detailParseTimer !== undefined) {
      window.clearTimeout(detailParseTimer);
      detailParseTimer = undefined;
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
    window.setTimeout(() => createBoardInputRef?.focus(), 0);
  });

  const boardSelectorFieldClass = "app-input-surface rounded-md px-2 py-1.5 text-sm text-[var(--text-main)]";
  const boardChipClass =
    "rounded-full border border-[var(--border-strong)] bg-[var(--panel-soft)] px-2.5 py-0.5 text-[11px] text-[var(--text-soft)]";
  const boardSidebarClass =
    "hidden h-full flex-col overflow-y-auto border-r border-[var(--border-strong)] bg-[var(--panel-strong-start)] text-[var(--text-main)] md:flex";
  const boardSidebarSectionClass = "border-b border-[var(--border-strong)] px-4 py-3";
  const boardSidebarHeadingClass = "text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-dim)]";
  const boardSidebarCardClass = "app-panel-soft rounded-xl px-3 py-3";
  const boardPerkChipClass =
    "rounded-full border border-[var(--border-strong)] bg-[var(--panel)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-soft)]";
  const boardHeaderButtonClass =
    "app-button-secondary rounded-md px-3 py-1 text-xs font-semibold text-[var(--text-main)] disabled:opacity-60";
  const boardWarningButtonClass =
    "rounded-md border border-[rgba(223,173,87,0.24)] bg-[var(--warning-bg)] px-3 py-1 text-xs font-semibold text-[var(--warning)] transition disabled:opacity-60";
  const boardDangerButtonClass =
    "rounded-md border border-[rgba(196,98,91,0.28)] bg-[var(--danger-bg)] px-3 py-1 text-xs font-semibold text-[var(--danger)] transition disabled:opacity-60";
  const boardModalPanelClass =
    "app-panel-strong w-full max-w-6xl rounded-[28px] p-4 md:p-5";
  const boardModalBackdropClass = () =>
    isLightTheme()
      ? "bg-[rgba(241,247,252,0.78)]"
      : "bg-[rgba(5,7,15,0.84)]";
  const boardModalBodyClass = "rounded-2xl border border-[var(--border-strong)] bg-[var(--panel)]";
  const boardModalSubpanelClass = "app-panel-soft rounded-2xl p-4";
  const boardModalHeaderBarClass =
    "sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-strong)] bg-[var(--panel-overlay)] px-5 py-4 backdrop-blur-sm";
  const boardModalFooterBarClass =
    "sticky bottom-0 flex items-center justify-between border-t border-[var(--border-strong)] bg-[var(--panel-overlay)] px-5 py-4 backdrop-blur-sm";
  const boardModalSectionLabelClass = "text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-dim)]";
  const boardModalTextareaClass =
    "app-input-surface w-full resize-none rounded-xl px-3 py-2 text-[var(--text-main)] outline-none";
  const boardModalSoftNoteClass =
    "rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--text-soft)]";
  const boardModalWarningNoteClass =
    "rounded-xl border border-[rgba(223,173,87,0.24)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]";
  const boardModalChipClass =
    "rounded-md border border-[var(--border-strong)] bg-[var(--panel-soft)] px-2 py-0.5 text-[11px] text-[var(--text-main)]";
  const boardModalPrimaryTagClass =
    "rounded-lg border border-[rgba(103,187,255,0.28)] bg-[rgba(103,187,255,0.14)] px-3 py-1 text-lg text-[var(--text-main)]";
  const boardModalAccentTagClass =
    "rounded-lg border border-[rgba(255,139,80,0.28)] bg-[var(--accent-wash)] px-3 py-1 text-lg text-[var(--accent-text)]";
  const boardModalPriorityButtonClass = (selected: boolean) =>
    selected
      ? "rounded-lg border border-[rgba(255,139,80,0.3)] bg-[var(--accent-wash)] px-3 py-2 text-base font-semibold text-[var(--text-main)] transition"
      : "app-button-secondary rounded-lg px-3 py-2 text-base font-semibold";
  const showDeveloperBoardActions = BOARD_DEV_CONTROLS_ENABLED;
  const boardMapToggleClass = () =>
    isLightTheme()
      ? "absolute right-3 top-3 z-40 rounded-md border border-[var(--border-strong)] bg-[rgba(255,255,255,0.94)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-main)] shadow-[0_12px_28px_rgba(56,88,124,0.16)] md:hidden"
      : "absolute right-3 top-3 z-40 rounded-md border border-[#3d5273] bg-[#0b1321]/92 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#cfd9ee] shadow-[0_10px_26px_rgba(0,0,0,0.38)] md:hidden";
  const boardMapPanelClass = () =>
    isLightTheme()
      ? "pointer-events-auto rounded-xl border border-[var(--border-strong)] bg-[rgba(255,255,255,0.95)] p-3 shadow-[0_16px_40px_rgba(56,88,124,0.16)] backdrop-blur-sm"
      : "pointer-events-auto rounded-xl border border-[#334665] bg-[#0b1321]/94 p-3 shadow-[0_14px_34px_rgba(0,0,0,0.45)] backdrop-blur-sm";
  const boardMapTitleClass = () => (isLightTheme() ? "text-[var(--text-main)]" : "text-[#cfd9ee]");
  const boardMapStatusClass = (hasOffscreen: boolean) =>
    hasOffscreen
      ? isLightTheme()
        ? "text-[var(--warning)]"
        : "text-[#f9c76f]"
      : isLightTheme()
        ? "text-[var(--text-soft)]"
        : "text-[#8fa2c6]";
  const boardMinimapSurfaceClass = () =>
    isLightTheme()
      ? "relative h-[144px] w-[220px] cursor-crosshair overflow-hidden rounded-lg border border-[rgba(82,111,145,0.3)] bg-[radial-gradient(circle_at_20%_0%,rgba(136,190,235,0.42),rgba(240,246,252,0.96))]"
      : "relative h-[144px] w-[220px] cursor-crosshair overflow-hidden rounded-lg border border-[#415779] bg-[radial-gradient(circle_at_20%_0%,rgba(60,85,125,0.28),rgba(8,14,24,0.95))]";
  const boardMinimapGridClass = () =>
    isLightTheme()
      ? "pointer-events-none absolute inset-0 opacity-60 [background-size:12px_12px] [background-image:radial-gradient(circle_at_1px_1px,rgba(87,118,150,0.28)_1px,transparent_1.2px)]"
      : "pointer-events-none absolute inset-0 opacity-45 [background-size:12px_12px] [background-image:radial-gradient(circle_at_1px_1px,rgba(188,201,230,0.35)_1px,transparent_1.2px)]";
  const boardMinimapViewportClass = () =>
    isLightTheme()
      ? "pointer-events-none absolute rounded-[2px] border border-[rgba(42,74,110,0.42)] bg-[rgba(114,165,217,0.14)] shadow-[0_0_0_1px_rgba(114,165,217,0.2)]"
      : "pointer-events-none absolute rounded-[2px] border border-[#f0f4ff] bg-[#dce7ff]/10 shadow-[0_0_0_1px_rgba(220,231,255,0.2)]";
  const deckHubBackdropClass = () =>
    isLightTheme()
      ? "absolute inset-0 z-50 bg-[rgba(221,232,244,0.52)] backdrop-blur-[2px]"
      : "absolute inset-0 z-50 bg-[#03060d]/55 backdrop-blur-[1px]";
  const deckHubPanelClass = () =>
    isLightTheme()
      ? "absolute right-3 top-3 w-[min(460px,calc(100%-1.5rem))] rounded-xl border border-[var(--border-strong)] bg-[rgba(255,255,255,0.96)] p-3 shadow-[0_18px_48px_rgba(56,88,124,0.18)]"
      : "absolute right-3 top-3 w-[min(460px,calc(100%-1.5rem))] rounded-xl border border-[#334865] bg-[#0c1525]/98 p-3 shadow-[0_16px_48px_rgba(0,0,0,0.55)]";
  const deckHubTitleClass = () => (isLightTheme() ? "text-[var(--text-main)]" : "text-[#d4def1]");
  const deckHubTextClass = () => (isLightTheme() ? "text-[var(--text-soft)]" : "text-[#93a7cc]");
  const deckHubCloseClass = () =>
    isLightTheme()
      ? "rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs text-[var(--text-main)] hover:border-[var(--accent)]"
      : "rounded-md border border-[#435c84] px-2 py-1 text-xs text-[#d5e4ff] hover:border-[var(--accent)]";
  const deckHubSectionTitleClass = () => (isLightTheme() ? "text-[var(--text-soft)]" : "text-[#9eb2d5]");
  const deckHubSectionMetaClass = () => (isLightTheme() ? "text-[var(--text-muted)]" : "text-[#869abe]");
  const deckHubRowZoneClass = () =>
    isLightTheme()
      ? "space-y-1 rounded-lg border border-[var(--border-strong)] bg-[rgba(235,242,249,0.92)] p-2"
      : "space-y-1 rounded-lg border border-[#365073] bg-[#101f35]/85 p-2";
  const deckHubReserveZoneClass = () =>
    isLightTheme()
      ? "space-y-1 rounded-lg border border-[var(--border-strong)] bg-[rgba(245,248,252,0.92)] p-2"
      : "space-y-1 rounded-lg border border-[#304867] bg-[#0f1a2b]/85 p-2";
  const boardCanvasClass = () =>
    isLightTheme()
      ? "relative h-full w-full touch-none overflow-hidden bg-[radial-gradient(circle_at_18%_0%,rgba(136,190,235,0.28),transparent_42%),linear-gradient(180deg,#f4f8fd,#e7eef6)]"
      : "relative h-full w-full touch-none overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(60,85,125,0.22),transparent_45%),linear-gradient(180deg,#090b12,#05070d)]";
  const boardGridOverlayClass = () =>
    isLightTheme()
      ? "pointer-events-none absolute inset-0 opacity-70 [background-size:22px_22px] [background-image:radial-gradient(circle_at_1px_1px,rgba(84,116,154,0.18)_1px,transparent_1.3px),radial-gradient(circle_at_1px_1px,rgba(84,116,154,0.08)_1px,transparent_1.3px)]"
      : "pointer-events-none absolute inset-0 opacity-65 [background-size:22px_22px] [background-image:radial-gradient(circle_at_1px_1px,rgba(207,218,241,0.2)_1px,transparent_1.3px),radial-gradient(circle_at_1px_1px,rgba(207,218,241,0.1)_1px,transparent_1.3px)]";
  const boardCanvasFadeClass = () =>
    isLightTheme()
      ? "pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[170px] bg-gradient-to-t from-[#d5e0ec] via-[#dbe6f0cc] to-transparent"
      : "pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[170px] bg-gradient-to-t from-[#05070d] via-[#05070ddd] to-transparent";

  const renderBoardSelectorOptions = () => (
    <For each={boardChoices()}>
      {(choice) => (
        <option value={choice.boardID}>
          {choice.name}
          {choice.isTeamBoard ? " (Team)" : ""}
        </option>
      )}
    </For>
  );
  return {
    api,
    theme,
    toast,
    location,
    navigate,
    isLightTheme,
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
    boardRef,
    setBoardRef,
    createBoardInputRef,
    setCreateBoardInputRef,
    composerParseTimer,
    detailParseTimer,
    composerParseController,
    detailParseController,
    composerParseRequestSeq,
    detailParseRequestSeq,
    lastComposerParsedText,
    lastDetailParsedText,
    hasPrimedExhaustedVillagers,
    resetComposerPreview,
    resetDetailPreview,
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
    persistDeckOrderPrefs,
    moveDeckToAbsoluteIndex,
    moveDeckToRow,
    moveDeckToReserve,
    draggedDeckDefFromEvent,
    beginDeckHubDrag,
    endDeckHubDrag,
    handleDeckHubDropToRow,
    handleDeckHubDropToReserve,
    selectedStack,
    selectedTaskCard,
    selectedCard,
    questState,
    activeQuests,
    progressionLevels,
    progressionPerkMap,
    villagerPerkLabel,
    summary,
    villagerStatuses,
    composerTokens,
    composerChips,
    composerGuidance,
    selectedModifierCards,
    recurringModifierEnabled,
    deadlineModifierEnabled,
    detailParsedChips,
    detailModifierHints,
    detailScheduleInput,
    detailStoredDue,
    detailStoredDeadline,
    detailPreviewInput,
    detailTokens,
    detailDueInputToken,
    detailDeadlineInputToken,
    detailVisibleLabels,
    detailScheduleWarning,
    stackPosition,
    worldFromClient,
    stackCardsForRender,
    draggedCardsForRender,
    dragPreviewPosition,
    clearLocalPosition,
    suppressStackClick,
    isClickSuppressed,
    isCollectDeck,
    draggingOverCollectDeck,
    stackZIndex,
    topDefID,
    stackHasCardDefID,
    stackHasKind,
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
    minimapModel,
    minimapDotClass,
    focusMinimapAt,
    onMinimapPointerDown,
    onMinimapPointerMove,
    onMinimapPointerUp,
    stackPreview,
    listAllTasks,
    taskIDsOnBoard,
    syncBoardProjectTasks,
    loadProjects,
    loadTeamSettings,
    loadBoardMembers,
    addPendingBoardMember,
    removeBoardMember,
    setManagedBoard,
    handleBoardSelectorInput,
    switchBoard,
    openStorePage,
    createBoard,
    deleteBoard,
    openCreateBoardModal,
    closeCreateBoardModal,
    submitCreateBoardFromModal,
    renameManagedBoard,
    inviteBoardMembersByEmail,
    toggleManagedBoardMember,
    loadBoard,
    sendCommand,
    refreshBoard,
    endDay,
    claimQuestReward,
    onComposerInput,
    queueDetailParse,
    onDetailTitleInput,
    parseTaskTitleInput,
    hasParsedSchedule,
    createTaskStack,
    openDetail,
    closeDetail,
    openInTaskPage,
    saveDetail,
    completeStack,
    removeStack,
    startInlineEdit,
    cancelInlineEdit,
    saveInlineEdit,
    activateDeckOrPack,
    isDeckLikeStack,
    resolveMergeTarget,
    stackCardIndexFromPointer,
    onBoardPointerDown,
    onStackPointerDown,
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

export type BoardController = ReturnType<typeof createBoardController>;
