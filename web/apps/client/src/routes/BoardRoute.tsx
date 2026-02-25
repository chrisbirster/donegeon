import { A } from "@solidjs/router";
import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";

import {
  boardApi,
  type BoardCard,
  type BoardCommandPayload,
  type BoardPoint,
  type BoardStack,
  type BoardStateResponse,
} from "../server/api";

const DEFAULT_BOARD = "default";

const CARD_WIDTH = 92;
const CARD_HEIGHT = 124;
const STACK_OFFSET_Y = 20;

const MERGE_DISTANCE = 150;
const MIN_MERGE_OVERLAP = 900;

type ApiError = Error & {
  status?: number;
  body?: any;
};

type DragState = {
  stackId: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  mode: "stack" | "split";
  splitIndex: number;
  draggedCount: number;
};

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type StackPreview = {
  title: string;
  subtitle: string;
  kind: string;
  icon: string;
  shellClass: string;
  titleClass: string;
  isDeck: boolean;
  isPack: boolean;
};

type BoardSummary = {
  villagerCount: number;
  zombieCount: number;
  activeTaskCount: number;
  deckCount: number;
  completedCount: number;
  dayTicks: number;
  inventory: Record<string, number>;
};

function dataString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function dataNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function cardKind(defID: string): string {
  const [kind] = defID.split(".");
  return kind || "unknown";
}

function isDeckDef(defID: string): boolean {
  return cardKind(defID) === "deck" && !defID.endsWith("_pack");
}

function isPackDef(defID: string): boolean {
  return cardKind(defID) === "deck" && defID.endsWith("_pack");
}

