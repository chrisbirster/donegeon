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
import { style1, style2, style3, style4, style5, style6, style7, style8, style9, style10, style11, style12, style13, style14, style15, style16, style17, style18, style19, style20, style21, style22, style23, style24, style25, style26, style27, taskRow, taskRowDrop, taskRowNextAction, completedTaskRow } from "./styles/HomeTaskContent.styles";

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
          <section class={style1}>
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
            <p class={` ${style2} ${errorBannerClass}`}>{error()}</p>
          </Show>

          <div class={style3}>
            <Show
              when={visibleTasks().length > 0}
              fallback={<p class={emptyStateClass}>No open tasks in this view.</p>}
            >
              <ul class={style4}>
                <For each={visibleTasks()}>
                  {(item) => (
                    <li
                      data-testid="task-row"
                      data-task-id={item.id}
                      class={`group ${taskRow} ${
                        dropTargetId() === item.id
                          ? taskRowDrop
                          : isNextActionTask(item)
                            ? taskRowNextAction
                            : ""
                      }`}
                      onDragOver={(event) => onDragOver(event, item.id)}
                      onDrop={(event) => onDrop(event, item.id)}
                      onClick={() => {
                        if (editingTaskId() === item.id) return;
                        openDetailModal(item);
                      }}
                    >
                      <Button
                        unstyled
                        type="button"
                        draggable="true"
                        class={` ${style5} ${
                          dragTaskId() === item.id ? style6 : style7
                        }`}
                        aria-label="Drag to reorder"
                        onClick={(event) => event.stopPropagation()}
                        onDragStart={(event) => onDragStart(event, item.id)}
                        onDragEnd={onDragEnd}
                      >
                        ::
                      </Button>

                      <Button
                        unstyled
                        type="button"
                        class={style8}
                        aria-label="Complete task"
                        onClick={(event) => {
                          event.stopPropagation();
                          void completeTask(item);
                        }}
                      />

                      <div class={style9}>
                        <Show
                          when={editingTaskId() === item.id}
                          fallback={
                            <>
                              <p class={style10} data-testid="task-content">
                                {item.content}
                              </p>
                              <div class={style11}>
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
                                    <span class={` ${style12} ${tagBadgeClass}`}>
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
                          <div class={style13} onClick={(event) => event.stopPropagation()}>
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
                              class={style14}
                              autofocus
                            />
                            <Button
                              type="button"
                              class={style15}
                              onClick={() => void saveInlineEdit(item.id)}
                            >
                              Save
                            </Button>
                            <Button
                              type="button"
                              class={style16}
                              onClick={cancelInlineEdit}
                            >
                              Cancel
                            </Button>
                          </div>
                        </Show>
                      </div>

                      <span
                        class={` ${style17} ${
                          item.priority <= 2
                            ? style18
                            : style19
                        }`}
                      >
                        p{item.priority}
                      </span>

                      <div class={style20}>
                        <Button
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
                        </Button>
                        <Button
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
                        </Button>
                        <Show when={isBoardProject(item.projectId) && !isBoardLiveTask(item)}>
                          <Button
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
                          </Button>
                        </Show>
                        <Button
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
                        </Button>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Show>

            <Show when={visibleCompletedTasks().length > 0}>
              <div class={visibleTasks().length > 0 ? style21 : style22} data-testid="completed-task-section">
                <div class={style23}>
                  <p class={style24}>Completed</p>
                  <span class={style25}>{visibleCompletedTasks().length} task(s)</span>
                </div>

                <ul class={style4}>
                  <For each={visibleCompletedTasks()}>
                    {(item) => (
                      <li
                        data-testid="completed-task-row"
                        data-task-id={item.id}
                        class={`group ${completedTaskRow}`}
                        onClick={() => {
                          if (editingTaskId() === item.id) return;
                          openDetailModal(item);
                        }}
                      >
                        <span class={style26}>
                          ✓
                        </span>

                        <div class={style9}>
                          <p class={style27} data-testid="completed-task-content">
                            {item.content}
                          </p>
                          <div class={style11}>
                            <span class={boardLiveBadgeClass}>Done</span>
                            <Show when={scheduleBadgeLabel(item, "due")}>
                              {(label) => <span class={dueBadgeClass}>{label()}</span>}
                            </Show>
                            <Show when={scheduleBadgeLabel(item, "deadline")}>
                              {(label) => <span class={deadlineBadgeClass}>{label()}</span>}
                            </Show>
                            <Show when={projectNameByID(item.projectId)}>
                              {(projectName) => (
                                <span class={` ${style12} ${tagBadgeClass}`}>
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
                          class={` ${style17} ${
                            item.priority <= 2
                              ? style18
                              : style19
                          }`}
                        >
                          p{item.priority}
                        </span>

                        <div class={style20}>
                          <Button
                            type="button"
                            class={successActionButtonClass}
                            data-testid="reopen-task"
                            onClick={(event) => {
                              event.stopPropagation();
                              void reopenTask(item);
                            }}
                          >
                            Reopen
                          </Button>
                          <Button
                            type="button"
                            class={listActionButtonClass}
                            onClick={(event) => {
                              event.stopPropagation();
                              openDetailModal(item);
                            }}
                          >
                            Open
                          </Button>
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
