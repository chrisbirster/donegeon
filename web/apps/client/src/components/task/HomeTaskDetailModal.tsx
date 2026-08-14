import Button from "../Button";
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
import { style1, style2, style3, style4, style5, style6, style7, style8, style9, style10, style11, style12, style13, style14, style15, style16, style17, style18, style19, style20, style21, style22, style23, style24, style25, style26, style27, style28, style29, style30, style31, style32, style33 } from "./styles/HomeTaskDetailModal.styles";

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
          class={style1}
          onClick={closeDetailModal}
        >
          <div
            class={style2}
            onClick={(event) => event.stopPropagation()}
            data-testid="task-detail-modal"
          >
            <div class={style3}>
              <p class={style4}>Task Detail</p>
              <Button
                type="button"
                class={style5}
                onClick={closeDetailModal}
              >
                Close
              </Button>
            </div>

            <div class={style6}>
              <div class={style7}>
                <label class={style8}>Task</label>
                <input
                  value={detailContent()}
                  onInput={(event) => setDetailContent(event.currentTarget.value)}
                  class={style9}
                  data-testid="task-detail-title"
                />

                <label class={style8}>Description</label>
                <textarea
                  value={detailDescription()}
                  onInput={(event) => setDetailDescription(event.currentTarget.value)}
                  class={style10}
                  data-testid="task-detail-description"
                />
              </div>

              <div class={style11}>
                <div class={style12}>
                  <label class={style8}>Project</label>
                  <Show
                    when={detailNewProjectName() === null}
                    fallback={
                      <div class={style13}>
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
                        <Button
                          type="button"
                          class={style14}
                          onClick={() => void createAndAssignDetailProject(detailNewProjectName() ?? "")}
                          disabled={detailProjectAssigning()}
                        >
                          {detailProjectAssigning() ? "..." : "✓"}
                        </Button>
                        <Button
                          type="button"
                          class={style14}
                          disabled={detailProjectAssigning()}
                          onClick={() => setDetailNewProjectName(null)}
                        >
                          ✕
                        </Button>
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
                    <p class={` ${style15} ${teamBadgeClass}`}>
                      Team board project
                    </p>
                  </Show>

                  <label class={style8}>Tags</label>
                  <input
                    value={detailTags()}
                    onInput={(event) => setDetailTags(event.currentTarget.value)}
                    placeholder="@chore @home"
                    class={formFieldClass}
                    data-testid="task-detail-tags"
                  />
                  <p class={style16}>
                    Use tags like <code>@chore @home</code>.
                  </p>

                  <label class={style8}>Priority</label>
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

                  <label class={style8}>Due</label>
                  <div class={style13}>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalValue(detailDueText())}
                      onInput={(event) => setDetailDueText(fromDatetimeLocalValue(event.currentTarget.value))}
                      class={`${formFieldClass} ${style17} `}
                      data-testid="task-detail-due"
                    />
                    <Show when={detailDueText()}>
                      <Button
                        type="button"
                        class={style14}
                        onClick={() => setDetailDueText("")}
                        title="Clear due date"
                      >
                        ✕
                      </Button>
                    </Show>
                  </div>
                  <Show when={detailDueInputToken()}>
                    <p class={style18}>Original token: {detailDueInputToken()}</p>
                  </Show>
                  <Show when={detailDueStoredValue()}>
                    <p class={style19}>Stored: {detailDueStoredValue()}</p>
                  </Show>

                  <label class={style8}>Deadline</label>
                  <div class={style13}>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalValue(detailDeadline())}
                      onInput={(event) => setDetailDeadline(fromDatetimeLocalValue(event.currentTarget.value))}
                      class={`${formFieldClass} ${style17} `}
                      data-testid="task-detail-deadline"
                    />
                    <Show when={detailDeadline()}>
                      <Button
                        type="button"
                        class={style14}
                        onClick={() => setDetailDeadline("")}
                        title="Clear deadline"
                      >
                        ✕
                      </Button>
                    </Show>
                  </div>
                  <Show when={detailDeadlineInputToken()}>
                    <p class={style18}>Original token: {detailDeadlineInputToken()}</p>
                  </Show>
                  <Show when={detailDeadlineStoredValue()}>
                    <p class={style19}>Stored: {detailDeadlineStoredValue()}</p>
                  </Show>
                  <Show when={detailScheduleWarning()}>
                    <p class={warningBannerClass}>
                      {detailScheduleWarning()}
                    </p>
                  </Show>

                  <label class={style8}>Original Schedule Input</label>
                  <input
                    value={detailScheduleOriginal()}
                    readonly
                    placeholder="Not captured for this task."
                    class={formFieldClass}
                    data-testid="task-detail-schedule-original"
                  />

                  <label class={style8}>Recurrence Rule (RRULE)</label>
                  <input
                    value={detailRecurrence()}
                    onInput={(event) => setDetailRecurrence(event.currentTarget.value)}
                    placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
                    class={formFieldClass}
                    data-testid="task-detail-recurrence"
                  />
                  <Button
                    type="button"
                    class={style20}
                    onClick={() => void parseDetailRecurrence()}
                    data-testid="task-detail-parse-rrule"
                  >
                    Validate RRULE
                  </Button>
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
                      class={style21}
                      data-testid="task-detail-board-activation"
                    >
                      <div class={style22}>
                        <p class={style23}>Board Activation</p>
                        <Show when={detailActivationPreview()?.alreadyLive}>
                          <span class={successBannerClass}>
                            Live
                          </span>
                        </Show>
                      </div>

                      <Show when={detailActivationLoading()}>
                        <p class={style16}>Checking board requirements...</p>
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
                                <div class={style24}>
                                  <p class={style25}>Coin</p>
                                  <p class={style26}>
                                    {coinRequirement().currency}: {coinRequirement().available}/{coinRequirement().required}
                                    <Show when={coinRequirement().missing > 0}>
                                      <span class={style27}>missing {coinRequirement().missing}</span>
                                    </Show>
                                  </p>
                                </div>
                              )}
                            </Show>

                            <Show
                              when={preview().requirements.modifiers.length > 0}
                              fallback={<p class={style16}>No modifier cards required.</p>}
                            >
                              <div class={style28}>
                                <For each={preview().requirements.modifiers}>
                                  {(requirement) => (
                                    <div class={style29}>
                                      <span>{formatModifierRequirementName(requirement.defId)}</span>
                                      <span>
                                        {requirement.available}/{requirement.required}
                                        <Show when={requirement.missing > 0}>
                                          <span class={style27}>missing {requirement.missing}</span>
                                        </Show>
                                      </span>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </Show>

                            <Button
                              type="button"
                              class={style30}
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
                            </Button>

                            <Show when={!preview().alreadyLive}>
                              <p class={style16}>
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

            <div class={style31}>
              <Button
                type="button"
                class={style32}
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
              </Button>
              <Button
                type="button"
                class={style33}
                onClick={() => void saveDetailModal()}
                data-testid="task-detail-save"
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
        </Show>
  );
}