function prettifyDefID(defID: string): string {
  const normalized = defID.replaceAll(".", " ").replaceAll("_", " ").trim();
  if (!normalized) return "Card";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function deckDisplayName(defID: string): string {
  switch (defID) {
    case "deck.first_day":
      return "First Day";
    case "deck.collect":
      return "Collect";
    case "deck.organization":
      return "Organization";
    case "deck.survival":
      return "Survival";
    case "deck.humble_beginnings":
      return "Humble Beginnings";
    case "deck.seeking_wisdom":
      return "Seeking Wisdom";
    case "deck.reap_sow":
      return "Reap & Sow";
    case "deck.armory":
      return "Armory";
    case "deck.explorers":
      return "Explorers";
    default:
      return prettifyDefID(defID.replace(/_pack$/, ""));
  }
}

function cardIcon(card: BoardCard | null): string {
  if (!card) return "·";

  const defID = card.defId;
  if (defID === "resource.tree") return "🌲";
  if (defID === "food.apple") return "🍎";
  if (defID === "villager.basic") return "🧑";
  if (defID === "zombie.basic") return "🧟";
  if (defID === "loot.coin" || defID === "coin") return "🪙";
  if (defID === "loot.paper") return "📄";
  if (defID === "loot.ink") return "🖋️";
  if (defID === "loot.gear") return "⚙️";
  if (defID === "loot.parts") return "🔩";

  const kind = cardKind(defID);
  switch (kind) {
    case "task":
      return "📝";
    case "deck":
      return isPackDef(defID) ? "🎴" : "📦";
    case "resource":
      return "⛏️";
    case "food":
      return "🥫";
    case "villager":
      return "🧑";
    case "zombie":
      return "☠";
    case "loot":
      return "🎁";
    default:
      return "⬡";
  }
}

function cardSkin(kind: string, defID: string): { shellClass: string; titleClass: string } {
  if (isPackDef(defID)) {
    return {
      shellClass: "border-[#6f5d2f] bg-[#efe0b1] text-[#241a08]",
      titleClass: "bg-[#d9c27f] text-[#2b2009]",
    };
  }

  switch (kind) {
    case "task":
      return {
        shellClass: "border-[#714f52] bg-[#e4b5b8] text-[#241417]",
        titleClass: "bg-[#d4979c] text-[#2d1417]",
      };
    case "villager":
      return {
        shellClass: "border-[#6f5a37] bg-[#e2c593] text-[#211609]",
        titleClass: "bg-[#d4ab6d] text-[#2b1b08]",
      };
    case "resource":
      return {
        shellClass: "border-[#4f6b49] bg-[#b5d6aa] text-[#10200c]",
        titleClass: "bg-[#94bd87] text-[#11260d]",
      };
    case "food":
      return {
        shellClass: "border-[#77563a] bg-[#e6b074] text-[#251508]",
        titleClass: "bg-[#d4924d] text-[#2b1809]",
      };
    case "zombie":
      return {
        shellClass: "border-[#6f3f4a] bg-[#cf9ba7] text-[#220e12]",
        titleClass: "bg-[#bb7f8c] text-[#2a0f14]",
      };
    case "deck":
      return {
        shellClass: "border-[#4a5875] bg-[#afb9ca] text-[#121722]",
        titleClass: "bg-[#8f9db3] text-[#111a2b]",
      };
    case "loot":
      return {
        shellClass: "border-[#6d633d] bg-[#ddd0a1] text-[#1d1807]",
        titleClass: "bg-[#c9b774] text-[#201807]",
      };
    default:
      return {
        shellClass: "border-[#4b505a] bg-[#bbc2cc] text-[#141820]",
        titleClass: "bg-[#9ea7b3] text-[#111722]",
      };
  }
}

function titleFromCard(card: BoardCard | null): string {
  if (!card) return "Unknown";
  const title = dataString(card.data?.title);
  if (title) return title;
  if (card.defId === "task.blank") return "Blank Task";
  if (isDeckDef(card.defId)) return deckDisplayName(card.defId);
  if (isPackDef(card.defId)) return `${deckDisplayName(card.defId)} Pack`;
  return prettifyDefID(card.defId);
}

function subtitleFromCard(card: BoardCard | null): string {
  if (!card) return "";
  const kind = cardKind(card.defId);
  if (isDeckDef(card.defId)) return "DECK";
  if (isPackDef(card.defId)) return "PACK";
  if (kind === "task") {
    const priority = dataNumber(card.data?.priority);
    if (priority && priority >= 1 && priority <= 4) {
      return `TASK · P${priority}`;
    }
    return "TASK";
  }
  return kind.toUpperCase();
}

function descriptionFromCard(card: BoardCard | null): string {
  if (!card) return "";
  return dataString(card.data?.description);
}

function cardFromStack(stack: BoardStack | null, state: BoardStateResponse | null): BoardCard | null {
  if (!stack || !state || stack.cards.length === 0) return null;
  const topID = stack.cards[stack.cards.length - 1];
  return state.cards[topID] ?? null;
}

function taskCardFromStack(stack: BoardStack | null, state: BoardStateResponse | null): BoardCard | null {
  if (!stack || !state || stack.cards.length === 0) return null;
  for (let index = stack.cards.length - 1; index >= 0; index -= 1) {
    const card = state.cards[stack.cards[index]];
    if (card && card.defId.startsWith("task.")) {
      return card;
    }
  }
  return null;
}

function cardFromCardIDs(cardIDs: string[], state: BoardStateResponse | null): BoardCard | null {
  if (!state || cardIDs.length === 0) return null;
  const topID = cardIDs[cardIDs.length - 1];
  return state.cards[topID] ?? null;
}

function splitCardIDs(cardIDs: string[], index: number): { remaining: string[]; dragged: string[] } {
  if (cardIDs.length === 0) {
    return {
      remaining: [],
      dragged: [],
    };
  }

  const clamped = Math.max(0, Math.min(cardIDs.length - 1, Math.trunc(index)));
  if (clamped === 0) {
    return {
      remaining: cardIDs.slice(1),
      dragged: cardIDs.slice(0, 1),
    };
  }

  return {
    remaining: cardIDs.slice(0, clamped),
    dragged: cardIDs.slice(clamped),
  };
}

function stackHeightPx(cardCount: number): number {
  return CARD_HEIGHT + Math.max(0, cardCount - 1) * STACK_OFFSET_Y;
}

function stackBounds(pos: BoardPoint, cardCount: number): Rect {
  return {
    left: pos.x,
    top: pos.y,
    right: pos.x + CARD_WIDTH,
    bottom: pos.y + stackHeightPx(cardCount),
  };
}

function overlapArea(a: Rect, b: Rect): number {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

function rectCenter(rect: Rect): BoardPoint {
  return {
    x: rect.left + (rect.right - rect.left) / 2,
    y: rect.top + (rect.bottom - rect.top) / 2,
  };
}

function distance(a: BoardPoint, b: BoardPoint): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function packDeckID(card: BoardCard): string {
  const fromData = dataString(card.data?.deckId);
  if (fromData) return fromData;
  if (card.defId.endsWith("_pack")) {
    return card.defId.slice(0, -"_pack".length);
  }
  return "deck.first_day";
}

export default function BoardRoute() {
  const [state, setState] = createSignal<BoardStateResponse | null>(null);
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [busy, setBusy] = createSignal(false);

  const [newTitle, setNewTitle] = createSignal("");

  const [selectedStackID, setSelectedStackID] = createSignal<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = createSignal(false);
  const [detailTitle, setDetailTitle] = createSignal("");
  const [detailDescription, setDetailDescription] = createSignal("");

  const [inlineStackID, setInlineStackID] = createSignal<string | null>(null);
  const [inlineTitle, setInlineTitle] = createSignal("");

  const [dragState, setDragState] = createSignal<DragState | null>(null);
  const [dragMoved, setDragMoved] = createSignal(false);
  const [mergeTargetID, setMergeTargetID] = createSignal<string | null>(null);
  const [localPositions, setLocalPositions] = createSignal<Record<string, BoardPoint>>({});
  const [clickSuppress, setClickSuppress] = createSignal<{ stackId: string; until: number } | null>(null);

  let boardRef: HTMLDivElement | undefined;

  const stacks = createMemo(() => Object.values(state()?.stacks ?? {}).sort((a, b) => a.z - b.z));

  const selectedStack = createMemo(() => {
    const id = selectedStackID();
    if (!id) return null;
    return state()?.stacks[id] ?? null;
  });

  const selectedTaskCard = createMemo(() => taskCardFromStack(selectedStack(), state()));

  const selectedCard = createMemo(() => cardFromStack(selectedStack(), state()));

  const summary = createMemo<BoardSummary>(() => {
    const current = state();
    if (!current) {
      return {
        villagerCount: 0,
        zombieCount: 0,
        activeTaskCount: 0,
        deckCount: 0,
        completedCount: 0,
        dayTicks: 0,
        inventory: {},
      };
    }

    let villagerCount = 0;
    let zombieCount = 0;
    let activeTaskCount = 0;
    let deckCount = 0;

    for (const stack of Object.values(current.stacks)) {
      if (!stack || stack.cards.length === 0) continue;

      let hasTask = false;
      let hasVillager = false;
      let hasZombie = false;

      for (const cardID of stack.cards) {
        const card = current.cards[cardID];
        if (!card) continue;
        const kind = cardKind(card.defId);
        if (kind === "task") hasTask = true;
        if (kind === "villager") hasVillager = true;
        if (kind === "zombie") hasZombie = true;
      }

      const top = cardFromStack(stack, current);
      if (top && isDeckDef(top.defId)) {
        deckCount += 1;
      }
      if (hasTask) activeTaskCount += 1;
      if (hasVillager) villagerCount += 1;
      if (hasZombie) zombieCount += 1;
    }

    return {
      villagerCount,
      zombieCount,
      activeTaskCount,
      deckCount,
      completedCount: current.meta?.metrics?.tasks_completed ?? 0,
      dayTicks: current.meta?.metrics?.day_ticks ?? 0,
      inventory: current.meta?.inventory ?? {},
    };
  });

  function stackPosition(stack: BoardStack): BoardPoint {
    const drag = dragState();
    if (drag && drag.mode === "split" && drag.stackId === stack.id) {
      return stack.pos;
    }
    return localPositions()[stack.id] ?? stack.pos;
  }

  function stackCardsForRender(stack: BoardStack): string[] {
    const drag = dragState();
    if (!drag || drag.mode !== "split" || drag.stackId !== stack.id) {
      return stack.cards;
    }
    return splitCardIDs(stack.cards, drag.splitIndex).remaining;
  }

  function draggedCardsForRender(stack: BoardStack): string[] {
    const drag = dragState();
    if (!drag || drag.mode !== "split" || drag.stackId !== stack.id) {
      return [];
    }
    return splitCardIDs(stack.cards, drag.splitIndex).dragged;
  }

  function dragPreviewPosition(stackID: string): BoardPoint | null {
    const drag = dragState();
    if (!drag || drag.mode !== "split" || drag.stackId !== stackID) {
      return null;
    }
    return localPositions()[stackID] ?? null;
  }

  function clearLocalPosition(stackID: string) {
    setLocalPositions((current) => {
      const next = { ...current };
      delete next[stackID];
      return next;
    });
  }

  function suppressStackClick(stackID: string) {
    setClickSuppress({
      stackId: stackID,
      until: Date.now() + 300,
    });
  }

  function isClickSuppressed(stackID: string): boolean {
    const suppression = clickSuppress();
    if (!suppression) return false;
    return suppression.stackId === stackID && Date.now() < suppression.until;
  }

  function isCollectDeck(stack: BoardStack | null): boolean {
    const top = cardFromStack(stack, state());
    return !!top && top.defId === "deck.collect";
  }

  function topDefID(stack: BoardStack | null): string {
    const top = cardFromStack(stack, state());
    if (!top) return "";
    return top.defId;
  }

  function stackPreview(stack: BoardStack, cardIDs?: string[]): StackPreview {
    const card = cardIDs ? cardFromCardIDs(cardIDs, state()) : cardFromStack(stack, state());
    const kind = card ? cardKind(card.defId) : "unknown";
    const isDeck = card ? isDeckDef(card.defId) : false;
    const isPack = card ? isPackDef(card.defId) : false;
    const skin = cardSkin(kind, card?.defId ?? "");

    let title = titleFromCard(card);
    if (card && isPack) {
      title = `${deckDisplayName(packDeckID(card))} Pack`;
    }

    return {
      title,
      subtitle: subtitleFromCard(card),
      kind,
      icon: cardIcon(card),
      shellClass: skin.shellClass,
      titleClass: skin.titleClass,
      isDeck,
      isPack,
    };
  }

  async function loadBoard() {
    setLoading(true);
    try {
      const response = await boardApi.getState(DEFAULT_BOARD);
      setState(response);
      setError("");
      setLocalPositions({});
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function sendCommand(
    payload: BoardCommandPayload,
    options: { refresh?: boolean; retryConflict?: boolean } = {},
  ) {
    const refresh = options.refresh ?? true;
    const retryConflict = options.retryConflict ?? true;

    setBusy(true);
    try {
      const response = await boardApi.command(
        {
          ...payload,
          clientVersion: state()?.version,
        },
        DEFAULT_BOARD,
      );

      if (refresh) {
        await loadBoard();
      }
      return response;
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.status === 409 && retryConflict) {
        await loadBoard();
        return sendCommand(payload, { refresh, retryConflict: false });
      }
      setError(apiError.message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function seedBoard() {
    try {
      await sendCommand({ cmd: "board.seed_default", args: {} });
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function refreshBoard() {
    await loadBoard();
  }

  async function endDay() {
    try {
      await sendCommand({ cmd: "world.end_day", args: {} });
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function spawnTaskCard() {
    const count = stacks().length;
    const x = 120 + (count * 37) % 720;
    const y = 120 + (count * 23) % 380;
    try {
      await sendCommand({
        cmd: "card.spawn",
        args: {
          defId: "task.blank",
          x,
          y,
          data: {
            title: "",
            description: "",
            project: "inbox",
          },
        },
      });
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function createTaskStack() {
    const count = stacks().length;
    const x = 64 + (count * 41) % 780;
    const y = 68 + (count * 29) % 420;
    const title = newTitle().trim();

    try {
      await sendCommand({
        cmd: "task.create_blank",
        args: {
          x,
          y,
          title,
        },
      });
      setNewTitle("");
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  function openDetail(stackID: string) {
    const stack = state()?.stacks[stackID];
    if (!stack) return;

    const card = taskCardFromStack(stack, state()) ?? cardFromStack(stack, state());
    setSelectedStackID(stackID);
    setDetailTitle(titleFromCard(card));
    setDetailDescription(descriptionFromCard(card));
    setIsDetailOpen(true);
  }

  function closeDetail() {
    setIsDetailOpen(false);
  }

  async function saveDetail() {
    const stack = selectedStack();
    const taskCard = selectedTaskCard();
    if (!stack || !taskCard) {
      setError("Selected stack does not include a task card.");
      return;
    }

    try {
      await sendCommand(
        {
          cmd: "task.set_title",
          args: {
            taskCardId: taskCard.id,
            title: detailTitle().trim(),
          },
        },
        { refresh: false },
      );

      await sendCommand({
        cmd: "task.set_description",
        args: {
          taskCardId: taskCard.id,
          description: detailDescription().trim(),
        },
      });

      closeDetail();
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function completeStack(stackID: string) {
    try {
      await sendCommand({
        cmd: "task.complete_stack",
        args: { stackId: stackID },
      });
      if (selectedStackID() === stackID) {
        closeDetail();
      }
      setInlineStackID(null);
      setInlineTitle("");
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function removeStack(stackID: string) {
    try {
      await sendCommand({
        cmd: "stack.remove",
        args: { stackId: stackID },
      });
      if (selectedStackID() === stackID) {
        closeDetail();
      }
      setInlineStackID(null);
      setInlineTitle("");
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  function startInlineEdit(stackID: string) {
    const stack = state()?.stacks[stackID];
    if (!stack) return;
    const card = taskCardFromStack(stack, state());
    if (!card) {
      setError("Only task cards can be renamed inline.");
      return;
    }
    setInlineStackID(stackID);
    setInlineTitle(titleFromCard(card));
    setError("");
  }

  function cancelInlineEdit() {
    setInlineStackID(null);
    setInlineTitle("");
  }

  async function saveInlineEdit() {
    const stackID = inlineStackID();
    if (!stackID) return;

    const stack = state()?.stacks[stackID];
    if (!stack) return;

    const taskCard = taskCardFromStack(stack, state());
    if (!taskCard) return;

    try {
      await sendCommand({
        cmd: "task.set_title",
        args: {
          taskCardId: taskCard.id,
          title: inlineTitle().trim(),
        },
      });
      cancelInlineEdit();
      setError("");
    } catch {
      // Error state is set in sendCommand.
    }
  }

  async function activateDeckOrPack(stack: BoardStack) {
    const top = cardFromStack(stack, state());
    if (!top) return;

    if (isDeckDef(top.defId)) {
      if (top.defId === "deck.collect") {
        return;
      }
      const pos = stackPosition(stack);
      const spawnX = pos.x + CARD_WIDTH + 26;
      const spawnY = Math.max(24, pos.y - 130);
      try {
        await sendCommand({
          cmd: "deck.spawn_pack",
          args: {
            deckStackId: stack.id,
            x: spawnX,
            y: spawnY,
          },
        });
      } catch {
        // Error state is set in sendCommand.
      }
      return;
    }

    if (isPackDef(top.defId)) {
      try {
        await sendCommand({
          cmd: "deck.open_pack",
          args: {
            packStackId: stack.id,
            deckId: packDeckID(top),
          },
        });
      } catch {
        // Error state is set in sendCommand.
      }
    }
  }

  function isDeckLikeStack(stack: BoardStack): boolean {
    const top = cardFromStack(stack, state());
    return !!top && isDeckDef(top.defId);
  }

  function resolveMergeTarget(sourceID: string, sourcePos: BoardPoint, sourceCardCount: number): string | null {
    const source = state()?.stacks[sourceID];
    if (!source) return null;

    const sourceRect = stackBounds(sourcePos, sourceCardCount);

    let bestAreaID: string | null = null;
    let bestArea = 0;

    for (const stack of stacks()) {
      if (stack.id === sourceID) continue;
      const targetRect = stackBounds(stackPosition(stack), stack.cards.length);
      const area = overlapArea(sourceRect, targetRect);
      if (area > bestArea) {
        bestArea = area;
        bestAreaID = stack.id;
      }
    }

    if (bestAreaID && bestArea >= MIN_MERGE_OVERLAP) {
      return bestAreaID;
    }

    const sourceCenter = rectCenter(sourceRect);
    let nearestID: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const stack of stacks()) {
      if (stack.id === sourceID) continue;
      const targetRect = stackBounds(stackPosition(stack), stack.cards.length);
      const targetCenter = rectCenter(targetRect);
      const d = distance(sourceCenter, targetCenter);
      if (d <= MERGE_DISTANCE && d < nearestDistance) {
        nearestDistance = d;
        nearestID = stack.id;
      }
    }

    return nearestID;
  }

  function stackCardIndexFromPointer(event: PointerEvent, stack: BoardStack): number {
    const topIndex = stack.cards.length - 1;
    if (topIndex <= 0) return Math.max(topIndex, 0);

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return topIndex;
    }

    const layer = target.closest<HTMLElement>("[data-card-index]");
    if (!layer) {
      return topIndex;
    }

    const parsed = Number(layer.dataset.cardIndex ?? topIndex);
    if (!Number.isFinite(parsed)) {
      return topIndex;
    }

    return Math.max(0, Math.min(topIndex, Math.trunc(parsed)));
  }

  function onStackPointerDown(event: PointerEvent, stack: BoardStack) {
    if (event.button !== 0 || busy()) return;
    if (!boardRef) return;

    setSelectedStackID(stack.id);

    if (isDeckLikeStack(stack)) {
      setDragState(null);
      setDragMoved(false);
      return;
    }

    event.preventDefault();

    const boardRect = boardRef.getBoundingClientRect();
    const pos = stackPosition(stack);
    const cardIndex = stackCardIndexFromPointer(event, stack);
    const splitMode = stack.cards.length > 1 && cardIndex < stack.cards.length - 1;
    const cardOffsetY = splitMode ? cardIndex * STACK_OFFSET_Y : 0;
    const dragCardCount = splitMode ? splitCardIDs(stack.cards, cardIndex).dragged.length : stack.cards.length;

    setDragMoved(false);
    setMergeTargetID(null);

    setDragState({
      stackId: stack.id,
      pointerId: event.pointerId,
      offsetX: event.clientX - boardRect.left - pos.x,
      offsetY: event.clientY - boardRect.top - (pos.y + cardOffsetY),
      startX: pos.x,
      startY: pos.y + cardOffsetY,
      mode: splitMode ? "split" : "stack",
      splitIndex: cardIndex,
      draggedCount: Math.max(1, dragCardCount),
    });

    setLocalPositions((current) => ({
      ...current,
      [stack.id]: { x: pos.x, y: pos.y + cardOffsetY },
    }));
  }

  onMount(() => {
    void loadBoard();

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragState();
      if (!drag || event.pointerId !== drag.pointerId || !boardRef) return;

      const rect = boardRef.getBoundingClientRect();
      const x = Math.max(16, Math.round(event.clientX - rect.left - drag.offsetX));
      const y = Math.max(16, Math.round(event.clientY - rect.top - drag.offsetY));

      setLocalPositions((current) => ({
        ...current,
        [drag.stackId]: { x, y },
      }));

      if (Math.abs(x - drag.startX) > 3 || Math.abs(y - drag.startY) > 3) {
        setDragMoved(true);
      }

      setMergeTargetID(resolveMergeTarget(drag.stackId, { x, y }, drag.draggedCount));
    };

    const onPointerUp = (event: PointerEvent) => {
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

      if (drag.mode === "split") {
        if (!moved) {
          clearLocalPosition(drag.stackId);

          if (sourceStack && sourceDef && isPackDef(sourceDef)) {
            suppressStackClick(drag.stackId);
            void activateDeckOrPack(sourceStack);
            return;
          }

          openDetail(drag.stackId);
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

              if (targetStack && isCollectDeck(targetStack)) {
                await sendCommand({
                  cmd: "loot.collect_stack",
                  args: { stackId: newStackID },
                });
                return;
              }

              if (!targetDef || cardKind(targetDef) !== "deck") {
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

        if (targetStack && isCollectDeck(targetStack) && sourceDef && !isDeckDef(sourceDef) && !isPackDef(sourceDef)) {
          suppressStackClick(drag.stackId);
          clearLocalPosition(drag.stackId);
          void sendCommand({
            cmd: "loot.collect_stack",
            args: { stackId: drag.stackId },
          });
          return;
        }

        if (sourceDef && targetDef && (cardKind(sourceDef) === "deck" || cardKind(targetDef) === "deck")) {
          if (!moved) {
            clearLocalPosition(drag.stackId);
            return;
          }
        } else {
          suppressStackClick(drag.stackId);
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

      openDetail(drag.stackId);
    };

    const onPointerCancel = (event: PointerEvent) => {
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

    onCleanup(() => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    });
  });

  return (
    <main class="h-screen overflow-hidden bg-[#0a0d12] text-[#eceff7]">
      <header class="flex h-12 items-center justify-between border-b border-[#262d3a] bg-[#11151d]/95 px-3">
        <div class="flex items-center gap-4">
          <span class="text-sm font-semibold tracking-wide text-[#e7ebf3]">Donegeon</span>
          <nav class="flex items-center gap-1 text-xs text-[#9ea9bb]">
            <A href="/task/inbox" class="rounded px-2 py-1 hover:bg-[#1a202b] hover:text-[#eef2fa]">
              Tasks
            </A>
            <A href="/board" class="rounded bg-[#1c2431] px-2 py-1 text-[#eef2fa]">
              Board
            </A>
            <span class="rounded px-2 py-1 text-[#7f8a9d]">Builder</span>
          </nav>
        </div>

        <div class="hidden items-center gap-3 text-xs text-[#aeb6c5] md:flex">
          <span class="flex items-center gap-1" title="Coins">
            <span>🪙</span>
            <span class="tabular-nums">{summary().inventory.coin ?? 0}</span>
          </span>
          <span class="flex items-center gap-1" title="Paper">
            <span>📄</span>
            <span class="tabular-nums">{summary().inventory.paper ?? 0}</span>
          </span>
          <span class="flex items-center gap-1" title="Ink">
            <span>🖋️</span>
            <span class="tabular-nums">{summary().inventory.ink ?? 0}</span>
          </span>
          <span class="flex items-center gap-1" title="Gear">
            <span>⚙️</span>
            <span class="tabular-nums">{summary().inventory.gear ?? 0}</span>
          </span>
          <span class="flex items-center gap-1" title="Parts">
            <span>🔩</span>
            <span class="tabular-nums">{summary().inventory.parts ?? 0}</span>
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-md border border-[#7c3737] bg-[#2a1416] px-3 py-1 text-xs text-[#ff857f] transition hover:bg-[#37181b] disabled:opacity-50"
            onClick={() => void endDay()}
            disabled={busy()}
          >
            End Day
          </button>
          <button
            type="button"
            class="rounded-md border border-[#394357] bg-[#181f2a] px-3 py-1 text-xs text-[#d5dced] transition hover:border-[#546282] disabled:opacity-50"
            onClick={() => void refreshBoard()}
            disabled={busy()}
          >
            Refresh
          </button>
        </div>
      </header>

      <div class="grid h-[calc(100vh-48px)] grid-cols-1 md:grid-cols-[244px_minmax(0,1fr)]">
        <aside class="hidden h-full flex-col border-r border-[#252c39] bg-[#151a23] md:flex">
          <div class="border-b border-[#252c39] px-4 py-3">
            <p class="text-lg font-semibold tracking-wide">DONEGEON</p>
          </div>

          <div class="border-b border-[#252c39] px-4 py-3">
            <p class="text-sm font-semibold uppercase tracking-[0.08em] text-[#d3d9e6]">Today&apos;s Goals</p>
          </div>

          <section class="border-b border-[#252c39] px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#8794a8]">Task Summary</p>
            <div class="mt-2 space-y-1 text-sm text-[#c2cada]">
              <p>
                Danger: <span class={summary().zombieCount > 0 ? "text-[#ff8c8c]" : "text-[#7ddf98]"}>{summary().zombieCount > 0 ? "HIGH" : "SAFE"}</span>
              </p>
              <p>Villagers: {summary().villagerCount}</p>
              <p>Active stacks: {summary().activeTaskCount}</p>
              <p>Completed tasks: {summary().completedCount}</p>
            </div>
          </section>

          <section class="border-b border-[#252c39] px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#8794a8]">Board Stats</p>
            <div class="mt-2 space-y-1 text-sm text-[#c2cada]">
              <p>Decks: {summary().deckCount}</p>
              <p>Zombies: {summary().zombieCount}</p>
              <p>Day ticks: {summary().dayTicks}</p>
              <p>Total stacks: {stacks().length}</p>
            </div>
          </section>

          <section class="px-4 py-3">
            <p class="text-xs font-semibold uppercase tracking-[0.08em] text-[#8794a8]">Board Actions</p>
            <div class="mt-3 space-y-2">
              <button
                type="button"
                class="w-full rounded-md border border-[#3b4760] bg-[#1b2433] px-3 py-2 text-sm text-[#d8e0f2] hover:border-[#5a6f95] disabled:opacity-50"
                onClick={() => void seedBoard()}
                disabled={busy()}
              >
                Seed default board
              </button>

              <button
                type="button"
                class="w-full rounded-md border border-[#3b4760] bg-[#1b2433] px-3 py-2 text-sm text-[#d8e0f2] hover:border-[#5a6f95] disabled:opacity-50"
                onClick={() => void spawnTaskCard()}
                disabled={busy()}
              >
                Spawn task card
              </button>

              <input
                value={newTitle()}
                onInput={(event) => setNewTitle(event.currentTarget.value)}
                placeholder="Task title"
                class="w-full rounded-md border border-[#313b50] bg-[#0f1520] px-3 py-2 text-sm text-[#eef3ff] outline-none transition focus:border-[#6a7fa8]"
              />

              <button
                type="button"
                class="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[#171717] transition hover:bg-[var(--accent-soft)] disabled:opacity-50"
                onClick={() => void createTaskStack()}
                disabled={busy()}
              >
                Add stack
              </button>
            </div>
          </section>

          <Show when={error()}>
            <p class="mx-4 mt-auto mb-4 rounded-md border border-[#7d3333] bg-[#351719] px-3 py-2 text-xs text-[#ffd0d0]">{error()}</p>
          </Show>
        </aside>

        <section class="relative h-full min-h-0 overflow-hidden bg-[#07090f]">
          <div class="absolute left-3 top-3 z-40 flex items-center gap-2 md:hidden">
            <A
              href="/task/inbox"
              class="rounded-md border border-[#3a465c] bg-[#161e2c]/90 px-2 py-1 text-xs text-[#dce6fa]"
            >
              /task
            </A>
            <button
              type="button"
              class="rounded-md border border-[#3a465c] bg-[#161e2c]/90 px-2 py-1 text-xs text-[#dce6fa]"
              onClick={() => void seedBoard()}
              disabled={busy()}
            >
              Seed
            </button>
            <button
              type="button"
              class="rounded-md border border-[#3a465c] bg-[#161e2c]/90 px-2 py-1 text-xs text-[#dce6fa]"
              onClick={() => void spawnTaskCard()}
              disabled={busy()}
            >
              Spawn
            </button>
          </div>

          <div
            ref={boardRef}
            class="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(60,85,125,0.22),transparent_45%),linear-gradient(180deg,#090b12,#05070d)]"
          >
            <div class="pointer-events-none absolute inset-0 opacity-65 [background-size:22px_22px] [background-image:radial-gradient(circle_at_1px_1px,rgba(207,218,241,0.2)_1px,transparent_1.3px),radial-gradient(circle_at_1px_1px,rgba(207,218,241,0.1)_1px,transparent_1.3px)] [background-position:0_0,11px_11px]" />
            <div class="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[170px] bg-gradient-to-t from-[#05070d] via-[#05070ddd] to-transparent" />
            <div class="pointer-events-none absolute bottom-3 left-1/2 z-0 -translate-x-1/2 rounded-md border border-[#3c4960] bg-[#0e1420]/85 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#a0aec7]">
              Deck row: click deck to spawn packs, click pack to open
            </div>

            <Show when={!loading()} fallback={<p class="p-4 text-sm text-[#a2adbf]">Loading board...</p>}>
              <For each={stacks()}>
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
                  const hideStackActions = createMemo(() => preview().isDeck || preview().isPack);
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
                        class={`group absolute select-none ${
                          topIsDeckLike() ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
                        } ${isMergeTarget() ? "ring-2 ring-[#efb05f] ring-offset-2 ring-offset-[#07090f]" : ""}`}
                        style={{
                          left: `${position().x}px`,
                          top: `${position().y}px`,
                          height: `${stackHeightPx(visibleCards().length)}px`,
                          width: `${CARD_WIDTH}px`,
                          "z-index": isDraggingStack() ? "9999" : `${stack.z}`,
                        }}
                        onPointerDown={(event) => onStackPointerDown(event, stack)}
                        onClick={(event) => {
                          if (!(topIsDeckLike() || topIsPack())) return;
                          if (isClickSuppressed(stack.id)) return;
                          event.stopPropagation();
                          void activateDeckOrPack(stack);
                        }}
                      >
                        <For each={visibleCards()}>
                          {(cardID, index) => {
                            const card = createMemo(() => state()?.cards[cardID] ?? null);
                            const cardPreview = createMemo(() => {
                              const value = card();
                              const kind = value ? cardKind(value.defId) : "unknown";
                              const skin = cardSkin(kind, value?.defId ?? "");
                              return {
                                title: titleFromCard(value),
                                subtitle: subtitleFromCard(value),
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
                                    <span class="truncate">{cardPreview().title}</span>
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

                        <Show when={!hideStackActions()}>
                          <div class="pointer-events-none absolute -right-[120px] top-1 z-30 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              class="pointer-events-auto rounded-md border border-[#516181] bg-[#132035] px-1.5 py-1 text-[10px] text-[#dbe7ff] hover:border-[var(--accent)]"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                startInlineEdit(stack.id);
                              }}
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              class="pointer-events-auto rounded-md border border-[#516181] bg-[#132035] px-1.5 py-1 text-[10px] text-[#dbe7ff] hover:border-[var(--accent)]"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                openDetail(stack.id);
                              }}
                            >
                              ⧉
                            </button>
                            <button
                              type="button"
                              class="pointer-events-auto rounded-md border border-[#516181] bg-[#132035] px-1.5 py-1 text-[10px] text-[#dbe7ff] hover:border-[var(--accent)]"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                void completeStack(stack.id);
                              }}
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              class="pointer-events-auto rounded-md border border-[#7a4350] bg-[#321720] px-1.5 py-1 text-[10px] text-[#ffd6de] hover:border-[#ef7f94]"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation();
                                void removeStack(stack.id);
                              }}
                            >
                              ×
                            </button>
                          </div>
                        </Show>
                      </article>

                      <Show when={isSplittingStack() && draggedCards().length > 0 && !!splitDragPosition()}>
                        <article
                          class="pointer-events-none absolute select-none"
                          style={{
                            left: `${splitDragPosition()?.x ?? 0}px`,
                            top: `${splitDragPosition()?.y ?? 0}px`,
                            height: `${stackHeightPx(draggedCards().length)}px`,
                            width: `${CARD_WIDTH}px`,
                            "z-index": "10000",
                          }}
                        >
                          <For each={draggedCards()}>
                            {(cardID, index) => {
                              const card = createMemo(() => state()?.cards[cardID] ?? null);
                              const cardPreview = createMemo(() => {
                                const value = card();
                                const kind = value ? cardKind(value.defId) : "unknown";
                                const skin = cardSkin(kind, value?.defId ?? "");
                                return {
                                  title: titleFromCard(value),
                                  subtitle: subtitleFromCard(value),
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
            </Show>
          </div>

          <Show when={error() && !loading()}>
            <div class="absolute bottom-4 left-4 z-40 max-w-md rounded-md border border-[#8d3a3a] bg-[#321417] px-3 py-2 text-xs text-[#ffd2d2] md:hidden">
              {error()}
            </div>
          </Show>
        </section>
      </div>

      <Show when={isDetailOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#05070fcc]/90 p-4">
          <div class="w-full max-w-5xl overflow-hidden rounded-2xl border border-[#2a3242] bg-[linear-gradient(180deg,#101825,#0b121d)] shadow-[0_24px_64px_rgba(0,0,0,0.55)]">
            <div class="flex items-center justify-between border-b border-[#273247] px-6 py-4">
              <div>
                <p class="text-xs uppercase tracking-[0.12em] text-[#8c99af]">Task Detail</p>
              </div>
              <button
                type="button"
                class="rounded-lg border border-[#466083] px-3 py-1.5 text-sm text-[#dbe7ff] hover:border-[var(--accent)]"
                onClick={closeDetail}
              >
                Close
              </button>
            </div>

            <div class="grid md:grid-cols-[minmax(0,1fr)_380px]">
              <div class="border-b border-[#273247] p-6 md:border-b-0 md:border-r">
                <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#8c99af]">Task</label>
                <input
                  value={detailTitle()}
                  onInput={(event) => setDetailTitle(event.currentTarget.value)}
                  class="w-full rounded-xl border border-[#355077] bg-[#0f1828] px-3 py-2 text-2xl font-semibold text-[#edf3ff] outline-none focus:border-[var(--accent)]"
                />

                <label class="mt-5 mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[#8c99af]">
                  Description
                </label>
                <textarea
                  rows={10}
                  value={detailDescription()}
                  onInput={(event) => setDetailDescription(event.currentTarget.value)}
                  class="w-full rounded-xl border border-[#355077] bg-[#0f1828] px-3 py-2 text-[15px] text-[#dbe6f8] outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div class="space-y-4 border-b border-[#273247] p-6 md:border-b-0">
                <div>
                  <p class="mb-1 text-xs uppercase tracking-[0.12em] text-[#8c99af]">Stack</p>
                  <input
                    value={selectedStackID() ?? ""}
                    disabled
                    class="w-full rounded-xl border border-[#334763] bg-[#0a121f] px-3 py-2 text-[#96a6c3]"
                  />
                </div>

                <div>
                  <p class="mb-1 text-xs uppercase tracking-[0.12em] text-[#8c99af]">Card Type</p>
                  <input
                    value={selectedCard() ? prettifyDefID(selectedCard()!.defId) : ""}
                    disabled
                    class="w-full rounded-xl border border-[#334763] bg-[#0a121f] px-3 py-2 text-[#96a6c3]"
                  />
                </div>

                <div>
                  <p class="mb-1 text-xs uppercase tracking-[0.12em] text-[#8c99af]">Project</p>
                  <input
                    value={dataString(selectedTaskCard()?.data?.project)}
                    disabled
                    class="w-full rounded-xl border border-[#334763] bg-[#0a121f] px-3 py-2 text-[#96a6c3]"
                  />
                </div>

                <div>
                  <p class="mb-1 text-xs uppercase tracking-[0.12em] text-[#8c99af]">Priority</p>
                  <input
                    value={(() => {
                      const priority = dataNumber(selectedTaskCard()?.data?.priority);
                      if (priority && priority >= 1 && priority <= 4) return `P${priority}`;
                      return "";
                    })()}
                    disabled
                    class="w-full rounded-xl border border-[#334763] bg-[#0a121f] px-3 py-2 text-[#96a6c3]"
                  />
                </div>

                <div>
                  <p class="mb-1 text-xs uppercase tracking-[0.12em] text-[#8c99af]">Recurrence</p>
                  <input
                    value={dataString(selectedTaskCard()?.data?.recurrence)}
                    disabled
                    class="w-full rounded-xl border border-[#334763] bg-[#0a121f] px-3 py-2 text-[#96a6c3]"
                  />
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between px-6 py-4">
              <button
                type="button"
                class="rounded-xl border border-[#466083] px-4 py-2 text-sm text-[#dbe7ff] hover:border-[var(--accent)]"
                onClick={() => {
                  const id = selectedStackID();
                  if (id) void completeStack(id);
                }}
              >
                Mark done
              </button>

              <button
                type="button"
                class="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#151515] hover:bg-[var(--accent-soft)]"
                onClick={() => void saveDetail()}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </Show>
    </main>
  );
}
