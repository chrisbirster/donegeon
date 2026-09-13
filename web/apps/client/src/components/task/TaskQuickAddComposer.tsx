import { css } from "@linaria/core";
import { For, Show, createSignal } from "solid-js";

import Button from "../Button";
import QuickAddTokenInput, { type QuickAddTokenPiece } from "./QuickAddTokenInput";

type TaskQuickAddComposerProps = {
  content: string;
  tokens: QuickAddTokenPiece[];
  parsedChips: string[];
  parsedGuidance: string;
  onInput: (value: string) => void;
  onSubmit: (event: SubmitEvent) => void;
  inputRef?: (el: HTMLInputElement) => void;
};

export default function TaskQuickAddComposer(props: TaskQuickAddComposerProps) {
  const [helpOpen, setHelpOpen] = createSignal(false);

  return (
    <form onSubmit={props.onSubmit} class={composer}>
      <QuickAddTokenInput
        value={props.content}
        tokens={props.tokens}
        onInput={props.onInput}
        ariaLabel="Quick add task"
        placeholder="Add task"
        testId="add-task-input"
        inputRef={props.inputRef}
      />

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
