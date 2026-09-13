import { css } from "@linaria/core";
import { For, Show, createMemo, createSignal, onSettled } from "solid-js";

import { organizationApi, type OrganizationLabel } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";
import ActionMenu from "../ui/ActionMenu";
import Dialog, { dialogEyebrow, dialogHeader, dialogTitle } from "../ui/Dialog";

const OPEN_EVENT = "donegeon:open-labels";
type EditMode = { kind: "create" } | { kind: "rename"; label: OrganizationLabel } | null;

const normalize = (value: string) => value.trim().replace(/^@/, "").toLowerCase();

export default function HomeLabelsManager() {
  const { tasks, refreshData, toast, setError } = useHome();
  const [open, setOpen] = createSignal(false);
  const [labels, setLabels] = createSignal<OrganizationLabel[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [mode, setMode] = createSignal<EditMode>(null);
  const [name, setName] = createSignal("");
  const [managerError, setManagerError] = createSignal("");

  const usageByLabel = createMemo(() => {
    const result = new Map<string, { open: number; total: number }>();
    for (const task of tasks()) {
      if (task.isDeleted) continue;
      for (const label of task.labels ?? []) {
        const key = normalize(label);
        if (!key) continue;
        const current = result.get(key) ?? { open: 0, total: 0 };
        current.total += 1;
        if (!task.checked) current.open += 1;
        result.set(key, current);
      }
    }
    return result;
  });

  async function load() {
    setLoading(true);
    try {
      const page = await organizationApi.labels.list();
      setLabels(page.items ?? []);
      setManagerError("");
    } catch (err) {
      setManagerError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function show() {
    setOpen(true);
    setMode(null);
    setName("");
    void load();
  }

  function close() {
    setOpen(false);
    setMode(null);
  }

  async function save() {
    const value = normalize(name());
    if (!value) {
      setManagerError("Label name is required.");
      return;
    }

    try {
      const currentMode = mode();
      if (currentMode?.kind === "rename") {
        await organizationApi.labels.rename(currentMode.label.id, value);
        toast.success(`Label renamed to ${value}.`);
      } else {
        await organizationApi.labels.create(value);
        toast.success(`Label ${value} created. You can assign it from Add Task or Task Detail.`);
      }
      setMode(null);
      setName("");
      setError("");
      await Promise.all([load(), refreshData()]);
    } catch (err) {
      const message = (err as Error).message;
      setManagerError(message);
      setError(message);
      toast.error(message);
    }
  }

  async function remove(label: OrganizationLabel) {
    try {
      await organizationApi.labels.remove(label.id);
      setError("");
      toast.info(`Label ${label.name} deleted.`);
      await Promise.all([load(), refreshData()]);
    } catch (err) {
      const message = (err as Error).message;
      setManagerError(message);
      setError(message);
      toast.error(message);
    }
  }

  onSettled(() => {
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  });

  return (
    <Show when={open()}>
      <Dialog ariaLabel="Labels" onClose={close} class={dialog}>
        <header class={dialogHeader}>
          <div>
            <p class={dialogEyebrow}>Organization</p>
            <h2 class={dialogTitle}>Labels</h2>
          </div>
          <Button type="button" onClick={close}>Close</Button>
        </header>

        <div class={toolbar}>
          <p class={copy}>Reusable labels can be assigned from Add Task or Task Detail. Usage counts help you audit rename/delete impact.</p>
          <Button type="button" variant="primary" onClick={() => { setMode({ kind: "create" }); setName(""); }}>Add label</Button>
        </div>

        <Show when={mode()}>
          {(activeMode) => (
            <div class={editor}>
              <label class={labelStyle} for="label-manager-name">Label name</label>
              <input
                id="label-manager-name"
                class={input}
                value={name()}
                autofocus
                onInput={(event) => setName(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void save();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setMode(null);
                  }
                }}
              />
              <div class={editorActions}>
                <Button type="button" variant="primary" onClick={() => void save()}>
                  {activeMode().kind === "rename" ? "Save" : "Create"}
                </Button>
                <Button type="button" onClick={() => { setMode(null); setName(""); }}>Cancel</Button>
              </div>
            </div>
          )}
        </Show>

        <Show when={managerError()}><p class={errorText} role="alert">{managerError()}</p></Show>

        <div class={list}>
          <Show when={!loading()} fallback={<p class={empty}>Loading labels…</p>}>
            <Show when={labels().length > 0} fallback={<p class={empty}>No labels yet.</p>}>
              <For each={labels()}>
                {(item) => {
                  const usage = () => usageByLabel().get(normalize(item.name)) ?? { open: 0, total: 0 };
                  return (
                    <div class={row}>
                      <div class={labelInfo}>
                        <span class={labelName}>@{item.name}</span>
                        <span class={usageText}>{usage().open} open · {usage().total} total task{usage().total === 1 ? "" : "s"}</span>
                      </div>
                      <ActionMenu
                        ariaLabel={`Label actions ${item.name}`}
                        items={[
                          {
                            label: "Rename",
                            onSelect: () => {
                              setMode({ kind: "rename", label: item });
                              setName(item.name);
                            },
                          },
                          { label: `Delete (${usage().total} task${usage().total === 1 ? "" : "s"})`, danger: true, onSelect: () => void remove(item) },
                        ]}
                      />
                    </div>
                  );
                }}
              </For>
            </Show>
          </Show>
        </div>
      </Dialog>
    </Show>
  );
}

const dialog = css`width:min(38rem,100%);`;
const toolbar = css`display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.3rem; border-bottom:1px solid var(--border-soft);`;
const copy = css`margin:0; max-width:27rem; font-size:.82rem; line-height:1.45; color:var(--text-dim);`;
const editor = css`display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.55rem; align-items:end; padding:1rem 1.3rem; border-bottom:1px solid var(--border-soft);`;
const labelStyle = css`grid-column:1 / -1; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const input = css`
  width:100%; border:1px solid var(--border-strong); border-radius:.65rem; padding:.65rem .75rem; background:rgba(255,255,255,.035); color:var(--text-main); outline:none;
  &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
const editorActions = css`display:flex; gap:.45rem;`;
const list = css`display:flex; flex-direction:column; gap:.45rem; padding:1rem 1.3rem 1.3rem;`;
const row = css`display:grid; grid-template-columns:minmax(0,1fr) 2.6rem; gap:.65rem; align-items:stretch; min-height:3.2rem; border:1px solid var(--border-soft); border-radius:.7rem; padding:.55rem .65rem .55rem .85rem; background:rgba(255,255,255,.018);`;
const labelInfo = css`display:flex; flex-direction:column; justify-content:center; min-width:0; gap:.15rem;`;
const labelName = css`font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
const usageText = css`color:var(--text-dim); font-size:.74rem;`;
const empty = css`margin:.5rem 0; color:var(--text-dim); font-size:.85rem;`;
const errorText = css`margin:0; padding:.7rem 1.3rem; color:var(--danger); border-bottom:1px solid var(--border-soft);`;
