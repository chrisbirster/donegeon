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
} from "../features/board/board-rules";import type { BoardControllerDataContext } from "./BoardControllerData";

export function createBoardControllerTasks(context: BoardControllerDataContext) {
  const {
    state,
    setError,
    composerText,
    setComposerText,
    setComposerParsed,
    setComposerParsing,
    selectedStackID,
    setSelectedStackID,
    setIsDetailOpen,
    setDetailTitle,
    detailDescription,
    setDetailDescription,
    detailPriority,
    setDetailPriority,
    setDetailParsed,
    setDetailParsing,
    inlineStackID,
    setInlineStackID,
    inlineTitle,
    setInlineTitle,
    boardPan,
    api,
    toast,
    navigate,
    runtime,
    activeBoardID,
    activeBoardProjectID,
    resetComposerPreview,
    resetDetailPreview,
    stacks,
    selectedStack,
    selectedTaskCard,
    recurringModifierEnabled,
    deadlineModifierEnabled,
    detailPreviewInput,
    stackPosition,
    loadBoard,
    sendCommand,
  } = context;

  function onComposerInput(value: string) {
    setComposerText(value);

    if (runtime.composerParseTimer !== undefined) {
      window.clearTimeout(runtime.composerParseTimer);
      runtime.composerParseTimer = undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      resetComposerPreview();
      return;
    }

    runtime.composerParseTimer = window.setTimeout(async () => {
      if (trimmed === runtime.lastComposerParsedText) return;
      runtime.lastComposerParsedText = trimmed;
      runtime.composerParseRequestSeq += 1;
      const requestSeq = runtime.composerParseRequestSeq;
      runtime.composerParseController?.abort();
      const controller = new AbortController();
      runtime.composerParseController = controller;
      setComposerParsing(true);
      try {
        const parsed = await api.parse.quickAdd(ensureBoardProjectToken(trimmed, activeBoardProjectID()), {
          signal: controller.signal,
        });
        if (requestSeq !== runtime.composerParseRequestSeq) return;
        setComposerParsed(parsed.parsed);
      } catch (err) {
        if (isAbortError(err) || requestSeq !== runtime.composerParseRequestSeq) return;
        setComposerParsed(null);
      } finally {
        if (requestSeq === runtime.composerParseRequestSeq) {
          runtime.composerParseController = undefined;
          setComposerParsing(false);
        }
      }
    }, 325);
  }

  function queueDetailParse(value: string) {
    if (runtime.detailParseTimer !== undefined) {
      window.clearTimeout(runtime.detailParseTimer);
      runtime.detailParseTimer = undefined;
    }

    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      resetDetailPreview();
      return;
    }

    runtime.detailParseTimer = window.setTimeout(async () => {
      if (trimmed === runtime.lastDetailParsedText) return;
      runtime.lastDetailParsedText = trimmed;
      runtime.detailParseRequestSeq += 1;
      const requestSeq = runtime.detailParseRequestSeq;
      runtime.detailParseController?.abort();
      const controller = new AbortController();
      runtime.detailParseController = controller;
      setDetailParsing(true);
      try {
        const parsed = await api.parse.quickAdd(trimmed, { signal: controller.signal });
        if (requestSeq !== runtime.detailParseRequestSeq) return;
        setDetailParsed(parsed.parsed);
      } catch (err) {
        if (isAbortError(err) || requestSeq !== runtime.detailParseRequestSeq) return;
        setDetailParsed(null);
      } finally {
        if (requestSeq === runtime.detailParseRequestSeq) {
          runtime.detailParseController = undefined;
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

    const rect = runtime.boardRef?.getBoundingClientRect();
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
    if (runtime.detailParseTimer !== undefined) {
      window.clearTimeout(runtime.detailParseTimer);
      runtime.detailParseTimer = undefined;
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

  return {
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
  };
}

export type BoardControllerTasksContext = BoardControllerDataContext & ReturnType<typeof createBoardControllerTasks>;
