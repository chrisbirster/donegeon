import Button from "../Button";
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
import { style1, style2, style3, style4, style5, style6, style7, style8, style9, style10, style11, style12, style13, style14, style15, style16, style17, style18, style19, style20, style21, style22, style23, style24, style25, style26, style27, style28, style29, style30, style31, style32, style33, style34, style35, style36, style37, style38, style39, style40, style41 } from "./styles/BoardSettingsModal.styles";

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
          class={` ${style1} ${boardModalBackdropClass()}`}
          onClick={closeCreateBoardModal}
        >
          <div
            class={boardModalPanelClass}
            onClick={(event) => event.stopPropagation()}
            data-testid="board-create-modal"
          >
            <div class={style2}>
              <div>
                <p class={style3}>Board Settings</p>
                <p class={style4}>
                  Create boards, rename them, remove them, and manage which teammates can access each board.
                </p>
              </div>
              <Button
                type="button"
                class={boardHeaderButtonClass}
                onClick={closeCreateBoardModal}
                disabled={boardCrudBusy()}
              >
                Close
              </Button>
            </div>

            <div class={style5}>
              <div class={style6}>
                <section class={style7}>
                  <p class={style8}>Create board</p>
                  <form
                    class={style9}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitCreateBoardFromModal();
                    }}
                  >
                    <label class={style10}>
                      Board name
                      <input
                        ref={setCreateBoardInputRef}
                        value={newBoardName()}
                        onInput={(event) => setNewBoardName(event.currentTarget.value)}
                        placeholder="Sprint Board"
                        class={style11}
                        data-testid="board-create-name-input"
                      />
                    </label>
                    <Show when={createBoardSlugHint()}>
                      {(slug) => (
                        <p class={style12}>
                          Quick add token: <span class={style13}>#{slug()}</span>
                        </p>
                      )}
                    </Show>
                    <Button
                      type="submit"
                      class={style14}
                      disabled={boardCrudBusy() || !newBoardName().trim()}
                      data-testid="board-create-submit"
                    >
                      {boardCrudBusy() ? "Creating..." : "Create board"}
                    </Button>
                  </form>
                </section>

                <section class={style7}>
                  <div class={style15}>
                    <p class={style8}>Boards</p>
                    <span class={style16}>{boardChoices().length}</span>
                  </div>
                  <div class={style17}>
                    <For each={boardChoices()}>
                      {(choice) => {
                        const selected = () => managedBoardID() === choice.boardID;
                        const isActive = () => activeBoardID() === choice.boardID;
                        return (
                          <Button
                            type="button"
                            class={` ${style18} ${
                              selected()
                                ? style19
                                : style20
                            }`}
                            onClick={() => setManagedBoard(choice.boardID)}
                          >
                            <div class={style2}>
                              <div class={style21}>
                                <p class={style22}>{choice.name}</p>
                                <p class={style23}>
                                  {choice.isTeamBoard ? "Shared team board" : "Personal board"}
                                </p>
                              </div>
                              <div class={style24}>
                                <Show when={choice.isTeamBoard}>
                                  <span class={boardChipClass}>Team</span>
                                </Show>
                                <Show when={isActive()}>
                                  <span class={boardChipClass}>Open</span>
                                </Show>
                              </div>
                            </div>
                          </Button>
                        );
                      }}
                    </For>
                  </div>
                </section>
              </div>

              <Show
                when={managedBoardChoice()}
                fallback={
                  <section class={style7}>
                    <p class={style25}>Select a board to manage.</p>
                  </section>
                }
              >
                {(choice) => (
                  <div class={style6}>
                    <section class={style7}>
                      <div class={style26}>
                        <div>
                          <p class={style8}>Board details</p>
                          <p class={style27}>{choice().name}</p>
                          <p class={style4}>
                            {choice().isTeamBoard ? "This board belongs to your team workspace." : "This board belongs to your personal workspace."}
                          </p>
                        </div>
                        <div class={style28}>
                          <Show when={managedBoardID() !== activeBoardID()}>
                            <Button
                              type="button"
                              class={boardHeaderButtonClass}
                              onClick={() => switchBoard(managedBoardID())}
                            >
                              Open board
                            </Button>
                          </Show>
                          <Button
                            type="button"
                            class={boardDangerButtonClass}
                            disabled={boardCrudBusy() || managedBoardID() === DEFAULT_BOARD}
                            onClick={() => void deleteBoard(managedBoardID())}
                          >
                            Delete board
                          </Button>
                        </div>
                      </div>

                      <form
                        class={style29}
                        onSubmit={(event) => {
                          event.preventDefault();
                          void renameManagedBoard();
                        }}
                      >
                        <label class={style30}>
                          Board name
                          <input
                            value={managedBoardName()}
                            onInput={(event) => setManagedBoardName(event.currentTarget.value)}
                            class={style11}
                          />
                        </label>
                        <Button
                          type="submit"
                          class={boardHeaderButtonClass}
                          disabled={boardCrudBusy() || !managedBoardName().trim()}
                        >
                          {boardCrudBusy() ? "Saving..." : "Save name"}
                        </Button>
                      </form>
                      <Show when={managedBoardID() === DEFAULT_BOARD}>
                        <p class={style31}>
                          The default board can be renamed, but it cannot be deleted.
                        </p>
                      </Show>
                    </section>

                    <section class={style7}>
                      <div class={style15}>
                        <div>
                          <p class={style8}>Board access</p>
                          <p class={style4}>
                            Select or deselect teammates to control access for <span class={style13}>{choice().name}</span>.
                          </p>
                        </div>
                        <span class={boardChipClass}>{boardMembers().length} member(s)</span>
                      </div>

                      <Show
                        when={canManageBoardMembers()}
                        fallback={
                          <p class={style32}>
                            {boardMemberManagementNotice()}
                          </p>
                        }
                      >
                        <>
                          <Show
                            when={teamSettings()?.members && teamSettings()!.members.length > 0}
                            fallback={
                              <p class={style32}>
                                No team members are available yet.
                              </p>
                            }
                          >
                            <div class={style33}>
                              <For each={teamSettings()?.members ?? []}>
                                {(member) => {
                                  const checked = () => boardMemberIDs().has(member.userId);
                                  const disabled = () => boardMembersBusy() || (member.userId === currentUserID() && checked());
                                  return (
                                    <label class={style34}>
                                      <input
                                        type="checkbox"
                                        class={style35}
                                        checked={checked()}
                                        disabled={disabled()}
                                        onChange={(event) => void toggleManagedBoardMember(member, event.currentTarget.checked)}
                                      />
                                      <div class={style36}>
                                        <p class={style22}>{member.name || member.email}</p>
                                        <p class={style37}>{member.email}</p>
                                      </div>
                                      <span class={boardChipClass}>{member.role}</span>
                                    </label>
                                  );
                                }}
                              </For>
                            </div>
                          </Show>

                          <div class={style38}>
                            <label class={style10}>
                              Add by email
                              <textarea
                                rows={3}
                                value={boardInviteEmail()}
                                onInput={(event) => setBoardInviteEmail(event.currentTarget.value)}
                                class={style11}
                                placeholder="teammate@company.com"
                                disabled={boardMembersBusy()}
                              />
                            </label>
                            <p class={style39}>
                              Existing team members are added immediately. Unknown emails receive a team invite first, then they can be added to the board after accepting.
                            </p>
                            <Show when={!canManageBoardInvites()}>
                              <p class={style40}>
                                Invite-by-email requires team invite access on this workspace.
                              </p>
                            </Show>
                            <Button
                              type="button"
                              class={` ${style41} ${boardHeaderButtonClass}`}
                              onClick={() => void inviteBoardMembersByEmail()}
                              disabled={boardMembersBusy() || !boardInviteEmail().trim()}
                            >
                              {boardMembersBusy() ? "Working..." : "Add or invite"}
                            </Button>
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
