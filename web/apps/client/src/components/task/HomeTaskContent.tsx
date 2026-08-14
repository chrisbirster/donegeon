import { For, Show } from "solid-js";
import AppShell from "../AppShell";
import SidebarAccountCard from "../SidebarAccountCard";
import TaskQuickAddComposer from "./TaskQuickAddComposer";
import TaskViewHeader from "./TaskViewHeader";
import HomeMobileSidebar from "./HomeMobileSidebar";

import {
  TokenKind,
  TokenPiece,
  TaskActivationCoinRequirement,
  TaskActivationModifierRequirement,
  TaskActivationPreview,
  QUICK_ADD_TOKEN_PATTERN,
  RECURRENCE_TOKEN_PATTERN,
  classifyToken,
  tokenizeQuickAdd,
  tokenClass,
  sidebarCardClass,
  sidebarItemBaseClass,
  sidebarItemActiveClass,
  sidebarItemIdleClass,
  searchButtonClass,
  panelActionButtonClass,
  smallActionButtonClass,
  listActionButtonClass,
  successActionButtonClass,
  dangerActionButtonClass,
  formFieldClass,
  iconMutedClass,
  iconActiveClass,
  teamBadgeClass,
  dueBadgeClass,
  deadlineBadgeClass,
  warningBadgeClass,
  boardDraftBadgeClass,
  boardLiveBadgeClass,
  tagBadgeClass,
  emptyStateClass,
  errorBannerClass,
  warningBannerClass,
  successBannerClass,
  taskRowBaseClass,
  taskRowDropClass,
  taskRowNextActionClass,
  taskRowDefaultClass,
  completedTaskRowClass,
  dateTimeFormatter,
  formatScheduleDateTime,
  scheduleTokenFromInput,
  scheduleBadgeLabel,
  parseScheduleInstant,
  scheduleValidationWarning,
  formatLabelsInput,
  parseLabelsInput,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
  slugifyProjectID,
  addChip,
  sortTasks,
  sortCompletedTasks,
  prettifyLabel,
  normalizeLabelToken,
  isBoardLiveLabel,
  isBoardLiveTask,
  projectSlug,
  isBoardProject,
  isTeamBoardProject,
  boardIDForProject,
  projectQuickAddAlias,
  hasExplicitProjectToken,
  projectAliasFromProjectID,
  visibleTaskLabels,
  formatModifierRequirementName,
  toNumber,
  toString,
} from "../../features/tasks/home-model";
import {
  parseTaskActivationPreview,
  isNextActionLabel,
  isNextActionTask,
  TaskView,
  ViewState,
  parseTaskView,
  startOfLocalDay,
  shiftDays,
  parseTaskDateValue,
  taskDueDate,
  DEFAULT_SIDEBAR_PROJECTS,
} from "../../features/tasks/home-rules";import { useHome } from "../../page/HomeContext";

