import { For, Show } from "solid-js";

type TokenPiece = {
  value: string;
  kind: TokenKind;
};

type TokenKind =
  | "project"
  | "label"
  | "assignee"
  | "priority"
  | "deadline"
  | "recurrence"
  | "due"
  | "text";

type TaskQuickAddComposerProps = {
  content: string;
  tokens: TokenPiece[];
  tokenClass: (kind: TokenKind) => string;
  parsedChips: string[];
  parsedGuidance: string;
  onInput: (value: string) => void;
  onSubmit: (event: SubmitEvent) => void;
  inputRef?: (el: HTMLInputElement) => void;
};

export default function TaskQuickAddComposer(props: TaskQuickAddComposerProps) {
  return (
    <form onSubmit={props.onSubmit} class="mb-6">
      <div class="relative">
        <div class="app-input-surface pointer-events-none absolute inset-0 overflow-hidden rounded-xl px-3 py-2 text-xl leading-normal tracking-normal whitespace-pre shadow-[0_18px_38px_rgba(0,0,0,0.16)] backdrop-blur [font-variant-ligatures:none]">
          <Show when={props.content.length > 0} fallback={<span class="text-[var(--text-dim)]">Add task</span>}>
            <For each={props.tokens}>
              {(token) => (
                <span class={token.kind === "text" ? "" : `rounded-[4px] ${props.tokenClass(token.kind)}`}>
                  {token.value}
                </span>
              )}
            </For>
          </Show>
        </div>

        <input
          ref={props.inputRef}
          value={props.content}
          onInput={(event) => props.onInput(event.currentTarget.value)}
          class="relative w-full rounded-xl border border-[var(--border-strong)] bg-transparent px-3 py-2 text-xl leading-normal tracking-normal text-transparent caret-[var(--text-main)] outline-none [font-variant-ligatures:none] focus:border-[var(--accent)]"
          aria-label="Add task"
          data-testid="add-task-input"
          spellcheck={false}
          autocomplete="off"
        />
      </div>

      <Show when={props.parsedChips.length > 0}>
        <div class="mt-3 flex flex-wrap gap-2">
          <For each={props.parsedChips}>
            {(chip) => (
              <span class="app-panel-soft rounded-lg px-2 py-1 text-xs text-[var(--text-soft)]">
                {chip}
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.parsedGuidance}>
        <p class="mt-2 rounded-lg border border-[rgba(49,122,86,0.42)] bg-[var(--success-bg)] px-3 py-2 text-xs text-[var(--success)]">
          {props.parsedGuidance}
        </p>
      </Show>

      <div class="mt-3 flex justify-end">
        <button
          type="submit"
          class="app-button-primary rounded-xl px-4 py-2 font-medium"
          data-testid="add-task-submit"
        >
          Add
        </button>
      </div>
    </form>
  );
}
