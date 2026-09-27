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
  project: css`border-radius:.28rem; background:var(--palette-rgba-120-37-34-36-ffcac1); color:var(--palette-hex-ffd4cf-e8c243);`,
  label: css`border-radius:.28rem; background:var(--palette-rgba-97-76-132-3-ded828); color:var(--palette-hex-edd8ff-825a92);`,
  assignee: css`border-radius:.28rem; background:var(--palette-rgba-26-78-95-34-b1bcae); color:var(--palette-hex-d2f4ff-85642c);`,
  priority: css`border-radius:.28rem; background:var(--palette-rgba-255-139-80-22-006f79); color:var(--palette-hex-ffd7b7-e9306f);`,
  deadline: css`border-radius:.28rem; background:var(--palette-rgba-74-78-156-35-8ee061); color:var(--palette-hex-ddd9ff-e3a001);`,
  recurrence: css`border-radius:.28rem; background:var(--palette-rgba-24-88-57-33-9ac90a); color:var(--palette-hex-c7f6d4-5832b1);`,
  due: css`border-radius:.28rem; background:var(--palette-rgba-110-78-21-34-b00d78); color:var(--palette-hex-ffd4a1-b83647);`,
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
  box-shadow:0 18px 38px var(--palette-rgba-0-0-0-16-dc0c50);
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
  &:focus-visible{border-color:var(--accent); outline:2px solid var(--palette-hex-00e0ff-93d32f); outline-offset:2px;}
`;
