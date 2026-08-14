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
  );
}
