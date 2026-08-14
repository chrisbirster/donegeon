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
} from "../features/tasks/home-rules";

export default function HomeRoute() {
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
    if (globalKeyHandler) {
      window.removeEventListener("keydown", globalKeyHandler);
    }
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
  });

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
              inputRef={(el) => {
                mainInputRef = el;
              }}
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
                ref={searchInputRef}
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
