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
import BrandTagline from "../brand/BrandTagline";

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

export default function BoardDesktopSidebar() {
  const {
    state,
    error,
    busy,
    questClaimingID,
    boardSelectorValue,
    activeBoardChoice,
    stacks,
    activeQuests,
    progressionLevels,
    villagerPerkLabel,
    summary,
    villagerStatuses,
    handleBoardSelectorInput,
    openCreateBoardModal,
    claimQuestReward,
    boardSelectorFieldClass,
    boardChipClass,
    boardSidebarClass,
    boardSidebarSectionClass,
    boardSidebarHeadingClass,
    boardSidebarCardClass,
    boardPerkChipClass,
    boardHeaderButtonClass,
    renderBoardSelectorOptions,
  } = useBoard();
  return (
        <aside class={boardSidebarClass}>
          <div class={boardSidebarSectionClass}>
            <BrandTagline class={style1} />
          </div>

          <section class={boardSidebarSectionClass}>
            <p class={boardSidebarHeadingClass}>Board</p>
            <select
              value={boardSelectorValue()}
              onInput={(event) => handleBoardSelectorInput(event.currentTarget.value)}
              class={` ${style2} ${boardSelectorFieldClass}`}
              data-testid="board-selector-sidebar"
            >
              {renderBoardSelectorOptions()}
            </select>
            <Show when={activeBoardChoice()?.isTeamBoard}>
              <p class={` ${style3} ${boardChipClass}`}>
                Team board
              </p>
            </Show>
            <p class={style4}>
              Use board settings to create boards, rename them, remove them, or manage access.
            </p>
            <Button
              type="button"
              class={` ${style5} ${boardHeaderButtonClass}`}
              onClick={openCreateBoardModal}
            >
              Manage boards
            </Button>
          </section>

          <div class={boardSidebarSectionClass}>
            <p class={style6}>Today&apos;s Goals</p>
          </div>

          <section class={boardSidebarSectionClass}>
            <p class={boardSidebarHeadingClass}>Task Summary</p>
            <div class={style7}>
              <p>
                Danger: <span class={summary().zombieCount > 0 ? style8 : style9}>{summary().zombieCount > 0 ? "HIGH" : "SAFE"}</span>
              </p>
              <p>Villagers: {summary().villagerCount}</p>
              <p>Active stacks: {summary().activeTaskCount}</p>
              <p data-testid="board-completed-count">Completed tasks: {summary().completedCount}</p>
            </div>
          </section>

          <section class={boardSidebarSectionClass}>
            <div class={style10}>
              <p class={boardSidebarHeadingClass}>Progression</p>
              <span class={style11}>Lv 2-{state()?.meta?.progression?.maxLevel ?? 10}</span>
            </div>

            <Show
              when={progressionLevels().length > 0}
              fallback={<p class={style4}>Progression data unavailable.</p>}
            >
              <div class={style12}>
                <For each={progressionLevels()}>
                  {(level) => (
                    <article class={boardSidebarCardClass}>
                      <div class={style13}>
                        <span class={style14}>Level {level.level}</span>
                        <span class={style15}>{level.threshold} XP</span>
                      </div>
                      <Show
                        when={(level.perks ?? []).length > 0}
                        fallback={<p class={style16}>No perk assigned.</p>}
                      >
                        <div class={style17}>
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
                        <div class={style18}>
                          <For each={(level.perks ?? []).filter((perk) => dataString(perk.summary))}>
                            {(perk) => (
                              <p class={style19}>{perk.summary}</p>
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
            <div class={style10}>
              <p class={boardSidebarHeadingClass}>Villagers</p>
              <span class={style11}>{villagerStatuses().length}</span>
            </div>

            <Show
              when={villagerStatuses().length > 0}
              fallback={<p class={style4}>No villagers on board.</p>}
            >
              <div class={style12}>
                <For each={villagerStatuses()}>
                  {(villager) => (
                    <div class={boardSidebarCardClass}>
                      <div class={style13}>
                        <span class={style20}>{villager.name}</span>
                        <span class={villager.stamina <= 0 ? style21 : style22}>
                          STA {villager.stamina}/{villager.maxStamina}
                        </span>
                      </div>
                      <p class={style16}>
                        Lv {villager.level} · XP {villager.xp}/{villager.nextLevelXP}
                      </p>
                      <p class={style23}>
                        {villager.xpToNextLevel > 0 ? `+${villager.xpToNextLevel} to next level` : "Max level reached"}
                      </p>
                      <Show when={villager.perks.length > 0}>
                        <div class={style17}>
                          <For each={villager.perks}>
                            {(perkID) => <span class={boardPerkChipClass}>{villagerPerkLabel(perkID)}</span>}
                          </For>
                        </div>
                      </Show>
                      <Show when={villager.stamina <= 0}>
                        <p class={style24}>Needs action</p>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class={boardSidebarSectionClass}>
            <div class={style10}>
              <p class={boardSidebarHeadingClass}>Quests</p>
              <span class={style11}>{activeQuests().length} active</span>
            </div>

            <Show when={activeQuests().length > 0} fallback={<p class={style4}>No active quests.</p>}>
              <div class={style25}>
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
                        <div class={style26}>
                          <p class={style27}>{quest.title}</p>
                          <span class={boardChipClass}>
                            {questTypeLabel(quest.type)}
                          </span>
                        </div>
                        <p class={style16}>
                          {completedCount()}/{objectives().length || 1} objectives
                        </p>
                        <Show when={quest.howToComplete}>
                          <p class={style28}>How: {quest.howToComplete}</p>
                        </Show>
                        <Show when={quest.definitionOfDone}>
                          <p class={style29}>Done when: {quest.definitionOfDone}</p>
                        </Show>
                        <div class={style30}>
                          <For each={objectives()}>
                            {(objective) => (
                              <div class={style31}>
                                <span class={objective.complete ? style32 : style33}>{questObjectiveLabel(objective)}</span>
                                <span class={objective.complete ? style34 : style35}>
                                  {objective.complete ? "Done" : questObjectiveProgressLabel(objective)}
                                </span>
                              </div>
                            )}
                          </For>
                        </div>
                        <Show when={(quest.acceptanceCriteria ?? []).length > 0}>
                          <div class={style36}>
                            <For each={(quest.acceptanceCriteria ?? []).slice(0, 2)}>
                              {(criterion) => (
                                <p class={style37}>- {criterion}</p>
                              )}
                            </For>
                          </div>
                        </Show>
                        <Show when={rewardText()}>
                          <p class={style38}>Reward: {rewardText()}</p>
                        </Show>
                        <Show when={quest.claimable}>
                          <Button
                            type="button"
                            class={style39}
                            onClick={() => void claimQuestReward(quest.id)}
                            disabled={busy() || questClaimingID() === quest.id}
                          >
                            {questClaimingID() === quest.id ? "Claiming..." : "Claim reward"}
                          </Button>
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
            <div class={style7}>
              <p>Decks: {summary().deckCount}</p>
              <p>Zombies: {summary().zombieCount}</p>
              <p data-testid="board-day-ticks">Day ticks: {summary().dayTicks}</p>
              <p>Total stacks: {stacks().length}</p>
            </div>
          </section>

          <div class={style40}>
            <SidebarAccountCard />
          </div>

          <Show when={error()}>
            <p class={style41}>{error()}</p>
          </Show>
        </aside>
  );
}


const style1 = css`
margin: .5rem auto .75rem;
`;

const style2 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
`;

const style3 = css`
margin-top: calc(var(--spacing) * 2);
display: inline-flex;
`;

const style4 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

const style5 = css`
margin-top: calc(var(--spacing) * 3);
`;

const style6 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--text-main);
text-transform: uppercase;
`;

const style7 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style8 = css`
color: #ff8c8c;
`;

const style9 = css`
color: #7ddf98;
`;

const style10 = css`
display: flex;
align-items: center;
justify-content: space-between;
`;

const style11 = css`
font-size: 11px;
color: var(--text-soft);
`;

const style12 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1.5) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1.5) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style13 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
`;

const style14 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style15 = css`
color: var(--text-soft);
`;

const style16 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
color: var(--text-soft);
`;

const style17 = css`
margin-top: calc(var(--spacing) * 2);
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 1.5);
`;

const style18 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style19 = css`
font-size: 10px;
color: var(--text-soft);
`;

const style20 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style21 = css`
color: var(--danger);
`;

const style22 = css`
color: var(--warning);
`;

const style23 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 10px;
color: var(--text-soft);
`;

const style24 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 10px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--danger);
text-transform: uppercase;
`;

const style25 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style26 = css`
display: flex;
align-items: flex-start;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
`;

const style27 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style28 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
color: #b7c9e8;
`;

const style29 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
color: #9ec4b1;
`;

const style30 = css`
margin-top: calc(var(--spacing) * 1);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style31 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
font-size: 11px;
`;

const style32 = css`
color: #89dc9a;
`;

const style33 = css`
color: #c8d3e8;
`;

const style34 = css`
color: #79d78e;
`;

const style35 = css`
color: #8ca4cf;
`;

const style36 = css`
margin-top: calc(var(--spacing) * 1);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 0.5) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 0.5) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style37 = css`
font-size: 10px;
color: #88a2c7;
`;

const style38 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
color: #ebcf8b;
`;

const style39 = css`
margin-top: calc(var(--spacing) * 2);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #456a41;
background-color: #112a1d;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #b9efc4;
&:disabled {
    opacity: 50%;
  }
`;

const style40 = css`
margin-top: auto;
border-top-style: var(--tw-border-style);
  border-top-width: 1px;
border-color: var(--border-strong);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
`;

const style41 = css`
margin-inline: calc(var(--spacing) * 4);
margin-bottom: calc(var(--spacing) * 4);
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(196,98,91,0.3);
background-color: var(--danger-bg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--danger);
`;
