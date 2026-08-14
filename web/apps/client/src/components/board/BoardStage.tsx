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
import { boardArtwork, style1, style2, style3, style4, style5, style6, style7, style8, style9, style10, style11, style12, style13, style14, style15, style16, style17, style18, style19, style20, style21, style22, style23, style24, style25, style26, style27, style28, style29, style30, style31, style32, style33, style34, style35, style36, style37, style38, style39, style40, style41, style42, style43, style44, style45, style46, style47, style48, style49, style50, style51, style52 } from "./styles/BoardStage.styles";

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
        <section class={`${boardArtwork} ${style1}`}>
          <Show when={minimapModel()}>
            {(model) => (
              <>
                <Button
                  type="button"
                  class={boardMapToggleClass()}
                  onClick={() => setMobileMapHubOpen((open) => !open)}
                  data-testid="board-mobile-map-toggle"
                >
                  {mobileMapHubOpen() ? "Hide Map" : "Map"}
                </Button>

                <Show when={mobileMapHubOpen()}>
                  <div class={style2}>
                    <div class={boardMapPanelClass()}>
                      <div class={style3}>
                        <span class={boardMapTitleClass()}>Map Hub</span>
                        <span class={boardMapStatusClass(model().offscreenCount > 0)}>
                          {model().offscreenCount > 0 ? `${model().offscreenCount} off-screen` : "All visible"}
                        </span>
                      </div>

                      <div
                        class={` ${style4} ${boardMinimapSurfaceClass()}`}
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
                              class={` ${style5} ${
                                dot.isSelected ? style6 : ""
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

                <div class={style7}>
                  <div class={boardMapPanelClass()}>
                    <div class={style8}>
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
                            class={` ${style5} ${
                              dot.isSelected ? style6 : ""
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
                <div class={style9}>
                  <div>
                    <p class={` ${style10} ${deckHubTitleClass()}`}>Deck Hub</p>
                    <p class={` ${style11} ${deckHubTextClass()}`}>Drag decks between row and reserve.</p>
                  </div>
                  <Button
                    type="button"
                    class={deckHubCloseClass()}
                    onClick={() => setDeckHubOpen(false)}
                  >
                    Close
                  </Button>
                </div>

                <div class={style12}>
                  <section>
                    <div class={style13}>
                      <p class={` ${style14} ${deckHubSectionTitleClass()}`}>Deck Row</p>
                      <p class={` ${style15} ${deckHubSectionMetaClass()}`}>Visible: {deckRowDefIDs().length}</p>
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
                            class={` ${style16} ${
                              deckHubDragDefID() === defID
                                ? style17
                                : style18
                            }`}
                            onDragStart={(event) => beginDeckHubDrag(event, defID)}
                            onDragEnd={endDeckHubDrag}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDeckHubDropToRow(event, index())}
                          >
                            <span class={style19}>{deckDisplayName(defID)}</span>
                            <Button
                              type="button"
                              data-testid="board-deck-hub-hide"
                              class={style20}
                              onClick={() => moveDeckToReserve(defID)}
                            >
                              Hide
                            </Button>
                          </div>
                        )}
                      </For>

                      <Show when={deckRowDefIDs().length === 0}>
                        <p class={` ${style21} ${isLightTheme() ? style22 : style23}`}>
                          No decks in row.
                        </p>
                      </Show>
                    </div>
                  </section>

                  <section>
                    <div class={style13}>
                      <p class={` ${style14} ${deckHubSectionTitleClass()}`}>Reserve</p>
                      <p class={` ${style15} ${deckHubSectionMetaClass()}`}>Hidden: {deckOverflowDefIDs().length}</p>
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
                            class={` ${style16} ${
                              deckHubDragDefID() === defID
                                ? style17
                                : style24
                            }`}
                            onDragStart={(event) => beginDeckHubDrag(event, defID)}
                            onDragEnd={endDeckHubDrag}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => handleDeckHubDropToReserve(event, index())}
                          >
                            <span class={style19}>{deckDisplayName(defID)}</span>
                            <Button
                              type="button"
                              data-testid="board-deck-hub-show"
                              class={style25}
                              onClick={() => moveDeckToRow(defID)}
                            >
                              Show
                            </Button>
                          </div>
                        )}
                      </For>

                      <Show when={deckOverflowDefIDs().length === 0}>
                        <p class={` ${style21} ${isLightTheme() ? style22 : style26}`}>
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

            <Show when={!loading()} fallback={<p class={style27}>Loading board...</p>}>
              <div
                class={style28}
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
                        class={` ${style29} ${
                          topIsDeckLike() ? style30 : style31
                        } ${
                          isMergeTarget()
                            ? style32
                            : isExhaustedVillager()
                              ? style33
                              : hasNextActionModifier()
                              ? style34
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
                            class={style35}
                            data-testid="board-stack-exhausted"
                          >
                            No stamina
                          </div>
                        </Show>

                        <Show when={miningProgress() !== null}>
                          <div class={style36}>
                            <div class={style37}>
                              <div
                                class={style38}
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
                                class={` ${style39} ${
                                  cardPreview().shellClass
                                }`}
                                style={{
                                  top: `${index() * STACK_OFFSET_Y}px`,
                                  "z-index": `${index() + 1}`,
                                }}
                              >
                                <div
                                  class={` ${style40} ${
                                    cardPreview().titleClass
                                  }`}
                                >
                                  <Show
                                    when={!(isFace() && isInline())}
                                    fallback={
                                      <input
                                        value={inlineTitle()}
                                        onInput={(event) => setInlineTitle(event.currentTarget.value)}
                                        class={style41}
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
                                    <span class={style42} data-testid="board-card-title">
                                      {cardPreview().title}
                                    </span>
                                  </Show>
                                </div>

                                <div class={style43}>
                                  <div class={style44}>
                                    {cardPreview().icon}
                                  </div>
                                  <p class={style45}>{cardPreview().subtitle}</p>
                                </div>

                                <Show when={isFace()}>
                                  <span class={style46}>
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
                          class={style47}
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
                                  class={` ${style39} ${
                                    cardPreview().shellClass
                                  }`}
                                  style={{
                                    top: `${index() * STACK_OFFSET_Y}px`,
                                    "z-index": `${index() + 1}`,
                                  }}
                                >
                                  <div
                                    class={` ${style40} ${
                                      cardPreview().titleClass
                                    }`}
                                  >
                                    <span class={style42}>{cardPreview().title}</span>
                                  </div>

                                  <div class={style43}>
                                    <div class={style44}>
                                      {cardPreview().icon}
                                    </div>
                                    <p class={style45}>{cardPreview().subtitle}</p>
                                  </div>

                                  <Show when={isFace()}>
                                    <span class={style46}>
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
                    <Button
                      type="button"
                      data-stack-root="true"
                      class={style48}
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
                      <div class={style49}>
                        Deck Hub
                      </div>
                      <div class={style43}>
                        <div class={style50}>
                          🗂️
                        </div>
                        <p class={style51}>{deckOverflowDefIDs().length} hidden</p>
                      </div>
                    </Button>
                  )}
                </Show>
              </div>
            </Show>
          </div>

          <Show when={error() && !loading()}>
            <div class={style52}>
              {error()}
            </div>
          </Show>
        </section>
  );
}
