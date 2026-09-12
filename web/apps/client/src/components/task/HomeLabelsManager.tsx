import { css } from "@linaria/core";
import { For, Show, createSignal, onSettled } from "solid-js";

import { organizationApi, type OrganizationLabel } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";

const OPEN_EVENT = "donegeon:open-labels";
type EditMode = { kind: "create" } | { kind: "rename"; label: OrganizationLabel } | null;

export default function HomeLabelsManager() {
  const { refreshData, toast, setError } = useHome();
  const [open, setOpen] = createSignal(false);
  const [labels, setLabels] = createSignal<OrganizationLabel[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [mode, setMode] = createSignal<EditMode>(null);
  const [name, setName] = createSignal("");
  const [menuLabel, setMenuLabel] = createSignal<OrganizationLabel | null>(null);
  const [managerError, setManagerError] = createSignal("");

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
    setMenuLabel(null);
    setName("");
    void load();
  }

  function close() {
    setOpen(false);
    setMode(null);
    setMenuLabel(null);
  }

  async function save() {
    const value = name().trim();
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
        toast.success(`Label ${value} created.`);
      }
      setMode(null);
      setName("");
      setMenuLabel(null);
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
      setMenuLabel(null);
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

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && open()) close();
  };

  onSettled(() => {
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  return (
    <Show when={open()}>
      <div class={backdrop} onClick={close}>
        <section
          class={dialog}
          role="dialog"
          aria-modal="true"
          aria-label="Labels"
          onClick={(event) => event.stopPropagation()}
        >
          <header class={header}>
            <div>
              <p class={eyebrow}>Organization</p>
              <h2 class={heading}>Labels</h2>
            </div>
            <Button type="button" class={secondaryButton} onClick={close}>Close</Button>
          </header>

          <div class={toolbar}>
            <p class={copy}>Create reusable labels, rename them, or remove labels you no longer need.</p>
            <Button
              type="button"
              class={primaryButton}
              onClick={() => { setMode({ kind: "create" }); setName(""); setMenuLabel(null); }}
            >
              Add label
            </Button>
          </div>

          <Show when={mode()}>
            {(activeMode) => (
              <div class={editor}>
                <label class={label} for="label-manager-name">
                  {activeMode().kind === "rename" ? "Label name" : "Label name"}
                </label>
                <input
                  id="label-manager-name"
                  aria-label="Label name"
                  class={input}
                  value={name()}
                  autofocus
                  onInput={(event) => setName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void save();
                    }
                  }}
                />
                <div class={editorActions}>
                  <Button type="button" class={primaryButton} onClick={() => void save()}>
                    {activeMode().kind === "rename" ? "Save" : "Create"}
                  </Button>
                  <Button type="button" class={secondaryButton} onClick={() => { setMode(null); setName(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </Show>

          <Show when={managerError()}><p class={errorText}>{managerError()}</p></Show>

          <div class={list}>
            <Show when={!loading()} fallback={<p class={empty}>Loading labels…</p>}>
              <Show when={labels().length > 0} fallback={<p class={empty}>No labels yet.</p>}>
                <For each={labels()}>
                  {(item) => (
                    <div class={row}>
                      <span class={labelName}>{item.name}</span>
                      <div class={actionWrap}>
                        <Button
                          type="button"
                          class={iconButton}
                          aria-label={`Label actions ${item.name}`}
                          aria-haspopup="menu"
                          onClick={() => setMenuLabel(menuLabel()?.id === item.id ? null : item)}
                        >
                          •••
                        </Button>
                        <Show when={menuLabel()?.id === item.id}>
                          <div class={menu} role="menu">
                            <Button
                              type="button"
                              class={menuItem}
                              role="menuitem"
                              onClick={() => {
                                setMode({ kind: "rename", label: item });
                                setName(item.name);
                                setMenuLabel(null);
                              }}
                            >
                              Rename
                            </Button>
                            <Button type="button" class={menuItemDanger} role="menuitem" onClick={() => void remove(item)}>
                              Delete
                            </Button>
                          </div>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </Show>
            </Show>
          </div>
        </section>
      </div>
    </Show>
  );
}

const backdrop = css`position:fixed; inset:0; z-index:75; display:flex; justify-content:center; align-items:flex-start; padding:2rem 1rem; overflow:auto; background:rgba(0,0,0,.7); backdrop-filter:blur(8px);`;
const dialog = css`width:min(36rem,100%); border:1px solid var(--border-strong); border-radius:1rem; background:var(--panel); color:var(--text-main); box-shadow:var(--shadow-elevated);`;
const header = css`display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.2rem 1.3rem; border-bottom:1px solid var(--border-strong);`;
const eyebrow = css`margin:0; font-size:.66rem; letter-spacing:.14em; text-transform:uppercase; color:var(--text-dim);`;
const heading = css`margin:.18rem 0 0; font-size:1.2rem;`;
const toolbar = css`display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.3rem; border-bottom:1px solid var(--border-soft);`;
const copy = css`margin:0; max-width:25rem; font-size:.82rem; color:var(--text-dim);`;
const editor = css`display:grid; grid-template-columns:minmax(0,1fr) auto; gap:.55rem; align-items:end; padding:1rem 1.3rem; border-bottom:1px solid var(--border-soft);`;
const label = css`grid-column:1 / -1; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const input = css`width:100%; border:1px solid var(--border-strong); border-radius:.65rem; padding:.65rem .75rem; background:rgba(255,255,255,.035); color:var(--text-main); outline:none; &:focus{border-color:var(--accent);}`;
const editorActions = css`display:flex; gap:.45rem;`;
const list = css`display:flex; flex-direction:column; gap:.45rem; padding:1rem 1.3rem 1.3rem;`;
const row = css`display:flex; align-items:center; justify-content:space-between; gap:1rem; min-height:2.75rem; border:1px solid var(--border-soft); border-radius:.7rem; padding:.55rem .65rem .55rem .85rem; background:rgba(255,255,255,.018);`;
const labelName = css`font-weight:650;`;
const actionWrap = css`position:relative;`;
const iconButton = css`border:1px solid var(--border-strong); border-radius:.55rem; padding:.35rem .55rem; background:var(--panel-soft); color:var(--text-main);`;
const menu = css`position:absolute; z-index:5; top:calc(100% + .3rem); right:0; min-width:8rem; display:flex; flex-direction:column; padding:.3rem; border:1px solid var(--border-strong); border-radius:.6rem; background:var(--panel); box-shadow:var(--shadow-elevated);`;
const menuItem = css`border:0; border-radius:.45rem; padding:.5rem .65rem; background:transparent; color:var(--text-main); text-align:left; &:hover{background:rgba(255,255,255,.06);}`;
const menuItemDanger = css`border:0; border-radius:.45rem; padding:.5rem .65rem; background:transparent; color:var(--danger); text-align:left; &:hover{background:rgba(255,255,255,.06);}`;
const primaryButton = css`border:0; border-radius:.6rem; padding:.55rem .75rem; background:var(--accent); color:#1d1108; font-weight:700;`;
const secondaryButton = css`border:1px solid var(--border-strong); border-radius:.6rem; padding:.5rem .7rem; background:var(--panel-soft); color:var(--text-main);`;
const empty = css`margin:.5rem 0; color:var(--text-dim); font-size:.85rem;`;
const errorText = css`margin:0; padding:.7rem 1.3rem; color:var(--danger); border-bottom:1px solid var(--border-soft);`;
