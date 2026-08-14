import { css } from "@linaria/core";
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
} from "../features/board/board-rules";import type { BoardControllerMiningContext } from "./BoardControllerMining";

export function createBoardControllerLifecycle(context: BoardControllerMiningContext) {
  const {
    state,
    setState,
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
    setBoardPan,
    setViewportSize,
    setMiningTickMs,
    setDeckOrderPrefs,
    runtime,
    stacks,
    topDefID,
    worldFromClient,
    clearLocalPosition,
    suppressStackClick,
    isCollectDeck,
    canMergeDraggedCardsIntoTarget,
    loadProjects,
    loadTeamSettings,
    loadBoard,
    sendCommand,
    openDetail,
    activateDeckOrPack,
    resolveMergeTarget,
  } = context;

  onSettled(() => {
    void loadProjects();
    void loadTeamSettings();

    try {
      const raw = window.localStorage.getItem(DECK_ROW_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const prefs = parsed
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0);
          setDeckOrderPrefs(prefs);
        }
      }
    } catch {
      // Ignore malformed local preferences.
    }

    const syncViewport = () => {
      setViewportSize({
        width: runtime.boardRef?.clientWidth ?? 0,
        height: runtime.boardRef?.clientHeight ?? 0,
      });
    };

    syncViewport();
    const miningTickTimer = window.setInterval(() => setMiningTickMs(Date.now()), 120);

    let resizeObserver: ResizeObserver | undefined;
    if (runtime.boardRef && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => syncViewport());
      resizeObserver.observe(runtime.boardRef!);
    }
    window.addEventListener("resize", syncViewport);

    const onPointerMove = (event: PointerEvent) => {
      const panDrag = panDragState();
      if (panDrag && event.pointerId === panDrag.pointerId) {
        setBoardPan({
          x: Math.round(panDrag.startPanX + (event.clientX - panDrag.startClientX)),
          y: Math.round(panDrag.startPanY + (event.clientY - panDrag.startClientY)),
        });
        return;
      }

      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId || !runtime.boardRef) return;

      const pointerWorld = worldFromClient(event.clientX, event.clientY);
      const snapped = snapBoardPoint({
        x: Math.round(pointerWorld.x - drag.offsetX),
        y: Math.round(pointerWorld.y - drag.offsetY),
      });

      setLocalPositions((current) => ({
        ...current,
        [drag.stackId]: snapped,
      }));

      if (Math.abs(snapped.x - drag.startX) > 3 || Math.abs(snapped.y - drag.startY) > 3) {
        setDragMoved(true);
      }

      setMergeTargetID(resolveMergeTarget(drag.stackId, snapped, drag.draggedCount));
    };

    const onPointerUp = (event: PointerEvent) => {
      const panDrag = panDragState();
      if (panDrag && event.pointerId === panDrag.pointerId) {
        setPanDragState(null);
        return;
      }

      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId) return;

      const finalPos = localPositions()[drag.stackId] ?? {
        x: drag.startX,
        y: drag.startY,
      };
      const targetID = mergeTargetID();
      const moved = dragMoved();

      setDragState(null);
      setMergeTargetID(null);

      const sourceStack = state()?.stacks[drag.stackId] ?? null;
      const sourceDef = topDefID(sourceStack);
      const draggedSourceCardIDs =
        drag.mode === "split" && sourceStack
          ? splitCardIDs(sourceStack.cards, drag.splitIndex).dragged
          : (sourceStack?.cards ?? []);

      if (drag.mode === "split") {
        if (!moved) {
          clearLocalPosition(drag.stackId);

          if (sourceStack && sourceDef && isPackDef(sourceDef)) {
            suppressStackClick(drag.stackId);
            void activateDeckOrPack(sourceStack);
            return;
          }

          if (sourceDef && cardKind(sourceDef) === "task") {
            openDetail(drag.stackId);
          }
          return;
        }

        suppressStackClick(drag.stackId);
        void (async () => {
          try {
            const splitResult = await sendCommand(
              {
                cmd: "stack.split",
                args: {
                  stackId: drag.stackId,
                  index: drag.splitIndex,
                  newX: finalPos.x,
                  newY: finalPos.y,
                  offsetX: 0,
                  offsetY: 0,
                },
              },
              { refresh: false },
            );

            const splitPatch = (splitResult?.patch ?? null) as
              | {
                  source?: BoardStack;
                  newStack?: BoardStack;
                }
              | null;
            let newStackID = "";

            setState((current) => {
              if (!current) return current;

              const nextStacks = { ...current.stacks };

              if (splitPatch?.source) {
                if (splitPatch.source.cards.length > 0) {
                  nextStacks[splitPatch.source.id] = splitPatch.source;
                } else {
                  delete nextStacks[splitPatch.source.id];
                }
              }

              if (splitPatch?.newStack) {
                nextStacks[splitPatch.newStack.id] = splitPatch.newStack;
                newStackID = splitPatch.newStack.id;
              }

              return {
                ...current,
                stacks: nextStacks,
                version: splitResult?.newVersion ?? current.version,
              };
            });

            if (!newStackID) {
              await loadBoard();
              return;
            }

            if (targetID && targetID !== drag.stackId) {
              const targetStack = state()?.stacks[targetID] ?? null;
              const targetDef = topDefID(targetStack);
              const newStack = state()?.stacks[newStackID] ?? null;
              const newStackCardIDs = newStack?.cards ?? [];

              if (targetStack && canMergeDraggedCardsIntoTarget(targetStack, newStackCardIDs) && isCollectDeck(targetStack)) {
                // Optimistic: remove the newly-split stack before collecting.
                setState((current) => {
                  if (!current) return current;
                  const nextStacks = { ...current.stacks };
                  delete nextStacks[newStackID];
                  return { ...current, stacks: nextStacks };
                });
                await sendCommand({
                  cmd: "loot.collect_stack",
                  args: { stackId: newStackID },
                });
                return;
              }

              if (targetStack && canMergeDraggedCardsIntoTarget(targetStack, newStackCardIDs) && (!targetDef || cardKind(targetDef) !== "deck")) {
                // Optimistic: merge new stack cards into target.
                setState((current) => {
                  if (!current) return current;
                  const src = current.stacks[newStackID];
                  const tgt = current.stacks[targetID];
                  if (!src || !tgt) return current;
                  const nextStacks = { ...current.stacks };
                  nextStacks[targetID] = { ...tgt, cards: [...tgt.cards, ...src.cards] };
                  delete nextStacks[newStackID];
                  return { ...current, stacks: nextStacks };
                });
                await sendCommand({
                  cmd: "stack.merge",
                  args: { targetId: targetID, sourceId: newStackID },
                });
              }
            }
          } catch {
            // Error state is set in sendCommand.
          } finally {
            clearLocalPosition(drag.stackId);
          }
        })();
        return;
      }

      if (targetID && targetID !== drag.stackId) {
        const targetStack = state()?.stacks[targetID] ?? null;
        const targetDef = topDefID(targetStack);
        const canMergeIntoTarget = canMergeDraggedCardsIntoTarget(targetStack, draggedSourceCardIDs);

        if (targetStack && canMergeIntoTarget && isCollectDeck(targetStack) && sourceDef && !isDeckDef(sourceDef) && !isPackDef(sourceDef)) {
          suppressStackClick(drag.stackId);
          // Optimistic: remove source stack so the card doesn't flash back.
          setState((current) => {
            if (!current) return current;
            const nextStacks = { ...current.stacks };
            delete nextStacks[drag.stackId];
            return { ...current, stacks: nextStacks };
          });
          clearLocalPosition(drag.stackId);
          void sendCommand({
            cmd: "loot.collect_stack",
            args: { stackId: drag.stackId },
          });
          return;
        }

        if (!canMergeIntoTarget || (sourceDef && targetDef && (cardKind(sourceDef) === "deck" || cardKind(targetDef) === "deck"))) {
          if (!moved) {
            clearLocalPosition(drag.stackId);
            return;
          }
        } else {
          suppressStackClick(drag.stackId);
          // Optimistic: move cards from source into target so the card
          // doesn't flash back to the source position while the server
          // processes the merge.
          setState((current) => {
            if (!current) return current;
            const src = current.stacks[drag.stackId];
            const tgt = current.stacks[targetID];
            if (!src || !tgt) return current;
            const nextStacks = { ...current.stacks };
            nextStacks[targetID] = { ...tgt, cards: [...tgt.cards, ...src.cards] };
            delete nextStacks[drag.stackId];
            return { ...current, stacks: nextStacks };
          });
          clearLocalPosition(drag.stackId);
          void sendCommand({
            cmd: "stack.merge",
            args: { targetId: targetID, sourceId: drag.stackId },
          });
          return;
        }
      }

      if (moved) {
        suppressStackClick(drag.stackId);
        void (async () => {
          try {
            const result = await sendCommand(
              {
                cmd: "stack.move",
                args: {
                  stackId: drag.stackId,
                  x: finalPos.x,
                  y: finalPos.y,
                },
              },
              { refresh: false },
            );

            setState((current) => {
              if (!current) return current;
              const existing = current.stacks[drag.stackId];
              if (!existing) return current;

              let z = existing.z;
              const patch = result?.patch as { stack?: { z?: number } } | undefined;
              if (patch?.stack && typeof patch.stack.z === "number") {
                z = patch.stack.z;
              }

              return {
                ...current,
                stacks: {
                  ...current.stacks,
                  [drag.stackId]: {
                    ...existing,
                    pos: { x: finalPos.x, y: finalPos.y },
                    z,
                  },
                },
                version: result?.newVersion ?? current.version,
              };
            });
          } catch {
            // Error state is set in sendCommand.
          } finally {
            clearLocalPosition(drag.stackId);
          }
        })();
        return;
      }

      clearLocalPosition(drag.stackId);

      if (sourceStack && sourceDef && isPackDef(sourceDef)) {
        suppressStackClick(drag.stackId);
        void activateDeckOrPack(sourceStack);
        return;
      }

      if (sourceDef && cardKind(sourceDef) === "task") {
        openDetail(drag.stackId);
      }
    };

    const onPointerCancel = (event: PointerEvent) => {
      const panDrag = panDragState();
      if (panDrag && event.pointerId === panDrag.pointerId) {
        setPanDragState(null);
      }

      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId) return;

      setDragState(null);
      setDragMoved(false);
      setMergeTargetID(null);
      clearLocalPosition(drag.stackId);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);

    return () => {
      window.clearInterval(miningTickTimer);
      if (runtime.syncTimer) window.clearInterval(runtime.syncTimer);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("resize", syncViewport);
      resizeObserver?.disconnect();
      if (runtime.composerParseTimer !== undefined) {
        window.clearTimeout(runtime.composerParseTimer);
      }
      if (runtime.detailParseTimer !== undefined) {
        window.clearTimeout(runtime.detailParseTimer);
      }
      runtime.composerParseController?.abort();
      runtime.detailParseController?.abort();
    };
  });

  return {};
}

export type BoardControllerLifecycleContext = BoardControllerMiningContext & ReturnType<typeof createBoardControllerLifecycle>;
