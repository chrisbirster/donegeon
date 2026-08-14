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

export default function BoardSettingsModal() {
  const {
    newBoardName,
    setNewBoardName,
    createBoardModalOpen,
    boardCrudBusy,
    managedBoardID,
    managedBoardName,
    setManagedBoardName,
    teamSettings,
    boardMembers,
    boardMembersBusy,
    boardInviteEmail,
    setBoardInviteEmail,
    setCreateBoardInputRef,
    activeBoardID,
    boardChoices,
    managedBoardChoice,
    createBoardSlugHint,
    canManageBoardMembers,
    canManageBoardInvites,
    boardMemberManagementNotice,
    currentUserID,
    boardMemberIDs,
    setManagedBoard,
    switchBoard,
    deleteBoard,
    closeCreateBoardModal,
    submitCreateBoardFromModal,
    renameManagedBoard,
    inviteBoardMembersByEmail,
    toggleManagedBoardMember,
    boardChipClass,
    boardHeaderButtonClass,
    boardDangerButtonClass,
    boardModalPanelClass,
    boardModalBackdropClass,
  } = useBoard();
  return (
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
  );
}
