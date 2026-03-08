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
    <form onSubmit={props.onSubmit} class="mb-5">
      <div class="relative">
        <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-[#2f3f5d] bg-[#0d1523] px-3 py-2 text-xl leading-normal tracking-normal whitespace-pre text-[var(--text-main)] [font-variant-ligatures:none]">
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
          class="relative w-full rounded-xl border border-[#2f3f5d] bg-transparent px-3 py-2 text-xl leading-normal tracking-normal text-transparent caret-[var(--text-main)] outline-none [font-variant-ligatures:none] focus:border-[var(--accent)]"
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
              <span class="rounded-lg border border-[#3a4d70] bg-[#121f34] px-2 py-1 text-xs text-[var(--text-main)]">
                {chip}
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.parsedGuidance}>
        <p class="mt-2 rounded-lg border border-[#2f4a39] bg-[#0f2219] px-3 py-2 text-xs text-[#b5efce]">
          {props.parsedGuidance}
        </p>
      </Show>

      <div class="mt-3 flex justify-end">
        <button
          type="submit"
          class="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-[#1e0f08] transition hover:bg-[var(--accent-soft)]"
          data-testid="add-task-submit"
        >
          Add
        </button>
      </div>
    </form>
  );
}
