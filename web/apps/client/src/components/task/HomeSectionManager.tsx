import { css } from "@linaria/core";
import { For, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";

import { organizationApi, type OrganizationSection } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";
import ActionMenu from "../ui/ActionMenu";
import Dialog from "../ui/Dialog";

type DialogMode =
  | { kind: "create" }
  | { kind: "rename"; section: OrganizationSection }
  | { kind: "delete"; section: OrganizationSection }
  | null;

type ActiveDialogMode = Exclude<DialogMode, null>;

const deletableSection = (mode: ActiveDialogMode) => mode.kind === "delete" ? mode.section : undefined;

export default function HomeSectionManager() {
  const { currentView, selectedProject, tasks, refreshData, toast, setError } = useHome();
  const [sections, setSections] = createSignal<OrganizationSection[]>([]);
  const [dialogMode, setDialogMode] = createSignal<DialogMode>(null);
  const [name, setName] = createSignal("");
  const [sectionError, setSectionError] = createSignal("");
  let loadedProjectId = "";

  const counts = createMemo(() => {
    const result = new Map<string, number>();
    const projectId = selectedProject()?.id;
    if (!projectId) return result;
    for (const task of tasks()) {
      if (task.isDeleted || task.checked || task.projectId !== projectId || !task.sectionId) continue;
      result.set(task.sectionId, (result.get(task.sectionId) ?? 0) + 1);
    }
    return result;
  });

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

  createEffect(
    () => {
      const project = selectedProject();
      return currentView().kind === "project" ? project?.id ?? "" : "";
    },
    (projectId) => {
      if (projectId === loadedProjectId) return;
      loadedProjectId = projectId;
      setDialogMode(null);
      if (projectId) void load(projectId);
      else setSections([]);
    },
  );

  onSettled(() => {
    const changed = (event: Event) => {
      const projectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (projectId && projectId === selectedProject()?.id) void load(projectId);
    };
    window.addEventListener("donegeon:sections-changed", changed);
    return () => window.removeEventListener("donegeon:sections-changed", changed);
  });

  function beginCreate() {
    setName("");
    setDialogMode({ kind: "create" });
  }

  function beginRename(section: OrganizationSection) {
    setName(section.name);
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
      window.dispatchEvent(new CustomEvent("donegeon:sections-changed", { detail: { projectId: project.id } }));
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
      setError("");
      toast.info(`Section ${section.name} deleted. Its tasks remain in ${project.name} with no section.`);
      await Promise.all([load(project.id), refreshData()]);
      window.dispatchEvent(new CustomEvent("donegeon:sections-changed", { detail: { projectId: project.id } }));
    } catch (err) {
      const message = (err as Error).message;
      setSectionError(message);
      setError(message);
      toast.error(message);
    }
  }

  return (
    <Show when={currentView().kind === "project" && selectedProject() && !selectedProject()?.isInboxProject}>
      <section class={wrapper} aria-labelledby="project-sections-heading">
        <div class={topRow}>
          <div>
            <p class={eyebrow} id="project-sections-heading">Sections</p>
            <p class={helper}>
              Optional groups inside {selectedProject()?.name}. A task can stay in the project without a section; sections never cross projects.
            </p>
          </div>
          <Button type="button" onClick={beginCreate}>Add section</Button>
        </div>

        <Show when={sectionError()}><p class={errorText} role="alert">{sectionError()}</p></Show>

        <Show when={sections().length > 0} fallback={<p class={empty}>No sections yet. Add one when this project needs another layer of organization.</p>}>
          <div class={sectionList}>
            <For each={sections()}>
              {(section) => (
                <div class={sectionCard}>
                  <div class={sectionIdentity}>
                    <h3 class={sectionName}>{section.name}</h3>
                    <span class={sectionCount}>{counts().get(section.id) ?? 0} open</span>
                  </div>
                  <ActionMenu
                    ariaLabel={`Section actions ${section.name}`}
                    items={[
                      { label: "Rename", onSelect: () => beginRename(section) },
                      { label: "Delete", danger: true, onSelect: () => setDialogMode({ kind: "delete", section }) },
                    ]}
                  />
                </div>
              )}
            </For>
          </div>
        </Show>
      </section>

      <Show when={dialogMode()}>
        {(mode) => (
          <Dialog
            ariaLabel={mode().kind === "rename" ? "Rename section" : mode().kind === "delete" ? "Delete section" : "Create section"}
            onClose={() => setDialogMode(null)}
            class={dialog}
          >
            <div class={dialogBody}>
              <h2 class={dialogTitle}>
                {mode().kind === "rename" ? "Rename section" : mode().kind === "delete" ? "Delete section" : "Create section"}
              </h2>

              <Show
                when={mode().kind !== "delete"}
                fallback={
                  <p class={dialogCopy}>
                    Delete <strong>{deletableSection(mode())?.name ?? "this section"}</strong>? Tasks stay in {selectedProject()?.name} and move to the unsectioned group.
                  </p>
                }
              >
                <label class={fieldLabel} for="section-dialog-name">Section name</label>
                <input
                  id="section-dialog-name"
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
                  fallback={<Button type="button" variant="primary" onClick={() => void saveSection()}>{mode().kind === "rename" ? "Save" : "Create"}</Button>}
                >
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      const section = deletableSection(mode());
                      if (section) void deleteSection(section);
                    }}
                  >
                    Delete
                  </Button>
                </Show>
                <Button type="button" onClick={() => setDialogMode(null)}>Cancel</Button>
              </div>
            </div>
          </Dialog>
        )}
      </Show>
    </Show>
  );
}

const wrapper = css`margin:.8rem 0 .25rem; padding:.85rem .95rem; border:1px solid var(--border-soft); border-radius:.8rem; background:rgba(255,255,255,.015);`;
const topRow = css`display:flex; align-items:flex-start; justify-content:space-between; gap:1rem;`;
const eyebrow = css`margin:0; font-size:.7rem; font-weight:750; letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim);`;
const helper = css`margin:.25rem 0 0; max-width:42rem; font-size:.76rem; line-height:1.45; color:var(--text-dim);`;
const sectionList = css`display:flex; flex-wrap:wrap; gap:.55rem; margin-top:.75rem;`;
const sectionCard = css`display:grid; grid-template-columns:minmax(0,1fr) 2.5rem; gap:.45rem; align-items:stretch; min-width:11rem; border:1px solid var(--border-soft); border-radius:.65rem; padding:.4rem; background:rgba(255,255,255,.025);`;
const sectionIdentity = css`display:flex; flex-direction:column; justify-content:center; min-width:0; padding:.1rem .3rem;`;
const sectionName = css`margin:0; font-size:.84rem; font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
const sectionCount = css`color:var(--text-dim); font-size:.68rem;`;
const errorText = css`margin:.65rem 0 0; color:var(--danger); font-size:.8rem;`;
const empty = css`margin:.7rem 0 0; color:var(--text-dim); font-size:.78rem;`;
const dialog = css`width:min(30rem,100%);`;
const dialogBody = css`padding:1.2rem;`;
const dialogTitle = css`margin:0 0 1rem; font-size:1.1rem;`;
const dialogCopy = css`margin:0 0 1rem; color:var(--text-dim); line-height:1.5;`;
const fieldLabel = css`display:block; margin-bottom:.4rem; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const input = css`
  width:100%; border:1px solid var(--border-strong); border-radius:.65rem; padding:.68rem .75rem; background:rgba(255,255,255,.035); color:var(--text-main); outline:none;
  &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
const dialogActions = css`display:flex; justify-content:flex-end; gap:.5rem; margin-top:1rem;`;
