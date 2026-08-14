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

export default function HomeSearchModal() {
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
        <Show when={isSearchOpen()}>
        <div
          class="fixed inset-0 z-40 flex items-start justify-center bg-black/55 p-4 pt-20 backdrop-blur-sm"
          onClick={closeSearchModal}
        >
          <div
            class="app-panel w-full max-w-2xl rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="border-b border-[var(--border-strong)] px-4 py-3">
              <input
                ref={setSearchInputRef}
                value={searchText()}
                onInput={(event) => setSearchText(event.currentTarget.value)}
                placeholder="Search tasks, descriptions, projects..."
                aria-label="Search tasks"
                data-testid="search-input"
                class={formFieldClass}
              />
            </div>
            <div class="max-h-[420px] overflow-y-auto px-3 py-3">
              <Show
                when={searchText().trim().length > 0}
                fallback={<p class="px-2 py-2 text-sm text-[var(--text-dim)]">Type to search.</p>}
              >
                <Show
                  when={searchResults().length > 0}
                  fallback={<p class="px-2 py-2 text-sm text-[var(--text-dim)]">No matching open tasks.</p>}
                >
                  <div class="space-y-1">
                    <For each={searchResults()}>
                      {(item) => (
                        <button
                          type="button"
                          class="w-full rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-[rgba(119,155,187,0.24)] hover:bg-[rgba(255,255,255,0.04)]"
                          onClick={() => {
                            closeSearchModal();
                            openDetailModal(item);
                          }}
                        >
                          <p class="truncate text-sm text-[var(--text-main)]">{item.content}</p>
                          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
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
                            <Show when={scheduleBadgeLabel(item, "due")}>
                              {(label) => <span class={dueBadgeClass}>{label()}</span>}
                            </Show>
                            <Show when={scheduleBadgeLabel(item, "deadline")}>
                              {(label) => <span class={deadlineBadgeClass}>{label()}</span>}
                            </Show>
                            <Show when={scheduleValidationWarning(item)}>
                              {(warning) => <span class={warningBadgeClass}>{warning()}</span>}
                            </Show>
                            <For each={visibleTaskLabels(item.labels)}>
                              {(label) => <span class={tagBadgeClass}>@{label}</span>}
                            </For>
                          </div>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </Show>
            </div>
          </div>
        </div>
        </Show>
  );
}
