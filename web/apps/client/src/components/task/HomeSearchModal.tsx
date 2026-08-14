import Button from "../Button";
import { css } from "@linaria/core";
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
          class={style1}
          onClick={closeSearchModal}
        >
          <div
            class={style2}
            onClick={(event) => event.stopPropagation()}
          >
            <div class={style3}>
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
            <div class={style4}>
              <Show
                when={searchText().trim().length > 0}
                fallback={<p class={style5}>Type to search.</p>}
              >
                <Show
                  when={searchResults().length > 0}
                  fallback={<p class={style5}>No matching open tasks.</p>}
                >
                  <div class={style6}>
                    <For each={searchResults()}>
                      {(item) => (
                        <Button
                          type="button"
                          class={style7}
                          onClick={() => {
                            closeSearchModal();
                            openDetailModal(item);
                          }}
                        >
                          <p class={style8}>{item.content}</p>
                          <div class={style9}>
                            <Show when={projectNameByID(item.projectId)}>
                              {(projectName) => (
                                <span class={` ${style10} ${tagBadgeClass}`}>
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
                        </Button>
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


const style1 = css`
position: fixed;
inset: calc(var(--spacing) * 0);
z-index: 40;
display: flex;
align-items: flex-start;
justify-content: center;
background-color: color-mix(in srgb, #000 55%, transparent);
  @supports (color: color-mix(in lab, red, red)) {
    background-color: color-mix(in oklab, var(--color-black) 55%, transparent);
  }
padding: calc(var(--spacing) * 4);
padding-top: calc(var(--spacing) * 20);
--tw-backdrop-blur: blur(var(--blur-sm));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
`;

const style2 = css`
width: 100%;
max-width: var(--container-2xl);
border-radius: var(--radius-2xl);
--tw-shadow: 0 25px 70px var(--tw-shadow-color, rgba(0,0,0,0.55));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
background: var(--panel); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style3 = css`
border-bottom-style: var(--tw-border-style);
  border-bottom-width: 1px;
border-color: var(--border-strong);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
`;

const style4 = css`
max-height: 420px;
overflow-y: auto;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 3);
`;

const style5 = css`
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-dim);
`;

const style6 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style7 = css`
width: 100%;
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: transparent;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
text-align: left;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: rgba(119,155,187,0.24);
    }
  }
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.04);
    }
  }
`;

const style8 = css`
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
`;

const style9 = css`
margin-top: calc(var(--spacing) * 1);
display: flex;
flex-wrap: wrap;
align-items: center;
gap: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

const style10 = css`
display: inline-flex;
align-items: center;
gap: calc(var(--spacing) * 1);
`;
