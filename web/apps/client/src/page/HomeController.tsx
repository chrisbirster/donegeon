import { onCleanup, onSettled } from "solid-js";

import { type Project, type QuickAddParsed, type Task } from "../server/api";
import { mergeNormalizedLabels } from "../lib/quickAddLabels";
import { isAbortError, shouldPreviewQuickAdd } from "../lib/quickAddPreview";
import {
  formatLabelsInput,
  parseLabelsInput,
  slugifyProjectID,
  isBoardLiveLabel,
  isBoardLiveTask,
  isBoardProject,
  boardIDForProject,
  projectQuickAddAlias,
  hasExplicitProjectToken,
  projectAliasFromProjectID,
} from "../features/tasks/home-model";
import { parseTaskActivationPreview, type TaskView } from "../features/tasks/home-rules";
import { createHomeControllerState } from "./HomeControllerState";

export function createHomeController() {
  const state = createHomeControllerState();
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
  } = state;

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
    ...state,
    mainInputRef,
    setMainInputRef,
    parseTimer,
    parseController,
    parseRequestSeq,
    searchInputRef,
    setSearchInputRef,
    globalKeyHandler,
    lastParsedText,
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
