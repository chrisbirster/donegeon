import Button from "../Button";
import BrandTagline from "../brand/BrandTagline";
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

export default function BoardMobileSidebar() {
  const {
    toast,
    state,
    busy,
    questClaimingID,
    setNotificationHistoryOpen,
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
    boardSidebarCardClass,
    boardPerkChipClass,
    boardHeaderButtonClass,
    renderBoardSelectorOptions,
  } = useBoard();
  return (
        <div class={style1}>
          <div class={mobileTagline}><BrandTagline /></div>
          <section class={style2}>
            <p class={style3}>Board</p>
            <select
              value={boardSelectorValue()}
              onInput={(event) => handleBoardSelectorInput(event.currentTarget.value)}
              class={` ${style4} ${boardSelectorFieldClass}`}
              data-testid="board-selector-mobile"
            >
              {renderBoardSelectorOptions()}
            </select>
            <Show when={activeBoardChoice()?.isTeamBoard}>
              <p class={` ${style5} ${boardChipClass}`}>
                Team board
              </p>
            </Show>
            <p class={style6}>
              Use board settings to create boards, rename them, remove them, or manage access.
            </p>
            <Button
              type="button"
              class={` ${style7} ${boardHeaderButtonClass}`}
              onClick={openCreateBoardModal}
            >
              Manage boards
            </Button>
            <Button
              type="button"
              class={` ${style8} ${boardHeaderButtonClass}`}
              onClick={() => setNotificationHistoryOpen(true)}
              data-testid="board-open-notifications-mobile"
            >
              Notes {toast.history().length}
            </Button>
          </section>

          <section class={style2}>
            <p class={style3}>Task Summary</p>
            <div class={style9}>
              <p>
                Danger:{" "}
                <span class={summary().zombieCount > 0 ? style10 : style11}>
                  {summary().zombieCount > 0 ? "HIGH" : "SAFE"}
                </span>
              </p>
              <p>Villagers: {summary().villagerCount}</p>
              <p>Active stacks: {summary().activeTaskCount}</p>
              <p>Completed tasks: {summary().completedCount}</p>
            </div>
          </section>

          <section class={style2}>
            <div class={style12}>
              <p class={style3}>Progression</p>
              <span class={style13}>Lv 2-{state()?.meta?.progression?.maxLevel ?? 10}</span>
            </div>

            <Show
              when={progressionLevels().length > 0}
              fallback={<p class={style6}>Progression data unavailable.</p>}
            >
              <div class={style14}>
                <For each={progressionLevels()}>
                  {(level) => (
                    <article class={boardSidebarCardClass}>
                      <div class={style15}>
                        <span class={style16}>Level {level.level}</span>
                        <span class={style17}>{level.threshold} XP</span>
                      </div>
                      <Show
                        when={(level.perks ?? []).length > 0}
                        fallback={<p class={style18}>No perk assigned.</p>}
                      >
                        <div class={style19}>
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
                        <div class={style20}>
                          <For each={(level.perks ?? []).filter((perk) => dataString(perk.summary))}>
                            {(perk) => (
                              <p class={style21}>{perk.summary}</p>
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

          <section class={style2}>
            <div class={style12}>
              <p class={style3}>Villagers</p>
              <span class={style13}>{villagerStatuses().length}</span>
            </div>

            <Show
              when={villagerStatuses().length > 0}
              fallback={<p class={style6}>No villagers on board.</p>}
            >
              <div class={style14}>
                <For each={villagerStatuses()}>
                  {(villager) => (
                    <div class={boardSidebarCardClass}>
                      <div class={style22}>
                        <span class={style23}>{villager.name}</span>
                        <span class={villager.stamina <= 0 ? style24 : style25}>
                          STA {villager.stamina}/{villager.maxStamina}
                        </span>
                      </div>
                      <p class={style26}>
                        Lv {villager.level} · XP {villager.xp}/{villager.nextLevelXP}
                      </p>
                      <p class={style27}>
                        {villager.xpToNextLevel > 0 ? `+${villager.xpToNextLevel} to next level` : "Max level reached"}
                      </p>
                      <Show when={villager.perks.length > 0}>
                        <div class={style19}>
                          <For each={villager.perks}>
                            {(perkID) => <span class={boardPerkChipClass}>{villagerPerkLabel(perkID)}</span>}
                          </For>
                        </div>
                      </Show>
                      <Show when={villager.stamina <= 0}>
                        <p class={style28}>Needs action</p>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </section>

          <section class={style2}>
            <div class={style12}>
              <p class={style3}>Quests</p>
              <span class={style13}>{activeQuests().length} active</span>
            </div>

            <Show when={activeQuests().length > 0} fallback={<p class={style6}>No active quests.</p>}>
              <div class={style29}>
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
                      <article class={style30}>
                        <div class={style31}>
                          <p class={style32}>{quest.title}</p>
                          <span class={` ${style33} ${boardChipClass}`}>
                            {questTypeLabel(quest.type)}
                          </span>
                        </div>
                        <p class={style18}>
                          {completedCount()}/{objectives().length || 1} objectives
                        </p>
                        <Show when={quest.howToComplete}>
                          <p class={style34}>How: {quest.howToComplete}</p>
                        </Show>
                        <Show when={quest.definitionOfDone}>
                          <p class={style35}>Done when: {quest.definitionOfDone}</p>
                        </Show>
                        <div class={style36}>
                          <For each={objectives()}>
                            {(objective) => (
                              <div class={style37}>
                                <span class={objective.complete ? style38 : style39}>{questObjectiveLabel(objective)}</span>
                                <span class={objective.complete ? style11 : style40}>
                                  {objective.complete ? "Done" : questObjectiveProgressLabel(objective)}
                                </span>
                              </div>
                            )}
                          </For>
                        </div>
                        <Show when={(quest.acceptanceCriteria ?? []).length > 0}>
                          <div class={style41}>
                            <For each={(quest.acceptanceCriteria ?? []).slice(0, 2)}>
                              {(criterion) => (
                                <p class={style42}>- {criterion}</p>
                              )}
                            </For>
                          </div>
                        </Show>
                        <Show when={rewardText()}>
                          <p class={style43}>Reward: {rewardText()}</p>
                        </Show>
                        <Show when={quest.claimable}>
                          <Button
                            type="button"
                            class={style44}
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

          <section class={style2}>
            <p class={style3}>Board Stats</p>
            <div class={style9}>
              <p>Decks: {summary().deckCount}</p>
              <p>Zombies: {summary().zombieCount}</p>
              <p>Day ticks: {summary().dayTicks}</p>
              <p>Total stacks: {stacks().length}</p>
            </div>
          </section>

          <section class={style2}>
            <p class={style3}>Inventory</p>
            <div class={style45}>
              <p>🪙 {summary().inventory.coin ?? 0}</p>
              <p>📄 {summary().inventory.paper ?? 0}</p>
              <p>🖋️ {summary().inventory.ink ?? 0}</p>
              <p>⚙️ {summary().inventory.gear ?? 0}</p>
              <p>🔩 {summary().inventory.parts ?? 0}</p>
            </div>
          </section>

          <p class={style46}>
            Deck row is pinned above the bottom tab bar on mobile.
          </p>
        </div>
  );
}

const mobileTagline = css`display: flex; justify-content: center; padding: .8rem .5rem 1rem; border-bottom: 1px solid rgba(255,32,114,.28);`;


const style1 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style2 = css`
border-radius: var(--radius-2xl);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

const style3 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

const style4 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
`;

const style5 = css`
margin-top: calc(var(--spacing) * 2);
display: inline-flex;
`;

const style6 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

const style7 = css`
margin-top: calc(var(--spacing) * 3);
`;

const style8 = css`
margin-top: calc(var(--spacing) * 2);
`;

const style9 = css`
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

const style10 = css`
color: #ff8c8c;
`;

const style11 = css`
color: #7ddf98;
`;

const style12 = css`
display: flex;
align-items: center;
justify-content: space-between;
`;

const style13 = css`
font-size: 11px;
color: var(--text-soft);
`;

const style14 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1.5) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1.5) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style15 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
`;

const style16 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style17 = css`
color: var(--text-soft);
`;

const style18 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
color: var(--text-soft);
`;

const style19 = css`
margin-top: calc(var(--spacing) * 2);
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 1.5);
`;

const style20 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style21 = css`
font-size: 10px;
color: var(--text-soft);
`;

const style22 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
`;

const style23 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
`;

const style24 = css`
color: var(--danger);
`;

const style25 = css`
color: var(--warning);
`;

const style26 = css`
margin-top: calc(var(--spacing) * 0.5);
font-size: 11px;
color: var(--text-soft);
`;

const style27 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 10px;
color: var(--text-soft);
`;

const style28 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 10px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--danger);
text-transform: uppercase;
`;

const style29 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style30 = css`
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 2);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

const style31 = css`
display: flex;
align-items: flex-start;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
`;

const style32 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style33 = css`
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 1.5);
padding-block: calc(var(--spacing) * 0.5);
font-size: 10px;
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
text-transform: uppercase;
`;

const style34 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
color: #b7c9e8;
`;

const style35 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
color: #9ec4b1;
`;

const style36 = css`
margin-top: calc(var(--spacing) * 1);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style37 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
font-size: 11px;
`;

const style38 = css`
color: #8be39f;
`;

const style39 = css`
color: #cdd9ef;
`;

const style40 = css`
color: #8ca4cf;
`;

const style41 = css`
margin-top: calc(var(--spacing) * 1);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 0.5) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 0.5) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style42 = css`
font-size: 10px;
color: #88a2c7;
`;

const style43 = css`
margin-top: calc(var(--spacing) * 1);
font-size: 11px;
color: #f1d38e;
`;

const style44 = css`
margin-top: calc(var(--spacing) * 2);
border-radius: var(--radius-md);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: #4b6d48;
background-color: #12301f;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #bff5cb;
&:disabled {
    opacity: 50%;
  }
`;

const style45 = css`
margin-top: calc(var(--spacing) * 2);
display: grid;
grid-template-columns: repeat(2, minmax(0, 1fr));
gap: calc(var(--spacing) * 1.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style46 = css`
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;
