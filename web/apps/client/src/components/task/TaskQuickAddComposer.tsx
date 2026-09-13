import { css } from "@linaria/core";
import { For, Show, createSignal } from "solid-js";

import Button from "../Button";

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
  parsedChips: string[];
  parsedGuidance: string;
  onInput: (value: string) => void;
  onSubmit: (event: SubmitEvent) => void;
  inputRef?: (el: HTMLInputElement) => void;
};

const tokenStyles: Record<Exclude<TokenKind, "text">, string> = {
  project: css`border-radius:.28rem; background:rgba(120,37,34,.36); color:#ffd4cf;`,
  label: css`border-radius:.28rem; background:rgba(97,76,132,.3); color:#edd8ff;`,
  assignee: css`border-radius:.28rem; background:rgba(26,78,95,.34); color:#d2f4ff;`,
  priority: css`border-radius:.28rem; background:rgba(255,139,80,.22); color:#ffd7b7;`,
  deadline: css`border-radius:.28rem; background:rgba(74,78,156,.35); color:#ddd9ff;`,
  recurrence: css`border-radius:.28rem; background:rgba(24,88,57,.33); color:#c7f6d4;`,
  due: css`border-radius:.28rem; background:rgba(110,78,21,.34); color:#ffd4a1;`,
};

export default function TaskQuickAddComposer(props: TaskQuickAddComposerProps) {
  const [helpOpen, setHelpOpen] = createSignal(false);

  return (
    <form onSubmit={props.onSubmit} class={composer}>
      <div class={inputWrap}>
        <div class={highlightLayer} aria-hidden="true">
          <Show when={props.content.length > 0} fallback={<span class={placeholder}>Add task</span>}>
            <For each={props.tokens}>
              {(token) => (
                <span class={token.kind === "text" ? plainToken : tokenStyles[token.kind]}>
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
          class={input}
          aria-label="Quick add task"
          aria-describedby="quick-add-help-summary"
          data-testid="add-task-input"
          spellcheck={false}
          autocomplete="off"
        />
      </div>

      <div class={utilityRow}>
        <div class={chipArea} aria-live="polite">
          <Show when={props.parsedChips.length > 0}>
            <For each={props.parsedChips}>
              {(chip) => <span class={chip}>{chip}</span>}
            </For>
          </Show>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={helpOpen()}
          aria-controls="quick-add-legend"
          onClick={() => setHelpOpen((value) => !value)}
        >
          <span aria-hidden="true">?</span> Quick Add help
        </Button>
      </div>

      <p id="quick-add-help-summary" class={srOnly}>
        Quick Add supports project, label, assignee, priority, due date, deadline, recurrence, and description syntax.
      </p>

      <Show when={helpOpen()}>
        <aside id="quick-add-legend" class={legend} aria-label="Quick Add syntax legend">
          <p class={legendTitle}>Quick Add syntax</p>
          <dl class={legendGrid}>
            <div><dt>Project</dt><dd><code>#project</code></dd></div>
            <div><dt>Label</dt><dd><code>@label</code></dd></div>
            <div><dt>Assignee</dt><dd><code>+name</code></dd></div>
            <div><dt>Priority</dt><dd><code>p1</code>–<code>p4</code></dd></div>
            <div><dt>Due</dt><dd><code>due Wednesday at 8pm</code></dd></div>
            <div><dt>Deadline</dt><dd><code>{`{Friday at 8am}`}</code></dd></div>
            <div><dt>Repeat</dt><dd><code>every week</code></dd></div>
            <div><dt>Description</dt><dd><code>// description</code></dd></div>
          </dl>
        </aside>
      </Show>

      <Show when={props.parsedGuidance}>
        <p class={guidance}>{props.parsedGuidance}</p>
      </Show>

      <div class={actions}>
        <Button type="submit" variant="primary" data-testid="add-task-submit">Add</Button>
      </div>
    </form>
  );
}

const composer = css`margin-bottom:1.5rem;`;
const inputWrap = css`position:relative;`;
const sharedText = `font-family:inherit; font-size:1.25rem; line-height:1.5; letter-spacing:normal; font-variant-ligatures:none;`;
const highlightLayer = css`
  pointer-events:none; position:absolute; inset:0; overflow:hidden; border:1px solid var(--border-strong);
  border-radius:var(--radius-xl); padding:.5rem .75rem; background:var(--panel-soft); color:var(--text-main);
  white-space:pre; box-shadow:0 18px 38px rgba(0,0,0,.16); backdrop-filter:blur(8px);
  ${sharedText}
`;
const placeholder = css`color:var(--text-dim);`;
const plainToken = css`color:var(--text-main);`;
const input = css`
  position:relative; width:100%; border:1px solid var(--border-strong); border-radius:var(--radius-xl);
  padding:.5rem .75rem; background:transparent; color:transparent; caret-color:var(--text-main); outline:none;
  ${sharedText}
  &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
const utilityRow = css`display:flex; align-items:flex-start; justify-content:space-between; gap:.75rem; margin-top:.65rem;`;
const chipArea = css`display:flex; flex:1; flex-wrap:wrap; gap:.45rem; min-height:1.9rem;`;
const chip = css`
  border:1px solid var(--border-soft); border-radius:.55rem; padding:.24rem .48rem; background:var(--panel-soft);
  color:var(--text-soft); font-size:.75rem; backdrop-filter:blur(12px);
`;
const legend = css`
  margin-top:.55rem; border:1px solid var(--border-strong); border-radius:.7rem; padding:.8rem;
  background:rgba(255,255,255,.025); color:var(--text-main);
`;
const legendTitle = css`margin:0 0 .6rem; font-weight:700;`;
const legendGrid = css`
  display:grid; grid-template-columns:repeat(auto-fit,minmax(12rem,1fr)); gap:.55rem .9rem; margin:0;
  & > div{display:flex; align-items:baseline; justify-content:space-between; gap:.7rem; border-bottom:1px solid var(--border-soft); padding-bottom:.35rem;}
  dt{font-size:.75rem; color:var(--text-dim);}
  dd{margin:0; font-size:.75rem; text-align:right;}
  code{color:var(--accent-text);}
`;
const guidance = css`
  margin:.5rem 0 0; border:1px solid rgba(49,122,86,.42); border-radius:.55rem; padding:.5rem .7rem;
  background:var(--success-bg); color:var(--success); font-size:.75rem;
`;
const actions = css`display:flex; justify-content:flex-end; margin-top:.65rem;`;
const srOnly = css`
  position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;
`;
