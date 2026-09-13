import { css } from "@linaria/core";
import { For, Show } from "solid-js";

export type QuickAddTokenKind =
  | "project"
  | "label"
  | "assignee"
  | "priority"
  | "deadline"
  | "recurrence"
  | "due"
  | "text";

export type QuickAddTokenPiece = {
  value: string;
  kind: QuickAddTokenKind;
};

export type QuickAddTokenInputProps = {
  id?: string;
  value: string;
  tokens: QuickAddTokenPiece[];
  onInput: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  testId?: string;
  autofocus?: boolean;
  inputRef?: (el: HTMLInputElement) => void;
};

const tokenStyles: Record<Exclude<QuickAddTokenKind, "text">, string> = {
  project: css`border-radius:.28rem; background:rgba(120,37,34,.36); color:#ffd4cf;`,
  label: css`border-radius:.28rem; background:rgba(97,76,132,.3); color:#edd8ff;`,
  assignee: css`border-radius:.28rem; background:rgba(26,78,95,.34); color:#d2f4ff;`,
  priority: css`border-radius:.28rem; background:rgba(255,139,80,.22); color:#ffd7b7;`,
  deadline: css`border-radius:.28rem; background:rgba(74,78,156,.35); color:#ddd9ff;`,
  recurrence: css`border-radius:.28rem; background:rgba(24,88,57,.33); color:#c7f6d4;`,
  due: css`border-radius:.28rem; background:rgba(110,78,21,.34); color:#ffd4a1;`,
};
const plainToken = css`color:var(--text-main);`;

export function quickAddTokenClass(kind: QuickAddTokenKind): string {
  return kind === "text" ? plainToken : tokenStyles[kind];
}

export default function QuickAddTokenInput(props: QuickAddTokenInputProps) {
  return (
    <div class={wrap}>
      <div class={highlightLayer} aria-hidden="true">
        <Show when={props.value.length > 0} fallback={<span class={placeholderStyle}>{props.placeholder ?? "Add task"}</span>}>
          <For each={props.tokens}>
            {(token) => <span class={quickAddTokenClass(token.kind)}>{token.value}</span>}
          </For>
        </Show>
      </div>
      <input
        id={props.id}
        ref={props.inputRef}
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        class={input}
        aria-label={props.ariaLabel}
        data-testid={props.testId}
        spellcheck={false}
        autocomplete="off"
        autofocus={props.autofocus}
      />
    </div>
  );
}

const wrap = css`position:relative;`;
const highlightLayer = css`
  pointer-events:none;
  position:absolute;
  inset:0;
  overflow:hidden;
  border:1px solid var(--border-strong);
  border-radius:var(--radius-xl);
  padding:.5rem .75rem;
  background:var(--panel-soft);
  color:var(--text-main);
  font-family:inherit;
  font-size:1.25rem;
  line-height:1.5;
  letter-spacing:normal;
  font-variant-ligatures:none;
  white-space:pre;
  box-shadow:0 18px 38px rgba(0,0,0,.16);
  backdrop-filter:blur(8px);
`;
const placeholderStyle = css`color:var(--text-dim);`;
const input = css`
  position:relative;
  width:100%;
  border:1px solid var(--border-strong);
  border-radius:var(--radius-xl);
  padding:.5rem .75rem;
  background:transparent;
  color:transparent;
  caret-color:var(--text-main);
  font-family:inherit;
  font-size:1.25rem;
  line-height:1.5;
  letter-spacing:normal;
  font-variant-ligatures:none;
  outline:none;
  &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
