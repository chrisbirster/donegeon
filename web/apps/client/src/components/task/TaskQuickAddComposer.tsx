import Button from "../Button";
import { css } from "@linaria/core";
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
    <form onSubmit={props.onSubmit} class={style1}>
      <div class={style2}>
        <div class={style3}>
          <Show when={props.content.length > 0} fallback={<span class={style4}>Add task</span>}>
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
          class={style5}
          aria-label="Add task"
          data-testid="add-task-input"
          spellcheck={false}
          autocomplete="off"
        />
      </div>

      <Show when={props.parsedChips.length > 0}>
        <div class={style6}>
          <For each={props.parsedChips}>
            {(chip) => (
              <span class={style7}>
                {chip}
              </span>
            )}
          </For>
        </div>
      </Show>

      <Show when={props.parsedGuidance}>
        <p class={style8}>
          {props.parsedGuidance}
        </p>
      </Show>

      <div class={style9}>
        <Button
          type="submit"
          class={style10}
          data-testid="add-task-submit"
        >
          Add
        </Button>
      </div>
    </form>
  );
}


const style1 = css`
margin-bottom: calc(var(--spacing) * 6);
`;

const style2 = css`
position: relative;
`;

const style3 = css`
pointer-events: none;
position: absolute;
inset: calc(var(--spacing) * 0);
overflow: hidden;
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xl);
  line-height: var(--tw-leading, var(--text-xl--line-height));
--tw-leading: var(--leading-normal);
  line-height: var(--leading-normal);
--tw-tracking: var(--tracking-normal);
  letter-spacing: var(--tracking-normal);
white-space: pre;
--tw-shadow: 0 18px 38px var(--tw-shadow-color, rgba(0,0,0,0.16));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
--tw-backdrop-blur: blur(8px);
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
font-variant-ligatures: none;
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

const style4 = css`
color: var(--text-dim);
`;

const style5 = css`
position: relative;
width: 100%;
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: transparent;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xl);
  line-height: var(--tw-leading, var(--text-xl--line-height));
--tw-leading: var(--leading-normal);
  line-height: var(--leading-normal);
--tw-tracking: var(--tracking-normal);
  letter-spacing: var(--tracking-normal);
color: transparent;
caret-color: var(--text-main);
--tw-outline-style: none;
  outline-style: none;
font-variant-ligatures: none;
&:focus {
    border-color: var(--accent);
  }
`;

const style6 = css`
margin-top: calc(var(--spacing) * 3);
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 2);
`;

const style7 = css`
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

const style8 = css`
margin-top: calc(var(--spacing) * 2);
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(49,122,86,0.42);
background-color: var(--success-bg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--success);
`;

const style9 = css`
margin-top: calc(var(--spacing) * 3);
display: flex;
justify-content: flex-end;
`;

const style10 = css`
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
--tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
background: var(--accent); color: #1d1108; transition: background-color 160ms ease; &:hover { background: var(--accent-soft); }
`;