export default function HomeTaskContent() {
  const {
    api,
    toast,
    location,
    navigate,
    tasks,
    setTasks,
    projects,
    setProjects,
    content,
    setContent,
    parsedInput,
    setParsedInput,
    error,
    setError,
    isSearchOpen,
    setIsSearchOpen,
    searchText,
    setSearchText,
    dragTaskId,
    setDragTaskId,
    dropTargetId,
    setDropTargetId,
    editingTaskId,
    setEditingTaskId,
    editingContent,
    setEditingContent,
    detailTaskId,
    setDetailTaskId,
    isDetailOpen,
    setIsDetailOpen,
    detailContent,
    setDetailContent,
    detailDescription,
    setDetailDescription,
    detailPriority,
    setDetailPriority,
    detailDueText,
    setDetailDueText,
    detailDeadline,
    setDetailDeadline,
    detailProjectId,
    setDetailProjectId,
    detailTags,
    setDetailTags,
    detailScheduleOriginal,
    setDetailScheduleOriginal,
    detailRecurrence,
    setDetailRecurrence,
    detailRecurrenceCanonical,
    setDetailRecurrenceCanonical,
    detailRecurrenceError,
    setDetailRecurrenceError,
    detailActivationPreview,
    setDetailActivationPreview,
    detailActivationLoading,
    setDetailActivationLoading,
    detailActivationError,
    setDetailActivationError,
    detailActivating,
    setDetailActivating,
    rowActivatingTaskID,
    setRowActivatingTaskID,
    detailNewProjectName,
    setDetailNewProjectName,
    detailProjectAssigning,
    setDetailProjectAssigning,
    tasksQuery,
    projectsQuery,
    mainInputRef,
    setMainInputRef,
    parseTimer,
    parseController,
    parseRequestSeq,
    searchInputRef,
    setSearchInputRef,
    globalKeyHandler,
    lastParsedText,
    inputTokens,
    currentView,
    mergedProjects,
    projectMap,
    openTasks,
    completedTasks,
    openTaskCountByProjectID,
    isInboxTask,
    inboxCount,
    todayCount,
    upcomingCount,
    favoriteProjects,
    sidebarProjects,
    selectedProject,
    viewTitle,
    filterTasksForCurrentView,
    visibleTasks,
    visibleCompletedTasks,
    detailTask,
    detailTaskIsBoardProject,
    detailDueInputToken,
    detailDeadlineInputToken,
    detailDueStoredValue,
    detailDeadlineStoredValue,
    detailScheduleWarning,
    parsedChips,
    parsedGuidance,
    searchResults,
    projectNameByID,
    sidebarProjectCount,
    refreshData,
    persistOrder,
    reorderTasks,
    focusComposer,
    navigateToView,
    navigateToProject,
    openSearchModal,
    closeSearchModal,
    toggleProjectFavorite,
    isViewActive,
    isProjectActive,
    parseMainInput,
    onMainInput,
    parseTaskTitleInput,
    hasParsedSchedule,
    addTask,
    completeTask,
    reopenTask,
    removeTask,
    beginInlineEdit,
    cancelInlineEdit,
    saveInlineEdit,
    loadDetailActivationPreview,
    makeDetailTaskLive,
    makeRowTaskLive,
    openDetailModal,
    closeDetailModal,
    projectByRef,
    nextProjectID,
    resolveProjectIDForDetail,
    createAndAssignDetailProject,
    saveDetailModal,
    parseDetailRecurrence,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = useHome();
  return (
          <section class="app-panel-strong flex h-full min-h-0 flex-col rounded-3xl p-6 md:p-8">
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
            <p class={`mb-4 ${errorBannerClass}`}>{error()}</p>
          </Show>

          <div class="min-h-0 flex-1 overflow-y-auto pr-1">
            <Show
              when={visibleTasks().length > 0}
              fallback={<p class={emptyStateClass}>No open tasks in this view.</p>}
            >
              <ul class="space-y-2">
                <For each={visibleTasks()}>
                  {(item) => (
                    <li
                      data-testid="task-row"
                      data-task-id={item.id}
                      class={`${taskRowBaseClass} ${
                        dropTargetId() === item.id
                          ? taskRowDropClass
                          : isNextActionTask(item)
                            ? taskRowNextActionClass
                            : taskRowDefaultClass
                      }`}
                      onDragOver={(event) => onDragOver(event, item.id)}
                      onDrop={(event) => onDrop(event, item.id)}
                      onClick={() => {
                        if (editingTaskId() === item.id) return;
                        openDetailModal(item);
                      }}
                    >
                      <button
                        type="button"
                        draggable="true"
                        class={`cursor-grab select-none rounded px-1 text-[var(--text-muted)] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-white ${
                          dragTaskId() === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        }`}
                        aria-label="Drag to reorder"
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={(event) => onDragStart(event, item.id)}
                        onDragEnd={onDragEnd}
                      >
                        ::
                      </button>

                      <button
                        type="button"
                        class="h-5 w-5 rounded-full border border-[var(--border-strong)] bg-transparent transition hover:border-[var(--accent)]"
                        aria-label="Complete task"
                        onClick={(event) => {
                          event.stopPropagation();
                          void completeTask(item);
                        }}
                      />

                      <div class="min-w-0 flex-1">
                        <Show
                          when={editingTaskId() === item.id}
                          fallback={
                            <>
                              <p class="truncate text-sm text-[var(--text-main)]" data-testid="task-content">
                                {item.content}
                              </p>
                              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                                <Show when={scheduleBadgeLabel(item, "due")}>
                                  {(label) => <span class={dueBadgeClass}>{label()}</span>}
                                </Show>
                                <Show when={scheduleBadgeLabel(item, "deadline")}>
                                  {(label) => <span class={deadlineBadgeClass}>{label()}</span>}
                                </Show>
                              <Show when={scheduleValidationWarning(item)}>
                                {(warning) => <span class={warningBadgeClass}>{warning()}</span>}
                              </Show>
                              <Show when={isBoardProject(item.projectId) && !isBoardLiveTask(item)}>
                                <span class={boardDraftBadgeClass}>Board draft</span>
                              </Show>
                              <Show when={isBoardLiveTask(item)}>
                                <span class={boardLiveBadgeClass}>Live on board</span>
                              </Show>
                              <For each={visibleTaskLabels(item.labels)}>
                                {(label) => <span class={tagBadgeClass}>@{label}</span>}
                              </For>
                                <Show when={projectNameByID(item.projectId)}>
                                  {(projectName) => (
                                    <span class={`inline-flex items-center gap-1 ${tagBadgeClass}`}>
                                      <span>#{projectName()}</span>
                                      <Show when={isTeamBoardProject(item.projectId, projectMap())}>
                                        <span class={teamBadgeClass}>Team</span>
                                      </Show>
                                    </span>
                                  )}
                                </Show>
                                <Show when={item.recurrenceRule}>
                                  <span class={boardLiveBadgeClass}>↻ recurring</span>
                                </Show>
                              </div>
                            </>
                          }
                        >
                          <div class="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                            <input
                              value={editingContent()}
                              onInput={(event) => setEditingContent(event.currentTarget.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void saveInlineEdit(item.id);
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  cancelInlineEdit();
                                }
                              }}
                              class="w-full rounded-lg border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] px-2 py-1 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                              autofocus
                            />
                            <button
                              type="button"
                              class="app-button-primary rounded-md px-2 py-1 text-xs"
                              onClick={() => void saveInlineEdit(item.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              class="app-button-secondary rounded-md px-2 py-1 text-xs text-[var(--text-soft)]"
                              onClick={cancelInlineEdit}
                            >
                              Cancel
                            </button>
                          </div>
                        </Show>
                      </div>

                      <span
                        class={`rounded-md px-2 py-1 text-xs ${
                          item.priority <= 2
                            ? "bg-[rgba(255,139,80,0.18)] text-[#ffd7b7]"
                            : "bg-[rgba(103,187,255,0.12)] text-[#cfe3ff]"
                        }`}
                      >
                        p{item.priority}
                      </span>

                      <div class="ml-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          class={listActionButtonClass}
                          aria-label="Edit inline"
                          data-testid="edit-task-inline"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginInlineEdit(item);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          class={listActionButtonClass}
                          aria-label="Open details"
                          data-testid="open-task-details"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetailModal(item);
                          }}
                          >
                          Open
                        </button>
                        <Show when={isBoardProject(item.projectId) && !isBoardLiveTask(item)}>
                          <button
                            type="button"
                            class={successActionButtonClass}
                            aria-label="Make live on board"
                            data-testid="make-task-live"
                            onClick={(event) => {
                              event.stopPropagation();
                              void makeRowTaskLive(item);
                            }}
                            disabled={rowActivatingTaskID() === item.id}
                          >
                            {rowActivatingTaskID() === item.id ? "Activating..." : "Make Live"}
                          </button>
                        </Show>
                        <button
                          type="button"
                          class={dangerActionButtonClass}
                          aria-label="Delete task"
                          data-testid="delete-task"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeTask(item);
                          }}
                        >
                          Del
                        </button>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Show>

            <Show when={visibleCompletedTasks().length > 0}>
              <div class={visibleTasks().length > 0 ? "mt-6" : "mt-4"} data-testid="completed-task-section">
                <div class="mb-3 flex items-center justify-between">
                  <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Completed</p>
                  <span class="text-xs text-[var(--text-dim)]">{visibleCompletedTasks().length} task(s)</span>
                </div>

                <ul class="space-y-2">
                  <For each={visibleCompletedTasks()}>
                    {(item) => (
                      <li
                        data-testid="completed-task-row"
                        data-task-id={item.id}
                        class={completedTaskRowClass}
                        onClick={() => {
                          if (editingTaskId() === item.id) return;
                          openDetailModal(item);
                        }}
                      >
                        <span class="flex h-5 w-5 items-center justify-center rounded-full border border-[rgba(49,122,86,0.42)] bg-[var(--success-bg)] text-[11px] text-[var(--success)]">
                          ✓
                        </span>

                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm text-[var(--text-soft)] line-through" data-testid="completed-task-content">
                            {item.content}
                          </p>
                          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                            <span class={boardLiveBadgeClass}>Done</span>
                            <Show when={scheduleBadgeLabel(item, "due")}>
                              {(label) => <span class={dueBadgeClass}>{label()}</span>}
                            </Show>
                            <Show when={scheduleBadgeLabel(item, "deadline")}>
                              {(label) => <span class={deadlineBadgeClass}>{label()}</span>}
                            </Show>
                            <Show when={projectNameByID(item.projectId)}>
                              {(projectName) => (
                                <span class={`inline-flex items-center gap-1 ${tagBadgeClass}`}>
                                  <span>#{projectName()}</span>
                                  <Show when={isTeamBoardProject(item.projectId, projectMap())}>
                                    <span class={teamBadgeClass}>Team</span>
                                  </Show>
                                </span>
                              )}
                            </Show>
                            <For each={visibleTaskLabels(item.labels)}>
                              {(label) => <span class={tagBadgeClass}>@{label}</span>}
                            </For>
                          </div>
                        </div>

                        <span
                          class={`rounded-md px-2 py-1 text-xs ${
                            item.priority <= 2
                              ? "bg-[rgba(255,139,80,0.18)] text-[#ffd7b7]"
                              : "bg-[rgba(103,187,255,0.12)] text-[#cfe3ff]"
                          }`}
                        >
                          p{item.priority}
                        </span>

                        <div class="ml-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            class={successActionButtonClass}
                            data-testid="reopen-task"
                            onClick={(event) => {
                              event.stopPropagation();
                              void reopenTask(item);
                            }}
                          >
                            Reopen
                          </button>
                          <button
                            type="button"
                            class={listActionButtonClass}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetailModal(item);
                            }}
                          >
                            Open
                          </button>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
            </Show>
          </div>
        </section>
  );
}
