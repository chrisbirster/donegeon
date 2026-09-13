import { css } from "@linaria/core";
import { Show, createMemo, createSignal } from "solid-js";

import { useHome } from "../../page/HomeContext";
import Button from "../Button";
import Picker from "../ui/Picker";

export type ProjectPickerProps = {
  id: string;
  value: string;
  onChange: (projectId: string) => void | Promise<void>;
  label?: string;
  description?: string;
  testId?: string;
  disabled?: boolean;
};

export default function ProjectPicker(props: ProjectPickerProps) {
  const { api, sidebarProjects, refreshData, toast, setError } = useHome();
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [createError, setCreateError] = createSignal("");

  const options = createMemo(() => [
    { value: "", label: "Inbox / no project" },
    ...sidebarProjects()
      .filter((project) => !project.isInboxProject && !project.isArchived)
      .map((project) => ({ value: project.id, label: project.name })),
  ]);

  async function createProject() {
    const value = name().trim();
    if (!value) {
      setCreateError("Project name is required.");
      return;
    }
    setBusy(true);
    setCreateError("");
    try {
      const project = await api.projects.create({ name: value });
      await refreshData();
      await props.onChange(project.id);
      setName("");
      setCreating(false);
      setError("");
      toast.success(`Project ${project.name} created.`);
    } catch (err) {
      const message = (err as Error).message;
      setCreateError(message);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class={wrapper}>
      <Picker
        id={props.id}
        label={props.label ?? "Project"}
        value={props.value}
        options={options()}
        onChange={props.onChange}
        description={props.description}
        testId={props.testId}
        disabled={props.disabled}
        actionLabel="Create project…"
        onAction={() => {
          setCreateError("");
          setName("");
          setCreating(true);
        }}
      />
      <Show when={creating()}>
        <div class={creator}>
          <label class={creatorLabel} for={`${props.id}-new-project`}>New project name</label>
          <div class={creatorRow}>
            <input
              id={`${props.id}-new-project`}
              class={input}
              value={name()}
              autofocus
              disabled={busy()}
              onInput={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createProject();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setCreating(false);
                }
              }}
            />
            <Button type="button" variant="primary" size="sm" disabled={busy()} onClick={() => void createProject()}>Create</Button>
            <Button type="button" size="sm" disabled={busy()} onClick={() => setCreating(false)}>Cancel</Button>
          </div>
          <Show when={createError()}><p class={errorText} role="alert">{createError()}</p></Show>
        </div>
      </Show>
    </div>
  );
}

const wrapper = css`display:flex; flex-direction:column; gap:.45rem;`;
const creator = css`padding:.7rem; border:1px solid var(--border-soft); border-radius:.7rem; background:rgba(255,255,255,.018);`;
const creatorLabel = css`display:block; margin-bottom:.4rem; color:var(--text-dim); font-size:.7rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase;`;
const creatorRow = css`display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:.4rem; align-items:center;`;
const input = css`
  width:100%; min-height:2.3rem; border:1px solid var(--border-strong); border-radius:.55rem; padding:.5rem .6rem;
  background:rgba(255,255,255,.035); color:var(--text-main); outline:none;
  &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
const errorText = css`margin:.45rem 0 0; color:var(--danger); font-size:.78rem;`;
