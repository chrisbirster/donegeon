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

export default function HomeTaskDetailModal() {
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
        <Show when={isDetailOpen() && detailTask()}>
        <div
          class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-3 backdrop-blur-sm md:p-4"
          onClick={closeDetailModal}
        >
          <div
            class="app-panel my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-[52rem] flex-col overflow-hidden rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.55)] md:my-4 md:max-h-[calc(100vh-2rem)]"
            onClick={(event) => event.stopPropagation()}
            data-testid="task-detail-modal"
          >
            <div class="flex items-center justify-between border-b border-[var(--border-strong)] px-6 py-4">
              <p class="text-sm uppercase tracking-wider text-[var(--text-dim)]">Task Detail</p>
              <button
                type="button"
                class="app-button-secondary rounded-md px-3 py-1 text-sm"
                onClick={closeDetailModal}
              >
                Close
              </button>
            </div>

            <div class="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1.15fr_0.85fr]">
              <div class="space-y-4 overflow-y-auto p-6">
                <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Task</label>
                <input
                  value={detailContent()}
                  onInput={(event) => setDetailContent(event.currentTarget.value)}
                  class="w-full rounded-lg border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-lg text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  data-testid="task-detail-title"
                />

                <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Description</label>
                <textarea
                  value={detailDescription()}
                  onInput={(event) => setDetailDescription(event.currentTarget.value)}
                  class="h-40 w-full resize-none rounded-lg border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
                  data-testid="task-detail-description"
                />
              </div>

              <div class="overflow-y-auto border-t border-[var(--border-strong)] p-6 md:border-l md:border-t-0">
                <div class="space-y-4">
                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Project</label>
                  <Show
                    when={detailNewProjectName() === null}
                    fallback={
                      <div class="flex items-center gap-2">
                        <input
                          value={detailNewProjectName() ?? ""}
                          onInput={(event) => setDetailNewProjectName(event.currentTarget.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void createAndAssignDetailProject(detailNewProjectName() ?? "");
                            } else if (event.key === "Escape") {
                              setDetailNewProjectName(null);
                            }
                          }}
                          placeholder="New project name"
                          autofocus
                          disabled={detailProjectAssigning()}
                          class={formFieldClass}
                          data-testid="task-detail-new-project"
                        />
                        <button
                          type="button"
                          class="app-button-secondary shrink-0 rounded-lg px-2 py-2 text-xs"
                          onClick={() => void createAndAssignDetailProject(detailNewProjectName() ?? "")}
                          disabled={detailProjectAssigning()}
                        >
                          {detailProjectAssigning() ? "..." : "✓"}
                        </button>
                        <button
                          type="button"
                          class="app-button-secondary shrink-0 rounded-lg px-2 py-2 text-xs"
                          disabled={detailProjectAssigning()}
                          onClick={() => setDetailNewProjectName(null)}
                        >
                          ✕
                        </button>
                      </div>
                    }
                  >
                    <select
                      value={detailProjectId()}
                      onInput={(event) => {
                        const value = event.currentTarget.value;
                        if (value === "__create_new__") {
                          setDetailNewProjectName("");
                          // Reset select to current value so it doesn't stay on the sentinel option.
                          event.currentTarget.value = detailProjectId();
                          return;
                        }
                        setDetailProjectId(value);
                      }}
                      class={formFieldClass}
                      data-testid="task-detail-project"
                    >
                      <For each={sidebarProjects()}>
                        {(project) => (
                          <option value={project.name} selected={detailProjectId() === project.name || detailProjectId() === project.id}>
                            {project.name}{project.isInboxProject ? " (inbox)" : ""}
                          </option>
                        )}
                      </For>
                      <option value="__create_new__">+ Create new project…</option>
                    </select>
                  </Show>
                  <Show when={isTeamBoardProject(detailTask()?.projectId, projectMap())}>
                    <p class={`inline-flex ${teamBadgeClass}`}>
                      Team board project
                    </p>
                  </Show>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Tags</label>
                  <input
                    value={detailTags()}
                    onInput={(event) => setDetailTags(event.currentTarget.value)}
                    placeholder="@chore @home"
                    class={formFieldClass}
                    data-testid="task-detail-tags"
                  />
                  <p class="text-xs text-[var(--text-dim)]">
                    Use tags like <code>@chore @home</code>.
                  </p>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Priority</label>
                  <select
                    value={detailPriority()}
                    onInput={(event) => setDetailPriority(Number(event.currentTarget.value))}
                    class={formFieldClass}
                    data-testid="task-detail-priority"
                  >
                    <option value={1}>P1</option>
                    <option value={2}>P2</option>
                    <option value={3}>P3</option>
                    <option value={4}>P4</option>
                  </select>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Due</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalValue(detailDueText())}
                      onInput={(event) => setDetailDueText(fromDatetimeLocalValue(event.currentTarget.value))}
                      class={`${formFieldClass} [color-scheme:dark]`}
                      data-testid="task-detail-due"
                    />
                    <Show when={detailDueText()}>
                      <button
                        type="button"
                        class="app-button-secondary shrink-0 rounded-lg px-2 py-2 text-xs"
                        onClick={() => setDetailDueText("")}
                        title="Clear due date"
                      >
                        ✕
                      </button>
                    </Show>
                  </div>
                  <Show when={detailDueInputToken()}>
                    <p class="text-xs text-[var(--text-muted)]">Original token: {detailDueInputToken()}</p>
                  </Show>
                  <Show when={detailDueStoredValue()}>
                    <p class="text-xs text-[var(--text-soft)]">Stored: {detailDueStoredValue()}</p>
                  </Show>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Deadline</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalValue(detailDeadline())}
                      onInput={(event) => setDetailDeadline(fromDatetimeLocalValue(event.currentTarget.value))}
                      class={`${formFieldClass} [color-scheme:dark]`}
                      data-testid="task-detail-deadline"
                    />
                    <Show when={detailDeadline()}>
                      <button
                        type="button"
                        class="app-button-secondary shrink-0 rounded-lg px-2 py-2 text-xs"
                        onClick={() => setDetailDeadline("")}
                        title="Clear deadline"
                      >
                        ✕
                      </button>
                    </Show>
                  </div>
                  <Show when={detailDeadlineInputToken()}>
                    <p class="text-xs text-[var(--text-muted)]">Original token: {detailDeadlineInputToken()}</p>
                  </Show>
                  <Show when={detailDeadlineStoredValue()}>
                    <p class="text-xs text-[var(--text-soft)]">Stored: {detailDeadlineStoredValue()}</p>
                  </Show>
                  <Show when={detailScheduleWarning()}>
                    <p class={warningBannerClass}>
                      {detailScheduleWarning()}
                    </p>
                  </Show>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Original Schedule Input</label>
                  <input
                    value={detailScheduleOriginal()}
                    readonly
                    placeholder="Not captured for this task."
                    class={formFieldClass}
                    data-testid="task-detail-schedule-original"
                  />

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Recurrence Rule (RRULE)</label>
                  <input
                    value={detailRecurrence()}
                    onInput={(event) => setDetailRecurrence(event.currentTarget.value)}
                    placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
                    class={formFieldClass}
                    data-testid="task-detail-recurrence"
                  />
                  <button
                    type="button"
                    class="app-button-secondary rounded-lg px-3 py-2 text-xs"
                    onClick={() => void parseDetailRecurrence()}
                    data-testid="task-detail-parse-rrule"
                  >
                    Validate RRULE
                  </button>
                  <Show when={detailRecurrenceError()}>
                    <p class={errorBannerClass}>
                      {detailRecurrenceError()}
                    </p>
                  </Show>
                  <Show when={detailRecurrenceCanonical()}>
                    <p class={successBannerClass}>
                      {detailRecurrenceCanonical().trim().toUpperCase() === detailRecurrence().trim().toUpperCase()
                        ? "RRULE is valid."
                        : detailRecurrenceCanonical()}
                    </p>
                  </Show>

                  <Show when={detailTaskIsBoardProject()}>
                    <div
                      class="space-y-3 rounded-lg border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] p-3"
                      data-testid="task-detail-board-activation"
                    >
                      <div class="flex items-center justify-between">
                        <p class="text-xs uppercase tracking-wider text-[var(--text-dim)]">Board Activation</p>
                        <Show when={detailActivationPreview()?.alreadyLive}>
                          <span class={successBannerClass}>
                            Live
                          </span>
                        </Show>
                      </div>

                      <Show when={detailActivationLoading()}>
                        <p class="text-xs text-[var(--text-dim)]">Checking board requirements...</p>
                      </Show>

                      <Show when={detailActivationError()}>
                        <p class={errorBannerClass}>
                          {detailActivationError()}
                        </p>
                      </Show>

                      <Show when={detailActivationPreview()}>
                        {(preview) => (
                          <>
                            <Show when={preview().requirements.coin}>
                              {(coinRequirement) => (
                                <div class="rounded-md border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] px-2 py-2">
                                  <p class="text-[11px] uppercase tracking-wider text-[var(--text-dim)]">Coin</p>
                                  <p class="text-sm text-[var(--text-main)]">
                                    {coinRequirement().currency}: {coinRequirement().available}/{coinRequirement().required}
                                    <Show when={coinRequirement().missing > 0}>
                                      <span class="ml-2 text-[var(--danger)]">missing {coinRequirement().missing}</span>
                                    </Show>
                                  </p>
                                </div>
                              )}
                            </Show>

                            <Show
                              when={preview().requirements.modifiers.length > 0}
                              fallback={<p class="text-xs text-[var(--text-dim)]">No modifier cards required.</p>}
                            >
                              <div class="space-y-1">
                                <For each={preview().requirements.modifiers}>
                                  {(requirement) => (
                                    <div class="flex items-center justify-between rounded-md border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] px-2 py-1.5 text-xs text-[var(--text-main)]">
                                      <span>{formatModifierRequirementName(requirement.defId)}</span>
                                      <span>
                                        {requirement.available}/{requirement.required}
                                        <Show when={requirement.missing > 0}>
                                          <span class="ml-2 text-[var(--danger)]">missing {requirement.missing}</span>
                                        </Show>
                                      </span>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </Show>

                            <button
                              type="button"
                              class="app-button-secondary w-full rounded-lg px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => void makeDetailTaskLive()}
                              disabled={
                                detailActivating() ||
                                detailActivationLoading() ||
                                preview().alreadyLive ||
                                !preview().canActivate
                              }
                              data-testid="task-detail-make-live"
                            >
                              {preview().alreadyLive
                                ? "Live on board"
                                : detailActivating()
                                  ? "Activating..."
                                  : preview().canActivate
                                    ? "Make Live on Board"
                                    : "Missing requirements"}
                            </button>

                            <Show when={!preview().alreadyLive}>
                              <p class="text-xs text-[var(--text-dim)]">
                                Activation consumes the listed requirements and spawns this task on board.
                              </p>
                            </Show>
                          </>
                        )}
                      </Show>
                    </div>
                  </Show>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-[var(--border-strong)] px-6 py-4">
              <button
                type="button"
                class="app-button-secondary rounded-lg px-3 py-2 text-sm"
                onClick={() => {
                  const task = detailTask();
                  if (task) {
                    if (task.checked) {
                      void reopenTask(task);
                    } else {
                      void completeTask(task);
                    }
                  }
                }}
                data-testid="task-detail-mark-done"
              >
                {detailTask()?.checked ? "Reopen" : "Mark done"}
              </button>
              <button
                type="button"
                class="app-button-primary rounded-lg px-4 py-2 font-medium"
                onClick={() => void saveDetailModal()}
                data-testid="task-detail-save"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
        </Show>
  );
}
