import Button from "../Button";
import { css } from "@linaria/core";
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
          class={` ${style1} ${boardModalBackdropClass()}`}
        >
          <div
            class={style2}
            data-testid="board-detail-modal"
          >
            <div class={boardModalHeaderBarClass}>
              <p class={style3}>Task Details</p>
              <Button
                type="button"
                class={style4}
                onClick={closeDetail}
              >
                ✕
              </Button>
            </div>

            <div class={style5}>
              <section class={boardModalSubpanelClass}>
                <p class={`${boardModalSectionLabelClass} ${style6} `}>Task</p>
                <div class={`${boardModalBodyClass} ${style7} `}>
                  <div class={style8}>
                    <div class={style9}>
                      📋
                    </div>
                    <div class={style10}>
                      <textarea
                        rows={3}
                        value={detailTitle()}
                        onInput={(event) => onDetailTitleInput(event.currentTarget.value)}
                        class={`${boardModalTextareaClass} ${style11} `}
                        data-testid="board-detail-title"
                      />
                    </div>
                  </div>

                  <Show when={detailTokens().length > 0}>
                    <div class={style12}>
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
                    <p class={style13}>Parsing schedule…</p>
                  </Show>

                  <Show when={detailParsedChips().length > 0}>
                    <div class={style14}>
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
                    <div class={style15}>
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
                    <div class={style16}>
                      <Show when={detailScheduleInput()}>
                        <p>
                          Input: <span class={style17}>{detailScheduleInput()}</span>
                        </p>
                      </Show>
                      <Show when={detailDueInputToken() || detailStoredDue()}>
                        <p>
                          Due:
                          <Show when={detailDueInputToken()}>
                            <span class={style18}>{detailDueInputToken()}</span>
                          </Show>
                          <Show when={detailDueInputToken() && detailStoredDue()}>
                            <span class={style19}>{"->"}</span>
                          </Show>
                          <Show when={detailStoredDue()}>
                            <span class={style17}>
                              {formatScheduleDateTime(detailStoredDue()) ?? detailStoredDue()}
                            </span>
                          </Show>
                        </p>
                      </Show>
                      <Show when={detailDeadlineInputToken() || detailStoredDeadline()}>
                        <p>
                          Deadline:
                          <Show when={detailDeadlineInputToken()}>
                            <span class={style18}>{detailDeadlineInputToken()}</span>
                          </Show>
                          <Show when={detailDeadlineInputToken() && detailStoredDeadline()}>
                            <span class={style19}>{"->"}</span>
                          </Show>
                          <Show when={detailStoredDeadline()}>
                            <span class={style17}>
                              {formatScheduleDateTime(detailStoredDeadline()) ?? detailStoredDeadline()}
                            </span>
                          </Show>
                        </p>
                      </Show>
                    </div>
                  </Show>
                  <Show when={detailScheduleWarning()}>
                    <p class={` ${style6} ${boardModalWarningNoteClass}`}>
                      {detailScheduleWarning()}
                    </p>
                  </Show>

                  <textarea
                    rows={5}
                    value={detailDescription()}
                    onInput={(event) => setDetailDescription(event.currentTarget.value)}
                    class={`${boardModalTextareaClass} ${style20} `}
                    data-testid="board-detail-description"
                  />

                  <Button
                    type="button"
                    class={style21}
                    onClick={openInTaskPage}
                  >
                    View in Tasks Page
                  </Button>
                </div>
              </section>

              <section>
                <p class={`${boardModalSectionLabelClass} ${style22} `}>Priority</p>
                <div class={style23}>
                  <For each={[0, 1, 2, 3, 4]}>
                    {(value) => (
                      <Button
                        type="button"
                        class={boardModalPriorityButtonClass(detailPriority() === value || (value === 0 && detailPriority() <= 0))}
                        onClick={() => setDetailPriority(value === 0 ? 4 : value)}
                      >
                        {value === 0 ? "None" : `P${value}`}
                      </Button>
                    )}
                  </For>
                </div>
              </section>

              <section>
                <p class={`${boardModalSectionLabelClass} ${style22} `}>Tags</p>
                <div class={style24}>
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
                <p class={`${boardModalSectionLabelClass} ${style22} `}>Modifier Slots</p>
                <div class={style25}>
                  <For each={[0, 1, 2, 3]}>
                    {(slotIndex) => {
                      const card = createMemo(() => selectedModifierCards()[slotIndex] ?? null);
                      return (
                        <div class={boardModalSubpanelClass}>
                          <Show
                            when={card()}
                            fallback={<p class={style26}>Slot {slotIndex + 1}: empty</p>}
                          >
                            {(value) => (
                              <p class={style27}>
                                Slot {slotIndex + 1}: {prettifyDefID(value().defId)}
                              </p>
                            )}
                          </Show>
                        </div>
                      );
                    }}
                  </For>
                </div>

                <p class={style28}>
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
                <p class={`${boardModalSectionLabelClass} ${style22} `}>Assigned Villager</p>
                <div class={boardModalSubpanelClass}>
                  <p class={style29}>
                    {dataString(selectedTaskCard()?.data?.assignedVillagerId) || "Unassigned"}
                  </p>
                </div>
              </section>
            </div>

            <div class={boardModalFooterBarClass}>
              <Button
                type="button"
                class={style30}
                onClick={() => {
                  const id = selectedStackID();
                  if (id) void completeStack(id);
                }}
                data-testid="board-detail-mark-done"
              >
                Mark done
              </Button>

              <Button
                type="button"
                class={style31}
                onClick={() => void saveDetail()}
                data-testid="board-detail-save"
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      </Show>
  );
}


