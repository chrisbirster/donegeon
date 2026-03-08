import { useLocation, useNavigate } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, onMount } from "solid-js";

import AppShell from "../components/AppShell";
import { useApi } from "../context/ApiContext";
import {
  type AuthSession,
  type BoardQuestHistoryEntry,
  type BoardQuestObjective,
  type BoardQuestRuntime,
  type BoardStateResponse,
  type CalendarConnection,
  type CalendarProvider,
  type Project,
} from "../server/api";

const DEFAULT_BOARD = "default";
const BOARD_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

type BoardChoice = {
  boardID: string;
  name: string;
  isTeamBoard: boolean;
};

type CompletedQuest = {
  id: string;
  title: string;
  type: string;
  scope: string;
  completed: boolean;
  claimed: boolean;
  claimable: boolean;
  failed: boolean;
  completedDay?: number;
  claimedDay?: number;
  source: "active" | "history";
};

function normalizeBoardID(raw: string | null | undefined): string {
  const normalized = (raw ?? "").trim();
  if (!normalized) return DEFAULT_BOARD;
  if (!BOARD_ID_PATTERN.test(normalized)) return DEFAULT_BOARD;
  return normalized;
}

function projectSlug(value: string | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return normalized.includes("::") ? normalized.slice(normalized.lastIndexOf("::") + 2) : normalized;
}

function isBoardProject(projectID: string | undefined): boolean {
  const slug = projectSlug(projectID);
  return slug === "board" || slug.startsWith("board-");
}

function isTeamBoardProject(projectID: string | undefined): boolean {
  return projectSlug(projectID).startsWith("board-");
}

function boardIDForProject(projectID: string | undefined): string | undefined {
  const slug = projectSlug(projectID);
  if (!isBoardProject(slug)) return undefined;
  if (slug === "board") return DEFAULT_BOARD;
  return slug;
}

function boardChoicesFromProjects(projects: Project[], activeBoardID: string): BoardChoice[] {
  const byBoardID = new Map<string, BoardChoice>();
  byBoardID.set(DEFAULT_BOARD, {
    boardID: DEFAULT_BOARD,
    name: "Board",
    isTeamBoard: false,
  });

  for (const project of projects) {
    const boardID = boardIDForProject(project.id);
    if (!boardID) continue;
    const normalized = normalizeBoardID(boardID);
    const existing = byBoardID.get(normalized);
    if (existing) {
      if (existing.name === "Board" && project.name.trim()) {
        existing.name = project.name.trim();
      }
      existing.isTeamBoard = existing.isTeamBoard || isTeamBoardProject(project.id);
      continue;
    }
    byBoardID.set(normalized, {
      boardID: normalized,
      name: project.name.trim() || normalized,
      isTeamBoard: isTeamBoardProject(project.id),
    });
  }

  const active = normalizeBoardID(activeBoardID);
  if (!byBoardID.has(active)) {
    byBoardID.set(active, {
      boardID: active,
      name: active === DEFAULT_BOARD ? "Board" : active,
      isTeamBoard: active !== DEFAULT_BOARD,
    });
  }

  const choices = [...byBoardID.values()];
  choices.sort((a, b) => {
    if (a.boardID === DEFAULT_BOARD && b.boardID !== DEFAULT_BOARD) return -1;
    if (b.boardID === DEFAULT_BOARD && a.boardID !== DEFAULT_BOARD) return 1;
    return a.name.localeCompare(b.name);
  });
  return choices;
}

function profileHref(boardID: string): string {
  const normalized = normalizeBoardID(boardID);
  if (normalized === DEFAULT_BOARD) return "/profile";
  return `/profile?board=${encodeURIComponent(normalized)}`;
}

function boardIDFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return normalizeBoardID(params.get("board"));
}

function questTypeLabel(value: string): string {
  switch (value.trim().toLowerCase()) {
    case "daily":
      return "Daily";
    case "story":
      return "Story";
    case "seasonal":
      return "Seasonal";
    case "boss":
      return "Boss";
    case "failure":
      return "Failure";
    default:
      return value.trim() || "Quest";
  }
}

