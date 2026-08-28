import { For, Show } from "solid-js";
import type { Task } from "../../server/api";

import {
  isBoardLiveTask,
  isBoardProject,
  isTeamBoardProject,
  projectAliasFromProjectID,
  projectQuickAddAlias,
  scheduleBadgeLabel,
  scheduleValidationWarning,
  tokenClass,
  visibleTaskLabels,
} from "../../features/tasks/home-model";
import { isNextActionTask } from "../../features/tasks/home-rules";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";
import TaskQuickAddComposer from "./TaskQuickAddComposer";
import TaskViewHeader from "./TaskViewHeader";
import {
  actionButton,
  actions,
  boardDraftBadge,
  completedBlock,
  completedDescription,
  completedStatus,
  completedTaskRow,
  completedTitle,
  contentPanel,
  deadlineBadge,
  description,
  destructiveButton,
  dragHandle,
  dragHandleActive,
  dueBadge,
  emptyState,
  errorSpacing,
  iconActionButton,
  inlineEdit,
  inlineInput,
  jumpButton,
  liveBadge,
  metaBadge,
  metadata,
  openStatus,
  priority,
  priorityHigh,
  priorityNormal,
  projectBadge,
  restoreButton,
  scrollArea,
  sectionBlock,
  sectionCount,
  sectionHeader,
  sectionJump,
  sectionTitle,
  taskBody,
  taskList,
  taskRow,
  taskRowDrop,
  taskRowNextAction,
  taskTitle,
  teamBadge,
  warningBadge,
} from "./styles/HomeTaskContent.styles";

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
    projectMap,
    editingTaskId,
    editingContent,
    setEditingContent,
    dragTaskId,
    dropTargetId,
    rowActivatingTaskID,
    setMainInputRef,
    onMainInput,
    addTask,
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
  } = useHome();

  const projectToken = (item: Task) => {
    const id = item.projectId?.trim();
    if (!id) return null;
    const project = projectMap().get(id);
    return project ? projectQuickAddAlias(project) : projectAliasFromProjectID(id);
  };

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const taskMetadata = (item: Task) => {
    const project = () => projectToken(item);
    return (
      <div class={metadata}>
        <Show when={scheduleBadgeLabel(item, "due")}>
          {(label) => <span class={dueBadge}>{label()}</span>}
        </Show>
        <Show when={scheduleBadgeLabel(item, "deadline")}>
          {(label) => <span class={deadlineBadge}>{label()}</span>}
        </Show>
        <Show when={scheduleValidationWarning(item)}>
          {(warning) => <span class={warningBadge}>{warning()}</span>}
        </Show>
        <Show when={isBoardProject(item.projectId) && !isBoardLiveTask(item)}>
          <span class={boardDraftBadge}>Board draft</span>
        </Show>
        <Show when={isBoardLiveTask(item)}>
          <span class={liveBadge}>Live on board</span>
        </Show>
        <For each={visibleTaskLabels(item.labels)}>
          {(label) => <span class={metaBadge}>@{label}</span>}
        </For>
        <Show when={project()}>
          {(alias) => (
            <span class={projectBadge}>
              #{alias()}
              <Show when={isTeamBoardProject(item.projectId, projectMap())}>
                <span class={teamBadge}>Team</span>
              </Show>
            </span>
          )}
        </Show>
        <Show when={item.recurrenceRule}>
          <span class={liveBadge}>↻ recurring</span>
        </Show>
      </div>
    );
  };

  return (
    <section class={contentPanel}>
      <TaskViewHeader title={viewTitle()} count={visibleTasks().length} />

      <TaskQuickAddComposer
        content={content()}
        tokens={inputTokens()}
        tokenClass={tokenClass}
        parsedChips={parsedChips()}
        parsedGuidance={parsedGuidance()}
        onInput={onMainInput}
        onSubmit={addTask}
        inputRef={setMainInputRef}
      />

      <Show when={error()}>
        <p class={errorSpacing}>{error()}</p>
      </Show>

      <div class={scrollArea}>
        <Show when={visibleCompletedTasks().length > 0}>
          <nav class={sectionJump} aria-label="Task sections">
            <Button type="button" class={jumpButton} onClick={() => jumpTo("open-task-section")}>Open {visibleTasks().length}</Button>
            <Button type="button" class={jumpButton} onClick={() => jumpTo("completed-task-section")}>Completed {visibleCompletedTasks().length}</Button>
          </nav>
        </Show>

        <section id="open-task-section" data-testid="open-task-section" class={sectionBlock}>
          <Show when={visibleCompletedTasks().length > 0}>
            <div class={sectionHeader}>
              <h3 class={sectionTitle}>Open</h3>
              <span class={sectionCount}>{visibleTasks().length} task(s)</span>
            </div>
          </Show>

          <Show
            when={visibleTasks().length > 0}
            fallback={<p class={emptyState}>No open tasks in this view.</p>}
          >
            <ul class={taskList}>
              <For each={visibleTasks()}>
                {(item) => (
                  <li
                    data-testid="task-row"
                    data-task-id={item.id}
                    class={`${taskRow} ${dropTargetId() === item.id ? taskRowDrop : ""} ${
                      isNextActionTask(item) ? taskRowNextAction : ""
                    }`}
                    onDragOver={(event) => onDragOver(event, item.id)}
                    onDrop={(event) => onDrop(event, item.id)}
                    onClick={() => {
                      if (editingTaskId() !== item.id) openDetailModal(item);
                    }}
                  >
                    <Button
                      unstyled
                      type="button"
                      draggable="true"
                      class={`${dragHandle} ${dragTaskId() === item.id ? dragHandleActive : ""}`}
                      aria-label="Drag to reorder"
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => onDragStart(event, item.id)}
                      onDragEnd={onDragEnd}
                    >
                      ⋮⋮
                    </Button>

                    <Button
                      unstyled
                      type="button"
                      class={openStatus}
                      aria-label="Complete task"
                      onClick={(event) => {
                        event.stopPropagation();
                        void completeTask(item);
                      }}
                    />

                    <div class={taskBody}>
                      <Show
                        when={editingTaskId() === item.id}
                        fallback={
                          <>
                            <p class={taskTitle} data-testid="task-content">{item.content}</p>
                            <Show when={item.description?.trim()}>
                              <p class={description} data-testid="task-description-summary">{item.description.trim()}</p>
                            </Show>
                            {taskMetadata(item)}
                          </>
                        }
                      >
                        <div class={inlineEdit} onClick={(event) => event.stopPropagation()}>
                          <input
                            value={editingContent()}
                            onInput={(event) => setEditingContent(event.currentTarget.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void saveInlineEdit(item.id);
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                cancelInlineEdit();
                              }
                            }}
                            class={inlineInput}
                            autofocus
                          />
                          <Button type="button" class={actionButton} onClick={() => void saveInlineEdit(item.id)}>Save</Button>
                          <Button type="button" class={actionButton} onClick={cancelInlineEdit}>Cancel</Button>
                        </div>
                      </Show>
                    </div>

                    <span class={`${priority} ${item.priority <= 2 ? priorityHigh : priorityNormal}`}>p{item.priority}</span>

                    <div class={actions}>
                      <Button
                        type="button"
                        class={iconActionButton}
                        aria-label="Edit inline"
                        data-testid="edit-task-inline"
                        onClick={(event) => {
                          event.stopPropagation();
                          beginInlineEdit(item);
                        }}
                      >
                        ✎
                      </Button>
                      <Button
                        type="button"
                        class={actionButton}
                        aria-label="Task details"
                        data-testid="open-task-details"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetailModal(item);
                        }}
                      >
                        Details
                      </Button>
                      <Show when={isBoardProject(item.projectId) && !isBoardLiveTask(item)}>
                        <Button
                          type="button"
                          class={actionButton}
                          aria-label="Make live on board"
                          data-testid="make-task-live"
                          onClick={(event) => {
                            event.stopPropagation();
                            void makeRowTaskLive(item);
                          }}
                          disabled={rowActivatingTaskID() === item.id}
                        >
                          {rowActivatingTaskID() === item.id ? "Activating..." : "Make Live"}
                        </Button>
                      </Show>
                      <Button
                        type="button"
                        class={destructiveButton}
                        aria-label="Delete task"
                        data-testid="delete-task"
                        onClick={(event) => {
                          event.stopPropagation();
                          void removeTask(item);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>

        <Show when={visibleCompletedTasks().length > 0}>
          <section id="completed-task-section" data-testid="completed-task-section" class={completedBlock}>
            <div class={sectionHeader}>
              <h3 class={sectionTitle}>Completed</h3>
              <span class={sectionCount}>{visibleCompletedTasks().length} task(s)</span>
            </div>

            <ul class={taskList}>
              <For each={visibleCompletedTasks()}>
                {(item) => (
                  <li
                    data-testid="completed-task-row"
                    data-task-id={item.id}
                    class={`${completedTaskRow} ${dropTargetId() === item.id ? taskRowDrop : ""}`}
                    onDragOver={(event) => onDragOver(event, item.id)}
                    onDrop={(event) => onDrop(event, item.id)}
                    onClick={() => openDetailModal(item)}
                  >
                    <Button
                      unstyled
                      type="button"
                      draggable="true"
                      class={`${dragHandle} ${dragTaskId() === item.id ? dragHandleActive : ""}`}
                      aria-label="Drag completed task to reorder"
                      onClick={(event) => event.stopPropagation()}
                      onDragStart={(event) => onDragStart(event, item.id)}
                      onDragEnd={onDragEnd}
                    >
                      ⋮⋮
                    </Button>

                    <span class={completedStatus}>✓</span>

                    <div class={taskBody}>
                      <p class={completedTitle} data-testid="completed-task-content">{item.content}</p>
                      <Show when={item.description?.trim()}>
                        <p class={completedDescription} data-testid="completed-task-description-summary">{item.description.trim()}</p>
                      </Show>
                      {taskMetadata(item)}
                    </div>

                    <span class={`${priority} ${item.priority <= 2 ? priorityHigh : priorityNormal}`}>p{item.priority}</span>

                    <div class={actions}>
                      <Button
                        type="button"
                        class={actionButton}
                        aria-label="Task details"
                        onClick={(event) => {
                          event.stopPropagation();
                          openDetailModal(item);
                        }}
                      >
                        Details
                      </Button>
                      <Button
                        type="button"
                        class={restoreButton}
                        data-testid="reopen-task"
                        onClick={(event) => {
                          event.stopPropagation();
                          void reopenTask(item);
                        }}
                      >
                        Restore
                      </Button>
                    </div>
                  </li>
                )}
              </For>
            </ul>
          </section>
        </Show>
      </div>
    </section>
  );
}
