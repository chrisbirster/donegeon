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
} from "../features/tasks/home-rules";export function createHomeControllerState() {
  const api = useApi();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [tasks, setTasks] = createSignal<Task[]>([]);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [content, setContent] = createSignal("");
  const [parsedInput, setParsedInput] = createSignal<QuickAddParsed | null>(null);
  const [error, setError] = createSignal("");
  const [isSearchOpen, setIsSearchOpen] = createSignal(false);
  const [searchText, setSearchText] = createSignal("");

  const [dragTaskId, setDragTaskId] = createSignal<string | null>(null);
  const [dropTargetId, setDropTargetId] = createSignal<string | null>(null);

  const [editingTaskId, setEditingTaskId] = createSignal<string | null>(null);
  const [editingContent, setEditingContent] = createSignal("");

  const [detailTaskId, setDetailTaskId] = createSignal<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = createSignal(false);
  const [detailContent, setDetailContent] = createSignal("");
  const [detailDescription, setDetailDescription] = createSignal("");
  const [detailPriority, setDetailPriority] = createSignal(4);
  const [detailDueText, setDetailDueText] = createSignal("");
  const [detailDeadline, setDetailDeadline] = createSignal("");
  const [detailProjectId, setDetailProjectId] = createSignal("");
  const [detailTags, setDetailTags] = createSignal("");
  const [detailScheduleOriginal, setDetailScheduleOriginal] = createSignal("");
  const [detailRecurrence, setDetailRecurrence] = createSignal("");
  const [detailRecurrenceCanonical, setDetailRecurrenceCanonical] = createSignal("");
  const [detailRecurrenceError, setDetailRecurrenceError] = createSignal("");
  const [detailActivationPreview, setDetailActivationPreview] = createSignal<TaskActivationPreview | null>(null);
  const [detailActivationLoading, setDetailActivationLoading] = createSignal(false);
  const [detailActivationError, setDetailActivationError] = createSignal("");
  const [detailActivating, setDetailActivating] = createSignal(false);
  const [rowActivatingTaskID, setRowActivatingTaskID] = createSignal<string | null>(null);
  const [detailNewProjectName, setDetailNewProjectName] = createSignal<string | null>(null);
  const [detailProjectAssigning, setDetailProjectAssigning] = createSignal(false);

  const tasksQuery = createQuery(() => ({
    queryKey: ["tasks", "list"],
    queryFn: () => api.tasks.list(),
  }));
  const projectsQuery = createQuery(() => ({
    queryKey: ["projects", "list"],
    queryFn: () => api.projects.list(),
  }));

  const inputTokens = createMemo(() => tokenizeQuickAdd(content()));
  const currentView = createMemo(() => parseTaskView(location.pathname));

  const mergedProjects = createMemo(() => {
    const byID = new Map<string, Project>();
    for (const project of DEFAULT_SIDEBAR_PROJECTS) {
      byID.set(project.id, project);
    }
    for (const project of projects()) {
      byID.set(project.id, project);
    }
    return [...byID.values()];
  });

  const projectMap = createMemo(() => {
    const byID = new Map<string, Project>();
    for (const project of mergedProjects()) {
      byID.set(project.id, project);
    }
    return byID;
  });

  const openTasks = createMemo(() =>
    sortTasks(tasks().filter((task) => !task.checked && !task.isDeleted)),
  );

  const completedTasks = createMemo(() =>
    sortCompletedTasks(tasks().filter((task) => task.checked && !task.isDeleted)),
  );

  const openTaskCountByProjectID = createMemo(() => {
    const counts = new Map<string, number>();
    for (const item of openTasks()) {
      const projectID = item.projectId?.trim();
      if (!projectID) continue;
      counts.set(projectID, (counts.get(projectID) || 0) + 1);
    }
    return counts;
  });

  function isInboxTask(item: Task): boolean {
    const projectID = item.projectId?.trim() ?? "";
    if (!projectID) return true;
    const project = projectMap().get(projectID);
    return !!project?.isInboxProject;
  }

  const inboxCount = createMemo(() =>
    openTasks().filter((task) => isInboxTask(task)).length,
  );

  const todayCount = createMemo(() => {
    const today = startOfLocalDay(new Date());
    return openTasks().filter((task) => {
      const due = taskDueDate(task);
      return due?.getTime() === today.getTime();
    }).length;
  });

  const upcomingCount = createMemo(() => {
    const today = startOfLocalDay(new Date());
    return openTasks().filter((task) => {
      const due = taskDueDate(task);
      return !!due && due.getTime() > today.getTime();
    }).length;
  });

  const favoriteProjects = createMemo(() =>
    mergedProjects()
      .filter((project) => project.isFavorite && !project.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const sidebarProjects = createMemo(() =>
    mergedProjects()
      .filter((project) => !project.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const selectedProject = createMemo(() => {
    const view = currentView();
    if (view.kind !== "project" || !view.projectId) return null;
    return projectMap().get(view.projectId) ?? null;
  });

  const viewTitle = createMemo(() => {
    const view = currentView();
    switch (view.kind) {
      case "today":
        return "Today";
      case "upcomming":
        return "Upcomming";
      case "project":
        return selectedProject()?.name ?? prettifyLabel(view.projectId ?? "Project");
      default:
        return "Inbox";
    }
  });

  function filterTasksForCurrentView(taskList: Task[]): Task[] {
    const view = currentView();
    if (view.kind === "today") {
      const today = startOfLocalDay(new Date());
      return taskList.filter((task) => {
        const due = taskDueDate(task);
        return due?.getTime() === today.getTime();
      });
    }
    if (view.kind === "upcomming") {
      const today = startOfLocalDay(new Date());
      return taskList.filter((task) => {
        const due = taskDueDate(task);
        return !!due && due.getTime() > today.getTime();
      });
    }
    if (view.kind === "project") {
      const projectID = view.projectId?.trim();
      if (!projectID) return [] as Task[];
      if (projectMap().get(projectID)?.isInboxProject) {
        return taskList.filter((task) => isInboxTask(task));
      }
      return taskList.filter((task) => task.projectId?.trim() === projectID);
    }
    return taskList.filter((task) => isInboxTask(task));
  }

  const visibleTasks = createMemo(() => {
    return filterTasksForCurrentView(openTasks());
  });

  const visibleCompletedTasks = createMemo(() => {
    return filterTasksForCurrentView(completedTasks());
  });

  const detailTask = createMemo(() => {
    const id = detailTaskId();
    if (!id) return null;
    return tasks().find((task) => task.id === id) ?? null;
  });

  const detailTaskIsBoardProject = createMemo(() => isBoardProject(detailTask()?.projectId));
  const detailDueInputToken = createMemo(() => scheduleTokenFromInput(detailScheduleOriginal(), "due"));
  const detailDeadlineInputToken = createMemo(() =>
    scheduleTokenFromInput(detailScheduleOriginal(), "deadline"),
  );
  const detailDueStoredValue = createMemo(
    () => formatScheduleDateTime(detailDueText()) ?? detailDueText().trim(),
  );
  const detailDeadlineStoredValue = createMemo(
    () => formatScheduleDateTime(detailDeadline()) ?? detailDeadline().trim(),
  );
  const detailScheduleWarning = createMemo(() => {
    const due = parseScheduleInstant(detailDueText());
    const deadline = parseScheduleInstant(detailDeadline());
    if (!due || !deadline) return "";
    if (deadline.getTime() >= due.getTime()) return "";
    const dueLabel = formatScheduleDateTime(detailDueText()) ?? detailDueText().trim();
    const deadlineLabel = formatScheduleDateTime(detailDeadline()) ?? detailDeadline().trim();
    return `Schedule check: deadline resolves before due (${deadlineLabel} < ${dueLabel}).`;
  });

  const parsedChips = createMemo(() => {
    const parsed = parsedInput();
    if (!parsed) return [] as string[];

    const chips: string[] = [];

    const project = addChip(parsed.project, "Project");
    if (project) chips.push(project);

    for (const label of parsed.labels) {
      chips.push(`Label: ${label}`);
    }

    const assignee = addChip(parsed.assignee, "Assignee");
    if (assignee) chips.push(assignee);

    if (parsed.priority) {
      chips.push(`Priority: p${parsed.priority}`);
    }

    const dueText = addChip(formatScheduleDateTime(parsed.dueText), "Due");
    if (dueText) chips.push(dueText);

    const deadline = addChip(formatScheduleDateTime(parsed.deadline), "Deadline");
    if (deadline) chips.push(deadline);

    const recurrence = addChip(parsed.recurrenceRule, "Recurrence");
    if (recurrence) chips.push(recurrence);

    return chips;
  });

  const parsedGuidance = createMemo(() => {
    const parsed = parsedInput();
    if (!parsed || !parsed.recurrenceRule) return "";
    if (parsed.dueText || parsed.deadline) return "";
    return "Recurrence sets repeat cadence only. Add due text (for example, tomorrow) and/or {deadline} to fill those fields.";
  });

  const searchResults = createMemo(() => {
    const query = searchText().trim().toLowerCase();
    if (!query) return [] as Task[];
    return openTasks().filter((task) => {
      const projectName = task.projectId ? projectMap().get(task.projectId)?.name ?? task.projectId : "";
      return (
        task.content.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        projectName.toLowerCase().includes(query)
      );
    });
  });

  createTrackedEffect(() => {
    const taskList = tasksQuery.data;
    if (!taskList) return;
    setTasks(sortTasks(taskList.items));
    setError("");
  });

  createTrackedEffect(() => {
    const projectList = projectsQuery.data;
    if (!projectList) return;
    setProjects(projectList.items);
  });

  createTrackedEffect(() => {
    const taskErr = tasksQuery.error;
    if (taskErr) {
      setError(taskErr instanceof Error ? taskErr.message : "Failed to load tasks");
      return;
    }
    const projectErr = projectsQuery.error;
    if (projectErr) {
      setError(projectErr instanceof Error ? projectErr.message : "Failed to load projects");
    }
  });

  function projectNameByID(projectID?: string): string | null {
    const id = projectID?.trim();
    if (!id) return null;
    return projectMap().get(id)?.name ?? prettifyLabel(id);
  }

  function sidebarProjectCount(project: Project): number {
    if (project.id === "inbox") {
      return inboxCount();
    }
    return openTaskCountByProjectID().get(project.id) ?? project.openTaskCount ?? 0;
  }

  async function refreshData() {
    try {
      await Promise.all([tasksQuery.refetch(), projectsQuery.refetch()]);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function persistOrder(orderedOpenTasks: Task[]) {
    try {
      await Promise.all(
        orderedOpenTasks.map((item, index) =>
          api.tasks.update(item.id, {
            sortOrder: index + 1,
          }),
        ),
      );
    } catch (err) {
      setError((err as Error).message);
      await refreshData();
    }
  }

  function reorderTasks(sourceId: string, targetId: string) {
    setTasks((current) => {
      const open = sortTasks(current.filter((item) => !item.checked && !item.isDeleted));
      const completed = current.filter((item) => item.checked || item.isDeleted);

      const sourceIndex = open.findIndex((item) => item.id === sourceId);
      const targetIndex = open.findIndex((item) => item.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return current;
      }

      const reordered = [...open];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const normalized = reordered.map((item, index) => ({
        ...item,
        sortOrder: index + 1,
      }));

      void persistOrder(normalized);
      return [...normalized, ...completed];
    });
  }

  return {
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
  };
}

export type HomeControllerState = ReturnType<typeof createHomeControllerState>;
