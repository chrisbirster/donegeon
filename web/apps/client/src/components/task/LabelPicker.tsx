import { css } from "@linaria/core";
import { For, Show, createMemo, createSignal, onSettled } from "solid-js";

import { organizationApi, type OrganizationLabel } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";

export type LabelPickerProps = {
  id: string;
  value: string[];
  onChange: (labels: string[]) => void;
  label?: string;
  testId?: string;
};

const normalize = (value: string) => value.trim().replace(/^@/, "").toLowerCase();

export default function LabelPicker(props: LabelPickerProps) {
  const { toast, setError } = useHome();
  const [open, setOpen] = createSignal(false);
  const [labels, setLabels] = createSignal<OrganizationLabel[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");
  const [pickerError, setPickerError] = createSignal("");
  let root!: HTMLDivElement;

  const selected = createMemo(() => new Set(props.value.map(normalize).filter(Boolean)));
  const summary = createMemo(() => props.value.length > 0 ? props.value.map((label) => `@${normalize(label)}`).join(" ") : "No labels");

  async function load() {
    setLoading(true);
    try {
      const page = await organizationApi.labels.list();
      setLabels(page.items ?? []);
      setPickerError("");
    } catch (err) {
      setPickerError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(label: string) {
    const normalized = normalize(label);
    const current = props.value.map(normalize).filter(Boolean);
    const next = current.includes(normalized)
      ? current.filter((item) => item !== normalized)
      : [...current, normalized];
    props.onChange(next);
  }

  async function createLabel() {
    const value = normalize(name());
    if (!value) {
      setPickerError("Label name is required.");
      return;
    }
    try {
      const created = await organizationApi.labels.create(value);
      await load();
      if (!selected().has(normalize(created.name))) props.onChange([...props.value.map(normalize).filter(Boolean), normalize(created.name)]);
      setCreating(false);
      setName("");
      setError("");
      toast.success(`Label ${created.name} created and selected.`);
    } catch (err) {
      const message = (err as Error).message;
      setPickerError(message);
      setError(message);
      toast.error(message);
    }
  }

  onSettled(() => {
    void load();
    const outside = (event: PointerEvent) => {
      if (!open()) return;
      if (event.target instanceof Node && !root.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open()) {
        event.preventDefault();
        setOpen(false);
        root.querySelector<HTMLElement>("[role='combobox']")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  });

  return (
    <div class={field} ref={root}>
      <label class={labelStyle} for={props.id}>{props.label ?? "Labels"}</label>
      <Button
        id={props.id}
        type="button"
        unstyled
        class={trigger}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open()}
        aria-controls={`${props.id}-listbox`}
        data-testid={props.testId}
        onClick={() => setOpen((value) => !value)}
      >
        <span class={summaryStyle}>{summary()}</span>
        <span aria-hidden="true">⌄</span>
      </Button>
      <p class={description}>Choose reusable labels for this task, or create one without leaving the editor.</p>

      <Show when={open()}>
        <div id={`${props.id}-listbox`} class={popup} role="listbox" aria-label={props.label ?? "Labels"} aria-multiselectable="true">
          <Show when={!loading()} fallback={<p class={empty}>Loading labels…</p>}>
            <Show when={labels().length > 0} fallback={<p class={empty}>No reusable labels yet.</p>}>
              <For each={labels()}>
                {(item) => {
                  const checked = () => selected().has(normalize(item.name));
                  return (
                    <Button
                      type="button"
                      unstyled
                      class={`${option} ${checked() ? selectedOption : ""}`}
                      role="option"
                      aria-selected={checked()}
                      onClick={() => toggle(item.name)}
                    >
                      <span>@{item.name}</span>
                      <span aria-hidden="true">{checked() ? "✓" : ""}</span>
                    </Button>
                  );
                }}
              </For>
            </Show>
          </Show>
          <div class={separator} />
          <Show
            when={creating()}
            fallback={<Button type="button" unstyled class={createAction} onClick={() => { setCreating(true); setName(""); }}>+ Create label…</Button>}
          >
            <div class={creator}>
              <label class={creatorLabel} for={`${props.id}-new-label`}>New label name</label>
              <input
                id={`${props.id}-new-label`}
                class={input}
                value={name()}
                autofocus
                onInput={(event) => setName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createLabel();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setCreating(false);
                  }
                }}
              />
              <div class={creatorActions}>
                <Button type="button" variant="primary" size="sm" onClick={() => void createLabel()}>Create & select</Button>
                <Button type="button" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </div>
          </Show>
          <Show when={pickerError()}><p class={errorText} role="alert">{pickerError()}</p></Show>
        </div>
      </Show>
    </div>
  );
}

const field = css`position:relative; display:flex; flex-direction:column; gap:.4rem;`;
const labelStyle = css`font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const trigger = css`
  display:flex; align-items:center; justify-content:space-between; gap:.75rem; width:100%; min-height:2.8rem;
  border:1px solid var(--border-strong); border-radius:.7rem; padding:.68rem .8rem; background:rgba(255,255,255,.035);
  color:var(--text-main); text-align:left; cursor:pointer;
  &:hover{border-color:var(--border-hover); background:var(--panel-soft);}
  &:focus-visible{outline:2px solid #00e0ff; outline-offset:2px; border-color:var(--accent);}
`;
const summaryStyle = css`min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
const description = css`margin:0; color:var(--text-dim); font-size:.72rem; line-height:1.35;`;
const popup = css`
  position:absolute; z-index:120; top:calc(100% + .35rem); left:0; right:0; max-height:20rem; overflow:auto;
  display:flex; flex-direction:column; gap:.2rem; padding:.35rem; border:1px solid var(--border-strong); border-radius:.7rem;
  background:var(--panel); box-shadow:var(--shadow-elevated);
`;
const option = css`
  display:flex; align-items:center; justify-content:space-between; gap:.75rem; width:100%; border:0; border-radius:.5rem;
  padding:.6rem .7rem; background:transparent; color:var(--text-main); text-align:left; cursor:pointer;
  &:hover, &:focus-visible{background:rgba(196,69,255,.12); outline:none; box-shadow:inset 0 0 0 2px #00e0ff;}
`;
const selectedOption = css`background:var(--accent-wash); color:var(--accent-text);`;
const separator = css`height:1px; margin:.2rem .25rem; background:var(--border-soft);`;
const createAction = css`
  width:100%; border:0; border-radius:.5rem; padding:.6rem .7rem; background:transparent; color:var(--accent-text); text-align:left; cursor:pointer;
  &:hover, &:focus-visible{background:rgba(196,69,255,.12); outline:none; box-shadow:inset 0 0 0 2px #00e0ff;}
`;
const creator = css`display:flex; flex-direction:column; gap:.45rem; padding:.45rem;`;
const creatorLabel = css`font-size:.68rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-dim);`;
const input = css`
  width:100%; min-height:2.3rem; border:1px solid var(--border-strong); border-radius:.55rem; padding:.5rem .6rem; background:rgba(255,255,255,.035);
  color:var(--text-main); outline:none; &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
const creatorActions = css`display:flex; gap:.4rem; justify-content:flex-end;`;
const empty = css`margin:.4rem; color:var(--text-dim); font-size:.78rem;`;
const errorText = css`margin:.3rem .45rem; color:var(--danger); font-size:.78rem;`;
