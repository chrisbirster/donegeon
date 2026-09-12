import { css } from "@linaria/core";
import { For, Show, createSignal, onSettled } from "solid-js";

import { fromDatetimeLocalValue, parseLabelsInput } from "../../features/tasks/home-model";
import { createFullTask, organizationApi, type OrganizationSection } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";

const OPEN_EVENT = "donegeon:open-task-create";

export default function HomeTaskCreateModal() {
  const { sidebarProjects, refreshData, toast, setError } = useHome();
  const [open, setOpen] = createSignal(false);
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [projectId, setProjectId] = createSignal("");
  const [sectionId, setSectionId] = createSignal("");
  const [sections, setSections] = createSignal<OrganizationSection[]>([]);
  const [tags, setTags] = createSignal("");
  const [priority, setPriority] = createSignal(4);
  const [due, setDue] = createSignal("");
  const [deadline, setDeadline] = createSignal("");
  const [recurrence, setRecurrence] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [formError, setFormError] = createSignal("");

  function reset() {
    setTitle("");
    setDescription("");
    setProjectId("");
    setSectionId("");
    setSections([]);
    setTags("");
    setPriority(4);
    setDue("");
    setDeadline("");
    setRecurrence("");
    setSaving(false);
    setFormError("");
  }

  function show() {
    reset();
    setOpen(true);
  }

  function close() {
    if (saving()) return;
    setOpen(false);
    setFormError("");
  }

  async function selectProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    setSectionId("");
    if (!nextProjectId) {
      setSections([]);
      return;
    }
    try {
      const page = await organizationApi.sections.list(nextProjectId);
      if (projectId() === nextProjectId) setSections(page.items ?? []);
    } catch (err) {
      setSections([]);
      setFormError((err as Error).message);
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const content = title().trim();
    if (!content) {
      setFormError("Task title is required.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await createFullTask({
        content,
        description: description().trim(),
        projectId: projectId() || undefined,
        sectionId: projectId() && sectionId() ? sectionId() : undefined,
        priority: priority(),
        labels: parseLabelsInput(tags()),
        dueText: due() ? fromDatetimeLocalValue(due()) : undefined,
        dueDeadline: deadline() ? fromDatetimeLocalValue(deadline()) : undefined,
        recurrenceRule: recurrence().trim() || undefined,
      });
      await refreshData();
      setError("");
      setOpen(false);
      toast.success("Task created.");
    } catch (err) {
      const message = (err as Error).message;
      setFormError(message);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  onSettled(() => {
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  });

  return (
    <Show when={open()}>
      <div class={backdrop} onClick={close}>
        <form
          class={dialog}
          role="dialog"
          aria-modal="true"
          aria-label="Create task"
          data-testid="task-create-modal"
          onSubmit={submit}
          onClick={(event) => event.stopPropagation()}
        >
          <header class={header}>
            <div>
              <p class={eyebrow}>New Task</p>
              <h2 class={titleStyle}>Create task</h2>
            </div>
            <Button type="button" class={secondaryButton} onClick={close}>Close</Button>
          </header>

          <div class={body}>
            <div class={primaryColumn}>
              <label class={fieldLabel} for="task-create-title">Title</label>
              <input
                id="task-create-title"
                data-testid="task-create-title"
                class={textInput}
                value={title()}
                onInput={(event) => setTitle(event.currentTarget.value)}
                autofocus
              />

              <label class={fieldLabel} for="task-create-description">Description</label>
              <textarea
                id="task-create-description"
                data-testid="task-create-description"
                class={textarea}
                value={description()}
                onInput={(event) => setDescription(event.currentTarget.value)}
              />
            </div>

            <div class={metadataColumn}>
              <label class={fieldLabel} for="task-create-project">Project</label>
              <select
                id="task-create-project"
                data-testid="task-create-project"
                class={textInput}
                value={projectId()}
                onInput={(event) => void selectProject(event.currentTarget.value)}
              >
                <option value="">Inbox / no project</option>
                <For each={sidebarProjects().filter((project) => !project.isInboxProject)}>
                  {(project) => <option value={project.id}>{project.name}</option>}
                </For>
              </select>

              <label class={fieldLabel} for="task-create-section">Section</label>
              <select
                id="task-create-section"
                data-testid="task-create-section"
                class={textInput}
                value={sectionId()}
                disabled={!projectId()}
                onInput={(event) => setSectionId(event.currentTarget.value)}
              >
                <option value="">No section</option>
                <For each={sections()}>{(section) => <option value={section.id}>{section.name}</option>}</For>
              </select>

              <label class={fieldLabel} for="task-create-tags">Tags</label>
              <input
                id="task-create-tags"
                data-testid="task-create-tags"
                class={textInput}
                placeholder="@chore @home"
                value={tags()}
                onInput={(event) => setTags(event.currentTarget.value)}
              />

              <label class={fieldLabel} for="task-create-priority">Priority</label>
              <select
                id="task-create-priority"
                data-testid="task-create-priority"
                class={textInput}
                value={priority()}
                onInput={(event) => setPriority(Number(event.currentTarget.value))}
              >
                <option value={1}>P1</option>
                <option value={2}>P2</option>
                <option value={3}>P3</option>
                <option value={4}>P4</option>
              </select>

              <label class={fieldLabel} for="task-create-due">Due · Scheduled for</label>
              <input
                id="task-create-due"
                data-testid="task-create-due"
                type="datetime-local"
                class={textInput}
                value={due()}
                onInput={(event) => setDue(event.currentTarget.value)}
              />

              <label class={fieldLabel} for="task-create-deadline">Deadline · Must be finished by</label>
              <input
                id="task-create-deadline"
                data-testid="task-create-deadline"
                type="datetime-local"
                class={textInput}
                value={deadline()}
                onInput={(event) => setDeadline(event.currentTarget.value)}
              />

              <label class={fieldLabel} for="task-create-recurrence">Recurrence rule (RRULE)</label>
              <input
                id="task-create-recurrence"
                data-testid="task-create-recurrence"
                class={textInput}
                placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
                value={recurrence()}
                onInput={(event) => setRecurrence(event.currentTarget.value)}
              />
            </div>
          </div>

          <Show when={formError()}><p class={errorText}>{formError()}</p></Show>

          <footer class={footer}>
            <p class={hint}>Quick Add remains available in the task view for fast capture.</p>
            <Button type="submit" class={primaryButton} disabled={saving()}>
              {saving() ? "Creating…" : "Create Task"}
            </Button>
          </footer>
        </form>
      </div>
    </Show>
  );
}

const backdrop = css`
  position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-start; justify-content: center;
  overflow-y: auto; padding: 1rem; background: rgba(0,0,0,.7); backdrop-filter: blur(8px);
`;
const dialog = css`
  margin: 1rem 0; width: min(58rem, 100%); max-height: calc(100vh - 2rem); overflow: auto;
  border: 1px solid var(--border-strong); border-radius: var(--radius-2xl); background: var(--panel);
  color: var(--text-main); box-shadow: var(--shadow-elevated);
`;
const header = css`
  display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1.25rem 1.5rem;
  border-bottom:1px solid var(--border-strong);
`;
const eyebrow = css`margin:0; font-size:.68rem; letter-spacing:.14em; text-transform:uppercase; color:var(--text-dim);`;
const titleStyle = css`margin:.2rem 0 0; font-size:1.25rem; color:var(--text-main);`;
const body = css`
  display:grid; grid-template-columns:1fr; @media (width >= 48rem) { grid-template-columns:1.05fr .95fr; }
`;
const primaryColumn = css`display:flex; flex-direction:column; gap:.55rem; padding:1.5rem;`;
const metadataColumn = css`
  display:flex; flex-direction:column; gap:.55rem; padding:1.5rem; border-top:1px solid var(--border-strong);
  @media (width >= 48rem) { border-top:0; border-left:1px solid var(--border-strong); }
`;
const fieldLabel = css`margin-top:.45rem; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const textInput = css`
  width:100%; border:1px solid var(--border-strong); border-radius:.7rem; padding:.72rem .8rem;
  background:rgba(255,255,255,.035); color:var(--text-main); color-scheme:dark; outline:none;
  &:focus { border-color:var(--accent); }
`;
const textarea = css`
  min-height:14rem; resize:vertical; border:1px solid var(--border-strong); border-radius:.7rem; padding:.8rem;
  background:rgba(255,255,255,.035); color:var(--text-main); outline:none;
  &:focus { border-color:var(--accent); }
`;
const footer = css`
  display:flex; align-items:center; justify-content:space-between; gap:1rem; padding:1rem 1.5rem;
  border-top:1px solid var(--border-strong);
`;
const hint = css`margin:0; font-size:.78rem; color:var(--text-dim);`;
const errorText = css`margin:0; padding:.75rem 1.5rem; color:var(--danger); border-top:1px solid var(--border-strong);`;
const primaryButton = css`
  border:0; border-radius:.7rem; padding:.7rem 1rem; background:var(--accent); color:#1d1108; font-weight:700;
  &:disabled { opacity:.55; cursor:not-allowed; }
`;
const secondaryButton = css`
  border:1px solid var(--border-strong); border-radius:.65rem; padding:.55rem .75rem; background:var(--panel-soft); color:var(--text-main);
`;
