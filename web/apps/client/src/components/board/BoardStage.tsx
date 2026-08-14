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

export default function BoardStage() {
  const {
    isLightTheme,
    state,
    error,
    loading,
    inlineStackID,
    inlineTitle,
    setInlineTitle,
    dragState,
    mergeTargetID,
    boardPan,
    miningSessionsByStackID,
    miningTickMs,
    deckHubOpen,
    setDeckHubOpen,
    deckHubDragDefID,
    setDeckHubDragDefID,
    mobileMapHubOpen,
    setMobileMapHubOpen,
    setBoardRef,
    deckRowDefIDs,
    deckOverflowDefIDs,
    deckHubWorldPosition,
    isMobileBoardViewport,
    renderStacks,
    moveDeckToRow,
    moveDeckToReserve,
    beginDeckHubDrag,
    endDeckHubDrag,
    handleDeckHubDropToRow,
    handleDeckHubDropToReserve,
    stackPosition,
    stackCardsForRender,
    draggedCardsForRender,
    dragPreviewPosition,
    isClickSuppressed,
    draggingOverCollectDeck,
    stackZIndex,
    stackHasCardDefID,
    stackHasKind,
    minimapModel,
    minimapDotClass,
    onMinimapPointerDown,
    onMinimapPointerMove,
    onMinimapPointerUp,
    stackPreview,
    cancelInlineEdit,
    saveInlineEdit,
    activateDeckOrPack,
    onBoardPointerDown,
    onStackPointerDown,
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
  } = useBoard();
  return (
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
  );
}
