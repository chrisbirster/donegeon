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
} from "../features/board/board-rules";import type { BoardControllerMinimapContext } from "./BoardControllerMinimap";

export function createBoardControllerData(context: BoardControllerMinimapContext) {
  const {
    state,
    setState,
    projects,
    setProjects,
    error,
    setError,
    loading,
    setLoading,
    setBusy,
    boardPan,
    setQuestClaimingID,
    newBoardName,
    setNewBoardName,
    setCreateBoardModalOpen,
    boardCrudBusy,
    setBoardCrudBusy,
    setBoardSelectorValue,
    managedBoardID,
    setManagedBoardID,
    managedBoardName,
    setManagedBoardName,
    teamSettings,
    setTeamSettings,
    setBoardMembers,
    setBoardMembersLoading,
    setBoardMembersBusy,
    pendingBoardMemberID,
    setPendingBoardMemberID,
    boardInviteEmail,
    setBoardInviteEmail,
    api,
    toast,
    navigate,
    runtime,
    activeBoardID,
    boardChoices,
    managedBoardChoice,
    managedBoardProjectID,
    canManageBoardInvites,
    currentUserID,
    boardMemberIDs,
    pendingTeamInvitesByEmail,
    stacks,
  } = context;

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

    const rect = runtime.boardRef?.getBoundingClientRect();
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

  return {
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
  };
}

export type BoardControllerDataContext = BoardControllerMinimapContext & ReturnType<typeof createBoardControllerData>;
