import { css } from "@linaria/core";
import { For, Show, createMemo, createSignal, onSettled } from "solid-js";

import {
  fromDatetimeLocalValue,
  projectQuickAddAlias,
  toDatetimeLocalValue,
  tokenizeQuickAdd,
} from "../../features/tasks/home-model";
import { createFullTask } from "../../lib/organizationApi";
import { parseQuickAddLocally } from "../../lib/localQuickAddParser";
import { shouldPreviewQuickAdd } from "../../lib/quickAddPreview";
import { useHome } from "../../page/HomeContext";
import type { QuickAddParsed } from "../../server/api";
import Button from "../Button";
import Dialog, { dialogEyebrow, dialogHeader, dialogTitle } from "../ui/Dialog";
import Picker from "../ui/Picker";
import LabelPicker from "./LabelPicker";
import ProjectPicker from "./ProjectPicker";
import QuickAddTokenInput from "./QuickAddTokenInput";
import SectionPicker from "./SectionPicker";

const OPEN_EVENT = "donegeon:open-task-create";

export default function HomeTaskCreateModal() {
  const { api, sidebarProjects, refreshData, toast, setError } = useHome();
  const [open, setOpen] = createSignal(false);
  const [title, setTitle] = createSignal("");
  const [description, setDescription] = createSignal("");
  const [projectId, setProjectId] = createSignal("");
  const [sectionId, setSectionId] = createSignal("");
  const [labels, setLabels] = createSignal<string[]>([]);
  const [priority, setPriority] = createSignal(4);
  const [due, setDue] = createSignal("");
  const [deadline, setDeadline] = createSignal("");
  const [recurrence, setRecurrence] = createSignal("");
  const [parsedPreview, setParsedPreview] = createSignal<QuickAddParsed | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [formError, setFormError] = createSignal("");
  let parseSequence = 0;

  const parsedChips = createMemo(() => {
    const parsed = parsedPreview();
    if (!parsed) return [] as string[];
    const chips: string[] = [];
    if (parsed.project) chips.push(`Project: ${parsed.project}`);
    for (const label of parsed.labels ?? []) chips.push(`Label: ${label}`);
    if (parsed.assignee) chips.push(`Assignee: ${parsed.assignee}`);
    if (parsed.priority) chips.push(`Priority: p${parsed.priority}`);
    if (parsed.dueText) chips.push(`Due: ${parsed.dueText}`);
    if (parsed.deadline) chips.push(`Deadline: ${parsed.deadline}`);
    if (parsed.recurrenceRule) chips.push(`Recurrence: ${parsed.recurrenceRule}`);
    if (parsed.description) chips.push("Description detected");
    return chips;
  });

  function reset() {
    parseSequence += 1;
    setTitle("");
    setDescription("");
    setProjectId("");
    setSectionId("");
    setLabels([]);
    setPriority(4);
    setDue("");
    setDeadline("");
    setRecurrence("");
    setParsedPreview(null);
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

  function resolveProject(ref: string) {
    const normalized = ref.trim().toLowerCase();
    return sidebarProjects().find((project) =>
      project.id.toLowerCase() === normalized ||
      project.name.trim().toLowerCase() === normalized ||
      (projectQuickAddAlias(project) ?? "").toLowerCase() === normalized,
    );
  }

  function applyPreview(parsed: QuickAddParsed) {
    setParsedPreview(parsed);
    if (parsed.description) setDescription(parsed.description);
    if (parsed.labels?.length) setLabels(parsed.labels);
    if (parsed.priority) setPriority(parsed.priority);
    if (parsed.recurrenceRule) setRecurrence(parsed.recurrenceRule);
    if (parsed.project) {
      const project = resolveProject(parsed.project);
      if (project) {
        setProjectId(project.id);
        setSectionId("");
      }
    }
  }

  async function onTitleInput(value: string) {
    setTitle(value);
    const trimmed = value.trim();
    const sequence = ++parseSequence;
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      setParsedPreview(null);
      return;
    }

    const local = parseQuickAddLocally(trimmed);
    applyPreview(local);

    try {
      const response = await api.parse.quickAdd(trimmed);
      if (sequence !== parseSequence) return;
      const parsed = response.parsed;
      applyPreview(parsed);
      if (parsed.dueText) setDue(toDatetimeLocalValue(parsed.dueText));
      if (parsed.deadline) setDeadline(toDatetimeLocalValue(parsed.deadline));
    } catch {
      // Local preview remains useful while the authoritative parser is unavailable.
    }
  }

  async function changeProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    setSectionId("");
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    const preview = parsedPreview();
    const content = (preview?.content || title()).trim();
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
        labels: labels(),
        dueText: due() ? fromDatetimeLocalValue(due()) : undefined,
        dueDeadline: deadline() ? fromDatetimeLocalValue(deadline()) : undefined,
        recurrenceRule: recurrence().trim() || undefined,
        scheduleInput: preview && (preview.dueText || preview.deadline || preview.recurrenceRule) ? title().trim() : undefined,
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
      <Dialog ariaLabel="Create task" onClose={close} class={dialog} testId="task-create-modal">
        <form onSubmit={submit}>
          <header class={dialogHeader}>
            <div>
              <p class={dialogEyebrow}>New Task</p>
              <h2 class={dialogTitle}>Create task</h2>
            </div>
            <Button type="button" onClick={close}>Close</Button>
          </header>

          <div class={body}>
            <div class={primaryColumn}>
              <label class={fieldLabel} for="task-create-title">Title</label>
              <QuickAddTokenInput
                id="task-create-title"
                value={title()}
                tokens={tokenizeQuickAdd(title())}
                onInput={(value) => void onTitleInput(value)}
                ariaLabel="Task title"
                placeholder="Task title or Quick Add syntax"
                testId="task-create-title"
                autofocus
              />

              <Show when={parsedChips().length > 0}>
                <div class={parsedChipsStyle} aria-live="polite">
                  <For each={parsedChips()}>{(chip) => <span class={parsedChip}>{chip}</span>}</For>
                </div>
              </Show>

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
              <ProjectPicker
                id="task-create-project"
                value={projectId()}
                onChange={changeProject}
                testId="task-create-project"
              />

              <SectionPicker
                id="task-create-section"
                projectId={projectId()}
                value={sectionId()}
                onChange={setSectionId}
                testId="task-create-section"
              />

              <LabelPicker
                id="task-create-labels"
                value={labels()}
                onChange={setLabels}
                label="Labels"
                testId="task-create-tags"
              />

              <Picker
                id="task-create-priority"
                label="Priority"
                value={String(priority())}
                options={[
                  { value: "1", label: "P1" },
                  { value: "2", label: "P2" },
                  { value: "3", label: "P3" },
                  { value: "4", label: "P4" },
                ]}
                onChange={(value) => setPriority(Number(value))}
                testId="task-create-priority"
              />

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

          <Show when={formError()}><p class={errorText} role="alert">{formError()}</p></Show>

          <footer class={footer}>
            <Button type="submit" variant="primary" disabled={saving()}>
              {saving() ? "Creating…" : "Create Task"}
            </Button>
          </footer>
        </form>
      </Dialog>
    </Show>
  );
}