function questTypeBadgeClass(value: string): string {
  switch (value.trim().toLowerCase()) {
    case "boss":
      return "border-[#6d3f3f] bg-[#2c1718] text-[#ffb7b2]";
    case "story":
      return "border-[#52558d] bg-[#1d2250] text-[#d8dbff]";
    case "seasonal":
      return "border-[#49636e] bg-[#17333a] text-[#c4f1ff]";
    case "daily":
      return "border-[#4c6a4d] bg-[#17321d] text-[#c4f2cf]";
    default:
      return "border-[#425678] bg-[#1a263f] text-[#d3e2ff]";
  }
}

function humanizeToken(value: string): string {
  const normalized = value
    .trim()
    .replaceAll(".", " ")
    .replaceAll("_", " ");
  if (!normalized) return "Unknown";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function questObjectiveLabel(objective: BoardQuestObjective): string {
  const op = objective.op.trim().toLowerCase();
  const count = objective.count ?? objective.target ?? 1;
  switch (op) {
    case "complete_task":
      return `Complete ${count} task${count === 1 ? "" : "s"}`;
    case "create_task":
      return `Create ${count} task${count === 1 ? "" : "s"}`;
    case "assign_villager":
      return `Assign ${count} villager${count === 1 ? "" : "s"}`;
    case "open_deck":
      return objective.ref ? `Open ${humanizeToken(objective.ref)} ${count}x` : `Open a deck ${count}x`;
    case "attach_modifier":
      return `Attach ${count} modifier${count === 1 ? "" : "s"}`;
    case "clear_zombie":
      return `Clear ${count} zombie${count === 1 ? "" : "s"}`;
    case "keep_zombies_below":
      return `Keep zombies <= ${objective.target ?? objective.value ?? 0}`;
    case "reduce_backlog_to":
      return `Reduce backlog <= ${objective.target ?? objective.value ?? 0}`;
    case "process_inbox_count":
      return `Process inbox ${count}x`;
    default:
      return `${humanizeToken(objective.op)} ${count}x`;
  }
}

function questObjectiveProgressLabel(objective: BoardQuestObjective): string {
  const op = objective.op.trim().toLowerCase();
  if (op === "keep_zombies_below" || op === "reduce_backlog_to") {
    return `Now ${objective.current}`;
  }
  const target = objective.target > 0 ? objective.target : objective.count ?? objective.value ?? 1;
  const current = Math.max(0, objective.current);
  return `${Math.min(current, target)}/${target}`;
}

const profileDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatOptionalDate(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "Not set";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return profileDateTimeFormatter.format(parsed);
}

function calendarProviderLabel(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "google") return "Google Calendar";
  return provider;
}

