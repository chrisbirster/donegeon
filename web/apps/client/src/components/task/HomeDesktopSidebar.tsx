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

export default function HomeDesktopSidebar() {
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
          <aside class="app-panel-strong hidden h-full min-h-0 flex-col overflow-hidden rounded-3xl p-4 md:flex">
            <div class="flex h-full min-h-0 flex-col">
              <div class="flex items-center justify-between">
                <h1 class="font-display text-lg font-semibold tracking-tight text-white">Tasks</h1>
                <button type="button" class={panelActionButtonClass} onClick={focusComposer}>
                  Add Task
                </button>
              </div>

              <nav class="mt-4 space-y-1">
                <button
                  type="button"
                  class={`${sidebarItemBaseClass} ${sidebarItemIdleClass}`}
                  onClick={openSearchModal}
                  data-testid="open-search"
                >
                  <span class="flex items-center gap-2 text-[var(--text-main)]">
                    <span class={iconMutedClass}>⌕</span>
                    <span>Search</span>
                  </span>
                  <span class="text-xs text-[var(--text-dim)]">⌘K</span>
                </button>

                <button
                  type="button"
                  class={`${sidebarItemBaseClass} ${isViewActive("inbox") ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                  onClick={() => navigateToView("inbox")}
                >
                  <span class="flex items-center gap-2">
                    <span class={isViewActive("inbox") ? iconActiveClass : iconMutedClass}>▱</span>
                    <span>Inbox</span>
                  </span>
                  <span class="text-xs text-[var(--text-dim)]">{inboxCount()}</span>
                </button>

                <button
                  type="button"
                  class={`${sidebarItemBaseClass} ${isViewActive("today") ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                  onClick={() => navigateToView("today")}
                >
                  <span class="flex items-center gap-2">
                    <span class={isViewActive("today") ? iconActiveClass : iconMutedClass}>◫</span>
                    <span>Today</span>
                  </span>
                  <span class="text-xs text-[var(--text-dim)]">{todayCount()}</span>
                </button>

                <button
                  type="button"
                  class={`${sidebarItemBaseClass} ${isViewActive("upcomming") ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                  onClick={() => navigateToView("upcomming")}
                >
                  <span class="flex items-center gap-2">
                    <span class={isViewActive("upcomming") ? iconActiveClass : iconMutedClass}>☷</span>
                    <span>Upcoming</span>
                  </span>
                  <span class="text-xs text-[var(--text-dim)]">{upcomingCount()}</span>
                </button>
              </nav>

              <div class="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">
                <div>
                  <p class="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Favorites</p>
                  <div class="mt-2 space-y-1">
                    <Show
                      when={favoriteProjects().length > 0}
                      fallback={<p class="px-2 py-1 text-sm text-[var(--text-dim)]">No favorite projects yet.</p>}
                    >
                      <For each={favoriteProjects()}>
                        {(project) => (
                          <button
                            type="button"
                            class={`${sidebarItemBaseClass} ${isProjectActive(project.id) ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                            onClick={() => navigateToProject(project.id)}
                          >
                            <span class="flex min-w-0 items-center gap-2">
                              <span class="text-[#ffd4a1]">★</span>
                              <span class="min-w-0">
                                <span class="block truncate">{project.name}</span>
                                <Show when={projectQuickAddAlias(project)}>
                                  {(alias) => (
                                    <span class="block text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                      #{alias()}
                                    </span>
                                  )}
                                </Show>
                              </span>
                              <Show when={isTeamBoardProject(project.id, projectMap())}>
                                <span class={teamBadgeClass}>Team</span>
                              </Show>
                            </span>
                            <span class="text-xs text-[var(--text-dim)]">{sidebarProjectCount(project)}</span>
                          </button>
                        )}
                      </For>
                    </Show>
                  </div>
                </div>

                <div class="mt-6">
                  <p class="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">My Projects</p>
                  <div class="mt-2 space-y-1">
                    <Show
                      when={sidebarProjects().length > 0}
                      fallback={<p class="px-2 py-1 text-sm text-[var(--text-dim)]">No projects found in database.</p>}
                    >
                      <For each={sidebarProjects()}>
                        {(project) => (
                          <div class="group flex items-center gap-1">
                            <button
                              type="button"
                              class={`min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm transition ${
                                isProjectActive(project.id) ? `${sidebarItemActiveClass}` : `${sidebarItemIdleClass}`
                              }`}
                              onClick={() => navigateToProject(project.id)}
                            >
                              <span class="flex items-center justify-between gap-2">
                                <span class="flex min-w-0 items-center gap-2">
                                  <span class="min-w-0">
                                    <span class="block truncate">{project.name}</span>
                                    <Show when={projectQuickAddAlias(project)}>
                                      {(alias) => (
                                        <span class="block text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                                          #{alias()}
                                        </span>
                                      )}
                                    </Show>
                                  </span>
                                  <Show when={isTeamBoardProject(project.id, projectMap())}>
                                    <span class={teamBadgeClass}>Team</span>
                                  </Show>
                                </span>
                                <span class="ml-3 text-xs text-[var(--text-dim)]">{sidebarProjectCount(project)}</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              class={`rounded-lg border px-2 py-1 text-xs transition ${
                                project.isFavorite
                                  ? "border-[rgba(255,139,80,0.28)] bg-[var(--accent-wash)] text-[var(--accent-text)]"
                                  : "border-[var(--border-strong)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
                              }`}
                              onClick={() => void toggleProjectFavorite(project)}
                              aria-label={project.isFavorite ? "Remove favorite" : "Add favorite"}
                            >
                              ★
                            </button>
                          </div>
                        )}
                      </For>
                    </Show>
                  </div>
                </div>
              </div>

              <div class="mt-4 border-t border-[var(--border-strong)] pt-4">
                <SidebarAccountCard />
              </div>
            </div>
          </aside>
  );
}