const dialog = css`width:min(58rem,100%);`;
const body = css`
  display:grid; grid-template-columns:1fr;
  @media (width >= 48rem){grid-template-columns:1.05fr .95fr;}
`;
const primaryColumn = css`display:flex; flex-direction:column; gap:.55rem; padding:1.5rem;`;
const metadataColumn = css`
  display:flex; flex-direction:column; gap:.8rem; padding:1.5rem; border-top:1px solid var(--border-strong);
  @media (width >= 48rem){border-top:0; border-left:1px solid var(--border-strong);}
`;
const fieldLabel = css`margin-top:.45rem; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const textInput = css`
  width:100%; border:1px solid var(--border-strong); border-radius:.7rem; padding:.72rem .8rem;
  background:rgba(255,255,255,.035); color:var(--text-main); color-scheme:dark; outline:none;
  &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
const textarea = css`
  min-height:14rem; resize:vertical; border:1px solid var(--border-strong); border-radius:.7rem; padding:.8rem;
  background:rgba(255,255,255,.035); color:var(--text-main); outline:none;
  &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
const parsedChipsStyle = css`display:flex; flex-wrap:wrap; gap:.4rem;`;
const parsedChip = css`border:1px solid var(--border-soft); border-radius:.5rem; padding:.25rem .45rem; background:var(--panel-soft); color:var(--text-soft); font-size:.72rem;`;
const footer = css`display:flex; justify-content:flex-end; gap:1rem; padding:1rem 1.5rem; border-top:1px solid var(--border-strong);`;
const errorText = css`margin:0; padding:.75rem 1.5rem; color:var(--danger); border-top:1px solid var(--border-strong);`;
