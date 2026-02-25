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

const MERGE_DISTANCE = 128;
const DEFAULT_BOARD = "default";

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
};

type StackPreview = {
  title: string;
  subtitle: string;
  kind: string;
  tone: string;
};

function dataString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function titleFromCard(card: BoardCard | null): string {
  if (!card) return "Unknown card";
  const title = dataString(card.data?.title);
  if (title) return title;
  return prettifyDefID(card.defId);
}

function descriptionFromCard(card: BoardCard | null): string {
  if (!card) return "";
  return dataString(card.data?.description);
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

function cardKind(defID: string): string {
  const [kind] = defID.split(".");
  return kind || "unknown";
}

function cardTone(kind: string): string {
  switch (kind) {
    case "task":
      return "border-[#3f5f93] bg-[linear-gradient(180deg,#142440,#101d34)]";
    case "villager":
      return "border-[#68558f] bg-[linear-gradient(180deg,#2a1d40,#211735)]";
    case "zombie":
      return "border-[#7a2d35] bg-[linear-gradient(180deg,#351621,#2b1119)]";
    case "resource":
      return "border-[#4f6f4b] bg-[linear-gradient(180deg,#1f3320,#182719)]";
    case "food":
      return "border-[#7f5c3c] bg-[linear-gradient(180deg,#3a2717,#2e1f14)]";
    case "deck":
      return "border-[#3f4f7a] bg-[linear-gradient(180deg,#1a2644,#151f38)]";
    case "loot":
      return "border-[#7c6840] bg-[linear-gradient(180deg,#362f1e,#2b2416)]";
    default:
      return "border-[#37465f] bg-[linear-gradient(180deg,#192337,#111a2a)]";
  }
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

  let boardRef: HTMLDivElement | undefined;

  const stacks = createMemo(() =>
    Object.values(state()?.stacks ?? {}).sort((a, b) => a.z - b.z),
  );

  const selectedStack = createMemo(() => {
    const id = selectedStackID();
    if (!id) return null;
    return state()?.stacks[id] ?? null;
  });

  const selectedTaskCard = createMemo(() => taskCardFromStack(selectedStack(), state()));

  function stackPosition(stack: BoardStack): BoardPoint {
    return localPositions()[stack.id] ?? stack.pos;
  }

  function stackPreview(stack: BoardStack): StackPreview {
    const card = cardFromStack(stack, state());
    if (!card) {
      return {
        title: "Empty stack",
        subtitle: "No cards",
        kind: "empty",
        tone: cardTone("unknown"),
      };
    }
    const kind = cardKind(card.defId);
    return {
      title: titleFromCard(card),
      subtitle: prettifyDefID(card.defId),
      kind,
      tone: cardTone(kind),
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
      // Error state already set in sendCommand.
    }
  }

  async function seedBoard() {
    try {
      await sendCommand({ cmd: "board.seed_default", args: {} });
    } catch {
      // Error state already set in sendCommand.
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
    } catch {
      // Error state already set in sendCommand.
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
      // Error state already set in sendCommand.
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
    } catch {
      // Error state already set in sendCommand.
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
    } catch {
      // Error state already set in sendCommand.
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
    } catch {
      // Error state already set in sendCommand.
    }
  }

  function nearestMergeTarget(sourceID: string, sourcePos: BoardPoint): string | null {
    let bestID: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const stack of stacks()) {
      if (stack.id === sourceID) continue;
      const targetPos = stackPosition(stack);
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > MERGE_DISTANCE || distance >= bestDistance) continue;
      bestID = stack.id;
      bestDistance = distance;
    }

    return bestID;
  }

  function onStackPointerDown(event: PointerEvent, stack: BoardStack) {
    if (event.button !== 0 || busy()) return;
    if (!boardRef) return;

    const boardRect = boardRef.getBoundingClientRect();
    const pos = stackPosition(stack);

    setSelectedStackID(stack.id);
    setDragMoved(false);
    setMergeTargetID(null);

    setDragState({
      stackId: stack.id,
      pointerId: event.pointerId,
      offsetX: event.clientX - boardRect.left - pos.x,
      offsetY: event.clientY - boardRect.top - pos.y,
      startX: pos.x,
      startY: pos.y,
    });

    setLocalPositions((current) => ({
      ...current,
      [stack.id]: { x: pos.x, y: pos.y },
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

      setMergeTargetID(nearestMergeTarget(drag.stackId, { x, y }));
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
      setLocalPositions((current) => {
        const next = { ...current };
        delete next[drag.stackId];
        return next;
      });

      if (targetID && targetID !== drag.stackId) {
        void sendCommand({
          cmd: "stack.merge",
          args: { targetId: targetID, sourceId: drag.stackId },
        });
        return;
      }

      if (moved) {
        void sendCommand({
          cmd: "stack.move",
          args: {
            stackId: drag.stackId,
            x: finalPos.x,
            y: finalPos.y,
          },
        });
        return;
      }

      openDetail(drag.stackId);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    onCleanup(() => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    });
  });

  return (
    <main class="h-screen overflow-hidden p-4 md:p-6">
      <div class="mx-auto grid h-full min-h-0 max-w-7xl grid-cols-1 gap-4 md:grid-cols-[320px_minmax(0,1fr)]">
        <aside class="h-full min-h-0 overflow-y-auto rounded-3xl border border-[#273248] bg-[linear-gradient(180deg,#111b2d,#0c1522)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-semibold tracking-tight">Board</h1>
            <A
              href="/task/inbox"
              class="rounded-lg border border-[#3f4f6b] bg-[#16253f] px-3 py-1.5 text-sm text-[#d9e7ff] hover:border-[var(--accent)]"
            >
              /task
            </A>
          </div>

          <p class="mt-2 text-sm text-[var(--text-dim)]">
            Drag stacks to move. Drag over another stack to merge. Click a stack to edit details.
          </p>

          <div class="mt-5 space-y-3">
            <button
              type="button"
              class="w-full rounded-xl border border-[#3b4a68] bg-[#1a2a44] px-3 py-2 text-sm text-[#d9e7ff] transition hover:border-[var(--accent)]"
              onClick={() => void seedBoard()}
              disabled={busy()}
            >
              Seed default board
            </button>

            <button
              type="button"
              class="w-full rounded-xl border border-[#3b4a68] bg-[#1a2a44] px-3 py-2 text-sm text-[#d9e7ff] transition hover:border-[var(--accent)]"
              onClick={() => void spawnTaskCard()}
              disabled={busy()}
            >
              Spawn task card
            </button>
          </div>

          <div class="mt-6">
            <label class="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
              Create Task Stack
            </label>
            <input
              value={newTitle()}
              onInput={(event) => setNewTitle(event.currentTarget.value)}
              placeholder="Task title"
              class="w-full rounded-xl border border-[#2f3f5d] bg-[#0f1725] px-3 py-2 text-sm text-[var(--text-main)] outline-none transition focus:border-[var(--accent)]"
            />
            <button
              type="button"
              class="mt-2 w-full rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[#111] transition hover:bg-[var(--accent-soft)]"
              onClick={() => void createTaskStack()}
              disabled={busy()}
            >
              Add stack
            </button>
          </div>

          <Show when={error()}>
            <p class="mt-4 rounded-xl border border-[#7f2d2d] bg-[#3a1818] px-3 py-2 text-sm text-[#ffc4c4]">{error()}</p>
          </Show>
        </aside>

        <section class="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-[#273248] bg-[linear-gradient(180deg,#101a2c,#0c1423)] shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div class="flex items-center justify-between border-b border-[#213149] px-6 py-4">
            <div>
              <h2 class="text-3xl font-semibold tracking-tight">/board</h2>
              <p class="text-sm text-[var(--text-dim)]">
                {stacks().length} stack(s) • version {state()?.version ?? "0"}
              </p>
            </div>
            <Show when={busy()}>
              <span class="rounded-lg border border-[#3d4e6a] bg-[#162439] px-2 py-1 text-xs text-[#cbd7eb]">syncing...</span>
            </Show>
          </div>

          <div
            ref={boardRef}
            class="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(76,112,173,0.14),transparent_55%),linear-gradient(180deg,#0d1523,#0a111c)]"
          >
            <div class="pointer-events-none absolute inset-0 opacity-35 [background-size:28px_28px] [background-image:linear-gradient(to_right,rgba(122,141,177,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(122,141,177,0.12)_1px,transparent_1px)]" />

            <Show when={!loading()} fallback={<p class="p-6 text-sm text-[var(--text-dim)]">Loading board...</p>}>
              <For each={stacks()}>
                {(stack) => {
                  const preview = createMemo(() => stackPreview(stack));
                  const position = createMemo(() => stackPosition(stack));
                  const isMergeTarget = createMemo(() => mergeTargetID() === stack.id);
                  const isInline = createMemo(() => inlineStackID() === stack.id);

                  return (
                    <article
                      class={`group absolute z-10 w-[240px] cursor-grab rounded-2xl border px-4 py-3 shadow-[0_16px_36px_rgba(0,0,0,0.35)] transition ${
                        preview().tone
                      } ${isMergeTarget() ? "ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[#0d1523]" : ""}`}
                      style={{
                        left: `${position().x}px`,
                        top: `${position().y}px`,
                      }}
                      onPointerDown={(event) => onStackPointerDown(event, stack)}
                    >
                      <div class="mb-2 flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a9b9d6]">{preview().kind}</p>
                          <Show
                            when={!isInline()}
                            fallback={
                              <input
                                value={inlineTitle()}
                                onInput={(event) => setInlineTitle(event.currentTarget.value)}
                                class="mt-1 w-full rounded-lg border border-[#5a6f95] bg-[#0f1829] px-2 py-1 text-base font-semibold text-[var(--text-main)] outline-none"
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
                            <p class="truncate text-lg font-semibold leading-tight text-[var(--text-main)]">{preview().title}</p>
                          </Show>
                          <p class="mt-1 truncate text-xs text-[var(--text-dim)]">{preview().subtitle}</p>
                        </div>
                        <span class="rounded-full border border-[#4a5d83] px-2 py-0.5 text-[11px] text-[#ced8eb]">
                          {stack.cards.length}
                        </span>
                      </div>

                      <div class="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          class="rounded-md border border-[#46608b] bg-[#14233a] px-1.5 py-1 text-xs text-[#cfe0ff] hover:border-[var(--accent)]"
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
                          class="rounded-md border border-[#46608b] bg-[#14233a] px-1.5 py-1 text-xs text-[#cfe0ff] hover:border-[var(--accent)]"
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
                          class="rounded-md border border-[#46608b] bg-[#14233a] px-1.5 py-1 text-xs text-[#cfe0ff] hover:border-[var(--accent)]"
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
                          class="rounded-md border border-[#65404a] bg-[#321922] px-1.5 py-1 text-xs text-[#ffced5] hover:border-[#ff7d92]"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeStack(stack.id);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </article>
                  );
                }}
              </For>
            </Show>
          </div>
        </section>
      </div>

      <Show when={isDetailOpen()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-[#03060dcc]/85 p-4">
          <div class="w-full max-w-3xl rounded-3xl border border-[#2d3d5b] bg-[linear-gradient(180deg,#111c2f,#0c1626)] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
            <div class="mb-4 flex items-center justify-between">
              <h3 class="text-2xl font-semibold tracking-tight">Stack Detail</h3>
              <button
                type="button"
                class="rounded-lg border border-[#42577a] px-3 py-1.5 text-sm text-[#d5e3fb] hover:border-[var(--accent)]"
                onClick={closeDetail}
              >
                Close
              </button>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div>
                <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Title
                </label>
                <input
                  value={detailTitle()}
                  onInput={(event) => setDetailTitle(event.currentTarget.value)}
                  class="w-full rounded-xl border border-[#334966] bg-[#0d1728] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                  Stack ID
                </label>
                <input
                  value={selectedStackID() ?? ""}
                  disabled
                  class="w-full rounded-xl border border-[#334966] bg-[#0b1320] px-3 py-2 text-[#96a5be]"
                />
              </div>
            </div>

            <div class="mt-4">
              <label class="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                Description
              </label>
              <textarea
                rows={8}
                value={detailDescription()}
                onInput={(event) => setDetailDescription(event.currentTarget.value)}
                class="w-full rounded-2xl border border-[#334966] bg-[#0d1728] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div class="mt-5 flex items-center justify-between">
              <button
                type="button"
                class="rounded-xl border border-[#42577a] px-4 py-2 text-sm text-[#d5e3fb] hover:border-[var(--accent)]"
                onClick={() => {
                  const id = selectedStackID();
                  if (id) void completeStack(id);
                }}
              >
                Mark done
              </button>
              <button
                type="button"
                class="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#121212] hover:bg-[var(--accent-soft)]"
                onClick={() => void saveDetail()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </Show>
    </main>
  );
}