const style1 = css`
position: fixed;
inset: calc(var(--spacing) * 0);
z-index: 70;
display: flex;
align-items: center;
justify-content: center;
padding: calc(var(--spacing) * 2);
padding-bottom: calc(72px + env(safe-area-inset-bottom));
--tw-backdrop-blur: blur(var(--blur-sm));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
@media (width >= 48rem) {
    padding: calc(var(--spacing) * 4);
  }
`;

const style2 = css`
max-height: 92dvh;
width: 100%;
max-width: var(--container-3xl);
overflow-y: auto;
border-radius: 28px;
@media (width >= 48rem) {
    max-height: 92vh;
  }
background: linear-gradient(180deg, var(--panel-strong-start), var(--panel-strong-end)); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style3 = css`
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: var(--tracking-tight);
  letter-spacing: var(--tracking-tight);
color: var(--text-main);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style4 = css`
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

const style5 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 6) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 6) * calc(1 - var(--tw-space-y-reverse)));
  }
padding: calc(var(--spacing) * 5);
@media (width >= 48rem) {
    padding: calc(var(--spacing) * 6);
  }
`;

const style6 = css`
margin-bottom: calc(var(--spacing) * 3);
`;

const style7 = css`
padding: calc(var(--spacing) * 4);
`;

const style8 = css`
margin-bottom: calc(var(--spacing) * 3);
display: flex;
align-items: center;
gap: calc(var(--spacing) * 3);
`;

const style9 = css`
display: flex;
height: calc(var(--spacing) * 12);
width: calc(var(--spacing) * 12);
align-items: center;
justify-content: center;
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
font-size: var(--text-xl);
  line-height: var(--tw-leading, var(--text-xl--line-height));
color: var(--text-main);
`;

const style10 = css`
min-width: calc(var(--spacing) * 0);
flex: 1;
`;

const style11 = css`
font-size: var(--text-base);
  line-height: var(--tw-leading, var(--text-base--line-height));
--tw-leading: var(--leading-tight);
  line-height: var(--leading-tight);
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
@media (width >= 48rem) {
    font-size: var(--text-2xl);
    line-height: var(--tw-leading, var(--text-2xl--line-height));
  }
`;

const style12 = css`
margin-bottom: calc(var(--spacing) * 3);
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-leading: var(--leading-relaxed);
  line-height: var(--leading-relaxed);
color: var(--text-soft);
`;

const style13 = css`
margin-bottom: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

const style14 = css`
margin-bottom: calc(var(--spacing) * 3);
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 1.5);
`;

const style15 = css`
margin-bottom: calc(var(--spacing) * 3);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style16 = css`
margin-bottom: calc(var(--spacing) * 3);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

const style17 = css`
color: var(--text-main);
`;

const style18 = css`
margin-left: calc(var(--spacing) * 1);
color: var(--accent-text);
`;

const style19 = css`
margin-inline: calc(var(--spacing) * 1);
color: var(--text-dim);
`;

const style20 = css`
font-size: 15px;
`;

const style21 = css`
margin-top: calc(var(--spacing) * 3);
width: 100%;
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-base);
  line-height: var(--tw-leading, var(--text-base--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

const style22 = css`
margin-bottom: calc(var(--spacing) * 2);
`;

const style23 = css`
display: grid;
grid-template-columns: repeat(5, minmax(0, 1fr));
gap: calc(var(--spacing) * 2);
`;

const style24 = css`
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 2);
`;

const style25 = css`
display: grid;
grid-template-columns: repeat(1, minmax(0, 1fr));
gap: calc(var(--spacing) * 2);
@media (width >= 40rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const style26 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-dim);
`;

const style27 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style28 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

const style29 = css`
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style30 = css`
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease; &:hover { background: color-mix(in srgb, var(--panel-soft) 78%, white 22%); border-color: var(--border-hover); }
`;

const style31 = css`
border-radius: var(--radius-xl);
background-color: var(--accent);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #151515;
&:hover {
    @media (hover: hover) {
      background-color: var(--accent-soft);
    }
  }
`;
