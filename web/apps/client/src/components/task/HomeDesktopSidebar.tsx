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
          <aside class={style1}>
            <div class={style2}>
              <div class={style3}>
                <h1 class={style4}>Tasks</h1>
                <Button type="button" class={panelActionButtonClass} onClick={focusComposer}>
                  Add Task
                </Button>
              </div>

              <nav class={style5}>
                <Button
                  type="button"
                  class={`${sidebarItemBaseClass} ${sidebarItemIdleClass}`}
                  onClick={openSearchModal}
                  data-testid="open-search"
                >
                  <span class={style6}>
                    <span class={iconMutedClass}>⌕</span>
                    <span>Search</span>
                  </span>
                  <span class={style7}>⌘K</span>
                </Button>

                <Button
                  type="button"
                  class={`${sidebarItemBaseClass} ${isViewActive("inbox") ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                  onClick={() => navigateToView("inbox")}
                >
                  <span class={style8}>
                    <span class={isViewActive("inbox") ? iconActiveClass : iconMutedClass}>▱</span>
                    <span>Inbox</span>
                  </span>
                  <span class={style7}>{inboxCount()}</span>
                </Button>

                <Button
                  type="button"
                  class={`${sidebarItemBaseClass} ${isViewActive("today") ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                  onClick={() => navigateToView("today")}
                >
                  <span class={style8}>
                    <span class={isViewActive("today") ? iconActiveClass : iconMutedClass}>◫</span>
                    <span>Today</span>
                  </span>
                  <span class={style7}>{todayCount()}</span>
                </Button>

                <Button
                  type="button"
                  class={`${sidebarItemBaseClass} ${isViewActive("upcomming") ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                  onClick={() => navigateToView("upcomming")}
                >
                  <span class={style8}>
                    <span class={isViewActive("upcomming") ? iconActiveClass : iconMutedClass}>☷</span>
                    <span>Upcoming</span>
                  </span>
                  <span class={style7}>{upcomingCount()}</span>
                </Button>
              </nav>

              <div class={style9}>
                <div>
                  <p class={style10}>Favorites</p>
                  <div class={style11}>
                    <Show
                      when={favoriteProjects().length > 0}
                      fallback={<p class={style12}>No favorite projects yet.</p>}
                    >
                      <For each={favoriteProjects()}>
                        {(project) => (
                          <Button
                            type="button"
                            class={`${sidebarItemBaseClass} ${isProjectActive(project.id) ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                            onClick={() => navigateToProject(project.id)}
                          >
                            <span class={style13}>
                              <span class={style14}>★</span>
                              <span class={style15}>
                                <span class={style16}>{project.name}</span>
                                <Show when={projectQuickAddAlias(project)}>
                                  {(alias) => (
                                    <span class={style17}>
                                      #{alias()}
                                    </span>
                                  )}
                                </Show>
                              </span>
                              <Show when={isTeamBoardProject(project.id, projectMap())}>
                                <span class={teamBadgeClass}>Team</span>
                              </Show>
                            </span>
                            <span class={style7}>{sidebarProjectCount(project)}</span>
                          </Button>
                        )}
                      </For>
                    </Show>
                  </div>
                </div>

                <div class={style18}>
                  <p class={style10}>My Projects</p>
                  <div class={style11}>
                    <Show
                      when={sidebarProjects().length > 0}
                      fallback={<p class={style12}>No projects found in database.</p>}
                    >
                      <For each={sidebarProjects()}>
                        {(project) => (
                          <div class={style19}>
                            <Button
                              type="button"
                              class={` ${style20} ${
                                isProjectActive(project.id) ? `${sidebarItemActiveClass}` : `${sidebarItemIdleClass}`
                              }`}
                              onClick={() => navigateToProject(project.id)}
                            >
                              <span class={style21}>
                                <span class={style13}>
                                  <span class={style15}>
                                    <span class={style16}>{project.name}</span>
                                    <Show when={projectQuickAddAlias(project)}>
                                      {(alias) => (
                                        <span class={style17}>
                                          #{alias()}
                                        </span>
                                      )}
                                    </Show>
                                  </span>
                                  <Show when={isTeamBoardProject(project.id, projectMap())}>
                                    <span class={teamBadgeClass}>Team</span>
                                  </Show>
                                </span>
                                <span class={style22}>{sidebarProjectCount(project)}</span>
                              </span>
                            </Button>
                            <Button
                              type="button"
                              class={` ${style23} ${
                                project.isFavorite
                                  ? style24
                                  : style25
                              }`}
                              onClick={() => void toggleProjectFavorite(project)}
                              aria-label={project.isFavorite ? "Remove favorite" : "Add favorite"}
                            >
                              ★
                            </Button>
                          </div>
                        )}
                      </For>
                    </Show>
                  </div>
                </div>
              </div>

              <div class={style26}>
                <SidebarAccountCard />
              </div>
            </div>
          </aside>
  );
}


const style1 = css`
display: none;
height: 100%;
min-height: calc(var(--spacing) * 0);
flex-direction: column;
overflow: hidden;
border-radius: var(--radius-3xl);
padding: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    display: flex;
  }
background: linear-gradient(180deg, var(--panel-strong-start), var(--panel-strong-end)); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style2 = css`
display: flex;
height: 100%;
min-height: calc(var(--spacing) * 0);
flex-direction: column;
`;

const style3 = css`
display: flex;
align-items: center;
justify-content: space-between;
`;

const style4 = css`
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: var(--tracking-tight);
  letter-spacing: var(--tracking-tight);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style5 = css`
margin-top: calc(var(--spacing) * 4);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style6 = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 2);
color: var(--text-main);
`;

const style7 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

const style8 = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 2);
`;

const style9 = css`
margin-top: calc(var(--spacing) * 6);
min-height: calc(var(--spacing) * 0);
flex: 1;
overflow-y: auto;
padding-right: calc(var(--spacing) * 1);
`;

const style10 = css`
padding-inline: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

const style11 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style12 = css`
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-dim);
`;

const style13 = css`
display: flex;
min-width: calc(var(--spacing) * 0);
align-items: center;
gap: calc(var(--spacing) * 2);
`;

const style14 = css`
color: #ffd4a1;
`;

const style15 = css`
min-width: calc(var(--spacing) * 0);
`;

const style16 = css`
display: block;
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const style17 = css`
font-size: 10px;
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style18 = css`
margin-top: calc(var(--spacing) * 6);
`;

const style19 = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 1);
`;

const style20 = css`
min-width: calc(var(--spacing) * 0);
flex: 1;
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
text-align: left;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

const style21 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 2);
`;

const style22 = css`
margin-left: calc(var(--spacing) * 3);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

const style23 = css`
border-radius: var(--radius-lg);
border-style: var(--tw-border-style);
  border-width: 1px;
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

const style24 = css`
border-color: rgba(255,139,80,0.28);
background-color: var(--accent-wash);
color: var(--accent-text);
`;

const style25 = css`
border-color: var(--border-strong);
color: var(--text-muted);
&:hover {
    @media (hover: hover) {
      border-color: var(--accent);
    }
  }
&:hover {
    @media (hover: hover) {
      color: var(--accent-text);
    }
  }
`;

const style26 = css`
margin-top: calc(var(--spacing) * 4);
border-top-style: var(--tw-border-style);
  border-top-width: 1px;
border-color: var(--border-strong);
padding-top: calc(var(--spacing) * 4);
`;
