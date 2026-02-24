import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import {
  parseApi,
  taskApi,
  type QuickAddParsed,
  type Task,
} from "../server/api";

type TokenKind =
  | "project"
  | "label"
  | "assignee"
  | "priority"
  | "deadline"
  | "due"
  | "text";

type TokenPiece = {
  value: string;
  kind: TokenKind;
};

const QUICK_ADD_TOKEN_PATTERN =
  /(\{[^{}]+\}|#[A-Za-z][A-Za-z0-9_-]*|@[A-Za-z][A-Za-z0-9_-]*|\+[A-Za-z][A-Za-z0-9_-]*|\bp[1-4]\b|\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?(?:am|pm)\b|\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b|\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b|\btomorrow\b)/gi;

function classifyToken(value: string): TokenKind {
  if (value.startsWith("#")) return "project";
  if (value.startsWith("@")) return "label";
  if (value.startsWith("+")) return "assignee";
  if (/^p[1-4]$/i.test(value)) return "priority";
  if (value.startsWith("{") && value.endsWith("}")) return "deadline";
  return "due";
}

function tokenizeQuickAdd(value: string): TokenPiece[] {
  if (value.length === 0) return [];

  const pieces: TokenPiece[] = [];
  let cursor = 0;

  QUICK_ADD_TOKEN_PATTERN.lastIndex = 0;
  for (let match = QUICK_ADD_TOKEN_PATTERN.exec(value); match !== null; match = QUICK_ADD_TOKEN_PATTERN.exec(value)) {
    const token = match[0];
    const start = match.index;
    const end = start + token.length;

    if (start > cursor) {
      pieces.push({
        value: value.slice(cursor, start),
        kind: "text",
      });
    }

    pieces.push({
      value: token,
      kind: classifyToken(token),
    });

    cursor = end;
  }

  if (cursor < value.length) {
    pieces.push({
      value: value.slice(cursor),
      kind: "text",
    });
  }

  return pieces;
}

function tokenClass(kind: TokenKind): string {
  switch (kind) {
    case "project":
      return "text-[#ffd2d2] bg-[#7f1d1d]";
    case "label":
      return "text-[#ffdff5] bg-[#6b214d]";
    case "assignee":
      return "text-[#fbe2ff] bg-[#5b2470]";
    case "priority":
      return "text-[#ffe5d5] bg-[#9a3412]";
    case "deadline":
      return "text-[#e3dcff] bg-[#4338ca]";
    case "due":
      return "text-[#ffe6cc] bg-[#92400e]";
    default:
      return "text-[var(--text-main)]";
  }
}

function addChip(value: string | undefined, label: string): string | null {
  if (!value || !value.trim()) return null;
  return `${label}: ${value}`;
}

export default function HomeRoute() {
  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [content, setContent] = createSignal("");
  const [quickAddText, setQuickAddText] = createSignal("");
  const [quickAddPreview, setQuickAddPreview] = createSignal("");
  const [parsedInput, setParsedInput] = createSignal<QuickAddParsed | null>(null);
  const [error, setError] = createSignal("");

  let parseTimer: number | undefined;

  const inputTokens = createMemo(() => tokenizeQuickAdd(content()));

  const parsedChips = createMemo(() => {
    const parsed = parsedInput();
    if (!parsed) return [] as string[];

    const chips: string[] = [];

    const project = addChip(parsed.project, "Project");
    if (project) chips.push(project);

    for (const label of parsed.labels) {
      chips.push(`Label: ${label}`);
    }

    const assignee = addChip(parsed.assignee, "Assignee");
    if (assignee) chips.push(assignee);

    if (parsed.priority) {
      chips.push(`Priority: p${parsed.priority}`);
    }

    const dueText = addChip(parsed.dueText, "Due");
    if (dueText) chips.push(dueText);

    const deadline = addChip(parsed.deadline, "Deadline");
    if (deadline) chips.push(deadline);

    return chips;
  });

  const hasQuickAddSyntax = createMemo(
    () => inputTokens().some((piece) => piece.kind !== "text") || !!parsedInput()?.dueText,
  );

  async function refreshTasks() {
    try {
      const list = await taskApi.list();
      setTasks(list.items);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function parseMainInput(text: string) {
    const trimmed = text.trim();
    if (!trimmed) {
      setParsedInput(null);
      return;
    }

    try {
      const parsed = await parseApi.quickAdd(trimmed);
      setParsedInput(parsed.parsed);
    } catch {
      // Parsing preview failures should not block typing.
      setParsedInput(null);
    }
  }

  function onMainInput(value: string) {
    setContent(value);

    if (parseTimer !== undefined) {
      window.clearTimeout(parseTimer);
    }

    parseTimer = window.setTimeout(() => {
      void parseMainInput(value);
    }, 120);
  }

  async function addTask(e: SubmitEvent) {
    e.preventDefault();
    const text = content().trim();
    if (!text) return;

    try {
      if (hasQuickAddSyntax()) {
        await taskApi.quickAdd(text);
      } else {
        await taskApi.create(text);
      }
      setContent("");
      setParsedInput(null);
      setError("");
      await refreshTasks();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleTask(item: Task) {
    try {
      if (item.checked) {
        await taskApi.reopen(item.id);
      } else {
        await taskApi.close(item.id);
      }
      await refreshTasks();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function previewQuickAdd() {
    if (!quickAddText().trim()) {
      setQuickAddPreview("");
      return;
    }

    try {
      const parsed = await parseApi.quickAdd(quickAddText());
      const value = parsed.parsed;
      const lines = [
        `Content: ${value.content}`,
        `Project: ${value.project || "none"}`,
        `Labels: ${value.labels.length ? value.labels.join(", ") : "none"}`,
        `Assignee: ${value.assignee || "none"}`,
        `Priority: ${value.priority ? `p${value.priority}` : "none"}`,
        `Due: ${value.dueText || "none"}`,
      ];
      setQuickAddPreview(lines.join(" | "));
      setError("");
    } catch (err) {
      setQuickAddPreview("");
      setError((err as Error).message);
    }
  }

  onCleanup(() => {
    if (parseTimer !== undefined) {
      window.clearTimeout(parseTimer);
    }
  });

  onMount(refreshTasks);

  return (
    <main class="min-h-screen p-4 md:p-10">
      <div class="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        <aside class="rounded-3xl border border-[#273248] bg-[linear-gradient(180deg,#111a2a,#0f1726)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <h1 class="text-2xl font-semibold tracking-tight">donegeon</h1>
          <p class="mt-1 text-sm text-[var(--text-dim)]">Todoist-like flow, Go-first logic.</p>
          <div class="mt-6 space-y-2 text-sm">
            <div class="rounded-xl bg-[var(--panel-soft)] px-3 py-2 text-[var(--accent)]">Today</div>
            <div class="rounded-xl px-3 py-2 text-[var(--text-dim)]">Upcoming</div>
            <div class="rounded-xl px-3 py-2 text-[var(--text-dim)]">Projects</div>
          </div>

          <div class="mt-8 rounded-2xl border border-[#2e3c58] bg-[#101a2d] p-3">
            <label class="text-xs uppercase tracking-wider text-[var(--text-dim)]">Quick add preview</label>
            <input
              value={quickAddText()}
              onInput={(e) => setQuickAddText(e.currentTarget.value)}
              class="mt-2 w-full rounded-lg border border-[#2f3f5d] bg-[#0d1523] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="Pay rent #Home @finance p2"
            />
            <button
              type="button"
              onClick={previewQuickAdd}
              class="mt-2 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-[#1e0f08] transition hover:bg-[var(--accent-soft)]"
            >
              Parse text
            </button>
            <Show when={quickAddPreview()}>
              <p class="mt-3 text-xs leading-relaxed text-[var(--text-dim)]">{quickAddPreview()}</p>
            </Show>
          </div>
        </aside>

        <section class="rounded-3xl border border-[#273248] bg-[linear-gradient(180deg,#101a2c,#0c1423)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-10">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-4xl font-semibold tracking-tight">Today</h2>
            <span class="text-sm text-[var(--text-dim)]">{tasks().length} task(s)</span>
          </div>

          <form onSubmit={addTask} class="mb-6">
            <div class="relative">
              <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-[#2f3f5d] bg-[#0d1523] px-3 py-2 text-xl whitespace-pre text-[var(--text-main)]">
                <Show when={content().length > 0} fallback={<span class="text-[var(--text-dim)]">Add task</span>}>
                  <For each={inputTokens()}>
                    {(token) => (
                      <span class={token.kind === "text" ? "" : `rounded-md px-1 ${tokenClass(token.kind)}`}>
                        {token.value}
                      </span>
                    )}
                  </For>
                </Show>
              </div>

              <input
                value={content()}
                onInput={(e) => onMainInput(e.currentTarget.value)}
                class="relative w-full rounded-xl border border-[#2f3f5d] bg-transparent px-3 py-2 text-xl text-transparent caret-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                aria-label="Add task"
                spellcheck={false}
                autocomplete="off"
              />
            </div>

            <Show when={parsedChips().length > 0}>
              <div class="mt-3 flex flex-wrap gap-2">
                <For each={parsedChips()}>
                  {(chip) => (
                    <span class="rounded-lg border border-[#3a4d70] bg-[#121f34] px-2 py-1 text-xs text-[var(--text-main)]">
                      {chip}
                    </span>
                  )}
                </For>
              </div>
            </Show>

            <div class="mt-3 flex justify-end">
              <button
                type="submit"
                class="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-[#1e0f08] transition hover:bg-[var(--accent-soft)]"
              >
                Add
              </button>
            </div>
          </form>

          <Show when={error()}>
            <p class="mb-4 rounded-lg border border-[#5d2f2f] bg-[#2a1111] px-3 py-2 text-sm text-[#ffb5b5]">{error()}</p>
          </Show>

          <ul class="space-y-2">
            <For each={tasks()}>
              {(item) => (
                <li class="group flex items-center gap-3 rounded-xl border border-[#24314a] bg-[#0f192b] px-3 py-3 transition hover:border-[#2d3f5f]">
                  <button
                    type="button"
                    onClick={() => void toggleTask(item)}
                    class={`h-5 w-5 rounded-full border transition ${
                      item.checked
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-[#42557a] bg-transparent"
                    }`}
                    aria-label={item.checked ? "Reopen task" : "Close task"}
                  />
                  <div class="flex-1">
                    <p class={`text-sm ${item.checked ? "text-[#8b9bb8] line-through" : "text-[var(--text-main)]"}`}>
                      {item.content}
                    </p>
                    <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                      <Show when={item.dueText}>
                        <span class="rounded-md bg-[#463312] px-2 py-0.5 text-[#ffd89c]">Due {item.dueText}</span>
                      </Show>
                      <Show when={item.dueDeadline}>
                        <span class="rounded-md bg-[#2d2c67] px-2 py-0.5 text-[#d8d6ff]">Deadline {item.dueDeadline}</span>
                      </Show>
                      <Show when={item.description}>
                        <span>{item.description}</span>
                      </Show>
                    </div>
                  </div>
                  <span
                    class={`rounded-md px-2 py-1 text-xs ${
                      item.priority <= 2
                        ? "bg-[#5f201a] text-[#ffcbc2]"
                        : "bg-[#1e2a43] text-[#b5c4df]"
                    }`}
                  >
                    p{item.priority}
                  </span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </div>
    </main>
  );
}
