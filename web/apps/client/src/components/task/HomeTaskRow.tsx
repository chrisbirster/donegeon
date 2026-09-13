import { css } from "@linaria/core";
import { For, Show } from "solid-js";

import {
  formatScheduleDateTime,
  isBoardLiveTask,
  isBoardProject,
  isTeamBoardProject,
  projectAliasFromProjectID,
  projectQuickAddAlias,
  scheduleValidationWarning,
  visibleTaskLabels,
} from "../../features/tasks/home-model";
import { isNextActionTask } from "../../features/tasks/home-rules";
import { useHome } from "../../page/HomeContext";
import type { Task } from "../../server/api";
import Button from "../Button";

export type HomeTaskRowProps = {
  item: Task;
  completed?: boolean;
  previousId?: string;
  nextId?: string;
};

export default function HomeTaskRow(props: HomeTaskRowProps) {
  const {
    projectMap,
    editingTaskId,
    editingContent,
    setEditingContent,
    dragTaskId,
    dropTargetId,
    rowActivatingTaskID,
    completeTask,
    reopenTask,
    removeTask,
    beginInlineEdit,
    cancelInlineEdit,
    saveInlineEdit,
    makeRowTaskLive,
    openDetailModal,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    reorderTasks,
  } = useHome();

  const projectToken = () => {
    const id = props.item.projectId?.trim();
    if (!id) return null;
    const project = projectMap().get(id);
    return project ? projectQuickAddAlias(project) : projectAliasFromProjectID(id);
  };

  const rowClass = () => [
    taskRow,
    props.completed ? completedRow : "",
    dropTargetId() === props.item.id ? dropTarget : "",
    !props.completed && isNextActionTask(props.item) ? nextAction : "",
  ].filter(Boolean).join(" ");

  const metadata = () => (
    <div class={metadataStyle} aria-label="Task metadata">
      <Show when={formatScheduleDateTime(props.item.dueText)}>
        {(value) => <span class={dueBadge}>Due {value()}</span>}
      </Show>
      <Show when={formatScheduleDateTime(props.item.dueDeadline)}>
        {(value) => <span class={deadlineBadge}>Deadline {value()}</span>}
      </Show>
      <Show when={scheduleValidationWarning(props.item)}>
        {(warning) => <span class={warningBadge}>{warning()}</span>}
      </Show>
      <Show when={isBoardProject(props.item.projectId) && !isBoardLiveTask(props.item)}>
        <span class={neutralBadge}>Board draft</span>
      </Show>
      <Show when={isBoardLiveTask(props.item)}><span class={successBadge}>Live on board</span></Show>
      <For each={visibleTaskLabels(props.item.labels)}>{(label) => <span class={labelBadge}>@{label}</span>}</For>
      <Show when={projectToken()}>
        {(alias) => (
          <span class={projectBadge}>
            #{alias()}
            <Show when={isTeamBoardProject(props.item.projectId, projectMap())}><span class={teamChip}>Team</span></Show>
          </span>
        )}
      </Show>
      <Show when={props.item.recurrenceRule}><span class={successBadge}>↻ recurring</span></Show>
    </div>
  );

  return (
    <li
      data-testid={props.completed ? "completed-task-row" : "task-row"}
      data-task-id={props.item.id}
      class={rowClass()}
      onDragOver={(event) => onDragOver(event, props.item.id)}
      onDrop={(event) => onDrop(event, props.item.id)}
      onClick={() => {
        if (props.completed || editingTaskId() !== props.item.id) openDetailModal(props.item);
      }}
    >
      <Button
        unstyled
        type="button"
        draggable="true"
        class={`${dragHandle} ${dragTaskId() === props.item.id ? dragActive : ""}`}
        aria-label={`Drag ${props.item.content} to reorder`}
        onClick={(event) => event.stopPropagation()}
        onDragStart={(event) => onDragStart(event, props.item.id)}
        onDragEnd={onDragEnd}
      >
        <span aria-hidden="true">⋮⋮</span>
      </Button>

      <Show when={!props.completed} fallback={<span class={completedStatus} aria-label="Completed">✓</span>}>
        <Button
          unstyled
          type="button"
          class={completionButton}
          aria-label={`Complete ${props.item.content}`}
          onClick={(event) => {
            event.stopPropagation();
            void completeTask(props.item);
          }}
        />
      </Show>

      <div class={taskBody}>
        <Show
          when={!props.completed && editingTaskId() === props.item.id}
          fallback={
            <>
              <p class={`${taskTitle} ${props.completed ? completedTitle : ""}`} data-testid={props.completed ? "completed-task-content" : "task-content"}>{props.item.content}</p>
              <Show when={props.item.description?.trim()}>
                <p class={description} data-testid={props.completed ? "completed-task-description-summary" : "task-description-summary"}>{props.item.description.trim()}</p>
              </Show>
              {metadata()}
            </>
          }
        >
          <div class={inlineEdit} onClick={(event) => event.stopPropagation()}>
            <input
              value={editingContent()}
              aria-label="Edit task title"
              onInput={(event) => setEditingContent(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveInlineEdit(props.item.id);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  cancelInlineEdit();
                }
              }}
              class={inlineInput}
              autofocus
            />
            <Button type="button" size="sm" onClick={() => void saveInlineEdit(props.item.id)}>Save</Button>
            <Button type="button" size="sm" onClick={cancelInlineEdit}>Cancel</Button>
          </div>
        </Show>
      </div>

      <span class={`${priority} ${props.item.priority <= 2 ? priorityHigh : priorityNormal}`} aria-label={`Priority ${props.item.priority}`}>p{props.item.priority}</span>

      <div class={actions} onClick={(event) => event.stopPropagation()}>
        <Show when={!props.completed}>
          <Button
            type="button"
            iconOnly
            size="sm"
            aria-label={`Move ${props.item.content} up`}
            disabled={!props.previousId}
            onClick={() => props.previousId && reorderTasks(props.item.id, props.previousId)}
          >
            <span aria-hidden="true">↑</span>
          </Button>
          <Button
            type="button"
            iconOnly
            size="sm"
            aria-label={`Move ${props.item.content} down`}
            disabled={!props.nextId}
            onClick={() => props.nextId && reorderTasks(props.item.id, props.nextId)}
          >
            <span aria-hidden="true">↓</span>
          </Button>
          <Button
            type="button"
            iconOnly
            size="sm"
            aria-label={`Edit ${props.item.content} inline`}
            data-testid="edit-task-inline"
            onClick={() => beginInlineEdit(props.item)}
          >
            <span aria-hidden="true">✎</span>
          </Button>
        </Show>
        <Button
          type="button"
          size="sm"
          aria-label={`Task details for ${props.item.content}`}
          data-testid="open-task-details"
          onClick={() => openDetailModal(props.item)}
        >
          Details
        </Button>
        <Show when={!props.completed && isBoardProject(props.item.projectId) && !isBoardLiveTask(props.item)}>
          <Button
            type="button"
            size="sm"
            aria-label={`Make ${props.item.content} live on board`}
            data-testid="make-task-live"
            onClick={() => void makeRowTaskLive(props.item)}
            disabled={rowActivatingTaskID() === props.item.id}
          >
            {rowActivatingTaskID() === props.item.id ? "Activating…" : "Make Live"}
          </Button>
        </Show>
        <Show
          when={!props.completed}
          fallback={<Button type="button" size="sm" onClick={() => void reopenTask(props.item)} data-testid="reopen-task">Restore</Button>}
        >
          <Button type="button" size="sm" variant="danger" aria-label={`Delete ${props.item.content}`} data-testid="delete-task" onClick={() => void removeTask(props.item)}>Delete</Button>
        </Show>
      </div>
    </li>
  );
}

