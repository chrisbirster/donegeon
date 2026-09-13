import { css } from "@linaria/core";
import { Show, createEffect, createMemo, createSignal } from "solid-js";

import { organizationApi, type OrganizationSection } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";
import Picker from "../ui/Picker";

export type SectionPickerProps = {
  id: string;
  projectId: string;
  value: string;
  onChange: (sectionId: string) => void | Promise<void>;
  label?: string;
  testId?: string;
  disabled?: boolean;
};

export default function SectionPicker(props: SectionPickerProps) {
  const { toast, setError } = useHome();
  const [sections, setSections] = createSignal<OrganizationSection[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [creating, setCreating] = createSignal(false);
  const [name, setName] = createSignal("");
  const [pickerError, setPickerError] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const options = createMemo(() => [
    { value: "", label: "No section" },
    ...sections().map((section) => ({ value: section.id, label: section.name })),
  ]);

  async function load(projectId: string) {
    if (!projectId) {
      setSections([]);
      setPickerError("");
      return;
    }
    setLoading(true);
    try {
      const page = await organizationApi.sections.list(projectId);
      const items = page.items ?? [];
      setSections(items);
      setPickerError("");
      if (props.value && !items.some((section) => section.id === props.value)) {
        await props.onChange("");
      }
    } catch (err) {
      setSections([]);
      setPickerError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  createEffect(
    () => props.projectId,
    (projectId) => {
      setCreating(false);
      setName("");
      void load(projectId);
    },
  );

  async function createSection() {
    const projectId = props.projectId.trim();
    const value = name().trim();
    if (!projectId) {
      setPickerError("Choose a project before creating a section.");
      return;
    }
    if (!value) {
      setPickerError("Section name is required.");
      return;
    }
    setBusy(true);
    setPickerError("");
    try {
      const section = await organizationApi.sections.create(projectId, value);
      await load(projectId);
      await props.onChange(section.id);
      setCreating(false);
      setName("");
      setError("");
      window.dispatchEvent(new CustomEvent("donegeon:sections-changed", { detail: { projectId } }));
      toast.success(`Section ${section.name} created.`);
    } catch (err) {
      const message = (err as Error).message;
      setPickerError(message);
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
        label={props.label ?? "Section"}
        value={props.value}
        options={options()}
        onChange={props.onChange}
        description="Optional subgroup inside the selected project. Sections cannot span projects."
        testId={props.testId}
        disabled={props.disabled || !props.projectId || loading()}
        actionLabel={props.projectId ? "Create section…" : undefined}
        onAction={props.projectId ? () => {
          setPickerError("");
          setName("");
          setCreating(true);
        } : undefined}
      />
      <Show when={creating()}>
        <div class={creator}>
          <label class={creatorLabel} for={`${props.id}-new-section`}>New section name</label>
          <div class={creatorRow}>
            <input
              id={`${props.id}-new-section`}
              class={input}
              value={name()}
              autofocus
              disabled={busy()}
              onInput={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void createSection();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setCreating(false);
                }
              }}
            />
            <Button type="button" variant="primary" size="sm" disabled={busy()} onClick={() => void createSection()}>Create</Button>
            <Button type="button" size="sm" disabled={busy()} onClick={() => setCreating(false)}>Cancel</Button>
          </div>
        </div>
      </Show>
      <Show when={pickerError()}><p class={errorText} role="alert">{pickerError()}</p></Show>
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
const errorText = css`margin:.1rem 0 0; color:var(--danger); font-size:.78rem;`;
