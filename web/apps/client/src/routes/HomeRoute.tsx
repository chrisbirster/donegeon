import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { useLocation, useNavigate } from "@solidjs/router";

import {
  parseApi,
  projectApi,
  rruleApi,
  taskApi,
  type Project,
  type QuickAddParsed,
  type Task,
} from "../server/api";

type TokenKind =
  | "project"
  | "label"
  | "assignee"
  | "priority"
  | "deadline"
  | "recurrence"
  | "due"
  | "text";

type TokenPiece = {
  value: string;
  kind: TokenKind;
};

const QUICK_ADD_TOKEN_PATTERN =
  /(\{[^{}]+\}|#[A-Za-z][A-Za-z0-9_-]*|@[A-Za-z][A-Za-z0-9_-]*|\+[A-Za-z][A-Za-z0-9_-]*|\bp[1-4]\b|\bevery\s+(?:\d+(?:st|nd|rd|th)?|one|two|three|four|five|six|seven|eight|nine|ten|other)\s+(?:day|days|week|weeks|month|months|year|years)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b|\bevery\s+(?:day|week|month|year)\b|\b(?:daily|every\s+day)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bevery\s+(?:weekday|weekdays|weekend|weekends|monday|mondays|tuesday|tuesdays|wednesday|wednesdays|thursday|thursdays|friday|fridays|saturday|saturdays|sunday|sundays)(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?\b|\b(?:weekdays|weekends|mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bbiweekly\b|\btwice\s+a\s+month\b|\bevery\s+month\s+on\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\b|\bon\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:each|every)\s+month\b|\b(?:first|second|third|fourth|last)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(?:each|every)\s+month\b|\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\b(?:on\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|week)\b|\bin\s+\d+\s+(?:day|days|week|weeks|month|months)\b|\b\d+\s+(?:day|days|week|weeks|month|months)\s+from\s+now\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b|\btomorrow\b)/gi;

const RECURRENCE_TOKEN_PATTERN =
  /^(?:every\b|daily\b|biweekly\b|twice\s+a\s+month\b|weekdays\s+at\b|weekends\s+at\b|mondays\s+at\b|tuesdays\s+at\b|wednesdays\s+at\b|thursdays\s+at\b|fridays\s+at\b|saturdays\s+at\b|sundays\s+at\b|first\b|second\b|third\b|fourth\b|last\b|on\s+(?:the\s+)?\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:each|every)\s+month\b)/i;

function classifyToken(value: string): TokenKind {
  if (value.startsWith("#")) return "project";
  if (value.startsWith("@")) return "label";
  if (value.startsWith("+")) return "assignee";
  if (/^p[1-4]$/i.test(value)) return "priority";
  if (value.startsWith("{") && value.endsWith("}")) return "deadline";
  if (RECURRENCE_TOKEN_PATTERN.test(value)) return "recurrence";
  return "due";
}

function tokenizeQuickAdd(value: string): TokenPiece[] {
  if (value.length === 0) return [];

  const pieces: TokenPiece[] = [];
  let cursor = 0;

  QUICK_ADD_TOKEN_PATTERN.lastIndex = 0;
  for (let match = QUICK_ADD_TOKEN_PATTERN.exec(value); match !== null; match = QUICK_ADD_TOKEN_PATTERN.exec(value)) {
    const token = match[0];
    const start = match.index;
    const end = start + token.length;

    if (start > cursor) {
      pieces.push({
        value: value.slice(cursor, start),
        kind: "text",
      });
    }

    pieces.push({
      value: token,
      kind: classifyToken(token),
    });

    cursor = end;
  }

  if (cursor < value.length) {
    pieces.push({
      value: value.slice(cursor),
      kind: "text",
    });
  }

  return pieces;
}

function tokenClass(kind: TokenKind): string {
  switch (kind) {
    case "project":
      return "text-[#ffd2d2] bg-[#7f1d1d]";
    case "label":
      return "text-[#ffdff5] bg-[#6b214d]";
    case "assignee":
      return "text-[#fbe2ff] bg-[#5b2470]";
    case "priority":
      return "text-[#ffe5d5] bg-[#9a3412]";
    case "deadline":
      return "text-[#e3dcff] bg-[#4338ca]";
    case "recurrence":
      return "text-[#d8ffd4] bg-[#14532d]";
    case "due":
      return "text-[#ffe6cc] bg-[#92400e]";
    default:
      return "text-[var(--text-main)]";
  }
}

