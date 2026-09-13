import { css } from "@linaria/core";
import { For, Show, createEffect, createMemo, createSignal, onSettled } from "solid-js";

import { organizationApi, type OrganizationSection } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import type { Task } from "../../server/api";
import Button from "../Button";
import HomeTaskRow from "./HomeTaskRow";
import TaskQuickAddComposer from "./TaskQuickAddComposer";
import TaskViewHeader from "./TaskViewHeader";

export default function HomeTaskContent() {
  const {
    content,
    error,
    inputTokens,
    parsedChips,
    parsedGuidance,
    viewTitle,
    visibleTasks,
    visibleCompletedTasks,
    currentView,
    selectedProject,
    setMainInputRef,
    onMainInput,
    addTask,
  } = useHome();

  const [sections, setSections] = createSignal<OrganizationSection[]>([]);
  const [sectionLoadError, setSectionLoadError] = createSignal("");
  let loadedProjectId = "";

  const projectUsesSections = createMemo(() =>
    currentView().kind === "project" && !!selectedProject() && !selectedProject()?.isInboxProject,
  );

  async function loadSections(projectId: string) {
    if (!projectId) {
      setSections([]);
      return;
    }
    try {
      const page = await organizationApi.sections.list(projectId);
      if (selectedProject()?.id === projectId) setSections(page.items ?? []);
      setSectionLoadError("");
    } catch (err) {
      setSections([]);
      setSectionLoadError((err as Error).message);
    }
  }

  createEffect(
    () => projectUsesSections() ? selectedProject()?.id ?? "" : "",
    (projectId) => {
      if (projectId === loadedProjectId) return;
      loadedProjectId = projectId;
      if (projectId) void loadSections(projectId);
      else setSections([]);
    },
  );

  onSettled(() => {
    const changed = (event: Event) => {
      const projectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      if (projectId && projectId === selectedProject()?.id) void loadSections(projectId);
    };
    window.addEventListener("donegeon:sections-changed", changed);
    return () => window.removeEventListener("donegeon:sections-changed", changed);
  });

  const unsectionedTasks = createMemo(() => {
    const known = new Set(sections().map((section) => section.id));
    return visibleTasks().filter((task) => !task.sectionId || !known.has(task.sectionId));
  });

  const tasksForSection = (sectionId: string) => visibleTasks().filter((task) => task.sectionId === sectionId);

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const taskList = (items: Task[], groupName?: string) => (
    <Show when={items.length > 0} fallback={<p class={emptyState}>No open tasks {groupName ? `in ${groupName}` : "in this view"}.</p>}>
      <ul class={list} aria-label={groupName ? `${groupName} tasks` : "Open tasks"}>
        <For each={items}>
          {(item, index) => (
            <HomeTaskRow
              item={item}
              previousId={index() > 0 ? items[index() - 1]?.id : undefined}
              nextId={index() < items.length - 1 ? items[index() + 1]?.id : undefined}
            />
          )}
        </For>
      </ul>
    </Show>
  );

  return (
    <section class={contentPanel} aria-label={`${viewTitle()} tasks`}>
      <TaskViewHeader title={viewTitle()} count={visibleTasks().length} />

      <TaskQuickAddComposer
        content={content()}
        tokens={inputTokens()}
        parsedChips={parsedChips()}
        parsedGuidance={parsedGuidance()}
        onInput={onMainInput}
        onSubmit={addTask}
        inputRef={setMainInputRef}
      />

      <Show when={error()}><p class={errorText} role="alert">{error()}</p></Show>

      <div class={scrollArea}>
        <Show when={visibleCompletedTasks().length > 0}>
          <nav class={jumpNav} aria-label="Task status sections">
            <Button type="button" size="sm" onClick={() => jumpTo("open-task-section")}>Open {visibleTasks().length}</Button>
            <Button type="button" size="sm" onClick={() => jumpTo("completed-task-section")}>Completed {visibleCompletedTasks().length}</Button>
          </nav>
        </Show>

        <section id="open-task-section" data-testid="open-task-section" class={statusSection} aria-labelledby="open-task-heading">
          <div class={statusHeader}>
            <h3 id="open-task-heading">Open</h3>
            <span>{visibleTasks().length} task{visibleTasks().length === 1 ? "" : "s"}</span>
          </div>

          <Show when={sectionLoadError()}><p class={errorText} role="alert">{sectionLoadError()}</p></Show>

          <Show
            when={projectUsesSections()}
            fallback={taskList(visibleTasks())}
          >
            <div class={groups} data-testid="project-section-groups">
              <section class={group} aria-labelledby="unsectioned-heading" data-testid="task-section-group" data-section-name="No section">
                <div class={groupHeader}>
                  <div>
                    <h4 id="unsectioned-heading">No section</h4>
                    <p>Tasks that belong to {selectedProject()?.name} without an optional subgroup.</p>
                  </div>
                  <span>{unsectionedTasks().length}</span>
                </div>
                {taskList(unsectionedTasks(), "No section")}
              </section>

              <For each={sections()}>
                {(section) => {
                  const items = () => tasksForSection(section.id);
                  const headingId = `task-section-${section.id}`;
                  return (
                    <section class={group} aria-labelledby={headingId} data-testid="task-section-group" data-section-name={section.name}>
                      <div class={groupHeader}>
                        <div>
                          <h4 id={headingId}>{section.name}</h4>
                          <p>Section inside {selectedProject()?.name}</p>
                        </div>
                        <span>{items().length}</span>
                      </div>
                      {taskList(items(), section.name)}
                    </section>
                  );
                }}
              </For>
            </div>
          </Show>
        </section>

        <Show when={visibleCompletedTasks().length > 0}>
          <section id="completed-task-section" data-testid="completed-task-section" class={statusSection} aria-labelledby="completed-task-heading">
            <div class={statusHeader}>
              <h3 id="completed-task-heading">Completed</h3>
              <span>{visibleCompletedTasks().length} task{visibleCompletedTasks().length === 1 ? "" : "s"}</span>
            </div>
            <ul class={list} aria-label="Completed tasks">
              <For each={visibleCompletedTasks()}>{(item) => <HomeTaskRow item={item} completed />}</For>
            </ul>
          </section>
        </Show>
      </div>
    </section>
  );
}