export default function ProfileRoute() {
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();

  const [session, setSession] = createSignal<AuthSession | null>(null);
  const [projects, setProjects] = createSignal<Project[]>([]);
  const [boardState, setBoardState] = createSignal<BoardStateResponse | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [boardLoading, setBoardLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [calendarConnections, setCalendarConnections] = createSignal<CalendarConnection[]>([]);
  const [calendarLoading, setCalendarLoading] = createSignal(false);
  const [calendarConnectBusy, setCalendarConnectBusy] = createSignal<CalendarProvider | null>(null);
  const [calendarSyncBusyID, setCalendarSyncBusyID] = createSignal<string | null>(null);
  const [calendarDisconnectBusyID, setCalendarDisconnectBusyID] = createSignal<string | null>(null);
  const [calendarNotice, setCalendarNotice] = createSignal("");
  const [calendarError, setCalendarError] = createSignal("");

  const activeBoardID = createMemo(() => boardIDFromSearch(location.search));
  const boardChoices = createMemo(() => boardChoicesFromProjects(projects(), activeBoardID()));
  const activeBoardChoice = createMemo(
    () => boardChoices().find((choice) => choice.boardID === activeBoardID()) ?? null,
  );

  const questState = createMemo(() => boardState()?.meta?.quests);
  const inProgressQuests = createMemo(() =>
    (questState()?.active ?? []).filter((quest) => !quest.completed && !quest.failed),
  );

  const completedQuests = createMemo(() => {
    const byID = new Map<string, CompletedQuest>();

    for (const quest of questState()?.active ?? []) {
      if (!quest.completed && !quest.claimed && !quest.claimable && !quest.failed) continue;
      byID.set(quest.id, {
        id: quest.id,
        title: quest.title,
        type: quest.type,
        scope: quest.scope,
        completed: quest.completed,
        claimed: quest.claimed,
        claimable: quest.claimable,
        failed: quest.failed === true,
        completedDay: quest.completedDay,
        claimedDay: quest.claimedDay,
        source: "active",
      });
    }

    for (const item of questState()?.history ?? []) {
      if (!item.completed && !item.claimed && !item.failed) continue;
      if (byID.has(item.id)) continue;
      byID.set(item.id, {
        id: item.id,
        title: item.title,
        type: item.type,
        scope: item.scope,
        completed: item.completed,
        claimed: item.claimed,
        claimable: false,
        failed: item.failed === true,
        completedDay: item.completedDay,
        claimedDay: item.claimedDay,
        source: "history",
      });
    }

    return [...byID.values()].sort((a, b) => {
      const aDay = a.completedDay ?? a.claimedDay ?? 0;
      const bDay = b.completedDay ?? b.claimedDay ?? 0;
      if (aDay !== bDay) return bDay - aDay;
      return a.title.localeCompare(b.title);
    });
  });

  async function loadBase() {
    setLoading(true);
    setError("");
    try {
      const [sessionRes, projectRes, calendarRes] = await Promise.all([
        api.auth.me(),
        api.projects.list(),
        api.calendar.listConnections(),
      ]);
      setSession(sessionRes.session);
      setProjects(projectRes.items);
      setCalendarConnections(calendarRes.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function loadBoard(boardID: string) {
    setBoardLoading(true);
    try {
      const response = await api.board.getState(boardID);
      setBoardState(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board quests");
      setBoardState(null);
    } finally {
      setBoardLoading(false);
    }
  }

  async function reloadCalendarConnections() {
    setCalendarLoading(true);
    try {
      const response = await api.calendar.listConnections();
      setCalendarConnections(response.items);
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Failed to refresh calendar connections");
    } finally {
      setCalendarLoading(false);
    }
  }

  async function startCalendarConnect(provider: CalendarProvider) {
    setCalendarConnectBusy(provider);
    setCalendarError("");
    setCalendarNotice("");
    try {
      const response = await api.calendar.startConnect(provider);
      window.location.href = response.authUrl;
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Failed to start calendar connection");
    } finally {
      setCalendarConnectBusy(null);
    }
  }

  async function syncCalendar(connectionId?: string) {
    const key = connectionId?.trim() || "__all__";
    setCalendarSyncBusyID(key);
    setCalendarError("");
    setCalendarNotice("");
    try {
      const response = await api.calendar.sync(connectionId);
      const totalPulled = response.results.reduce((sum, item) => sum + item.pulled, 0);
      const withErrors = response.results.filter((item) => item.error && item.error.trim().length > 0);
      if (withErrors.length > 0) {
        setCalendarError(withErrors.map((item) => `${calendarProviderLabel(item.provider)}: ${item.error}`).join(" | "));
      }
      setCalendarNotice(
        `Calendar sync complete: ${response.results.length} connection${response.results.length === 1 ? "" : "s"}, ${totalPulled} upcoming event${totalPulled === 1 ? "" : "s"} fetched.`,
      );
      await reloadCalendarConnections();
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Failed to sync calendars");
    } finally {
      setCalendarSyncBusyID(null);
    }
  }

  async function disconnectCalendar(connectionId: string) {
    const id = connectionId.trim();
    if (!id) return;
    setCalendarDisconnectBusyID(id);
    setCalendarError("");
    setCalendarNotice("");
    try {
      await api.calendar.disconnect(id);
      setCalendarNotice("Calendar connection removed.");
      await reloadCalendarConnections();
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "Failed to disconnect calendar");
    } finally {
      setCalendarDisconnectBusyID(null);
    }
  }

  function switchBoard(boardID: string) {
    const normalized = normalizeBoardID(boardID);
    if (normalized === activeBoardID()) return;
    navigate(profileHref(normalized));
  }

  onMount(() => {
    const params = new URLSearchParams(location.search);
    const calendarStatus = (params.get("calendar") || "").trim().toLowerCase();
    const calendarProvider = (params.get("provider") || "").trim().toLowerCase();
    const calendarMessage = (params.get("message") || "").trim();
    if (calendarStatus === "connected") {
      const label = calendarProvider ? calendarProviderLabel(calendarProvider) : "Calendar";
      setCalendarNotice(`${label} connected.`);
    } else if (calendarStatus === "error") {
      setCalendarError(calendarMessage || "Calendar connection failed. Try again.");
    }
    void loadBase();
  });

  createEffect(() => {
    const boardID = activeBoardID();
    void loadBoard(boardID);
  });

  return (
    <AppShell
      activeView="profile"
      headerRight={
        <div class="hidden items-center gap-2 md:flex">
          <select
            value={activeBoardID()}
            onInput={(event) => switchBoard(event.currentTarget.value)}
            class="rounded-md border border-[#394b66] bg-[#131b2b] px-2 py-1 text-xs text-[#dbe7ff] outline-none focus:border-[var(--accent)]"
            data-testid="profile-board-selector-desktop"
          >
            <For each={boardChoices()}>
              {(choice) => (
                <option value={choice.boardID}>
                  {choice.name}
                  {choice.isTeamBoard ? " (Team)" : ""}
                </option>
              )}
            </For>
          </select>
          <Show when={activeBoardChoice()?.isTeamBoard}>
            <span class="rounded-md border border-[#4b5ea8] bg-[#1f2554] px-2 py-0.5 text-[11px] text-[#d5dcff]">
              Team board
            </span>
          </Show>
        </div>
      }
      mobileSidebar={
        <div class="space-y-3 text-sm text-[#c5d2ea]">
          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Profile</p>
            <p class="mt-1 text-sm text-[#e3edff]">{session()?.user.name || "User"}</p>
            <p class="text-xs text-[#9bb0d3]">{session()?.user.email || ""}</p>
          </section>

          <section class="rounded-lg border border-[#2d3e5a] bg-[#0f1728] px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Quest Progress</p>
            <p class="mt-2 text-sm text-[#e3edff]">In progress: {inProgressQuests().length}</p>
            <p class="text-sm text-[#e3edff]">Completed: {completedQuests().length}</p>
          </section>
        </div>
      }
    >
      <section class="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6">
        <div class="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <header class="rounded-2xl border border-[#2a3750] bg-[#0f1728] px-5 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">User Profile</p>
            <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#edf3ff]">
              {session()?.user.name || "Profile"}
            </h1>
            <p class="mt-1 text-sm text-[#9fb0cc]">Track quest progress across your board.</p>
          </header>

          <Show when={loading()}>
            <p class="rounded-xl border border-[#2d3c57] bg-[#0f1728] px-4 py-3 text-sm text-[#b8c8e4]">Loading profile...</p>
          </Show>

          <Show when={error()}>
            <p class="rounded-xl border border-[#643434] bg-[#2b1618] px-4 py-3 text-sm text-[#ffc0bd]">{error()}</p>
          </Show>

          <Show when={!loading()}>
            <>
              <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5 md:hidden">
                <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Board</p>
                <select
                  value={activeBoardID()}
                  onInput={(event) => switchBoard(event.currentTarget.value)}
                  class="mt-2 w-full rounded-md border border-[#3a4d6f] bg-[#0c1524] px-2 py-1.5 text-sm text-[#e7f0ff] outline-none focus:border-[var(--accent)]"
                  data-testid="profile-board-selector-mobile"
                >
                  <For each={boardChoices()}>
                    {(choice) => (
                      <option value={choice.boardID}>
                        {choice.name}
                        {choice.isTeamBoard ? " (Team)" : ""}
                      </option>
                    )}
                  </For>
                </select>
              </section>

              <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5" data-testid="profile-calendar-connections">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Connected Calendars</h2>
                    <p class="mt-1 text-xs text-[#9eb4d8]">
                      Connect Google Calendar and sync upcoming events.
                    </p>
                  </div>
                  <button
                    type="button"
                    class="rounded-lg border border-[#3b4f73] bg-[#1a2b46] px-3 py-1.5 text-xs font-semibold text-[#d8e7ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                    onClick={() => void syncCalendar()}
                    disabled={calendarSyncBusyID() !== null || calendarConnections().length === 0}
                  >
                    <Show when={calendarSyncBusyID() === "__all__"} fallback="Sync all">
                      Syncing...
                    </Show>
                  </button>
                </div>

                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-[#4a6286] bg-[#1b2f4f] px-3 py-1.5 text-xs font-semibold text-[#e0ebff] transition hover:border-[var(--accent)] disabled:opacity-60"
                    onClick={() => void startCalendarConnect("google")}
                    disabled={calendarConnectBusy() !== null}
                  >
                    <Show when={calendarConnectBusy() === "google"} fallback="Connect Google">
                      Connecting...
                    </Show>
                  </button>
                </div>

                <Show when={calendarLoading()}>
                  <p class="mt-2 text-xs text-[#9db3d7]">Refreshing calendar connections...</p>
                </Show>

                <Show when={calendarNotice()}>
                  <p class="mt-3 rounded-md border border-[#3b6547] bg-[#162b1d] px-3 py-2 text-xs text-[#bcf0c9]">{calendarNotice()}</p>
                </Show>
                <Show when={calendarError()}>
                  <p class="mt-3 rounded-md border border-[#6f3f42] bg-[#2b1718] px-3 py-2 text-xs text-[#ffb7b4]">{calendarError()}</p>
                </Show>

                <Show
                  when={calendarConnections().length > 0}
                  fallback={
                    <p class="mt-3 rounded-md border border-[#304767] bg-[#101f35] px-3 py-2 text-sm text-[#9cb2d6]">
                      No calendar connections yet.
                    </p>
                  }
                >
                  <div class="mt-3 space-y-2">
                    <For each={calendarConnections()}>
                      {(connection) => (
                        <article class="rounded-lg border border-[#304767] bg-[#101f35] px-3 py-3">
                          <div class="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p class="text-sm font-semibold text-[#e0ebff]">{calendarProviderLabel(connection.provider)}</p>
                              <p class="text-xs text-[#a9bedf]">{connection.email || "Connected account"}</p>
                            </div>
                            <div class="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                class="rounded-md border border-[#3e5f8a] bg-[#1a2c4a] px-2 py-1 text-[11px] font-semibold text-[#d8e7ff] transition hover:border-[var(--accent)] disabled:opacity-60"
                                onClick={() => void syncCalendar(connection.id)}
                                disabled={calendarSyncBusyID() !== null || calendarDisconnectBusyID() !== null}
                              >
                                <Show when={calendarSyncBusyID() === connection.id} fallback="Sync">
                                  Syncing...
                                </Show>
                              </button>
                              <button
                                type="button"
                                class="rounded-md border border-[#75464a] bg-[#2a1819] px-2 py-1 text-[11px] font-semibold text-[#ffc7c4] transition hover:border-[#ff7d66] disabled:opacity-60"
                                onClick={() => void disconnectCalendar(connection.id)}
                                disabled={calendarDisconnectBusyID() !== null || calendarSyncBusyID() !== null}
                              >
                                <Show when={calendarDisconnectBusyID() === connection.id} fallback="Disconnect">
                                  Removing...
                                </Show>
                              </button>
                            </div>
                          </div>

                          <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                            <span class="rounded border border-[#405570] bg-[#18253d] px-2 py-0.5 text-[#c5d7f5]">
                              Expires: {formatOptionalDate(connection.expiresAt)}
                            </span>
                            <span class="rounded border border-[#405570] bg-[#18253d] px-2 py-0.5 text-[#c5d7f5]">
                              Last sync: {formatOptionalDate(connection.lastSyncAt)}
                            </span>
                            <Show when={connection.hasRefreshToken}>
                              <span class="rounded border border-[#3f6a4d] bg-[#17301f] px-2 py-0.5 text-[#bff5cb]">Refresh token set</span>
                            </Show>
                            <Show when={connection.scope}>
                              <span class="rounded border border-[#405570] bg-[#18253d] px-2 py-0.5 text-[#c5d7f5]">
                                Scope: {connection.scope}
                              </span>
                            </Show>
                          </div>
                        </article>
                      )}
                    </For>
                  </div>
                </Show>
              </section>

              <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Quest Summary</h2>
                  <Show when={boardLoading()}>
                    <span class="text-xs text-[#9ab0d4]">Refreshing...</span>
                  </Show>
                </div>
                <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div class="rounded-xl border border-[#304767] bg-[#101f35] px-3 py-3">
                    <p class="text-xs uppercase tracking-[0.1em] text-[#96add1]">In Progress</p>
                    <p class="mt-1 text-2xl font-semibold text-[#e6f0ff]">{inProgressQuests().length}</p>
                  </div>
                  <div class="rounded-xl border border-[#304767] bg-[#101f35] px-3 py-3">
                    <p class="text-xs uppercase tracking-[0.1em] text-[#96add1]">Completed</p>
                    <p class="mt-1 text-2xl font-semibold text-[#e6f0ff]">{completedQuests().length}</p>
                  </div>
                  <div class="rounded-xl border border-[#304767] bg-[#101f35] px-3 py-3">
                    <p class="text-xs uppercase tracking-[0.1em] text-[#96add1]">Board</p>
                    <p class="mt-1 truncate text-sm font-semibold text-[#e6f0ff]">{activeBoardChoice()?.name || "Board"}</p>
                  </div>
                </div>
              </section>

              <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">In Progress</h2>
                  <span class="text-xs text-[#9cb3d8]">{inProgressQuests().length}</span>
                </div>

                <Show
                  when={inProgressQuests().length > 0}
                  fallback={<p class="mt-3 rounded-md border border-[#304767] bg-[#101f35] px-3 py-2 text-sm text-[#9cb2d6]">No quests in progress.</p>}
                >
                  <div class="mt-3 space-y-2">
                    <For each={inProgressQuests()}>
                      {(quest) => (
                        <article class="rounded-lg border border-[#304767] bg-[#101f35] px-3 py-3">
                          <div class="flex items-start justify-between gap-2">
                            <p class="text-sm font-semibold text-[#e0ebff]">{quest.title}</p>
                            <span class={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${questTypeBadgeClass(quest.type)}`}>
                              {questTypeLabel(quest.type)}
                            </span>
                          </div>

                          <div class="mt-2 space-y-1">
                            <For each={quest.objectives ?? []}>
                              {(objective) => (
                                <div class="flex items-center justify-between gap-2 text-xs">
                                  <span class={objective.complete ? "text-[#8be39f]" : "text-[#cdd9ef]"}>{questObjectiveLabel(objective)}</span>
                                  <span class={objective.complete ? "text-[#7ddf98]" : "text-[#8ca4cf]"}>
                                    {objective.complete ? "Done" : questObjectiveProgressLabel(objective)}
                                  </span>
                                </div>
                              )}
                            </For>
                          </div>
                        </article>
                      )}
                    </For>
                  </div>
                </Show>
              </section>

              <section class="rounded-2xl border border-[#2a3750] bg-[#0f1728] p-5">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[#93a3bf]">Completed</h2>
                  <span class="text-xs text-[#9cb3d8]">{completedQuests().length}</span>
                </div>

                <Show
                  when={completedQuests().length > 0}
                  fallback={<p class="mt-3 rounded-md border border-[#304767] bg-[#101f35] px-3 py-2 text-sm text-[#9cb2d6]">No completed quests yet.</p>}
                >
                  <div class="mt-3 space-y-2">
                    <For each={completedQuests()}>
                      {(quest) => (
                        <article class="rounded-lg border border-[#304767] bg-[#101f35] px-3 py-3">
                          <div class="flex items-start justify-between gap-2">
                            <p class="text-sm font-semibold text-[#e0ebff]">{quest.title}</p>
                            <span class={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] ${questTypeBadgeClass(quest.type)}`}>
                              {questTypeLabel(quest.type)}
                            </span>
                          </div>

                          <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                            <span class={`rounded border px-2 py-0.5 ${quest.failed ? "border-[#7f4247] bg-[#2c1718] text-[#ffb7b2]" : "border-[#3f6a4d] bg-[#17301f] text-[#bff5cb]"}`}>
                              {quest.failed ? "Failed" : "Completed"}
                            </span>
                            <Show when={quest.claimed}>
                              <span class="rounded border border-[#49636e] bg-[#17333a] px-2 py-0.5 text-[#c4f1ff]">Claimed</span>
                            </Show>
                            <Show when={quest.claimable}>
                              <span class="rounded border border-[#6f6241] bg-[#2e2717] px-2 py-0.5 text-[#f3e1a6]">Claim reward on board</span>
                            </Show>
                            <span class="rounded border border-[#405570] bg-[#18253d] px-2 py-0.5 text-[#c5d7f5]">
                              {quest.source === "history" ? "History" : "Active"}
                            </span>
                            <Show when={quest.completedDay !== undefined}>
                              <span class="rounded border border-[#405570] bg-[#18253d] px-2 py-0.5 text-[#c5d7f5]">Day {quest.completedDay}</span>
                            </Show>
                          </div>
                        </article>
                      )}
                    </For>
                  </div>
                </Show>
              </section>
            </>
          </Show>
        </div>
      </section>
    </AppShell>
  );
}
