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
} from "../features/board/board-rules";import type { BoardControllerDeckContext } from "./BoardControllerDeck";

export function createBoardControllerSummary(context: BoardControllerDeckContext) {
  const {
    state,
    error,
    composerText,
    composerParsed,
    selectedStackID,
    detailTitle,
    detailParsed,
    setNotificationHistoryOpen,
    pendingBoardMemberID,
    setPendingBoardMemberID,
    exhaustedVillagerIDs,
    setExhaustedVillagerIDs,
    exhaustedResourceAssignmentKeys,
    setExhaustedResourceAssignmentKeys,
    toast,
    runtime,
    activeBoardID,
    addableBoardMembers,
    stacks,
  } = context;

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
    runtime.hasPrimedExhaustedVillagers = false;
    setExhaustedVillagerIDs([]);
    setExhaustedResourceAssignmentKeys([]);
    setNotificationHistoryOpen(false);
  });

  createTrackedEffect(() => {
    const currentState = state();
    if (!currentState) {
      runtime.hasPrimedExhaustedVillagers = false;
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
      if (runtime.hasPrimedExhaustedVillagers && !previousAssignments.has(assignmentKey) && previous.has(status.villagerID)) {
        toast.error(`${status.name} is assigned but out of stamina.`, 4800);
      }
    }

    if (runtime.hasPrimedExhaustedVillagers) {
      for (const status of nextExhausted) {
        if (previous.has(status.villagerID)) continue;
        toast.error(`${status.name} ran out of stamina.`, 4800);
      }
    } else {
      runtime.hasPrimedExhaustedVillagers = true;
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

  return {
    selectedStack,
    selectedTaskCard,
    selectedCard,
    questState,
    activeQuests,
    progressionLevels,
    progressionPerkMap,
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
    stackHasKind,
    villagerPerkLabel,
  };
}

export type BoardControllerSummaryContext = BoardControllerDeckContext & ReturnType<typeof createBoardControllerSummary>;
