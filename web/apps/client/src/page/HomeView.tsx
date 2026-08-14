import {
  For,
  Show,
  createTrackedEffect,
  createMemo,
  createSignal,
  onCleanup,
  onSettled,
} from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";

import {
  type Project,
  type QuickAddParsed,
  type Task,
} from "../server/api";
import { useApi } from "../context/ApiContext";
import { useToast } from "../context/ToastContext";
import { mergeNormalizedLabels } from "../lib/quickAddLabels";
import { isAbortError, shouldPreviewQuickAdd } from "../lib/quickAddPreview";
import AppShell from "../components/AppShell";
import SidebarAccountCard from "../components/SidebarAccountCard";
import TaskQuickAddComposer from "../components/task/TaskQuickAddComposer";
import TaskViewHeader from "../components/task/TaskViewHeader";

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
} from "../features/tasks/home-model";
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
} from "../features/tasks/home-rules";import { useHome } from "./HomeContext";

export default function HomeView() {
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
    <AppShell
      activeView="task"
      accountPlacement="sidebar"
      mobileSidebar={
        <div class="space-y-5">
          <div class={sidebarCardClass}>
            <div class="flex items-center justify-between">
              <h2 class="font-display text-sm font-semibold tracking-tight text-white">Tasks</h2>
              <button
                type="button"
                class={smallActionButtonClass}
                onClick={focusComposer}
              >
                Add
              </button>
            </div>
            <button
              type="button"
              class={searchButtonClass}
              onClick={openSearchModal}
            >
              <span>Search</span>
              <span class="text-xs text-[var(--text-dim)]">⌘K</span>
            </button>
          </div>

          <div class={sidebarCardClass}>
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Views</p>
            <div class="mt-2 space-y-1">
              <button
                type="button"
                class={`${sidebarItemBaseClass} ${isViewActive("inbox") ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                onClick={() => navigateToView("inbox")}
              >
                <span>Inbox</span>
                <span class="text-xs text-[var(--text-dim)]">{inboxCount()}</span>
              </button>
              <button
                type="button"
                class={`${sidebarItemBaseClass} ${isViewActive("today") ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                onClick={() => navigateToView("today")}
              >
                <span>Today</span>
                <span class="text-xs text-[var(--text-dim)]">{todayCount()}</span>
              </button>
              <button
                type="button"
                class={`${sidebarItemBaseClass} ${isViewActive("upcomming") ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                onClick={() => navigateToView("upcomming")}
              >
                <span>Upcoming</span>
                <span class="text-xs text-[var(--text-dim)]">{upcomingCount()}</span>
              </button>
            </div>
          </div>

          <div class={sidebarCardClass}>
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Projects</p>
            <div class="mt-2 space-y-1">
              <For each={sidebarProjects()}>
                {(project) => (
                  <button
                    type="button"
                    class={`${sidebarItemBaseClass} ${isProjectActive(project.id) ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                    onClick={() => navigateToProject(project.id)}
                  >
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
                    <span class="ml-2 text-xs text-[var(--text-dim)]">{sidebarProjectCount(project)}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </div>
      }
    >
      <div class="h-full overflow-hidden p-3 md:p-6">
        <div class="grid h-full min-h-0 w-full grid-cols-1 gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
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
        </div>

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
      </div>
    </AppShell>
  );
}
