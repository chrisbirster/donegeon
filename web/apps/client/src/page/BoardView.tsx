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
} from "../features/board/board-rules";import { useBoard } from "./BoardContext";

export default function BoardView() {
  const {
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
  } = useBoard();
  return (
    <AppShell
      activeView="board"
      accountPlacement="sidebar"
      mobileSidebar={
        <div class="space-y-3">
          <section class="app-panel-soft rounded-2xl px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Board</p>
            <select
              value={boardSelectorValue()}
              onInput={(event) => handleBoardSelectorInput(event.currentTarget.value)}
              class={`mt-2 w-full ${boardSelectorFieldClass}`}
              data-testid="board-selector-mobile"
            >
              {renderBoardSelectorOptions()}
            </select>
            <Show when={activeBoardChoice()?.isTeamBoard}>
              <p class={`mt-2 inline-flex ${boardChipClass}`}>
                Team board
              </p>
            </Show>
            <p class="mt-2 text-xs text-[var(--text-soft)]">
              Use board settings to create boards, rename them, remove them, or manage access.
            </p>
            <button
              type="button"
              class={`mt-3 ${boardHeaderButtonClass}`}
              onClick={openCreateBoardModal}
            >
              Manage boards
            </button>
            <button
              type="button"
              class={`mt-2 ${boardHeaderButtonClass}`}
              onClick={() => setNotificationHistoryOpen(true)}
              data-testid="board-open-notifications-mobile"
            >
              Notes {toast.history().length}
            </button>
          </section>

          <section class="app-panel-soft rounded-2xl px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Task Summary</p>
            <div class="mt-2 space-y-1 text-sm text-[var(--text-soft)]">
              <p>
                Danger:{" "}
                <span class={summary().zombieCount > 0 ? "text-[#ff8c8c]" : "text-[#7ddf98]"}>
                  {summary().zombieCount > 0 ? "HIGH" : "SAFE"}
                </span>
              </p>
              <p>Villagers: {summary().villagerCount}</p>
              <p>Active stacks: {summary().activeTaskCount}</p>
              <p>Completed tasks: {summary().completedCount}</p>
            </div>
          </section>

          <section class="app-panel-soft rounded-2xl px-3 py-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Progression</p>
              <span class="text-[11px] text-[var(--text-soft)]">Lv 2-{state()?.meta?.progression?.maxLevel ?? 10}</span>
            </div>

            <Show
              when={progressionLevels().length > 0}
              fallback={<p class="mt-2 text-xs text-[var(--text-soft)]">Progression data unavailable.</p>}
            >
              <div class="mt-2 space-y-1.5">
                <For each={progressionLevels()}>
                  {(level) => (
                    <article class={boardSidebarCardClass}>
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="font-semibold text-[var(--text-main)]">Level {level.level}</span>
                        <span class="text-[var(--text-soft)]">{level.threshold} XP</span>
                      </div>
                      <Show
                        when={(level.perks ?? []).length > 0}
                        fallback={<p class="mt-1 text-[11px] text-[var(--text-soft)]">No perk assigned.</p>}
                      >
                        <div class="mt-2 flex flex-wrap gap-1.5">
                          <For each={level.perks ?? []}>
                            {(perk) => (
                              <span class={boardPerkChipClass} title={perk.summary || perk.label}>
                                {perk.label}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                      <Show when={(level.perks ?? []).some((perk) => dataString(perk.summary))}>
                        <div class="mt-2 space-y-1">
                          <For each={(level.perks ?? []).filter((perk) => dataString(perk.summary))}>
                            {(perk) => (
                              <p class="text-[10px] text-[var(--text-soft)]">{perk.summary}</p>
                            )}
                          </For>
                        </div>
                      </Show>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class="app-panel-soft rounded-2xl px-3 py-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Villagers</p>
              <span class="text-[11px] text-[var(--text-soft)]">{villagerStatuses().length}</span>
            </div>

            <Show
              when={villagerStatuses().length > 0}
              fallback={<p class="mt-2 text-xs text-[var(--text-soft)]">No villagers on board.</p>}
            >
              <div class="mt-2 space-y-1.5">
                <For each={villagerStatuses()}>
                  {(villager) => (
                    <div class={boardSidebarCardClass}>
                      <div class="flex items-center justify-between gap-2">
                        <span class="truncate font-semibold">{villager.name}</span>
                        <span class={villager.stamina <= 0 ? "text-[var(--danger)]" : "text-[var(--warning)]"}>
                          STA {villager.stamina}/{villager.maxStamina}
                        </span>
                      </div>
                      <p class="mt-0.5 text-[11px] text-[var(--text-soft)]">
                        Lv {villager.level} · XP {villager.xp}/{villager.nextLevelXP}
                      </p>
                      <p class="mt-1 text-[10px] text-[var(--text-soft)]">
                        {villager.xpToNextLevel > 0 ? `+${villager.xpToNextLevel} to next level` : "Max level reached"}
                      </p>
                      <Show when={villager.perks.length > 0}>
                        <div class="mt-2 flex flex-wrap gap-1.5">
                          <For each={villager.perks}>
                            {(perkID) => <span class={boardPerkChipClass}>{villagerPerkLabel(perkID)}</span>}
                          </For>
                        </div>
                      </Show>
                      <Show when={villager.stamina <= 0}>
                        <p class="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--danger)]">Needs action</p>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class="app-panel-soft rounded-2xl px-3 py-3">
            <div class="flex items-center justify-between">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Quests</p>
              <span class="text-[11px] text-[var(--text-soft)]">{activeQuests().length} active</span>
            </div>

            <Show when={activeQuests().length > 0} fallback={<p class="mt-2 text-xs text-[var(--text-soft)]">No active quests.</p>}>
              <div class="mt-2 space-y-2">
                <For each={activeQuests().slice(0, 3)}>
                  {(quest) => {
                    const objectives = () => quest.objectives ?? [];
                    const completedCount = () => objectives().filter((objective) => objective.complete).length;
                    const rewardText = () =>
                      (quest.rewards ?? [])
                        .slice(0, 2)
                        .map((reward) => questRewardLabel(reward))
                        .join(" · ");
                    return (
                      <article class="app-panel-soft rounded-xl px-2 py-2">
                        <div class="flex items-start justify-between gap-2">
                          <p class="text-xs font-semibold text-[var(--text-main)]">{quest.title}</p>
                          <span class={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${boardChipClass}`}>
                            {questTypeLabel(quest.type)}
                          </span>
                        </div>
                        <p class="mt-1 text-[11px] text-[var(--text-soft)]">
                          {completedCount()}/{objectives().length || 1} objectives
                        </p>
                        <Show when={quest.howToComplete}>
                          <p class="mt-1 text-[11px] text-[#b7c9e8]">How: {quest.howToComplete}</p>
                        </Show>
                        <Show when={quest.definitionOfDone}>
                          <p class="mt-1 text-[11px] text-[#9ec4b1]">Done when: {quest.definitionOfDone}</p>
                        </Show>
                        <div class="mt-1 space-y-1">
                          <For each={objectives()}>
                            {(objective) => (
                              <div class="flex items-center justify-between gap-2 text-[11px]">
                                <span class={objective.complete ? "text-[#8be39f]" : "text-[#cdd9ef]"}>{questObjectiveLabel(objective)}</span>
                                <span class={objective.complete ? "text-[#7ddf98]" : "text-[#8ca4cf]"}>
                                  {objective.complete ? "Done" : questObjectiveProgressLabel(objective)}
                                </span>
                              </div>
                            )}
                          </For>
                        </div>
                        <Show when={(quest.acceptanceCriteria ?? []).length > 0}>
                          <div class="mt-1 space-y-0.5">
                            <For each={(quest.acceptanceCriteria ?? []).slice(0, 2)}>
                              {(criterion) => (
                                <p class="text-[10px] text-[#88a2c7]">- {criterion}</p>
                              )}
                            </For>
                          </div>
                        </Show>
                        <Show when={rewardText()}>
                          <p class="mt-1 text-[11px] text-[#f1d38e]">Reward: {rewardText()}</p>
                        </Show>
                        <Show when={quest.claimable}>
                          <button
                            type="button"
                            class="mt-2 rounded-md border border-[#4b6d48] bg-[#12301f] px-2 py-1 text-[11px] font-semibold text-[#bff5cb] disabled:opacity-50"
                            onClick={() => void claimQuestReward(quest.id)}
                            disabled={busy() || questClaimingID() === quest.id}
                          >
                            {questClaimingID() === quest.id ? "Claiming..." : "Claim reward"}
                          </button>
                        </Show>
                      </article>
                    );
                  }}
                </For>
              </div>
            </Show>
          </section>

          <section class="app-panel-soft rounded-2xl px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Board Stats</p>
            <div class="mt-2 space-y-1 text-sm text-[var(--text-soft)]">
              <p>Decks: {summary().deckCount}</p>
              <p>Zombies: {summary().zombieCount}</p>
              <p>Day ticks: {summary().dayTicks}</p>
              <p>Total stacks: {stacks().length}</p>
            </div>
          </section>

          <section class="app-panel-soft rounded-2xl px-3 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Inventory</p>
            <div class="mt-2 grid grid-cols-2 gap-1.5 text-sm text-[var(--text-soft)]">
              <p>🪙 {summary().inventory.coin ?? 0}</p>
              <p>📄 {summary().inventory.paper ?? 0}</p>
              <p>🖋️ {summary().inventory.ink ?? 0}</p>
              <p>⚙️ {summary().inventory.gear ?? 0}</p>
              <p>🔩 {summary().inventory.parts ?? 0}</p>
            </div>
          </section>

          <p class="app-panel-soft rounded-xl px-3 py-2 text-xs text-[var(--text-soft)]">
            Deck row is pinned above the bottom tab bar on mobile.
          </p>
        </div>
      }
      headerRight={
        <>
          <div class="hidden items-center gap-2 md:flex">
            <Show when={activeBoardChoice()?.isTeamBoard}>
              <span class={boardChipClass}>
                Team board
              </span>
            </Show>
            <button
              type="button"
              class={boardWarningButtonClass}
              onClick={openStorePage}
              disabled={busy()}
              data-testid="board-open-store-header"
            >
              Store
            </button>
          </div>

          <div class="hidden items-center gap-3 text-xs text-[var(--text-soft)] lg:flex">
            <span class="flex items-center gap-1" title="Coins">
              <span>🪙</span>
              <span class="tabular-nums">{summary().inventory.coin ?? 0}</span>
            </span>
            <span class="flex items-center gap-1" title="Paper">
              <span>📄</span>
              <span class="tabular-nums">{summary().inventory.paper ?? 0}</span>
            </span>
            <span class="flex items-center gap-1" title="Ink">
              <span>🖋️</span>
              <span class="tabular-nums">{summary().inventory.ink ?? 0}</span>
            </span>
            <span class="flex items-center gap-1" title="Gear">
              <span>⚙️</span>
              <span class="tabular-nums">{summary().inventory.gear ?? 0}</span>
            </span>
            <span class="flex items-center gap-1" title="Parts">
              <span>🔩</span>
              <span class="tabular-nums">{summary().inventory.parts ?? 0}</span>
            </span>
          </div>

          <button
            type="button"
            class={boardHeaderButtonClass}
            onClick={() => setNotificationHistoryOpen(true)}
            data-testid="board-open-notifications"
          >
            Notifications {toast.history().length}
          </button>
          <Show when={showDeveloperBoardActions}>
            <>
              <button
                type="button"
                class={boardDangerButtonClass}
                onClick={() => void endDay()}
                disabled={busy()}
                data-testid="board-end-day"
              >
                End Day
              </button>
              <button
                type="button"
                class={boardHeaderButtonClass}
                onClick={() => void refreshBoard()}
                disabled={busy()}
                data-testid="board-refresh"
              >
                Refresh
              </button>
            </>
          </Show>
        </>
      }
    >
      <div class="grid h-full min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[280px_minmax(0,1fr)]">
        <aside class={boardSidebarClass}>
          <div class={boardSidebarSectionClass}>
            <p class="text-lg font-semibold tracking-wide text-[var(--text-main)]">DONEGEON</p>
          </div>

          <section class={boardSidebarSectionClass}>
            <p class={boardSidebarHeadingClass}>Board</p>
            <select
              value={boardSelectorValue()}
              onInput={(event) => handleBoardSelectorInput(event.currentTarget.value)}
              class={`mt-2 w-full ${boardSelectorFieldClass}`}
              data-testid="board-selector-sidebar"
            >
              {renderBoardSelectorOptions()}
            </select>
            <Show when={activeBoardChoice()?.isTeamBoard}>
              <p class={`mt-2 inline-flex ${boardChipClass}`}>
                Team board
              </p>
            </Show>
            <p class="mt-2 text-xs text-[var(--text-soft)]">
              Use board settings to create boards, rename them, remove them, or manage access.
            </p>
            <button
              type="button"
              class={`mt-3 ${boardHeaderButtonClass}`}
              onClick={openCreateBoardModal}
            >
              Manage boards
            </button>
          </section>

          <div class={boardSidebarSectionClass}>
            <p class="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-main)]">Today&apos;s Goals</p>
          </div>

          <section class={boardSidebarSectionClass}>
            <p class={boardSidebarHeadingClass}>Task Summary</p>
            <div class="mt-2 space-y-1 text-sm text-[var(--text-soft)]">
              <p>
                Danger: <span class={summary().zombieCount > 0 ? "text-[#ff8c8c]" : "text-[#7ddf98]"}>{summary().zombieCount > 0 ? "HIGH" : "SAFE"}</span>
              </p>
              <p>Villagers: {summary().villagerCount}</p>
              <p>Active stacks: {summary().activeTaskCount}</p>
              <p data-testid="board-completed-count">Completed tasks: {summary().completedCount}</p>
            </div>
          </section>

          <section class={boardSidebarSectionClass}>
            <div class="flex items-center justify-between">
              <p class={boardSidebarHeadingClass}>Progression</p>
              <span class="text-[11px] text-[var(--text-soft)]">Lv 2-{state()?.meta?.progression?.maxLevel ?? 10}</span>
            </div>

            <Show
              when={progressionLevels().length > 0}
              fallback={<p class="mt-2 text-xs text-[var(--text-soft)]">Progression data unavailable.</p>}
            >
              <div class="mt-2 space-y-1.5">
                <For each={progressionLevels()}>
                  {(level) => (
                    <article class={boardSidebarCardClass}>
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="font-semibold text-[var(--text-main)]">Level {level.level}</span>
                        <span class="text-[var(--text-soft)]">{level.threshold} XP</span>
                      </div>
                      <Show
                        when={(level.perks ?? []).length > 0}
                        fallback={<p class="mt-1 text-[11px] text-[var(--text-soft)]">No perk assigned.</p>}
                      >
                        <div class="mt-2 flex flex-wrap gap-1.5">
                          <For each={level.perks ?? []}>
                            {(perk) => (
                              <span class={boardPerkChipClass} title={perk.summary || perk.label}>
                                {perk.label}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                      <Show when={(level.perks ?? []).some((perk) => dataString(perk.summary))}>
                        <div class="mt-2 space-y-1">
                          <For each={(level.perks ?? []).filter((perk) => dataString(perk.summary))}>
                            {(perk) => (
                              <p class="text-[10px] text-[var(--text-soft)]">{perk.summary}</p>
                            )}
                          </For>
                        </div>
                      </Show>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class={boardSidebarSectionClass}>
            <div class="flex items-center justify-between">
              <p class={boardSidebarHeadingClass}>Villagers</p>
              <span class="text-[11px] text-[var(--text-soft)]">{villagerStatuses().length}</span>
            </div>

            <Show
              when={villagerStatuses().length > 0}
              fallback={<p class="mt-2 text-xs text-[var(--text-soft)]">No villagers on board.</p>}
            >
              <div class="mt-2 space-y-1.5">
                <For each={villagerStatuses()}>
                  {(villager) => (
                    <div class={boardSidebarCardClass}>
                      <div class="flex items-center justify-between gap-2 text-xs">
                        <span class="truncate font-semibold text-[var(--text-main)]">{villager.name}</span>
                        <span class={villager.stamina <= 0 ? "text-[var(--danger)]" : "text-[var(--warning)]"}>
                          STA {villager.stamina}/{villager.maxStamina}
                        </span>
                      </div>
                      <p class="mt-1 text-[11px] text-[var(--text-soft)]">
                        Lv {villager.level} · XP {villager.xp}/{villager.nextLevelXP}
                      </p>
                      <p class="mt-1 text-[10px] text-[var(--text-soft)]">
                        {villager.xpToNextLevel > 0 ? `+${villager.xpToNextLevel} to next level` : "Max level reached"}
                      </p>
                      <Show when={villager.perks.length > 0}>
                        <div class="mt-2 flex flex-wrap gap-1.5">
                          <For each={villager.perks}>
                            {(perkID) => <span class={boardPerkChipClass}>{villagerPerkLabel(perkID)}</span>}
                          </For>
                        </div>
                      </Show>
                      <Show when={villager.stamina <= 0}>
                        <p class="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--danger)]">Needs action</p>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class={boardSidebarSectionClass}>
            <div class="flex items-center justify-between">
              <p class={boardSidebarHeadingClass}>Quests</p>
              <span class="text-[11px] text-[var(--text-soft)]">{activeQuests().length} active</span>
            </div>

            <Show when={activeQuests().length > 0} fallback={<p class="mt-2 text-xs text-[var(--text-soft)]">No active quests.</p>}>
              <div class="mt-2 space-y-2">
                <For each={activeQuests().slice(0, 4)}>
                  {(quest) => {
                    const objectives = () => quest.objectives ?? [];
                    const completedCount = () => objectives().filter((objective) => objective.complete).length;
                    const rewardText = () =>
                      (quest.rewards ?? [])
                        .slice(0, 2)
                        .map((reward) => questRewardLabel(reward))
                        .join(" · ");
                    return (
                      <article class={boardSidebarCardClass}>
                        <div class="flex items-start justify-between gap-2">
                          <p class="text-xs font-semibold text-[var(--text-main)]">{quest.title}</p>
                          <span class={boardChipClass}>
                            {questTypeLabel(quest.type)}
                          </span>
                        </div>
                        <p class="mt-1 text-[11px] text-[var(--text-soft)]">
                          {completedCount()}/{objectives().length || 1} objectives
                        </p>
                        <Show when={quest.howToComplete}>
                          <p class="mt-1 text-[11px] text-[#b7c9e8]">How: {quest.howToComplete}</p>
                        </Show>
                        <Show when={quest.definitionOfDone}>
                          <p class="mt-1 text-[11px] text-[#9ec4b1]">Done when: {quest.definitionOfDone}</p>
                        </Show>
                        <div class="mt-1 space-y-1">
                          <For each={objectives()}>
                            {(objective) => (
                              <div class="flex items-center justify-between gap-2 text-[11px]">
                                <span class={objective.complete ? "text-[#89dc9a]" : "text-[#c8d3e8]"}>{questObjectiveLabel(objective)}</span>
                                <span class={objective.complete ? "text-[#79d78e]" : "text-[#8ca4cf]"}>
                                  {objective.complete ? "Done" : questObjectiveProgressLabel(objective)}
                                </span>
                              </div>
                            )}
                          </For>
                        </div>
                        <Show when={(quest.acceptanceCriteria ?? []).length > 0}>
                          <div class="mt-1 space-y-0.5">
                            <For each={(quest.acceptanceCriteria ?? []).slice(0, 2)}>
                              {(criterion) => (
                                <p class="text-[10px] text-[#88a2c7]">- {criterion}</p>
                              )}
                            </For>
                          </div>
                        </Show>
                        <Show when={rewardText()}>
                          <p class="mt-1 text-[11px] text-[#ebcf8b]">Reward: {rewardText()}</p>
                        </Show>
                        <Show when={quest.claimable}>
                          <button
                            type="button"
                            class="mt-2 rounded-md border border-[#456a41] bg-[#112a1d] px-2 py-1 text-[11px] font-semibold text-[#b9efc4] disabled:opacity-50"
                            onClick={() => void claimQuestReward(quest.id)}
                            disabled={busy() || questClaimingID() === quest.id}
                          >
                            {questClaimingID() === quest.id ? "Claiming..." : "Claim reward"}
                          </button>
                        </Show>
                      </article>
                    );
                  }}
                </For>
              </div>
            </Show>
          </section>

          <section class={boardSidebarSectionClass}>
            <p class={boardSidebarHeadingClass}>Board Stats</p>
            <div class="mt-2 space-y-1 text-sm text-[var(--text-soft)]">
              <p>Decks: {summary().deckCount}</p>
              <p>Zombies: {summary().zombieCount}</p>
              <p data-testid="board-day-ticks">Day ticks: {summary().dayTicks}</p>
              <p>Total stacks: {stacks().length}</p>
            </div>
          </section>

          <div class="mt-auto border-t border-[var(--border-strong)] px-4 py-3">
            <SidebarAccountCard />
          </div>

          <Show when={error()}>
            <p class="mx-4 mb-4 rounded-xl border border-[rgba(196,98,91,0.3)] bg-[var(--danger-bg)] px-3 py-2 text-xs text-[var(--danger)]">{error()}</p>
          </Show>
        </aside>

        <section class="relative h-full min-h-0 overflow-hidden">
          <Show when={minimapModel()}>
            {(model) => (
              <>
                <button
                  type="button"
                  class={boardMapToggleClass()}
                  onClick={() => setMobileMapHubOpen((open) => !open)}
                  data-testid="board-mobile-map-toggle"
                >
                  {mobileMapHubOpen() ? "Hide Map" : "Map"}
                </button>

                <Show when={mobileMapHubOpen()}>
                  <div class="pointer-events-none absolute left-1/2 top-3 z-40 w-[min(240px,calc(100%-1.5rem))] -translate-x-1/2 md:hidden">
                    <div class={boardMapPanelClass()}>
                      <div class="mb-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.1em]">
                        <span class={boardMapTitleClass()}>Map Hub</span>
                        <span class={boardMapStatusClass(model().offscreenCount > 0)}>
                          {model().offscreenCount > 0 ? `${model().offscreenCount} off-screen` : "All visible"}
                        </span>
                      </div>

                      <div
                        class={`mx-auto ${boardMinimapSurfaceClass()}`}
                        onPointerDown={onMinimapPointerDown}
                        onPointerMove={onMinimapPointerMove}
                        onPointerUp={onMinimapPointerUp}
                        title="Drag or click to recenter board"
                        data-testid="board-minimap-mobile"
                      >
                        <div class={boardMinimapGridClass()} />

                        <For each={model().dots}>
                          {(dot) => (
                            <div
                              class={`pointer-events-none absolute h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                                dot.isSelected ? "ring-2 ring-[#e6edf9]" : ""
                              } ${minimapDotClass(dot.kind, dot.isNextAction, dot.isExhausted)}`}
                              style={{
                                left: `${dot.x}px`,
                                top: `${dot.y}px`,
                              }}
                            />
                          )}
                        </For>

                        <div
                          class={boardMinimapViewportClass()}
                          data-testid="board-minimap-mobile-viewport"
                          style={{
                            left: `${model().viewportRect.x}px`,
                            top: `${model().viewportRect.y}px`,
                            width: `${model().viewportRect.width}px`,
                            height: `${model().viewportRect.height}px`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </Show>

                <div class="pointer-events-none absolute right-3 top-3 z-40 hidden md:block">
                  <div class={boardMapPanelClass()}>
                    <div class="mb-2 flex items-center justify-between gap-4 text-[11px] uppercase tracking-[0.11em]">
                      <span class={boardMapTitleClass()}>Map Hub</span>
                      <span class={boardMapStatusClass(model().offscreenCount > 0)}>
                        {model().offscreenCount > 0 ? `${model().offscreenCount} off-screen` : "All visible"}
                      </span>
                    </div>

                    <div
                      class={boardMinimapSurfaceClass()}
                      onPointerDown={onMinimapPointerDown}
                      onPointerMove={onMinimapPointerMove}
                      onPointerUp={onMinimapPointerUp}
                      title="Drag or click to recenter board"
                      data-testid="board-minimap-desktop"
                    >
                      <div class={boardMinimapGridClass()} />

                      <For each={model().dots}>
                        {(dot) => (
                          <div
                            class={`pointer-events-none absolute h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full ${
                              dot.isSelected ? "ring-2 ring-[#e6edf9]" : ""
                            } ${minimapDotClass(dot.kind, dot.isNextAction, dot.isExhausted)}`}
                            style={{
                              left: `${dot.x}px`,
                              top: `${dot.y}px`,
                            }}
                          />
                        )}
                      </For>

                      <div
                        class={boardMinimapViewportClass()}
                        data-testid="board-minimap-desktop-viewport"
                        style={{
                          left: `${model().viewportRect.x}px`,
                          top: `${model().viewportRect.y}px`,
                          width: `${model().viewportRect.width}px`,
                          height: `${model().viewportRect.height}px`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </Show>

          <Show when={deckHubOpen()}>
            <div
              class={deckHubBackdropClass()}
              onPointerDown={() => {
                setDeckHubOpen(false);
                setDeckHubDragDefID(null);
              }}
            >
              <div
                class={deckHubPanelClass()}
                onPointerDown={(event) => event.stopPropagation()}
                data-testid="board-deck-hub-panel"
              >
                <div class="mb-3 flex items-center justify-between">
                  <div>
                    <p class={`text-sm font-semibold uppercase tracking-[0.16em] ${deckHubTitleClass()}`}>Deck Hub</p>
                    <p class={`text-xs ${deckHubTextClass()}`}>Drag decks between row and reserve.</p>
                  </div>
                  <button
                    type="button"
                    class={deckHubCloseClass()}
                    onClick={() => setDeckHubOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <div class="space-y-3">
                  <section>
                    <div class="mb-1 flex items-center justify-between">
                      <p class={`text-[11px] font-semibold uppercase tracking-[0.12em] ${deckHubSectionTitleClass()}`}>Deck Row</p>
                      <p class={`text-[11px] ${deckHubSectionMetaClass()}`}>Visible: {deckRowDefIDs().length}</p>
                    </div>
                    <div
                      class={deckHubRowZoneClass()}
                      data-testid="board-deck-hub-row-dropzone"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDeckHubDropToRow(event)}
                    >
                      <For each={deckRowDefIDs()}>
                        {(defID, index) => (
                          <div
                            draggable="true"
                            data-testid="board-deck-hub-row-item"
                            data-def-id={defID}
                            class={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                              deckHubDragDefID() === defID
                                ? "border-[#8db4ff] bg-[#243a63] text-[#eff5ff]"
                                : "border-[#466288] bg-[#162946] text-[#d9e7ff]"
                            }`}
                            onDragStart={(event) => beginDeckHubDrag(event, defID)}
                            onDragEnd={endDeckHubDrag}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDeckHubDropToRow(event, index())}
                          >
                            <span class="truncate pr-2">{deckDisplayName(defID)}</span>
                            <button
                              type="button"
                              data-testid="board-deck-hub-hide"
                              class="rounded border border-[#55729b] px-1.5 py-0.5 text-[10px] text-[#d2e2ff] hover:border-[var(--accent)]"
                              onClick={() => moveDeckToReserve(defID)}
                            >
                              Hide
                            </button>
                          </div>
                        )}
                      </For>

                      <Show when={deckRowDefIDs().length === 0}>
                        <p class={`rounded-md border border-dashed px-2 py-2 text-[11px] ${isLightTheme() ? "border-[var(--border-strong)] bg-[rgba(255,255,255,0.8)] text-[var(--text-soft)]" : "border-[#42628f] bg-[#13223a] text-[#8ca5cd]"}`}>
                          No decks in row.
                        </p>
                      </Show>
                    </div>
                  </section>

                  <section>
                    <div class="mb-1 flex items-center justify-between">
                      <p class={`text-[11px] font-semibold uppercase tracking-[0.12em] ${deckHubSectionTitleClass()}`}>Reserve</p>
                      <p class={`text-[11px] ${deckHubSectionMetaClass()}`}>Hidden: {deckOverflowDefIDs().length}</p>
                    </div>
                    <div
                      class={deckHubReserveZoneClass()}
                      data-testid="board-deck-hub-reserve-dropzone"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleDeckHubDropToReserve(event)}
                    >
                      <For each={deckOverflowDefIDs()}>
                        {(defID, index) => (
                          <div
                            draggable="true"
                            data-testid="board-deck-hub-reserve-item"
                            data-def-id={defID}
                            class={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
                              deckHubDragDefID() === defID
                                ? "border-[#8db4ff] bg-[#243a63] text-[#eff5ff]"
                                : "border-[#415a80] bg-[#141f34] text-[#cedcf6]"
                            }`}
                            onDragStart={(event) => beginDeckHubDrag(event, defID)}
                            onDragEnd={endDeckHubDrag}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDeckHubDropToReserve(event, index())}
                          >
                            <span class="truncate pr-2">{deckDisplayName(defID)}</span>
                            <button
                              type="button"
                              data-testid="board-deck-hub-show"
                              class="rounded border border-[#4f6c95] px-1.5 py-0.5 text-[10px] text-[#d2e2ff] hover:border-[var(--accent)]"
                              onClick={() => moveDeckToRow(defID)}
                            >
                              Show
                            </button>
                          </div>
                        )}
                      </For>

                      <Show when={deckOverflowDefIDs().length === 0}>
                        <p class={`rounded-md border border-dashed px-2 py-2 text-[11px] ${isLightTheme() ? "border-[var(--border-strong)] bg-[rgba(255,255,255,0.8)] text-[var(--text-soft)]" : "border-[#375172] bg-[#121f32] text-[#8ca5cd]"}`}>
                          No extra decks.
                        </p>
                      </Show>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </Show>

          <div
            ref={setBoardRef}
            class={boardCanvasClass()}
            onPointerDown={onBoardPointerDown}
            data-testid="board-canvas"
            data-pan-x={String(boardPan().x)}
            data-pan-y={String(boardPan().y)}
          >
            <div
              class={boardGridOverlayClass()}
              style={{
                "background-position": `${boardPan().x}px ${boardPan().y}px, ${boardPan().x + 11}px ${boardPan().y + 11}px`,
              }}
              data-testid="board-grid-overlay"
            />
            <div class={boardCanvasFadeClass()} />

            <Show when={!loading()} fallback={<p class="p-4 text-sm text-[var(--text-soft)]">Loading board...</p>}>
              <div
                class="absolute inset-0"
                data-testid="board-world-layer"
                style={{
                  transform: `translate(${boardPan().x}px, ${boardPan().y}px)`,
                }}
              >
                <For each={renderStacks()}>
                  {(stack) => {
                  const visibleCards = createMemo(() => stackCardsForRender(stack));
                  const draggedCards = createMemo(() => draggedCardsForRender(stack));
                  const preview = createMemo(() => stackPreview(stack, visibleCards()));
                  const position = createMemo(() => stackPosition(stack));
                  const splitDragPosition = createMemo(() => dragPreviewPosition(stack.id));
                  const isMergeTarget = createMemo(() => mergeTargetID() === stack.id);
                  const isInline = createMemo(() => inlineStackID() === stack.id);
                  const topIsDeckLike = createMemo(() => preview().isDeck);
                  const topIsPack = createMemo(() => preview().isPack);
                  const villagerStatus = createMemo(() => villagerStatusForStack(stack, state()));
                  const stackTooltip = createMemo(() => villagerTooltipLabel(villagerStatus()) ?? preview().title);
                  const hasNextActionModifier = createMemo(
                    () => stackHasKind(stack, "task") && stackHasCardDefID(stack, "mod.next_action"),
                  );
                  const isExhaustedVillager = createMemo(() => (villagerStatus()?.stamina ?? 1) <= 0);
                  const miningProgress = createMemo(() => {
                    const session = miningSessionsByStackID()[stack.id];
                    if (!session) return null;
                    const tick = miningTickMs();
                    const elapsed = Math.max(0, tick - session.startedAt);
                    if (session.durationMs <= 0) return null;
                    return (elapsed % session.durationMs) / session.durationMs;
                  });
                  const isDraggingStack = createMemo(() => {
                    const drag = dragState();
                    return drag?.stackId === stack.id && drag.mode === "stack";
                  });
                  const isSplittingStack = createMemo(() => {
                    const drag = dragState();
                    return drag?.stackId === stack.id && drag.mode === "split";
                  });

                  return (
                    <>
                      <article
                        data-testid="board-stack"
                        data-stack-id={stack.id}
                        data-stack-title={preview().title}
                        data-stack-root="true"
                        title={stackTooltip()}
                        class={`group absolute select-none ${
                          topIsDeckLike() ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
                        } ${
                          isMergeTarget()
                            ? "ring-2 ring-[#efb05f] ring-offset-2 ring-offset-[var(--bg-base)]"
                            : isExhaustedVillager()
                              ? "ring-2 ring-[#f87171] ring-offset-2 ring-offset-[var(--bg-base)] shadow-[0_0_0_1px_rgba(248,113,113,0.34),0_0_26px_rgba(248,113,113,0.28)]"
                              : hasNextActionModifier()
                              ? "ring-2 ring-[#facc15]/90 ring-offset-2 ring-offset-[var(--bg-base)] shadow-[0_0_0_1px_rgba(250,204,21,0.36),0_0_26px_rgba(250,204,21,0.34)]"
                              : ""
                        }`}
                        style={{
                          left: `${position().x}px`,
                          top: `${position().y}px`,
                          height: `${stackHeightPx(visibleCards().length)}px`,
                          width: `${CARD_WIDTH}px`,
                          "z-index": stackZIndex(stack, isDraggingStack()),
                          transform:
                            topIsDeckLike() && isMobileBoardViewport()
                              ? `scale(${MOBILE_DECK_SCALE})`
                              : undefined,
                          "transform-origin":
                            topIsDeckLike() && isMobileBoardViewport() ? "top left" : undefined,
                        }}
                        onPointerDown={(event) => onStackPointerDown(event, stack)}
                        onClick={(event) => {
                          if (!(topIsDeckLike() || topIsPack())) return;
                          if (isClickSuppressed(stack.id)) return;
                          event.stopPropagation();
                          void activateDeckOrPack(stack);
                        }}
                      >
                        <Show when={isExhaustedVillager()}>
                          <div
                            class="pointer-events-none absolute -top-3 left-0 rounded-md border border-[#7d3f3f] bg-[#311617]/96 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#ffb3ad] shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
                            data-testid="board-stack-exhausted"
                          >
                            No stamina
                          </div>
                        </Show>

                        <Show when={miningProgress() !== null}>
                          <div class="pointer-events-none absolute -bottom-3 left-0 right-0 rounded-md border border-[#335244] bg-[#0c1b14]/92 px-1 py-0.5">
                            <div class="h-1.5 w-full overflow-hidden rounded-full border border-[#2f4a3f] bg-[#13291f]">
                              <div
                                class="h-full bg-gradient-to-r from-[#78cc57] to-[#b8ef90] transition-[width] duration-100"
                                style={{
                                  width: `${Math.round((miningProgress() ?? 0) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </Show>

                        <For each={visibleCards()}>
                          {(cardID, index) => {
                            const card = createMemo(() => state()?.cards[cardID] ?? null);
                            const cardPreview = createMemo(() => {
                              const value = card();
                              const kind = value ? cardKind(value.defId) : "unknown";
                              const skin = cardSkin(kind, value?.defId ?? "");
                              const villagerInfo = kind === "villager" ? villagerStatus() : null;
                              return {
                                title: titleFromCard(value),
                                subtitle: villagerInfo ? `VILLAGER · STA ${villagerInfo.stamina}` : subtitleFromCard(value),
                                icon: cardIcon(value),
                                shellClass: skin.shellClass,
                                titleClass: skin.titleClass,
                              };
                            });
                            const isFace = createMemo(() => index() === visibleCards().length - 1);

                            return (
                              <div
                                data-card-index={index()}
                                class={`absolute left-0 h-[124px] w-[92px] rounded-[3px] border-2 border-black/55 shadow-[2px_2px_0_rgba(0,0,0,0.35)] ${
                                  cardPreview().shellClass
                                }`}
                                style={{
                                  top: `${index() * STACK_OFFSET_Y}px`,
                                  "z-index": `${index() + 1}`,
                                }}
                              >
                                <div
                                  class={`absolute inset-x-0 top-0 flex h-[18px] items-center justify-between border-b-2 border-black/40 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                    cardPreview().titleClass
                                  }`}
                                >
                                  <Show
                                    when={!(isFace() && isInline())}
                                    fallback={
                                      <input
                                        value={inlineTitle()}
                                        onInput={(event) => setInlineTitle(event.currentTarget.value)}
                                        class="h-4 w-full border-none bg-transparent px-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#1a1f2a] outline-none"
                                        onClick={(event) => event.stopPropagation()}
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onKeyDown={(event) => {
                                          if (event.key === "Enter") {
                                            event.preventDefault();
                                            void saveInlineEdit();
                                          }
                                          if (event.key === "Escape") {
                                            event.preventDefault();
                                            cancelInlineEdit();
                                          }
                                        }}
                                        onBlur={() => void saveInlineEdit()}
                                      />
                                    }
                                  >
                                    <span class="truncate" data-testid="board-card-title">
                                      {cardPreview().title}
                                    </span>
                                  </Show>
                                </div>

                                <div class="absolute inset-x-0 top-[18px] bottom-0 flex flex-col items-center justify-center gap-1 px-1">
                                  <div class="flex h-[46px] w-[46px] items-center justify-center rounded-[8px] border-2 border-black/30 bg-white/30 text-[18px]">
                                    {cardPreview().icon}
                                  </div>
                                  <p class="max-w-full truncate text-[9px] uppercase tracking-[0.12em] text-black/75">{cardPreview().subtitle}</p>
                                </div>

                                <Show when={isFace()}>
                                  <span class="absolute bottom-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black/40 bg-white/80 px-1 text-[10px] font-bold text-[#1a1e28]">
                                    {visibleCards().length}
                                  </span>
                                </Show>
                              </div>
                            );
                          }}
                        </For>

                      </article>

                      <Show when={isSplittingStack() && draggedCards().length > 0 && !!splitDragPosition()}>
                        <article
                          class="pointer-events-none absolute select-none"
                          style={{
                            left: `${splitDragPosition()?.x ?? 0}px`,
                            top: `${splitDragPosition()?.y ?? 0}px`,
                            height: `${stackHeightPx(draggedCards().length)}px`,
                            width: `${CARD_WIDTH}px`,
                            "z-index": `${draggingOverCollectDeck() ? Z_INDEX_DRAG_OVER_COLLECT + 1 : Z_INDEX_DRAG + 1}`,
                          }}
                        >
                          <For each={draggedCards()}>
                            {(cardID, index) => {
                              const card = createMemo(() => state()?.cards[cardID] ?? null);
                              const cardPreview = createMemo(() => {
                                const value = card();
                                const kind = value ? cardKind(value.defId) : "unknown";
                                const skin = cardSkin(kind, value?.defId ?? "");
                                const villagerInfo = kind === "villager" ? villagerStatus() : null;
                                return {
                                  title: titleFromCard(value),
                                  subtitle: villagerInfo ? `VILLAGER · STA ${villagerInfo.stamina}` : subtitleFromCard(value),
                                  icon: cardIcon(value),
                                  shellClass: skin.shellClass,
                                  titleClass: skin.titleClass,
                                };
                              });
                              const isFace = createMemo(() => index() === draggedCards().length - 1);

                              return (
                                <div
                                  class={`absolute left-0 h-[124px] w-[92px] rounded-[3px] border-2 border-black/55 shadow-[2px_2px_0_rgba(0,0,0,0.35)] ${
                                    cardPreview().shellClass
                                  }`}
                                  style={{
                                    top: `${index() * STACK_OFFSET_Y}px`,
                                    "z-index": `${index() + 1}`,
                                  }}
                                >
                                  <div
                                    class={`absolute inset-x-0 top-0 flex h-[18px] items-center justify-between border-b-2 border-black/40 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                      cardPreview().titleClass
                                    }`}
                                  >
                                    <span class="truncate">{cardPreview().title}</span>
                                  </div>

                                  <div class="absolute inset-x-0 top-[18px] bottom-0 flex flex-col items-center justify-center gap-1 px-1">
                                    <div class="flex h-[46px] w-[46px] items-center justify-center rounded-[8px] border-2 border-black/30 bg-white/30 text-[18px]">
                                      {cardPreview().icon}
                                    </div>
                                    <p class="max-w-full truncate text-[9px] uppercase tracking-[0.12em] text-black/75">{cardPreview().subtitle}</p>
                                  </div>

                                  <Show when={isFace()}>
                                    <span class="absolute bottom-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-black/40 bg-white/80 px-1 text-[10px] font-bold text-[#1a1e28]">
                                      {draggedCards().length}
                                    </span>
                                  </Show>
                                </div>
                              );
                            }}
                          </For>
                        </article>
                      </Show>
                    </>
                  );
                }}
                </For>

                <Show when={deckOverflowDefIDs().length > 0 ? deckHubWorldPosition() : null}>
                  {(position) => (
                    <button
                      type="button"
                      data-stack-root="true"
                      class="group absolute h-[124px] w-[92px] cursor-pointer select-none rounded-[3px] border-2 border-black/55 bg-[#a9b7cf] text-[#121722] shadow-[2px_2px_0_rgba(0,0,0,0.35)]"
                      style={{
                        left: `${position().x}px`,
                        top: `${position().y}px`,
                        "z-index": `${Z_INDEX_DECK_BASE + DECK_ROW_MAX_VISIBLE + 2}`,
                        transform: isMobileBoardViewport() ? `scale(${MOBILE_DECK_SCALE})` : undefined,
                        "transform-origin": isMobileBoardViewport() ? "top left" : undefined,
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeckHubOpen((open) => !open);
                      }}
                      data-testid="board-deck-hub-toggle"
                      title="Open deck hub"
                    >
                      <div class="absolute inset-x-0 top-0 flex h-[18px] items-center justify-center border-b-2 border-black/40 bg-[#8494af] px-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
                        Deck Hub
                      </div>
                      <div class="absolute inset-x-0 top-[18px] bottom-0 flex flex-col items-center justify-center gap-1 px-1">
                        <div class="flex h-[46px] w-[46px] items-center justify-center rounded-[8px] border-2 border-black/30 bg-white/30 text-[20px]">
                          🗂️
                        </div>
                        <p class="text-[9px] uppercase tracking-[0.12em] text-black/75">{deckOverflowDefIDs().length} hidden</p>
                      </div>
                    </button>
                  )}
                </Show>
              </div>
            </Show>
          </div>

          <Show when={error() && !loading()}>
            <div class="absolute bottom-4 left-4 z-40 max-w-md rounded-md border border-[#8d3a3a] bg-[#321417] px-3 py-2 text-xs text-[#ffd2d2] md:hidden">
              {error()}
            </div>
          </Show>
        </section>
      </div>

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

      <Show when={createBoardModalOpen()}>
        <div
          class={`fixed inset-0 z-[80] flex items-center justify-center p-3 backdrop-blur-sm md:p-4 ${boardModalBackdropClass()}`}
          onClick={closeCreateBoardModal}
        >
          <div
            class={boardModalPanelClass}
            onClick={(event) => event.stopPropagation()}
            data-testid="board-create-modal"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Board Settings</p>
                <p class="mt-1 text-sm text-[var(--text-soft)]">
                  Create boards, rename them, remove them, and manage which teammates can access each board.
                </p>
              </div>
              <button
                type="button"
                class={boardHeaderButtonClass}
                onClick={closeCreateBoardModal}
                disabled={boardCrudBusy()}
              >
                Close
              </button>
            </div>

            <div class="mt-4 grid gap-4 md:grid-cols-[260px_minmax(0,1fr)]">
              <div class="space-y-4">
                <section class="app-panel-soft rounded-2xl p-4">
                  <p class="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">Create board</p>
                  <form
                    class="mt-3 space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitCreateBoardFromModal();
                    }}
                  >
                    <label class="block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">
                      Board name
                      <input
                        ref={setCreateBoardInputRef}
                        value={newBoardName()}
                        onInput={(event) => setNewBoardName(event.currentTarget.value)}
                        placeholder="Sprint Board"
                        class="app-input-surface mt-1 w-full rounded-xl px-3 py-2 text-sm"
                        data-testid="board-create-name-input"
                      />
                    </label>
                    <Show when={createBoardSlugHint()}>
                      {(slug) => (
                        <p class="rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] px-3 py-2 text-xs text-[var(--text-soft)]">
                          Quick add token: <span class="font-semibold text-[var(--text-main)]">#{slug()}</span>
                        </p>
                      )}
                    </Show>
                    <button
                      type="submit"
                      class="app-button-primary w-full rounded-xl border border-[rgba(255,139,80,0.28)] px-3 py-2 text-sm font-semibold disabled:opacity-60"
                      disabled={boardCrudBusy() || !newBoardName().trim()}
                      data-testid="board-create-submit"
                    >
                      {boardCrudBusy() ? "Creating..." : "Create board"}
                    </button>
                  </form>
                </section>

                <section class="app-panel-soft rounded-2xl p-4">
                  <div class="flex items-center justify-between gap-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">Boards</p>
                    <span class="text-xs text-[var(--text-soft)]">{boardChoices().length}</span>
                  </div>
                  <div class="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                    <For each={boardChoices()}>
                      {(choice) => {
                        const selected = () => managedBoardID() === choice.boardID;
                        const isActive = () => activeBoardID() === choice.boardID;
                        return (
                          <button
                            type="button"
                            class={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                              selected()
                                ? "border-[rgba(255,139,80,0.24)] bg-[var(--accent-wash)]"
                                : "border-[var(--border-strong)] bg-[var(--panel)] hover:border-[var(--border-hover)]"
                            }`}
                            onClick={() => setManagedBoard(choice.boardID)}
                          >
                            <div class="flex items-start justify-between gap-3">
                              <div class="min-w-0">
                                <p class="truncate text-sm font-semibold text-[var(--text-main)]">{choice.name}</p>
                                <p class="mt-1 text-xs text-[var(--text-soft)]">
                                  {choice.isTeamBoard ? "Shared team board" : "Personal board"}
                                </p>
                              </div>
                              <div class="flex shrink-0 flex-col items-end gap-1">
                                <Show when={choice.isTeamBoard}>
                                  <span class={boardChipClass}>Team</span>
                                </Show>
                                <Show when={isActive()}>
                                  <span class={boardChipClass}>Open</span>
                                </Show>
                              </div>
                            </div>
                          </button>
                        );
                      }}
                    </For>
                  </div>
                </section>
              </div>

              <Show
                when={managedBoardChoice()}
                fallback={
                  <section class="app-panel-soft rounded-2xl p-4">
                    <p class="text-sm text-[var(--text-soft)]">Select a board to manage.</p>
                  </section>
                }
              >
                {(choice) => (
                  <div class="space-y-4">
                    <section class="app-panel-soft rounded-2xl p-4">
                      <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p class="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">Board details</p>
                          <p class="mt-1 text-lg font-semibold text-[var(--text-main)]">{choice().name}</p>
                          <p class="mt-1 text-sm text-[var(--text-soft)]">
                            {choice().isTeamBoard ? "This board belongs to your team workspace." : "This board belongs to your personal workspace."}
                          </p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                          <Show when={managedBoardID() !== activeBoardID()}>
                            <button
                              type="button"
                              class={boardHeaderButtonClass}
                              onClick={() => switchBoard(managedBoardID())}
                            >
                              Open board
                            </button>
                          </Show>
                          <button
                            type="button"
                            class={boardDangerButtonClass}
                            disabled={boardCrudBusy() || managedBoardID() === DEFAULT_BOARD}
                            onClick={() => void deleteBoard(managedBoardID())}
                          >
                            Delete board
                          </button>
                        </div>
                      </div>

                      <form
                        class="mt-4 flex flex-col gap-3 md:flex-row md:items-end"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void renameManagedBoard();
                        }}
                      >
                        <label class="flex-1 text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">
                          Board name
                          <input
                            value={managedBoardName()}
                            onInput={(event) => setManagedBoardName(event.currentTarget.value)}
                            class="app-input-surface mt-1 w-full rounded-xl px-3 py-2 text-sm"
                          />
                        </label>
                        <button
                          type="submit"
                          class={boardHeaderButtonClass}
                          disabled={boardCrudBusy() || !managedBoardName().trim()}
                        >
                          {boardCrudBusy() ? "Saving..." : "Save name"}
                        </button>
                      </form>
                      <Show when={managedBoardID() === DEFAULT_BOARD}>
                        <p class="mt-3 rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] px-3 py-2 text-xs text-[var(--text-soft)]">
                          The default board can be renamed, but it cannot be deleted.
                        </p>
                      </Show>
                    </section>

                    <section class="app-panel-soft rounded-2xl p-4">
                      <div class="flex items-center justify-between gap-3">
                        <div>
                          <p class="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">Board access</p>
                          <p class="mt-1 text-sm text-[var(--text-soft)]">
                            Select or deselect teammates to control access for <span class="font-semibold text-[var(--text-main)]">{choice().name}</span>.
                          </p>
                        </div>
                        <span class={boardChipClass}>{boardMembers().length} member(s)</span>
                      </div>

                      <Show
                        when={canManageBoardMembers()}
                        fallback={
                          <p class="mt-3 rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--text-soft)]">
                            {boardMemberManagementNotice()}
                          </p>
                        }
                      >
                        <>
                          <Show
                            when={teamSettings()?.members && teamSettings()!.members.length > 0}
                            fallback={
                              <p class="mt-3 rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--text-soft)]">
                                No team members are available yet.
                              </p>
                            }
                          >
                            <div class="mt-3 space-y-2">
                              <For each={teamSettings()?.members ?? []}>
                                {(member) => {
                                  const checked = () => boardMemberIDs().has(member.userId);
                                  const disabled = () => boardMembersBusy() || (member.userId === currentUserID() && checked());
                                  return (
                                    <label class="flex items-start gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--panel)] px-3 py-3">
                                      <input
                                        type="checkbox"
                                        class="mt-1 h-4 w-4 accent-[var(--accent)]"
                                        checked={checked()}
                                        disabled={disabled()}
                                        onChange={(event) => void toggleManagedBoardMember(member, event.currentTarget.checked)}
                                      />
                                      <div class="min-w-0 flex-1">
                                        <p class="truncate text-sm font-semibold text-[var(--text-main)]">{member.name || member.email}</p>
                                        <p class="truncate text-xs text-[var(--text-soft)]">{member.email}</p>
                                      </div>
                                      <span class={boardChipClass}>{member.role}</span>
                                    </label>
                                  );
                                }}
                              </For>
                            </div>
                          </Show>

                          <div class="mt-4 border-t border-[var(--border-strong)] pt-4">
                            <label class="block text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-dim)]">
                              Add by email
                              <textarea
                                rows={3}
                                value={boardInviteEmail()}
                                onInput={(event) => setBoardInviteEmail(event.currentTarget.value)}
                                class="app-input-surface mt-1 w-full rounded-xl px-3 py-2 text-sm"
                                placeholder="teammate@company.com"
                                disabled={boardMembersBusy()}
                              />
                            </label>
                            <p class="mt-2 text-xs text-[var(--text-soft)]">
                              Existing team members are added immediately. Unknown emails receive a team invite first, then they can be added to the board after accepting.
                            </p>
                            <Show when={!canManageBoardInvites()}>
                              <p class="mt-2 rounded-xl border border-[rgba(223,173,87,0.24)] bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]">
                                Invite-by-email requires team invite access on this workspace.
                              </p>
                            </Show>
                            <button
                              type="button"
                              class={`mt-3 ${boardHeaderButtonClass}`}
                              onClick={() => void inviteBoardMembersByEmail()}
                              disabled={boardMembersBusy() || !boardInviteEmail().trim()}
                            >
                              {boardMembersBusy() ? "Working..." : "Add or invite"}
                            </button>
                          </div>
                        </>
                      </Show>
                    </section>
                  </div>
                )}
              </Show>
            </div>
          </div>
        </div>
      </Show>

      <Show when={isDetailOpen() && !!selectedTaskCard()}>
        <div
          class={`fixed inset-0 z-[70] flex items-center justify-center p-2 pb-[calc(72px+env(safe-area-inset-bottom))] backdrop-blur-sm md:p-4 ${boardModalBackdropClass()}`}
        >
          <div
            class="app-panel-strong max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-[28px] md:max-h-[92vh]"
            data-testid="board-detail-modal"
          >
            <div class={boardModalHeaderBarClass}>
              <p class="font-display text-2xl font-semibold tracking-tight text-[var(--text-main)]">Task Details</p>
              <button
                type="button"
                class="app-button-secondary rounded-lg px-3 py-1.5 text-sm font-semibold"
                onClick={closeDetail}
              >
                ✕
              </button>
            </div>

            <div class="space-y-6 p-5 md:p-6">
              <section class={boardModalSubpanelClass}>
                <p class={`${boardModalSectionLabelClass} mb-3`}>Task</p>
                <div class={`${boardModalBodyClass} p-4`}>
                  <div class="mb-3 flex items-center gap-3">
                    <div class="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] text-xl text-[var(--text-main)]">
                      📋
                    </div>
                    <div class="min-w-0 flex-1">
                      <textarea
                        rows={3}
                        value={detailTitle()}
                        onInput={(event) => onDetailTitleInput(event.currentTarget.value)}
                        class={`${boardModalTextareaClass} text-base leading-tight font-semibold md:text-2xl`}
                        data-testid="board-detail-title"
                      />
                    </div>
                  </div>

                  <Show when={detailTokens().length > 0}>
                    <div class="mb-3 rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] px-3 py-2 text-sm leading-relaxed text-[var(--text-soft)]">
                      <For each={detailTokens()}>
                        {(token) => (
                          <span class={token.kind === "text" ? "" : `rounded-[4px] ${tokenClass(token.kind)}`}>
                            {token.value}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={detailParsing()}>
                    <p class="mb-2 text-xs text-[var(--text-dim)]">Parsing schedule…</p>
                  </Show>

                  <Show when={detailParsedChips().length > 0}>
                    <div class="mb-3 flex flex-wrap gap-1.5">
                      <For each={detailParsedChips()}>
                        {(chip) => (
                          <span class={boardModalChipClass}>
                            {chip}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={detailModifierHints().length > 0}>
                    <div class="mb-3 space-y-1">
                      <For each={detailModifierHints()}>
                        {(hint) => (
                          <p class={boardModalWarningNoteClass}>
                            {hint}
                          </p>
                        )}
                      </For>
                    </div>
                  </Show>

                  <Show when={detailScheduleInput() || detailStoredDue() || detailStoredDeadline()}>
                    <div class="mb-3 space-y-1 rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] px-3 py-2 text-xs text-[var(--text-soft)]">
                      <Show when={detailScheduleInput()}>
                        <p>
                          Input: <span class="text-[var(--text-main)]">{detailScheduleInput()}</span>
                        </p>
                      </Show>
                      <Show when={detailDueInputToken() || detailStoredDue()}>
                        <p>
                          Due:
                          <Show when={detailDueInputToken()}>
                            <span class="ml-1 text-[var(--accent-text)]">{detailDueInputToken()}</span>
                          </Show>
                          <Show when={detailDueInputToken() && detailStoredDue()}>
                            <span class="mx-1 text-[var(--text-dim)]">{"->"}</span>
                          </Show>
                          <Show when={detailStoredDue()}>
                            <span class="text-[var(--text-main)]">
                              {formatScheduleDateTime(detailStoredDue()) ?? detailStoredDue()}
                            </span>
                          </Show>
                        </p>
                      </Show>
                      <Show when={detailDeadlineInputToken() || detailStoredDeadline()}>
                        <p>
                          Deadline:
                          <Show when={detailDeadlineInputToken()}>
                            <span class="ml-1 text-[var(--accent-text)]">{detailDeadlineInputToken()}</span>
                          </Show>
                          <Show when={detailDeadlineInputToken() && detailStoredDeadline()}>
                            <span class="mx-1 text-[var(--text-dim)]">{"->"}</span>
                          </Show>
                          <Show when={detailStoredDeadline()}>
                            <span class="text-[var(--text-main)]">
                              {formatScheduleDateTime(detailStoredDeadline()) ?? detailStoredDeadline()}
                            </span>
                          </Show>
                        </p>
                      </Show>
                    </div>
                  </Show>
                  <Show when={detailScheduleWarning()}>
                    <p class={`mb-3 ${boardModalWarningNoteClass}`}>
                      {detailScheduleWarning()}
                    </p>
                  </Show>

                  <textarea
                    rows={5}
                    value={detailDescription()}
                    onInput={(event) => setDetailDescription(event.currentTarget.value)}
                    class={`${boardModalTextareaClass} text-[15px]`}
                    data-testid="board-detail-description"
                  />

                  <button
                    type="button"
                    class="app-button-secondary mt-3 w-full rounded-xl px-4 py-2 text-base font-semibold"
                    onClick={openInTaskPage}
                  >
                    View in Tasks Page
                  </button>
                </div>
              </section>

              <section>
                <p class={`${boardModalSectionLabelClass} mb-2`}>Priority</p>
                <div class="grid grid-cols-5 gap-2">
                  <For each={[0, 1, 2, 3, 4]}>
                    {(value) => (
                      <button
                        type="button"
                        class={boardModalPriorityButtonClass(detailPriority() === value || (value === 0 && detailPriority() <= 0))}
                        onClick={() => setDetailPriority(value === 0 ? 4 : value)}
                      >
                        {value === 0 ? "None" : `P${value}`}
                      </button>
                    )}
                  </For>
                </div>
              </section>

              <section>
                <p class={`${boardModalSectionLabelClass} mb-2`}>Tags</p>
                <div class="flex flex-wrap gap-2">
                  <span class={boardModalPrimaryTagClass}>
                    #{activeBoardProjectID()}
                  </span>
                  <For each={detailVisibleLabels()}>
                    {(tag) => (
                      <span class={boardModalAccentTagClass}>@{tag}</span>
                    )}
                  </For>
                </div>
              </section>

              <section>
                <p class={`${boardModalSectionLabelClass} mb-2`}>Modifier Slots</p>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <For each={[0, 1, 2, 3]}>
                    {(slotIndex) => {
                      const card = createMemo(() => selectedModifierCards()[slotIndex] ?? null);
                      return (
                        <div class={boardModalSubpanelClass}>
                          <Show
                            when={card()}
                            fallback={<p class="text-sm text-[var(--text-dim)]">Slot {slotIndex + 1}: empty</p>}
                          >
                            {(value) => (
                              <p class="text-sm font-semibold text-[var(--text-main)]">
                                Slot {slotIndex + 1}: {prettifyDefID(value().defId)}
                              </p>
                            )}
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>

                <p class="mt-3 text-xs text-[var(--text-dim)]">
                  {recurringModifierEnabled() || deadlineModifierEnabled()
                    ? `Parsing enabled on save: ${
                        recurringModifierEnabled() ? "recurrence phrases" : ""
                      }${recurringModifierEnabled() && deadlineModifierEnabled() ? " and " : ""}${
                        deadlineModifierEnabled() ? "due/deadline phrases" : ""
                      } are extracted.`
                    : 'Modifiers are earned from card packs. Stack "Recurring" and/or "Deadline Pin" cards on this task to enable schedule parsing; otherwise timing text is kept as plain text.'}
                </p>
              </section>

              <section>
                <p class={`${boardModalSectionLabelClass} mb-2`}>Assigned Villager</p>
                <div class={boardModalSubpanelClass}>
                  <p class="text-lg font-semibold text-[var(--text-main)]">
                    {dataString(selectedTaskCard()?.data?.assignedVillagerId) || "Unassigned"}
                  </p>
                </div>
              </section>
            </div>

            <div class={boardModalFooterBarClass}>
              <button
                type="button"
                class="app-button-secondary rounded-xl px-4 py-2 text-sm font-semibold"
                onClick={() => {
                  const id = selectedStackID();
                  if (id) void completeStack(id);
                }}
                data-testid="board-detail-mark-done"
              >
                Mark done
              </button>

              <button
                type="button"
                class="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#151515] hover:bg-[var(--accent-soft)]"
                onClick={() => void saveDetail()}
                data-testid="board-detail-save"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </Show>
    </AppShell>
  );
}