const taskRow = css`
  display:grid;
  grid-template-columns:auto auto minmax(0,1fr) auto auto;
  gap:.7rem;
  align-items:center;
  border:1px solid rgba(119,155,187,.18);
  border-radius:.75rem;
  padding:.7rem .75rem;
  background:var(--panel-soft);
  transition:border-color 150ms ease, background 150ms ease;
  &:hover{border-color:rgba(119,155,187,.34);}
  &:focus-within{border-color:var(--border-hover);}
  @media (max-width:60rem){
    grid-template-columns:auto auto minmax(0,1fr) auto;
    > :last-child{grid-column:1 / -1; justify-content:flex-end;}
  }
  @media (prefers-reduced-motion: reduce){transition:none;}
`;
const completedRow = css`opacity:.78;`;
const dropTarget = css`border-color:var(--accent); background:rgba(255,139,80,.08);`;
const nextAction = css`border-color:rgba(255,139,80,.28); background:rgba(255,139,80,.06);`;
const dragHandle = css`border:0; background:transparent; color:var(--text-muted); cursor:grab; padding:.25rem; &:focus-visible{outline:2px solid #00e0ff; outline-offset:2px;}`;
const dragActive = css`color:var(--accent-text); cursor:grabbing;`;
const completionButton = css`width:1.25rem; height:1.25rem; border:2px solid var(--accent); border-radius:50%; background:transparent; &:focus-visible{outline:2px solid #00e0ff; outline-offset:2px;}`;
const completedStatus = css`display:flex; align-items:center; justify-content:center; width:1.25rem; height:1.25rem; color:var(--success);`;
const taskBody = css`min-width:0;`;
const taskTitle = css`margin:0; color:var(--text-main); font-weight:650; overflow-wrap:anywhere;`;
const completedTitle = css`text-decoration:line-through; color:var(--text-muted);`;
const description = css`margin:.2rem 0 0; color:var(--text-dim); font-size:.78rem; line-height:1.35;`;
const metadataStyle = css`display:flex; flex-wrap:wrap; gap:.35rem; margin-top:.4rem;`;
const dueBadge = css`border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(110,78,21,.34); color:#ffd4a1;`;
const deadlineBadge = css`border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(74,78,156,.35); color:#ddd9ff;`;
const warningBadge = css`border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(129,61,28,.35); color:#ffd4b5;`;
const neutralBadge = css`border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(97,76,132,.26); color:#d9c6ff;`;
const successBadge = css`border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(24,88,57,.33); color:#c7f6d4;`;
const labelBadge = css`border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(84,95,168,.22); color:#e0d8ff;`;
const projectBadge = css`display:inline-flex; align-items:center; gap:.3rem; border-radius:.42rem; padding:.18rem .42rem; font-size:.7rem; line-height:1.2; background:rgba(120,37,34,.26); color:#ffd4cf;`;
const teamChip = css`font-size:.58rem; text-transform:uppercase; color:#d8e1ff;`;
const priority = css`border-radius:.45rem; padding:.25rem .45rem; font-size:.72rem; font-weight:700; text-transform:lowercase;`;
const priorityHigh = css`background:rgba(154,52,18,.35); color:#ffd7b7;`;
const priorityNormal = css`background:rgba(255,255,255,.05); color:var(--text-dim);`;
const actions = css`display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; gap:.35rem;`;
const inlineEdit = css`display:flex; align-items:center; gap:.4rem;`;
const inlineInput = css`
  min-width:0; flex:1; border:1px solid var(--border-strong); border-radius:.55rem; padding:.5rem .6rem; background:rgba(255,255,255,.035); color:var(--text-main); outline:none;
  &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}
`;
