import { css } from "@linaria/core";
import { For, Show, createEffect, createSignal } from "solid-js";

import { organizationApi, type OrganizationSection } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";

type DialogMode =
  | { kind: "create" }
  | { kind: "rename"; section: OrganizationSection }
  | { kind: "delete"; section: OrganizationSection }
  | null;

export default function HomeSectionManager() {
  const { currentView, selectedProject, refreshData, toast, setError } = useHome();
  const [sections, setSections] = createSignal<OrganizationSection[]>([]);
  const [dialogMode, setDialogMode] = createSignal<DialogMode>(null);
  const [menuSection, setMenuSection] = createSignal<OrganizationSection | null>(null);
  const [name, setName] = createSignal("");
  const [sectionError, setSectionError] = createSignal("");
  let loadedProjectId = "";

  async function load(projectId: string) {
    if (!projectId) {
      setSections([]);
      return;
    }
    try {
      const page = await organizationApi.sections.list(projectId);
      if (selectedProject()?.id === projectId) setSections(page.items ?? []);
      setSectionError("");
    } catch (err) {
      setSectionError((err as Error).message);
    }
  }

  createEffect(() => {
    const project = selectedProject();
    const projectId = currentView().kind === "project" ? project?.id ?? "" : "";
    if (projectId === loadedProjectId) return;
    loadedProjectId = projectId;
    setDialogMode(null);
    setMenuSection(null);
    if (projectId) void load(projectId);
    else setSections([]);
  });

  function beginCreate() {
    setName("");
    setMenuSection(null);
    setDialogMode({ kind: "create" });
  }

  function beginRename(section: OrganizationSection) {
    setName(section.name);
    setMenuSection(null);
    setDialogMode({ kind: "rename", section });
  }

  async function saveSection() {
    const project = selectedProject();
    const value = name().trim();
    const mode = dialogMode();
    if (!project || !mode || mode.kind === "delete") return;
    if (!value) {
      setSectionError("Section name is required.");
      return;
    }

    try {
      if (mode.kind === "rename") {
        await organizationApi.sections.rename(mode.section.id, value);
        toast.success(`Section renamed to ${value}.`);
      } else {
        await organizationApi.sections.create(project.id, value);
        toast.success(`Section ${value} created.`);
      }
      setDialogMode(null);
      setName("");
      setError("");
      await load(project.id);
    } catch (err) {
      const message = (err as Error).message;
      setSectionError(message);
      setError(message);
      toast.error(message);
    }
  }

  async function deleteSection(section: OrganizationSection) {
    const project = selectedProject();
    if (!project) return;
    try {
      await organizationApi.sections.remove(section.id);
      setDialogMode(null);
      setMenuSection(null);
      setError("");
      toast.info(`Section ${section.name} deleted.`);
      await Promise.all([load(project.id), refreshData()]);
    } catch (err) {
      const message = (err as Error).message;
      setSectionError(message);
      setError(message);
      toast.error(message);
    }
  }

  return (
    <Show when={currentView().kind === "project" && selectedProject() && !selectedProject()?.isInboxProject}>
      <section class={wrapper} aria-label="Project sections">
        <div class={topRow}>
          <div>
            <p class={eyebrow}>Sections</p>
            <p class={helper}>Group tasks inside {selectedProject()?.name}.</p>
          </div>
          <Button type="button" class={addButton} onClick={beginCreate}>Add section</Button>
        </div>

        <Show when={sectionError()}><p class={errorText}>{sectionError()}</p></Show>

        <Show when={sections().length > 0}>
          <div class={sectionList}>
            <For each={sections()}>
              {(section) => (
                <div class={sectionCard}>
                  <h3 class={sectionName}>{section.name}</h3>
                  <div class={actionWrap}>
                    <Button
                      type="button"
                      class={actionButton}
                      aria-label={`Section actions ${section.name}`}
                      aria-haspopup="menu"
                      onClick={() => setMenuSection(menuSection()?.id === section.id ? null : section)}
                    >
                      •••
                    </Button>
                    <Show when={menuSection()?.id === section.id}>
                      <div class={menu} role="menu">
                        <Button type="button" role="menuitem" class={menuItem} onClick={() => beginRename(section)}>Rename</Button>
                        <Button
                          type="button"
                          role="menuitem"
                          class={menuItemDanger}
                          onClick={() => { setMenuSection(null); setDialogMode({ kind: "delete", section }); }}
                        >
                          Delete
                        </Button>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </section>

      <Show when={dialogMode()}>
        {(mode) => (
          <div class={backdrop} onClick={() => setDialogMode(null)}>
            <section
              class={dialog}
              role="dialog"
              aria-modal="true"
              aria-label={mode().kind === "rename" ? "Rename section" : mode().kind === "delete" ? "Delete section" : "Create section"}
              onClick={(event) => event.stopPropagation()}
            >
              <h2 class={dialogTitle}>
                {mode().kind === "rename" ? "Rename section" : mode().kind === "delete" ? "Delete section" : "Create section"}
              </h2>

              <Show
                when={mode().kind !== "delete"}
                fallback={
                  <p class={dialogCopy}>
                    Delete <strong>{mode().kind === "delete" ? mode().section.name : "this section"}</strong>? Tasks stay in the project and lose only this section placement.
                  </p>
                }
              >
                <label class={fieldLabel} for="section-dialog-name">Section name</label>
                <input
                  id="section-dialog-name"
                  aria-label="Section name"
                  class={input}
                  value={name()}
                  autofocus
                  onInput={(event) => setName(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void saveSection();
                    }
                  }}
                />
              </Show>

              <div class={dialogActions}>
                <Show
                  when={mode().kind === "delete"}
                  fallback={
                    <Button type="button" class={primaryButton} onClick={() => void saveSection()}>
                      {mode().kind === "rename" ? "Save" : "Create"}
                    </Button>
                  }
                >
                  <Button
                    type="button"
                    class={dangerButton}
                    onClick={() => mode().kind === "delete" && void deleteSection(mode().section)}
                  >
                    Delete
                  </Button>
                </Show>
                <Button type="button" class={secondaryButton} onClick={() => setDialogMode(null)}>Cancel</Button>
              </div>
            </section>
          </div>
        )}
      </Show>
    </Show>
  );
}

const wrapper = css`margin:.8rem 0 .25rem; padding:.8rem .9rem; border:1px solid var(--border-soft); border-radius:.8rem; background:rgba(255,255,255,.015);`;
const topRow = css`display:flex; align-items:center; justify-content:space-between; gap:1rem;`;
const eyebrow = css`margin:0; font-size:.7rem; font-weight:750; letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim);`;
const helper = css`margin:.2rem 0 0; font-size:.76rem; color:var(--text-dim);`;
const addButton = css`border:1px solid var(--border-strong); border-radius:.6rem; padding:.5rem .7rem; background:var(--panel-soft); color:var(--text-main);`;
const sectionList = css`display:flex; flex-wrap:wrap; gap:.5rem; margin-top:.75rem;`;
const sectionCard = css`display:flex; align-items:center; gap:.45rem; border:1px solid var(--border-soft); border-radius:.65rem; padding:.4rem .4rem .4rem .65rem; background:rgba(255,255,255,.025);`;
const sectionName = css`margin:0; font-size:.84rem; font-weight:650;`;
const actionWrap = css`position:relative;`;
const actionButton = css`border:0; border-radius:.45rem; padding:.25rem .4rem; background:transparent; color:var(--text-dim);`;
const menu = css`position:absolute; z-index:20; top:calc(100% + .25rem); right:0; min-width:8rem; display:flex; flex-direction:column; padding:.3rem; border:1px solid var(--border-strong); border-radius:.6rem; background:var(--panel); box-shadow:var(--shadow-elevated);`;
const menuItem = css`border:0; border-radius:.4rem; padding:.48rem .6rem; background:transparent; color:var(--text-main); text-align:left;`;
const menuItemDanger = css`border:0; border-radius:.4rem; padding:.48rem .6rem; background:transparent; color:var(--danger); text-align:left;`;
const errorText = css`margin:.65rem 0 0; color:var(--danger); font-size:.8rem;`;
const backdrop = css`position:fixed; inset:0; z-index:80; display:flex; align-items:flex-start; justify-content:center; padding:3rem 1rem; background:rgba(0,0,0,.72); backdrop-filter:blur(8px);`;
const dialog = css`width:min(30rem,100%); border:1px solid var(--border-strong); border-radius:.9rem; padding:1.2rem; background:var(--panel); color:var(--text-main); box-shadow:var(--shadow-elevated);`;
const dialogTitle = css`margin:0 0 1rem; font-size:1.1rem;`;
const dialogCopy = css`margin:0 0 1rem; color:var(--text-dim); line-height:1.5;`;
const fieldLabel = css`display:block; margin-bottom:.4rem; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const input = css`width:100%; border:1px solid var(--border-strong); border-radius:.65rem; padding:.68rem .75rem; background:rgba(255,255,255,.035); color:var(--text-main); outline:none; &:focus{border-color:var(--accent);}`;
const dialogActions = css`display:flex; justify-content:flex-end; gap:.5rem; margin-top:1rem;`;
const primaryButton = css`border:0; border-radius:.6rem; padding:.55rem .75rem; background:var(--accent); color:#1d1108; font-weight:700;`;
const secondaryButton = css`border:1px solid var(--border-strong); border-radius:.6rem; padding:.5rem .7rem; background:var(--panel-soft); color:var(--text-main);`;
const dangerButton = css`border:1px solid color-mix(in srgb,var(--danger) 45%,transparent); border-radius:.6rem; padding:.5rem .75rem; background:rgba(255,70,90,.08); color:var(--danger);`;