const contentPanel = css`
  min-width:0; min-height:0; height:100%; display:flex; flex-direction:column; overflow:hidden;
  border:1px solid var(--border-strong); border-radius:var(--radius-3xl); padding:1rem;
  background:linear-gradient(180deg,var(--panel-strong-start),var(--panel-strong-end)); box-shadow:var(--shadow-elevated);
`;
const scrollArea = css`min-height:0; flex:1; overflow:auto; padding-right:.15rem;`;
const jumpNav = css`display:flex; gap:.45rem; margin-bottom:.7rem;`;
const statusSection = css`scroll-margin-top:1rem;`;
const statusHeader = css`
  display:flex; align-items:center; justify-content:space-between; gap:1rem; margin:.3rem 0 .65rem;
  h3{margin:0; color:var(--text-dim); font-size:.72rem; letter-spacing:.12em; text-transform:uppercase;}
  span{color:var(--text-dim); font-size:.75rem;}
`;
const groups = css`display:flex; flex-direction:column; gap:1rem;`;
const group = css`border:1px solid var(--border-soft); border-radius:.8rem; padding:.75rem; background:rgba(255,255,255,.012);`;
const groupHeader = css`
  display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; margin-bottom:.6rem;
  h4{margin:0; color:var(--text-main); font-size:.95rem;}
  p{margin:.12rem 0 0; color:var(--text-dim); font-size:.72rem;}
  > span{min-width:1.8rem; border-radius:999px; padding:.18rem .42rem; background:var(--panel-soft); color:var(--text-soft); font-size:.7rem; text-align:center;}
`;
const list = css`display:flex; flex-direction:column; gap:.55rem; margin:0; padding:0; list-style:none;`;
const emptyState = css`margin:0; border:1px dashed var(--border-soft); border-radius:.7rem; padding:1rem; color:var(--text-dim); font-size:.8rem;`;
const errorText = css`margin:.55rem 0; border:1px solid rgba(255,181,173,.35); border-radius:.55rem; padding:.5rem .65rem; background:var(--danger-bg); color:var(--danger); font-size:.78rem;`;