function addChip(value: string | undefined, label: string): string | null {
  if (!value || !value.trim()) return null;
  return `${label}: ${value}`;
}

function sortTasks(list: Task[]): Task[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.content.localeCompare(b.content));
}

function prettifyLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

type TaskView = "inbox" | "today" | "upcomming" | "project";

type ViewState = {
  kind: TaskView;
  projectId?: string;
};

function parseTaskView(pathname: string): ViewState {
  const clean = pathname.replace(/^\/+|\/+$/g, "");
  const parts = clean.length > 0 ? clean.split("/") : [];

  if (parts.length < 2 || parts[0] !== "task") {
    return { kind: "inbox" };
  }

  const view = parts[1]?.toLowerCase() ?? "";
  if (view === "today") {
    return { kind: "today" };
  }
  if (view === "upcomming" || view === "upcoming") {
    return { kind: "upcomming" };
  }
  if (view === "project" && parts[2]) {
    return { kind: "project", projectId: decodeURIComponent(parts[2]) };
  }
  return { kind: "inbox" };
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDays(date: Date, days: number): Date {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

function parseTaskDateValue(value: string | undefined): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();

  const today = startOfLocalDay(new Date());
  if (lower === "today") return today;
  if (lower === "tomorrow") return shiftDays(today, 1);

  const inDays = /^in\s+(\d+)\s+days?$/.exec(lower);
  if (inDays) {
    return shiftDays(today, Number(inDays[1]));
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (ymd) {
    return new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return startOfLocalDay(parsed);
}

function taskDueDate(task: Task): Date | null {
  return parseTaskDateValue(task.dueDeadline) ?? parseTaskDateValue(task.dueText);
}

export default function HomeRoute() {
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
  const [detailRecurrence, setDetailRecurrence] = createSignal("");
  const [detailRecurrenceCanonical, setDetailRecurrenceCanonical] = createSignal("");
  const [detailRecurrenceError, setDetailRecurrenceError] = createSignal("");

  let mainInputRef: HTMLInputElement | undefined;
  let parseTimer: number | undefined;
  let searchInputRef: HTMLInputElement | undefined;
  let globalKeyHandler: ((event: KeyboardEvent) => void) | undefined;
  let lastParsedText = "";

  const inputTokens = createMemo(() => tokenizeQuickAdd(content()));
  const currentView = createMemo(() => parseTaskView(location.pathname));

  const projectMap = createMemo(() => {
    const byID = new Map<string, Project>();
    for (const project of projects()) {
      byID.set(project.id, project);
    }
    return byID;
  });

  const openTasks = createMemo(() =>
    sortTasks(tasks().filter((task) => !task.checked && !task.isDeleted)),
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
    projects()
      .filter((project) => project.isFavorite && !project.isArchived)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  const sidebarProjects = createMemo(() =>
    projects()
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

  const visibleTasks = createMemo(() => {
    const view = currentView();
    if (view.kind === "today") {
      const today = startOfLocalDay(new Date());
      return openTasks().filter((task) => {
        const due = taskDueDate(task);
        return due?.getTime() === today.getTime();
      });
    }
    if (view.kind === "upcomming") {
      const today = startOfLocalDay(new Date());
      return openTasks().filter((task) => {
        const due = taskDueDate(task);
        return !!due && due.getTime() > today.getTime();
      });
    }
    if (view.kind === "project") {
      const projectID = view.projectId?.trim();
      if (!projectID) return [] as Task[];
      return openTasks().filter((task) => task.projectId?.trim() === projectID);
    }
    return openTasks().filter((task) => isInboxTask(task));
  });

  const detailTask = createMemo(() => {
    const id = detailTaskId();
    if (!id) return null;
    return tasks().find((task) => task.id === id) ?? null;
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

    const dueText = addChip(parsed.dueText, "Due");
    if (dueText) chips.push(dueText);

    const deadline = addChip(parsed.deadline, "Deadline");
    if (deadline) chips.push(deadline);

    const recurrence = addChip(parsed.recurrenceRule, "Recurrence");
    if (recurrence) chips.push(recurrence);

    return chips;
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

  function projectNameByID(projectID?: string): string | null {
    const id = projectID?.trim();
    if (!id) return null;
    return projectMap().get(id)?.name ?? prettifyLabel(id);
  }

  async function refreshData() {
    try {
      const [taskList, projectList] = await Promise.all([taskApi.list(), projectApi.list()]);
      setTasks(sortTasks(taskList.items));
      setProjects(projectList.items);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function persistOrder(orderedOpenTasks: Task[]) {
    try {
      await Promise.all(
        orderedOpenTasks.map((item, index) =>
          taskApi.update(item.id, {
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
      const updated = await projectApi.update(project.id, {
        name: project.name,
        isFavorite: !project.isFavorite,
      });
      setProjects((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setError("");
    } catch (err) {
      setError((err as Error).message);
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
    if (!trimmed) {
      setParsedInput(null);
      lastParsedText = "";
      return;
    }

    if (trimmed === lastParsedText) {
      return;
    }
    lastParsedText = trimmed;

    try {
      const parsed = await parseApi.quickAdd(trimmed);
      setParsedInput(parsed.parsed);
    } catch {
      setParsedInput(null);
    }
  }

  function onMainInput(value: string) {
    setContent(value);

    if (parseTimer !== undefined) {
      window.clearTimeout(parseTimer);
    }

    parseTimer = window.setTimeout(() => {
      void parseMainInput(value);
    }, 260);
  }

  async function addTask(e: SubmitEvent) {
    e.preventDefault();
    const text = content().trim();
    if (!text) return;

    try {
      await taskApi.quickAdd(text);
      setContent("");
      setParsedInput(null);
      lastParsedText = "";
      setError("");
      await refreshData();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function completeTask(item: Task) {
    try {
      await taskApi.close(item.id);
      setTasks((current) =>
        current.map((task) =>
          task.id === item.id
            ? {
                ...task,
                checked: true,
              }
            : task,
        ),
      );
      if (detailTaskId() === item.id) {
        closeDetailModal();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function removeTask(item: Task) {
    try {
      await taskApi.remove(item.id);
      setTasks((current) => current.filter((task) => task.id !== item.id));
      if (detailTaskId() === item.id) {
        closeDetailModal();
      }
    } catch (err) {
      setError((err as Error).message);
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
    const nextContent = editingContent().trim();
    if (!nextContent) {
      setError("Task content cannot be empty");
      return;
    }

    try {
      const updated = await taskApi.update(taskId, { content: nextContent });
      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updated : task)),
      );
      cancelInlineEdit();
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function openDetailModal(item: Task) {
    setDetailTaskId(item.id);
    setDetailContent(item.content);
    setDetailDescription(item.description || "");
    setDetailPriority(item.priority || 4);
    setDetailDueText(item.dueText || "");
    setDetailDeadline(item.dueDeadline || "");
    setDetailProjectId(item.projectId || "");
    setDetailRecurrence(item.recurrenceRule || "");
    setDetailRecurrenceCanonical(item.recurrenceRule || "");
    setDetailRecurrenceError("");
    setIsDetailOpen(true);
  }

  function closeDetailModal() {
    setIsDetailOpen(false);
    setDetailTaskId(null);
  }

  async function saveDetailModal() {
    const taskId = detailTaskId();
    if (!taskId) return;

    const nextContent = detailContent().trim();
    if (!nextContent) {
      setError("Task content cannot be empty");
      return;
    }

    try {
      const updated = await taskApi.update(taskId, {
        content: nextContent,
        description: detailDescription(),
        projectId: detailProjectId(),
        recurrenceRule: detailRecurrence().trim() || undefined,
        priority: detailPriority(),
        dueText: detailDueText(),
        dueDeadline: detailDeadline(),
      });

      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updated : task)),
      );
      setError("");
      setDetailRecurrenceError("");
      closeDetailModal();
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      if (message.toLowerCase().includes("rrule") || message.toLowerCase().includes("recurrence")) {
        setDetailRecurrenceError(message);
      }
    }
  }

  async function parseDetailRecurrence() {
    const raw = detailRecurrence().trim();
    if (!raw) {
      setDetailRecurrenceCanonical("");
      setDetailRecurrenceError("");
      return;
    }

    try {
      const parsed = await rruleApi.parse(raw);
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
    if (globalKeyHandler) {
      window.removeEventListener("keydown", globalKeyHandler);
    }
  });

  onMount(() => {
    void refreshData();
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
    <main class="h-screen overflow-hidden p-4 md:p-6">
      <div class="mx-auto grid h-full min-h-0 max-w-7xl grid-cols-1 gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
        <aside class="h-full min-h-0 overflow-y-auto rounded-3xl border border-[#273248] bg-[linear-gradient(180deg,#101a2c,#0d1523)] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div class="flex h-full min-h-0 flex-col">
            <div class="flex items-center justify-between">
              <h1 class="text-lg font-semibold tracking-tight text-[var(--text-main)]">Tasks</h1>
              <button
                type="button"
                class="rounded-lg border border-[#334660] px-3 py-1.5 text-sm text-[#d7e4ff] transition hover:border-[var(--accent)]"
                onClick={focusComposer}
              >
                Add Task
              </button>
            </div>

            <nav class="mt-4 space-y-1">
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-[#17243a]"
                onClick={openSearchModal}
              >
                <span class="flex items-center gap-2 text-[var(--text-main)]">
                  <span class="text-[#9fb2d3]">⌕</span>
                  <span>Search</span>
                </span>
                <span class="text-xs text-[var(--text-dim)]">⌘K</span>
              </button>

              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  isViewActive("inbox")
                    ? "bg-[#5c2525]/65 text-[#ef8680]"
                    : "text-[var(--text-main)] hover:bg-[#17243a]"
                }`}
                onClick={() => navigateToView("inbox")}
              >
                <span class="flex items-center gap-2">
                  <span class={isViewActive("inbox") ? "text-[#f5b7b1]" : "text-[#9fb2d3]"}>▱</span>
                  <span>Inbox</span>
                </span>
                <span class="text-xs text-[var(--text-dim)]">{inboxCount()}</span>
              </button>

              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  isViewActive("today")
                    ? "bg-[#5c2525]/65 text-[#ef8680]"
                    : "text-[var(--text-main)] hover:bg-[#17243a]"
                }`}
                onClick={() => navigateToView("today")}
              >
                <span class="flex items-center gap-2">
                  <span class={isViewActive("today") ? "text-[#f5b7b1]" : "text-[#9fb2d3]"}>◫</span>
                  <span>Today</span>
                </span>
                <span class="text-xs text-[var(--text-dim)]">{todayCount()}</span>
              </button>

              <button
                type="button"
                class={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                  isViewActive("upcomming")
                    ? "bg-[#5c2525]/65 text-[#ef8680]"
                    : "text-[var(--text-main)] hover:bg-[#17243a]"
                }`}
                onClick={() => navigateToView("upcomming")}
              >
                <span class="flex items-center gap-2">
                  <span class={isViewActive("upcomming") ? "text-[#f5b7b1]" : "text-[#9fb2d3]"}>☷</span>
                  <span>Upcomming</span>
                </span>
                <span class="text-xs text-[var(--text-dim)]">{upcomingCount()}</span>
              </button>
            </nav>

            <div class="mt-6">
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
                        class={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                          isProjectActive(project.id)
                            ? "bg-[#5c2525]/65 text-[#ef8680]"
                            : "text-[var(--text-main)] hover:bg-[#17243a]"
                        }`}
                        onClick={() => navigateToProject(project.id)}
                      >
                        <span class="flex min-w-0 items-center gap-2">
                          <span class="text-[#ffd89c]">★</span>
                          <span class="truncate">{project.name}</span>
                        </span>
                        <span class="text-xs text-[var(--text-dim)]">{openTaskCountByProjectID().get(project.id) ?? 0}</span>
                      </button>
                    )}
                  </For>
                </Show>
              </div>
            </div>

            <div class="mt-6 min-h-0 flex-1">
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
                            isProjectActive(project.id)
                              ? "bg-[#5c2525]/65 text-[#ef8680]"
                              : "text-[var(--text-main)] hover:bg-[#17243a]"
                          }`}
                          onClick={() => navigateToProject(project.id)}
                        >
                          <span class="flex items-center justify-between">
                            <span class="truncate">{project.name}</span>
                            <span class="ml-3 text-xs text-[var(--text-dim)]">{openTaskCountByProjectID().get(project.id) ?? 0}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          class={`rounded-lg border px-2 py-1 text-xs transition ${
                            project.isFavorite
                              ? "border-[#ffbf69] bg-[#3a2a0d] text-[#ffd89c]"
                              : "border-[#334660] text-[#9fb2d3] hover:border-[#ffbf69] hover:text-[#ffd89c]"
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
        </aside>

        <section class="flex h-full min-h-0 flex-col rounded-3xl border border-[#273248] bg-[linear-gradient(180deg,#101a2c,#0c1423)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
          <div class="mb-6 flex items-center justify-between">
            <h2 class="text-4xl font-semibold tracking-tight">{viewTitle()}</h2>
            <span class="text-sm text-[var(--text-dim)]">{visibleTasks().length} task(s)</span>
          </div>

          <form onSubmit={addTask} class="mb-5">
            <div class="relative">
              <div class="pointer-events-none absolute inset-0 overflow-hidden rounded-xl border border-[#2f3f5d] bg-[#0d1523] px-3 py-2 text-xl leading-normal tracking-normal whitespace-pre text-[var(--text-main)] [font-variant-ligatures:none]">
                <Show when={content().length > 0} fallback={<span class="text-[var(--text-dim)]">Add task</span>}>
                  <For each={inputTokens()}>
                    {(token) => (
                      <span class={token.kind === "text" ? "" : `rounded-[4px] ${tokenClass(token.kind)}`}>
                        {token.value}
                      </span>
                    )}
                  </For>
                </Show>
              </div>

              <input
                ref={mainInputRef}
                value={content()}
                onInput={(e) => onMainInput(e.currentTarget.value)}
                class="relative w-full rounded-xl border border-[#2f3f5d] bg-transparent px-3 py-2 text-xl leading-normal tracking-normal text-transparent caret-[var(--text-main)] outline-none [font-variant-ligatures:none] focus:border-[var(--accent)]"
                aria-label="Add task"
                spellcheck={false}
                autocomplete="off"
              />
            </div>

            <Show when={parsedChips().length > 0}>
              <div class="mt-3 flex flex-wrap gap-2">
                <For each={parsedChips()}>
                  {(chip) => (
                    <span class="rounded-lg border border-[#3a4d70] bg-[#121f34] px-2 py-1 text-xs text-[var(--text-main)]">
                      {chip}
                    </span>
                  )}
                </For>
              </div>
            </Show>

            <div class="mt-3 flex justify-end">
              <button
                type="submit"
                class="rounded-xl bg-[var(--accent)] px-4 py-2 font-medium text-[#1e0f08] transition hover:bg-[var(--accent-soft)]"
              >
                Add
              </button>
            </div>
          </form>

          <Show when={error()}>
            <p class="mb-4 rounded-lg border border-[#5d2f2f] bg-[#2a1111] px-3 py-2 text-sm text-[#ffb5b5]">{error()}</p>
          </Show>

          <div class="min-h-0 flex-1 overflow-y-auto pr-1">
            <Show
              when={visibleTasks().length > 0}
              fallback={<p class="rounded-xl border border-[#23314c] bg-[#101a2c] px-4 py-6 text-sm text-[var(--text-dim)]">No open tasks in this view.</p>}
            >
              <ul class="space-y-2">
                <For each={visibleTasks()}>
                  {(item) => (
                    <li
                      class={`group flex items-center gap-3 rounded-xl border bg-[#0f192b] px-3 py-3 transition ${
                        dropTargetId() === item.id ? "border-[var(--accent)]" : "border-[#24314a] hover:border-[#2d3f5f]"
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
                        draggable={true}
                        class={`cursor-grab select-none rounded px-1 text-[#91a4c6] transition hover:bg-[#1e2b43] hover:text-white ${
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
                        class="h-5 w-5 rounded-full border border-[#4b6da5] bg-transparent transition hover:border-[var(--accent)]"
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
                              <p class="truncate text-sm text-[var(--text-main)]">{item.content}</p>
                              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                                <Show when={item.dueText}>
                                  <span class="rounded-md bg-[#463312] px-2 py-0.5 text-[#ffd89c]">Due {item.dueText}</span>
                                </Show>
                                <Show when={item.dueDeadline}>
                                  <span class="rounded-md bg-[#2d2c67] px-2 py-0.5 text-[#d8d6ff]">Deadline {item.dueDeadline}</span>
                                </Show>
                                <Show when={projectNameByID(item.projectId)}>
                                  {(projectName) => (
                                    <span class="rounded-md bg-[#2f243b] px-2 py-0.5 text-[#e9cbff]">#{projectName()}</span>
                                  )}
                                </Show>
                                <Show when={item.recurrenceRule}>
                                  <span class="rounded-md bg-[#163328] px-2 py-0.5 text-[#b3f2d5]">↻ recurring</span>
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
                              class="w-full rounded-lg border border-[#3d537b] bg-[#101d30] px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
                              autofocus
                            />
                            <button
                              type="button"
                              class="rounded-md bg-[#2a3a56] px-2 py-1 text-xs text-white"
                              onClick={() => void saveInlineEdit(item.id)}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              class="rounded-md bg-[#28303d] px-2 py-1 text-xs text-[#d7d9dd]"
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
                            ? "bg-[#5f201a] text-[#ffcbc2]"
                            : "bg-[#1e2a43] text-[#b5c4df]"
                        }`}
                      >
                        p{item.priority}
                      </span>

                      <div class="ml-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          class="rounded-md border border-[#334660] bg-[#101b2d] px-2 py-1 text-xs text-[#d7e4ff] hover:border-[var(--accent)]"
                          aria-label="Edit inline"
                          onClick={(event) => {
                            event.stopPropagation();
                            beginInlineEdit(item);
                          }}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          class="rounded-md border border-[#334660] bg-[#101b2d] px-2 py-1 text-xs text-[#d7e4ff] hover:border-[var(--accent)]"
                          aria-label="Open details"
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetailModal(item);
                          }}
                        >
                          Open
                        </button>
                        <button
                          type="button"
                          class="rounded-md border border-[#5b2f2f] bg-[#2a1616] px-2 py-1 text-xs text-[#ffbeb7] hover:border-[#ff6a4a]"
                          aria-label="Delete task"
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
          </div>
        </section>
      </div>

      <Show when={isSearchOpen()}>
        <div
          class="fixed inset-0 z-40 flex items-start justify-center bg-black/55 p-4 pt-20 backdrop-blur-sm"
          onClick={closeSearchModal}
        >
          <div
            class="w-full max-w-2xl rounded-2xl border border-[#29354c] bg-[#111a2a] shadow-[0_25px_70px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="border-b border-[#24314a] px-4 py-3">
              <input
                ref={searchInputRef}
                value={searchText()}
                onInput={(event) => setSearchText(event.currentTarget.value)}
                placeholder="Search tasks, descriptions, projects..."
                class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
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
                          class="w-full rounded-lg border border-transparent px-3 py-2 text-left transition hover:border-[#2d3f5f] hover:bg-[#0f192b]"
                          onClick={() => {
                            closeSearchModal();
                            openDetailModal(item);
                          }}
                        >
                          <p class="truncate text-sm text-[var(--text-main)]">{item.content}</p>
                          <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-dim)]">
                            <Show when={projectNameByID(item.projectId)}>
                              {(projectName) => (
                                <span class="rounded-md bg-[#2f243b] px-2 py-0.5 text-[#e9cbff]">#{projectName()}</span>
                              )}
                            </Show>
                            <Show when={item.dueText}>
                              <span class="rounded-md bg-[#463312] px-2 py-0.5 text-[#ffd89c]">Due {item.dueText}</span>
                            </Show>
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
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={closeDetailModal}
        >
          <div
            class="w-full max-w-4xl rounded-2xl border border-[#29354c] bg-[#121824] shadow-[0_30px_100px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div class="flex items-center justify-between border-b border-[#27344d] px-6 py-4">
              <p class="text-sm uppercase tracking-wider text-[var(--text-dim)]">Task Detail</p>
              <button
                type="button"
                class="rounded-md border border-[#344764] px-3 py-1 text-sm text-[#d2e3ff] hover:border-[var(--accent)]"
                onClick={closeDetailModal}
              >
                Close
              </button>
            </div>

            <div class="grid gap-0 md:grid-cols-[1.2fr_0.8fr]">
              <div class="space-y-4 p-6">
                <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Task</label>
                <input
                  value={detailContent()}
                  onInput={(event) => setDetailContent(event.currentTarget.value)}
                  class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-lg outline-none focus:border-[var(--accent)]"
                />

                <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Description</label>
                <textarea
                  value={detailDescription()}
                  onInput={(event) => setDetailDescription(event.currentTarget.value)}
                  class="h-40 w-full resize-none rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div class="border-t border-[#27344d] p-6 md:border-l md:border-t-0">
                <div class="space-y-4">
                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Project</label>
                  <input
                    value={detailProjectId()}
                    onInput={(event) => setDetailProjectId(event.currentTarget.value)}
                    list="project-options"
                    placeholder="project id"
                    class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <datalist id="project-options">
                    <For each={sidebarProjects()}>
                      {(project) => (
                        <option value={project.id}>{project.name}</option>
                      )}
                    </For>
                  </datalist>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Priority</label>
                  <select
                    value={detailPriority()}
                    onInput={(event) => setDetailPriority(Number(event.currentTarget.value))}
                    class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value={1}>P1</option>
                    <option value={2}>P2</option>
                    <option value={3}>P3</option>
                    <option value={4}>P4</option>
                  </select>

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Due</label>
                  <input
                    value={detailDueText()}
                    onInput={(event) => setDetailDueText(event.currentTarget.value)}
                    placeholder="tomorrow"
                    class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Deadline</label>
                  <input
                    value={detailDeadline()}
                    onInput={(event) => setDetailDeadline(event.currentTarget.value)}
                    placeholder="in 2 days"
                    class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />

                  <label class="block text-xs uppercase tracking-wider text-[var(--text-dim)]">Recurrence (RRULE)</label>
                  <input
                    value={detailRecurrence()}
                    onInput={(event) => setDetailRecurrence(event.currentTarget.value)}
                    placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
                    class="w-full rounded-lg border border-[#354968] bg-[#0f1728] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <button
                    type="button"
                    class="rounded-lg border border-[#3a4d6d] bg-[#172033] px-3 py-2 text-xs text-[#d8e6ff] hover:border-[var(--accent)]"
                    onClick={() => void parseDetailRecurrence()}
                  >
                    Parse RRULE
                  </button>
                  <Show when={detailRecurrenceError()}>
                    <p class="rounded-md border border-[#5d2f2f] bg-[#2a1111] px-2 py-1 text-xs text-[#ffb5b5]">
                      {detailRecurrenceError()}
                    </p>
                  </Show>
                  <Show when={detailRecurrenceCanonical()}>
                    <p class="rounded-md border border-[#2d4b37] bg-[#102419] px-2 py-1 text-xs text-[#b4efce]">
                      {detailRecurrenceCanonical()}
                    </p>
                  </Show>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between border-t border-[#27344d] px-6 py-4">
              <button
                type="button"
                class="rounded-lg border border-[#3a4d6d] bg-[#172033] px-3 py-2 text-sm text-[#d8e6ff] hover:border-[var(--accent)]"
                onClick={() => {
                  const task = detailTask();
                  if (task) {
                    void completeTask(task);
                  }
                }}
              >
                Mark done
              </button>
              <button
                type="button"
                class="rounded-lg bg-[var(--accent)] px-4 py-2 font-medium text-[#1e0f08] hover:bg-[var(--accent-soft)]"
                onClick={() => void saveDetailModal()}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </Show>
    </main>
  );
}
