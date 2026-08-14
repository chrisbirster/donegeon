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
} from "../features/tasks/home-rules";export function createHomeController() {
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

  let mainInputRef: HTMLInputElement | undefined;
  let parseTimer: number | undefined;
  let parseController: AbortController | undefined;
  let parseRequestSeq = 0;
  let searchInputRef: HTMLInputElement | undefined;
  let globalKeyHandler: ((event: KeyboardEvent) => void) | undefined;
  let lastParsedText = "";

  function setMainInputRef(element: HTMLInputElement) {
    mainInputRef = element;
  }

  function setSearchInputRef(element: HTMLInputElement) {
    searchInputRef = element;
  }

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

  function focusComposer() {
    mainInputRef?.focus();
  }

  function navigateToView(view: Exclude<TaskView, "project">) {
    navigate(`/task/${view}`);
  }

  function navigateToProject(projectID: string) {
    navigate(`/task/project/${encodeURIComponent(projectID)}`);
  }

  function openSearchModal() {
    setIsSearchOpen(true);
    window.setTimeout(() => searchInputRef?.focus(), 0);
  }

  function closeSearchModal() {
    setIsSearchOpen(false);
    setSearchText("");
  }

  async function toggleProjectFavorite(project: Project) {
    try {
      const updated = await api.projects.update(project.id, {
        name: project.name,
        isFavorite: !project.isFavorite,
      });
      setProjects((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setError("");
      toast.success(updated.isFavorite ? `Added ${updated.name} to favorites.` : `Removed ${updated.name} from favorites.`);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  function isViewActive(view: Exclude<TaskView, "project">): boolean {
    return currentView().kind === view;
  }

  function isProjectActive(projectID: string): boolean {
    const view = currentView();
    return view.kind === "project" && view.projectId === projectID;
  }

  async function parseMainInput(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      setParsedInput(null);
      lastParsedText = "";
      parseRequestSeq += 1;
      parseController?.abort();
      parseController = undefined;
      return;
    }

    if (trimmed === lastParsedText) {
      return;
    }
    lastParsedText = trimmed;
    parseRequestSeq += 1;
    const requestSeq = parseRequestSeq;
    parseController?.abort();
    const controller = new AbortController();
    parseController = controller;

    try {
      const parsed = await api.parse.quickAdd(trimmed, { signal: controller.signal });
      if (requestSeq !== parseRequestSeq) return;
      setParsedInput(parsed.parsed);
    } catch (err) {
      if (isAbortError(err) || requestSeq !== parseRequestSeq) return;
      setParsedInput(null);
    } finally {
      if (requestSeq === parseRequestSeq) {
        parseController = undefined;
      }
    }
  }

  function onMainInput(value: string) {
    setContent(value);

    if (parseTimer !== undefined) {
      window.clearTimeout(parseTimer);
    }

    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      lastParsedText = "";
      parseRequestSeq += 1;
      parseController?.abort();
      parseController = undefined;
      setParsedInput(null);
      return;
    }

    parseTimer = window.setTimeout(() => {
      void parseMainInput(value);
    }, 350);
  }

  async function parseTaskTitleInput(value: string): Promise<QuickAddParsed | null> {
    const trimmed = value.trim();
    if (!trimmed || !shouldPreviewQuickAdd(trimmed)) {
      return null;
    }

    const parsed = await api.parse.quickAdd(trimmed);
    return parsed.parsed;
  }

  function hasParsedSchedule(parsed: QuickAddParsed | null): boolean {
    return !!(parsed?.recurrenceRule || parsed?.dueText || parsed?.deadline);
  }

  async function addTask(e: SubmitEvent) {
    e.preventDefault();
    const text = content().trim();
    if (!text) return;
    let quickAddText = text;

    const view = currentView();
    if (view.kind === "project" && !hasExplicitProjectToken(text)) {
      const selected = view.projectId ? projectMap().get(view.projectId) : undefined;
      const alias = selected ? projectQuickAddAlias(selected) : projectAliasFromProjectID(view.projectId);
      if (alias) {
        quickAddText = `${text} #${alias}`;
      }
    }

    try {
      await api.tasks.quickAdd(quickAddText);
      setContent("");
      setParsedInput(null);
      lastParsedText = "";
      parseRequestSeq += 1;
      parseController?.abort();
      parseController = undefined;
      setError("");
      await refreshData();
      toast.success("Task added.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  async function completeTask(item: Task) {
    try {
      await api.tasks.close(item.id);
      await refreshData();
      if (detailTaskId() === item.id) {
        closeDetailModal();
      }
      toast.success("Task completed.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  async function reopenTask(item: Task) {
    try {
      await api.tasks.reopen(item.id);
      await refreshData();
      if (detailTaskId() === item.id) {
        closeDetailModal();
      }
      toast.info("Task reopened.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  async function removeTask(item: Task) {
    try {
      await api.tasks.remove(item.id);
      setTasks((current) => current.filter((task) => task.id !== item.id));
      if (detailTaskId() === item.id) {
        closeDetailModal();
      }
      toast.info("Task deleted.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  function beginInlineEdit(item: Task) {
    setEditingTaskId(item.id);
    setEditingContent(item.content);
  }

  function cancelInlineEdit() {
    setEditingTaskId(null);
    setEditingContent("");
  }

  async function saveInlineEdit(taskId: string) {
    const rawContent = editingContent().trim();

    try {
      const parsed = await parseTaskTitleInput(rawContent);
      const nextContent = (parsed?.content ?? rawContent).trim();
      if (!nextContent) {
        setError("Task content cannot be empty");
        toast.error("Task content cannot be empty");
        return;
      }
      const currentTask = tasks().find((task) => task.id === taskId);
      const parsedProjectID = parsed?.project ? await resolveProjectIDForDetail(parsed.project) : undefined;
      const updated = await api.tasks.update(taskId, {
        content: nextContent,
        description: parsed?.description || undefined,
        projectId: parsedProjectID,
        labels: parsed?.labels.length ? mergeNormalizedLabels(currentTask?.labels, parsed.labels) : undefined,
        recurrenceRule: parsed?.recurrenceRule,
        scheduleInput: hasParsedSchedule(parsed) ? rawContent : undefined,
        priority: parsed?.priority,
        dueText: parsed?.dueText,
        dueDeadline: parsed?.deadline,
      });
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updated : task)),
      );
      cancelInlineEdit();
      setError("");
      toast.success("Task updated.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    }
  }

  async function loadDetailActivationPreview(taskId: string, projectID?: string) {
    if (!taskId) return;
    const boardID = boardIDForProject(projectID);
    if (!boardID) return;
    setDetailActivationLoading(true);
    setDetailActivationError("");
    try {
      const response = await api.board.command({
        cmd: "task.activate",
        args: {
          taskId,
          preview: true,
        },
      }, boardID);
      if (detailTaskId() !== taskId) return;
      const preview = parseTaskActivationPreview(response.patch);
      if (!preview) {
        setDetailActivationPreview(null);
        setDetailActivationError("Unable to read activation requirements.");
        return;
      }
      setDetailActivationPreview(preview);
    } catch (err) {
      if (detailTaskId() !== taskId) return;
      setDetailActivationPreview(null);
      setDetailActivationError((err as Error).message);
    } finally {
      if (detailTaskId() === taskId) {
        setDetailActivationLoading(false);
      }
    }
  }

  async function makeDetailTaskLive() {
    const task = detailTask();
    if (!task) return;
    const boardID = boardIDForProject(task.projectId);
    if (!boardID) {
      setDetailActivationError("Task must be in the board project to activate.");
      toast.error("Task must be in the board project to activate.");
      return;
    }

    setDetailActivating(true);
    setDetailActivationError("");
    try {
      const response = await api.board.command({
        cmd: "task.activate",
        args: {
          taskId: task.id,
          preview: false,
        },
      }, boardID);
      const preview = parseTaskActivationPreview(response.patch);
      if (preview) {
        setDetailActivationPreview(preview);
        if (!preview.canActivate && !preview.alreadyLive) {
          setDetailActivationError("Not enough board requirements to activate this task.");
        }
      }
      await refreshData();
      setError("");
      toast.success("Task is now live on the board.");
    } catch (err) {
      const message = (err as Error).message;
      setDetailActivationError(message);
      toast.error(message);
    } finally {
      setDetailActivating(false);
    }
  }

  async function makeRowTaskLive(item: Task) {
    const boardID = boardIDForProject(item.projectId);
    if (!boardID) {
      setError("Task must be in a board project to activate.");
      toast.error("Task must be in a board project to activate.");
      return;
    }

    setRowActivatingTaskID(item.id);
    try {
      await api.board.command({
        cmd: "task.activate",
        args: {
          taskId: item.id,
          preview: false,
        },
      }, boardID);
      await refreshData();
      setError("");
      toast.success("Task is now live on the board.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setRowActivatingTaskID(null);
    }
  }

  function openDetailModal(item: Task) {
    const detailProject = projectNameByID(item.projectId) ?? item.projectId ?? "";
    setDetailTaskId(item.id);
    setDetailContent(item.content);
    setDetailDescription(item.description || "");
    setDetailPriority(item.priority || 4);
    setDetailDueText(item.dueText || "");
    setDetailDeadline(item.dueDeadline || "");
    setDetailProjectId(detailProject);
    setDetailTags(formatLabelsInput(item.labels));
    setDetailScheduleOriginal(item.scheduleInput || "");
    setDetailRecurrence(item.recurrenceRule || "");
    setDetailRecurrenceCanonical(item.recurrenceRule || "");
    setDetailRecurrenceError("");
    setDetailActivationPreview(null);
    setDetailActivationError("");
    setDetailActivationLoading(false);
    setDetailActivating(false);
    setDetailNewProjectName(null);
    setIsDetailOpen(true);
    if (isBoardProject(item.projectId)) {
      void loadDetailActivationPreview(item.id, item.projectId);
    }
  }

  function closeDetailModal() {
    setIsDetailOpen(false);
    setDetailTaskId(null);
    setDetailActivationPreview(null);
    setDetailActivationError("");
    setDetailActivationLoading(false);
    setDetailActivating(false);
  }

  function projectByRef(value: string): Project | undefined {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    return projects().find((project) =>
      project.id.toLowerCase() === normalized || project.name.toLowerCase() === normalized,
    );
  }

  function nextProjectID(baseName: string): string {
    const existing = new Set(projects().map((project) => project.id.toLowerCase()));
    const base = slugifyProjectID(baseName);
    if (!existing.has(base)) return base;

    let index = 2;
    while (existing.has(`${base}-${index}`)) {
      index += 1;
    }
    return `${base}-${index}`;
  }

  async function resolveProjectIDForDetail(value: string): Promise<string | undefined> {
    const raw = value.trim();
    if (!raw) return undefined;

    const existing = projectByRef(raw);
    if (existing) {
      return existing.id;
    }

    const created = await api.projects.update(nextProjectID(raw), { name: raw });
    setProjects((current) => {
      const withoutCreated = current.filter((item) => item.id !== created.id);
      return [...withoutCreated, created];
    });
    return created.id;
  }

  async function createAndAssignDetailProject(rawName: string) {
    const taskId = detailTaskId();
    const name = rawName.trim();
    if (!taskId || !name || detailProjectAssigning()) {
      return;
    }

    setDetailProjectAssigning(true);
    setError("");

    try {
      const projectID = await resolveProjectIDForDetail(name);
      if (!projectID) {
        throw new Error("Project name cannot be empty");
      }

      const updated = await api.tasks.update(taskId, { projectId: projectID });
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updated : task)),
      );

      const assignedProject = projectMap().get(projectID);
      setDetailProjectId(assignedProject?.name ?? name);
      setDetailNewProjectName(null);
      if (isBoardProject(projectID)) {
        void loadDetailActivationPreview(taskId, projectID);
      } else {
        setDetailActivationPreview(null);
        setDetailActivationError("");
        setDetailActivationLoading(false);
      }
      toast.success(`Project "${assignedProject?.name ?? name}" assigned to task.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to assign project";
      setError(message);
      toast.error(message);
    } finally {
      setDetailProjectAssigning(false);
    }
  }

  async function saveDetailModal() {
    const taskId = detailTaskId();
    if (!taskId) return;

    const rawContent = detailContent().trim();

    try {
      const parsed = await parseTaskTitleInput(rawContent);
      const nextContent = (parsed?.content ?? rawContent).trim();
      if (!nextContent) {
        setError("Task content cannot be empty");
        toast.error("Task content cannot be empty");
        return;
      }
      const existingTask = detailTask();
      const resolvedProjectID = await resolveProjectIDForDetail(parsed?.project ?? detailProjectId());
      let labels = mergeNormalizedLabels(
        parseLabelsInput(detailTags()).filter((label) => !isBoardLiveLabel(label)),
        parsed?.labels,
      ).filter((label) => !isBoardLiveLabel(label));
      const shouldKeepBoardLive =
        isBoardProject(resolvedProjectID) &&
        (isBoardLiveTask(existingTask) || detailActivationPreview()?.alreadyLive === true);
      if (shouldKeepBoardLive && !labels.some((label) => isBoardLiveLabel(label))) {
        labels = [...labels, "board_live"];
      }
      const updated = await api.tasks.update(taskId, {
        content: nextContent,
        description: parsed?.description || detailDescription(),
        projectId: resolvedProjectID ?? "",
        labels,
        recurrenceRule: detailRecurrence().trim() || parsed?.recurrenceRule || undefined,
        scheduleInput: hasParsedSchedule(parsed) ? rawContent : undefined,
        priority: parsed?.priority ?? detailPriority(),
        dueText: detailDueText() || parsed?.dueText,
        dueDeadline: detailDeadline() || parsed?.deadline,
      });

      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updated : task)),
      );
      await refreshData();
      setError("");
      setDetailRecurrenceError("");
      closeDetailModal();
      toast.success("Task details saved.");
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      if (message.toLowerCase().includes("rrule") || message.toLowerCase().includes("recurrence")) {
        setDetailRecurrenceError(message);
      }
      toast.error(message);
    }
  }

  async function parseDetailRecurrence() {
    const recurrenceRaw = detailRecurrence().trim();
    if (!recurrenceRaw) {
      setDetailRecurrenceCanonical("");
      setDetailRecurrenceError("");
      return;
    }

    try {
      const parsed = await api.rrule.parse(recurrenceRaw);
      setDetailRecurrenceCanonical(parsed.canonical);
      setDetailRecurrenceError("");
      setError("");
    } catch (err) {
      setDetailRecurrenceCanonical("");
      setDetailRecurrenceError((err as Error).message);
    }
  }

  function onDragStart(event: DragEvent, taskId: string) {
    setDragTaskId(taskId);
    setDropTargetId(taskId);
    event.dataTransfer?.setData("text/plain", taskId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      const dragHandle = event.currentTarget as HTMLElement | null;
      const taskRow = dragHandle?.closest("li");
      if (taskRow) {
        const rect = taskRow.getBoundingClientRect();
        event.dataTransfer.setDragImage(taskRow, event.clientX - rect.left, event.clientY - rect.top);
      }
    }
  }

  function onDragOver(event: DragEvent, taskId: string) {
    event.preventDefault();
    setDropTargetId(taskId);
  }

  function onDrop(event: DragEvent, taskId: string) {
    event.preventDefault();
    const sourceId = dragTaskId() ?? event.dataTransfer?.getData("text/plain") ?? null;

    if (sourceId && sourceId !== taskId) {
      reorderTasks(sourceId, taskId);
    }

    setDragTaskId(null);
    setDropTargetId(null);
  }

  function onDragEnd() {
    setDragTaskId(null);
    setDropTargetId(null);
  }

  onCleanup(() => {
    if (parseTimer !== undefined) {
      window.clearTimeout(parseTimer);
    }
    parseController?.abort();
  });

  onSettled(() => {
    globalKeyHandler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "k") {
        event.preventDefault();
        openSearchModal();
        return;
      }
      if (key === "escape" && isSearchOpen()) {
        event.preventDefault();
        closeSearchModal();
      }
    };
    window.addEventListener("keydown", globalKeyHandler);
    return () => window.removeEventListener("keydown", globalKeyHandler!);
  });
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
  };
}

export type HomeController = ReturnType<typeof createHomeController>;
