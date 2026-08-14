import Button from "../components/Button";
import { css } from "@linaria/core";
import { useLocation, useNavigate } from "@solidjs/router";
import { For, Show, createMemo, createSignal, createTrackedEffect, onSettled } from "solid-js";

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
import { style1, style2, style3, style4, style5, style6, style7, style8, style9, style10, style11, style12, style13, style14, style15, style16, style17, style18, style19, style20, style21, style22, style23, style24, style25, style26, style27, style28, style29, style30, style31, style32, style33, style34, style35, style36, style37, style38, style39, style40, style41, style42, style43, style44, style45, style46, style47, style48, style49, style50, style51, style52, style53, style54, style55, style56, style57, style58, style59, style60, style61, style62 } from "./styles/ProfileRoute.styles";

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

const questBoss = css`border-color: #6d3f3f; background: #2c1718; color: #ffb7b2;`;
const questStory = css`border-color: #52558d; background: #1d2250; color: #d8dbff;`;
const questSeasonal = css`border-color: #49636e; background: #17333a; color: #c4f1ff;`;
const questDaily = css`border-color: #4c6a4d; background: #17321d; color: #c4f2cf;`;
const questDefault = css`border-color: #425678; background: #1a263f; color: #d3e2ff;`;

function questTypeBadgeClass(value: string): string {
  switch (value.trim().toLowerCase()) {
    case "boss":
      return questBoss;
    case "story":
      return questStory;
    case "seasonal":
      return questSeasonal;
    case "daily":
      return questDaily;
    default:
      return questDefault;
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

  onSettled(() => {
    let navigationTimer: number | undefined;
    const params = new URLSearchParams(location.search);
    const calendarStatus = (params.get("calendar") || "").trim().toLowerCase();
    const calendarProvider = (params.get("provider") || "").trim().toLowerCase();
    const calendarMessage = (params.get("message") || "").trim();
    const cleanProfileRoute = profileHref(boardIDFromSearch(location.search));
    if (calendarStatus || calendarProvider || calendarMessage) {
      navigationTimer = window.setTimeout(() => navigate(cleanProfileRoute, { replace: true }), 0);
    }
    if (calendarStatus === "connected") {
      const label = calendarProvider ? calendarProviderLabel(calendarProvider) : "Calendar";
      setCalendarNotice(calendarMessage || `${label} connected. Syncing upcoming events...`);
      void (async () => {
        await loadBase();
        await syncCalendar();
      })();
      return () => {
        if (navigationTimer !== undefined) window.clearTimeout(navigationTimer);
      };
    } else if (calendarStatus === "error") {
      setCalendarError(calendarMessage || "Calendar connection failed. Try again.");
    }
    void loadBase();
    return () => {
      if (navigationTimer !== undefined) window.clearTimeout(navigationTimer);
    };
  });

  createTrackedEffect(() => {
    const boardID = activeBoardID();
    void loadBoard(boardID);
  });

  return (
    <AppShell
      activeView="profile"
      headerRight={
        <div class={style1}>
          <select
            value={activeBoardID()}
            onInput={(event) => switchBoard(event.currentTarget.value)}
            class={style2}
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
            <span class={style3}>
              Team board
            </span>
          </Show>
        </div>
      }
      mobileSidebar={
        <div class={style4}>
          <section class={style5}>
            <p class={style6}>Profile</p>
            <p class={style7}>{session()?.user.name || "User"}</p>
            <p class={style8}>{session()?.user.email || ""}</p>
          </section>

          <section class={style5}>
            <p class={style6}>Quest Progress</p>
            <p class={style9}>In progress: {inProgressQuests().length}</p>
            <p class={style10}>Completed: {completedQuests().length}</p>
          </section>
        </div>
      }
    >
      <section class={style11}>
        <div class={style12}>
          <header class={style13}>
            <p class={style6}>User Profile</p>
            <h1 class={style14}>
              {session()?.user.name || "Profile"}
            </h1>
            <p class={style15}>Track quest progress across your board.</p>
          </header>

          <Show when={loading()}>
            <p class={style16}>Loading profile...</p>
          </Show>

          <Show when={error()}>
            <p class={style17}>{error()}</p>
          </Show>

          <Show when={!loading()}>
            <>
              <section class={style18}>
                <p class={style6}>Board</p>
                <select
                  value={activeBoardID()}
                  onInput={(event) => switchBoard(event.currentTarget.value)}
                  class={style19}
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

              <section class={style20} data-testid="profile-calendar-connections">
                <div class={style21}>
                  <div>
                    <h2 class={style22}>Connected Calendars</h2>
                    <p class={style23}>
                      Connect Google Calendar and sync upcoming events.
                    </p>
                  </div>
                  <Button
                    type="button"
                    class={style24}
                    onClick={() => void syncCalendar()}
                    disabled={calendarSyncBusyID() !== null || calendarConnections().length === 0}
                  >
                    <Show when={calendarSyncBusyID() === "__all__"} fallback="Sync all">
                      Syncing...
                    </Show>
                  </Button>
                </div>

                <div class={style25}>
                  <Button
                    type="button"
                    class={style26}
                    onClick={() => void startCalendarConnect("google")}
                    disabled={calendarConnectBusy() !== null}
                  >
                    <Show when={calendarConnectBusy() === "google"} fallback="Connect Google">
                      Connecting...
                    </Show>
                  </Button>
                </div>

                <Show when={calendarLoading()}>
                  <p class={style27}>Refreshing calendar connections...</p>
                </Show>

                <Show when={calendarNotice()}>
                  <p class={style28}>{calendarNotice()}</p>
                </Show>
                <Show when={calendarError()}>
                  <p class={style29}>{calendarError()}</p>
                </Show>

                <Show
                  when={calendarConnections().length > 0}
                  fallback={
                    <p class={style30}>
                      No calendar connections yet.
                    </p>
                  }
                >
                  <div class={style31}>
                    <For each={calendarConnections()}>
                      {(connection) => (
                        <article class={style32}>
                          <div class={style33}>
                            <div>
                              <p class={style34}>{calendarProviderLabel(connection.provider)}</p>
                              <p class={style35}>{connection.email || "Connected account"}</p>
                            </div>
                            <div class={style36}>
                              <Button
                                type="button"
                                class={style37}
                                onClick={() => void syncCalendar(connection.id)}
                                disabled={calendarSyncBusyID() !== null || calendarDisconnectBusyID() !== null}
                              >
                                <Show when={calendarSyncBusyID() === connection.id} fallback="Sync">
                                  Syncing...
                                </Show>
                              </Button>
                              <Button
                                type="button"
                                class={style38}
                                onClick={() => void disconnectCalendar(connection.id)}
                                disabled={calendarDisconnectBusyID() !== null || calendarSyncBusyID() !== null}
                              >
                                <Show when={calendarDisconnectBusyID() === connection.id} fallback="Disconnect">
                                  Removing...
                                </Show>
                              </Button>
                            </div>
                          </div>

                          <div class={style39}>
                            <span class={style40}>Connected</span>
                            <span class={style41}>
                              {connection.lastSyncAt ? `Last sync ${formatOptionalDate(connection.lastSyncAt)}` : "Ready to sync upcoming events."}
                            </span>
                          </div>
                        </article>
                      )}
                    </For>
                  </div>
                </Show>
              </section>

              <section class={style20}>
                <div class={style42}>
                  <h2 class={style22}>Quest Summary</h2>
                  <Show when={boardLoading()}>
                    <span class={style43}>Refreshing...</span>
                  </Show>
                </div>
                <div class={style44}>
                  <div class={style45}>
                    <p class={style46}>In Progress</p>
                    <p class={style47}>{inProgressQuests().length}</p>
                  </div>
                  <div class={style45}>
                    <p class={style46}>Completed</p>
                    <p class={style47}>{completedQuests().length}</p>
                  </div>
                  <div class={style45}>
                    <p class={style46}>Board</p>
                    <p class={style48}>{activeBoardChoice()?.name || "Board"}</p>
                  </div>
                </div>
              </section>

              <section class={style20}>
                <div class={style42}>
                  <h2 class={style22}>In Progress</h2>
                  <span class={style49}>{inProgressQuests().length}</span>
                </div>

                <Show
                  when={inProgressQuests().length > 0}
                  fallback={<p class={style30}>No quests in progress.</p>}
                >
                  <div class={style31}>
                    <For each={inProgressQuests()}>
                      {(quest) => (
                        <article class={style32}>
                          <div class={style50}>
                            <p class={style34}>{quest.title}</p>
                            <span class={` ${style51} ${questTypeBadgeClass(quest.type)}`}>
                              {questTypeLabel(quest.type)}
                            </span>
                          </div>

                          <div class={style52}>
                            <For each={quest.objectives ?? []}>
                              {(objective) => (
                                <div class={style53}>
                                  <span class={objective.complete ? style54 : style55}>{questObjectiveLabel(objective)}</span>
                                  <span class={objective.complete ? style56 : style57}>
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

              <section class={style20}>
                <div class={style42}>
                  <h2 class={style22}>Completed</h2>
                  <span class={style49}>{completedQuests().length}</span>
                </div>

                <Show
                  when={completedQuests().length > 0}
                  fallback={<p class={style30}>No completed quests yet.</p>}
                >
                  <div class={style31}>
                    <For each={completedQuests()}>
                      {(quest) => (
                        <article class={style32}>
                          <div class={style50}>
                            <p class={style34}>{quest.title}</p>
                            <span class={` ${style51} ${questTypeBadgeClass(quest.type)}`}>
                              {questTypeLabel(quest.type)}
                            </span>
                          </div>

                          <div class={style39}>
                            <span class={` ${style58} ${quest.failed ? style59 : style60}`}>
                              {quest.failed ? "Failed" : "Completed"}
                            </span>
                            <Show when={quest.claimed}>
                              <span class={style61}>Claimed</span>
                            </Show>
                            <Show when={quest.claimable}>
                              <span class={style62}>Claim reward on board</span>
                            </Show>
                            <span class={style41}>
                              {quest.source === "history" ? "History" : "Active"}
                            </span>
                            <Show when={quest.completedDay !== undefined}>
                              <span class={style41}>Day {quest.completedDay}</span>
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
