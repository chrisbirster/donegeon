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

export default function BoardTaskDetailModal() {
  const {
    selectedStackID,
    isDetailOpen,
    detailTitle,
    detailDescription,
    setDetailDescription,
    detailPriority,
    setDetailPriority,
    detailParsing,
    activeBoardProjectID,
    selectedTaskCard,
    selectedModifierCards,
    recurringModifierEnabled,
    deadlineModifierEnabled,
    detailParsedChips,
    detailModifierHints,
    detailScheduleInput,
    detailStoredDue,
    detailStoredDeadline,
    detailTokens,
    detailDueInputToken,
    detailDeadlineInputToken,
    detailVisibleLabels,
    detailScheduleWarning,
    onDetailTitleInput,
    closeDetail,
    openInTaskPage,
    saveDetail,
    completeStack,
    boardModalBackdropClass,
    boardModalBodyClass,
    boardModalSubpanelClass,
    boardModalHeaderBarClass,
    boardModalFooterBarClass,
    boardModalSectionLabelClass,
    boardModalTextareaClass,
    boardModalWarningNoteClass,
    boardModalChipClass,
    boardModalPrimaryTagClass,
    boardModalAccentTagClass,
    boardModalPriorityButtonClass,
  } = useBoard();
  return (
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
  );
}
