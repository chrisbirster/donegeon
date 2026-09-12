import { css } from "@linaria/core";
import { For, Show, createSignal } from "solid-js";

import { isTeamBoardProject } from "../../features/tasks/home-model";
import { organizationApi } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import type { Project } from "../../server/api";
import Button from "../Button";
import SidebarAccountCard from "../SidebarAccountCard";

type ProjectDialog =
  | { kind: "create" }
  | { kind: "rename"; project: Project }
  | { kind: "delete"; project: Project }
  | null;

type ActiveProjectDialog = Exclude<ProjectDialog, null>;

const deletableProject = (dialog: ActiveProjectDialog) => dialog.kind === "delete" ? dialog.project : undefined;
const openTaskCreate = () => window.dispatchEvent(new CustomEvent("donegeon:open-task-create"));
const openLabels = () => window.dispatchEvent(new CustomEvent("donegeon:open-labels"));

export default function HomeDesktopSidebar() {
  const {
    api,
    toast,
    setError,
    openSearchModal,
    isViewActive,
    navigateToView,
    inboxCount,
    todayCount,
    upcomingCount,
    favoriteProjects,
    sidebarProjects,
    isProjectActive,
    navigateToProject,
    projectMap,
    sidebarProjectCount,
    toggleProjectFavorite,
    refreshData,
  } = useHome();

  const [dialog, setDialog] = createSignal<ProjectDialog>(null);
  const [projectNameInput, setProjectNameInput] = createSignal("");
  const [menuProject, setMenuProject] = createSignal<Project | null>(null);
  const [archivedOpen, setArchivedOpen] = createSignal(false);
  const [archivedProjects, setArchivedProjects] = createSignal<Project[]>([]);
  const [busy, setBusy] = createSignal(false);
  const [projectError, setProjectError] = createSignal("");

  const projectRowClass = (projectID: string) =>
    `${projectButton} ${isProjectActive(projectID) ? projectButtonActive : ""} ${
      isTeamBoardProject(projectID, projectMap()) ? teamBoardButton : ""
    }`;

  const isProtectedProject = (project: Project) =>
    project.isInboxProject || project.id.toLowerCase() === "board" || project.name.trim().toLowerCase() === "board";

  function beginCreateProject() {
    setProjectNameInput("");
    setMenuProject(null);
    setProjectError("");
    setDialog({ kind: "create" });
  }

  function beginRenameProject(project: Project) {
    setProjectNameInput(project.name);
    setMenuProject(null);
    setProjectError("");
    setDialog({ kind: "rename", project });
  }

  async function saveProject() {
    const active = dialog();
    const name = projectNameInput().trim();
    if (!active || active.kind === "delete") return;
    if (!name) {
      setProjectError("Project name is required.");
      return;
    }

    setBusy(true);
    setProjectError("");
    try {
      if (active.kind === "create") {
        await api.projects.create({ name });
        toast.success(`Project ${name} created.`);
      } else {
        await api.projects.update(active.project.id, { name });
        toast.success(`Project renamed to ${name}.`);
      }
      setDialog(null);
      setError("");
      await refreshData();
    } catch (err) {
      const message = (err as Error).message;
      setProjectError(message);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function archiveProject(project: Project) {
    setBusy(true);
    try {
      await organizationApi.projects.archive(project.id);
      setMenuProject(null);
      setError("");
      if (isProjectActive(project.id)) navigateToView("inbox");
      await refreshData();
      toast.info(`Project ${project.name} archived.`);
    } catch (err) {
      const message = (err as Error).message;
      setProjectError(message);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function openArchivedProjects() {
    setArchivedOpen(true);
    setMenuProject(null);
    setProjectError("");
    try {
      const page = await organizationApi.projects.archived();
      setArchivedProjects(page.items ?? []);
    } catch (err) {
      setProjectError((err as Error).message);
    }
  }

  async function unarchiveProject(project: Project) {
    setBusy(true);
    try {
      await organizationApi.projects.unarchive(project.id);
      const page = await organizationApi.projects.archived();
      setArchivedProjects(page.items ?? []);
      setMenuProject(null);
      setError("");
      await refreshData();
      toast.success(`Project ${project.name} restored.`);
    } catch (err) {
      const message = (err as Error).message;
      setProjectError(message);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProject(project: Project) {
    setBusy(true);
    try {
      await organizationApi.projects.remove(project.id);
      setDialog(null);
      setMenuProject(null);
      setError("");
      if (isProjectActive(project.id)) navigateToView("inbox");
      await refreshData();
      toast.info(`Project ${project.name} deleted. Tasks were moved back to Inbox.`);
    } catch (err) {
      const message = (err as Error).message;
      setProjectError(message);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const projectActions = (project: Project, archived = false) => (
    <Show when={!isProtectedProject(project)}>
      <div class={actionWrap}>
        <Button
          type="button"
          class={projectActionsButton}
          aria-label={`Project actions ${project.name}`}
          aria-haspopup="menu"
          onClick={() => setMenuProject(menuProject()?.id === project.id ? null : project)}
        >
          •••
        </Button>
        <Show when={menuProject()?.id === project.id}>
          <div class={menu} role="menu">
            <Show when={!archived}>
              <Button type="button" class={menuItem} role="menuitem" onClick={() => beginRenameProject(project)}>Rename</Button>
              <Button type="button" class={menuItem} role="menuitem" onClick={() => void archiveProject(project)}>Archive</Button>
            </Show>
            <Show when={archived}>
              <Button type="button" class={menuItem} role="menuitem" onClick={() => void unarchiveProject(project)}>Unarchive</Button>
            </Show>
            <Button
              type="button"
              class={menuItemDanger}
              role="menuitem"
              onClick={() => { setMenuProject(null); setDialog({ kind: "delete", project }); }}
            >
              Delete
            </Button>
          </div>
        </Show>
      </div>
    </Show>
  );

  return (
    <aside class={sidebar}>
      <div class={sidebarInner}>
        <div class={headingRow}>
          <h1 class={heading}>Tasks</h1>
          <Button type="button" class={addButton} onClick={openTaskCreate}>Add Task</Button>
        </div>

        <nav class={primaryNav} aria-label="Task views">
          <Button type="button" class={navButton} onClick={openSearchModal} data-testid="open-search">
            <span class={navLabel}><span aria-hidden="true">⌕</span> Search</span>
            <span class={shortcut}>⌘K</span>
          </Button>
          <Button type="button" class={`${navButton} ${isViewActive("inbox") ? navButtonActive : ""}`} onClick={() => navigateToView("inbox")}>
            <span class={navLabel}><span aria-hidden="true">▱</span> Inbox</span><span class={count}>{inboxCount()}</span>
          </Button>
          <Button type="button" class={`${navButton} ${isViewActive("today") ? navButtonActive : ""}`} onClick={() => navigateToView("today")}>
            <span class={navLabel}><span aria-hidden="true">◫</span> Today</span><span class={count}>{todayCount()}</span>
          </Button>
          <Button type="button" class={`${navButton} ${isViewActive("upcomming") ? navButtonActive : ""}`} onClick={() => navigateToView("upcomming")}>
            <span class={navLabel}><span aria-hidden="true">☷</span> Upcoming</span><span class={count}>{upcomingCount()}</span>
          </Button>
        </nav>

        <div class={managerRow}>
          <Button type="button" class={managerButton} onClick={openLabels}>Manage labels</Button>
          <Button type="button" class={managerButton} onClick={() => void openArchivedProjects()}>Archived projects</Button>
        </div>

        <div class={projectScroller}>
          <section>
            <p class={sectionLabel}>Favorites</p>
            <div class={projectList}>
              <Show when={favoriteProjects().length > 0} fallback={<p class={emptyCopy}>No favorite projects yet.</p>}>
                <For each={favoriteProjects()}>
                  {(project) => (
                    <div class={favoriteLine}>
                      <Button type="button" class={projectRowClass(project.id)} onClick={() => navigateToProject(project.id)}>
                        <span class={projectIdentity}>
                          <span class={favoriteGlyph} aria-hidden="true">★</span>
                          <span class={projectName}>{project.name}</span>
                          <Show when={isTeamBoardProject(project.id, projectMap())}><span class={teamBoardChip}>◆ Team Board</span></Show>
                        </span>
                        <span class={count}>{sidebarProjectCount(project)}</span>
                      </Button>
                      <Button
                        type="button"
                        class={`${favoriteButton} ${favoriteButtonActive}`}
                        aria-label={`Remove favorite ${project.name}`}
                        onClick={() => void toggleProjectFavorite(project)}
                      >
                        ★
                      </Button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>

          <section class={projectsSection}>
            <div class={sectionHeadingRow}>
              <p class={sectionLabel}>My Projects</p>
              <Button type="button" class={smallManagerButton} onClick={beginCreateProject}>Add project</Button>
            </div>
            <div class={projectList}>
              <Show when={sidebarProjects().length > 0} fallback={<p class={emptyCopy}>No projects found.</p>}>
                <For each={sidebarProjects()}>
                  {(project) => (
                    <div class={projectLine}>
                      <Button type="button" class={projectRowClass(project.id)} onClick={() => navigateToProject(project.id)}>
                        <span class={projectIdentity}>
                          <span class={projectName}>{project.name}</span>
                          <Show when={isTeamBoardProject(project.id, projectMap())}><span class={teamBoardChip}>◆ Team Board</span></Show>
                        </span>
                        <span class={count}>{sidebarProjectCount(project)}</span>
                      </Button>
                      <Button
                        type="button"
                        class={`${favoriteButton} ${project.isFavorite ? favoriteButtonActive : ""}`}
                        onClick={() => void toggleProjectFavorite(project)}
                        aria-label={project.isFavorite ? "Remove favorite" : "Add favorite"}
                      >
                        ★
                      </Button>
                      {projectActions(project)}
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>
        </div>

        <div class={accountArea}><SidebarAccountCard /></div>
      </div>

      <Show when={archivedOpen()}>
        <div class={backdrop} onClick={() => { setArchivedOpen(false); setMenuProject(null); }}>
          <section class={wideDialog} role="dialog" aria-modal="true" aria-label="Archived projects" onClick={(event) => event.stopPropagation()}>
            <div class={dialogHeader}>
              <div><p class={dialogEyebrow}>Projects</p><h2 class={dialogTitle}>Archived projects</h2></div>
              <Button type="button" class={managerButton} onClick={() => { setArchivedOpen(false); setMenuProject(null); }}>Close</Button>
            </div>
            <Show when={archivedProjects().length > 0} fallback={<p class={emptyDialog}>No archived projects.</p>}>
              <div class={archivedList}>
                <For each={archivedProjects()}>
                  {(project) => (
                    <div class={archivedRow}>
                      <Button type="button" class={archivedNameButton}>{project.name}</Button>
                      {projectActions(project, true)}
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={projectError()}><p class={errorText}>{projectError()}</p></Show>
          </section>
        </div>
      </Show>

      <Show when={dialog()}>
        {(activeDialog) => (
          <div class={backdrop} onClick={() => setDialog(null)}>
            <section
              class={dialogCard}
              role="dialog"
              aria-modal="true"
              aria-label={activeDialog().kind === "rename" ? "Rename project" : activeDialog().kind === "delete" ? "Delete project" : "Create project"}
              onClick={(event) => event.stopPropagation()}
            >
              <h2 class={dialogTitle}>
                {activeDialog().kind === "rename" ? "Rename project" : activeDialog().kind === "delete" ? "Delete project" : "Create project"}
              </h2>
              <Show
                when={activeDialog().kind !== "delete"}
                fallback={
                  <p class={dialogCopy}>
                    Delete <strong>{deletableProject(activeDialog())?.name ?? "this project"}</strong>? Tasks are kept and their project/section placement is cleared.
                  </p>
                }
              >
                <label class={fieldLabel} for="project-dialog-name">Project name</label>
                <input
                  id="project-dialog-name"
                  aria-label="Project name"
                  class={dialogInput}
                  value={projectNameInput()}
                  autofocus
                  onInput={(event) => setProjectNameInput(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); void saveProject(); }
                  }}
                />
              </Show>
              <Show when={projectError()}><p class={errorText}>{projectError()}</p></Show>
              <div class={dialogActions}>
                <Show
                  when={activeDialog().kind === "delete"}
                  fallback={<Button type="button" class={primaryButton} disabled={busy()} onClick={() => void saveProject()}>{activeDialog().kind === "rename" ? "Save" : "Create"}</Button>}
                >
                  <Button
                    type="button"
                    class={dangerButton}
                    disabled={busy()}
                    onClick={() => {
                      const project = deletableProject(activeDialog());
                      if (project) void deleteProject(project);
                    }}
                  >
                    Delete
                  </Button>
                </Show>
                <Button type="button" class={managerButton} onClick={() => setDialog(null)}>Cancel</Button>
              </div>
            </section>
          </div>
        )}
      </Show>
    </aside>
  );
}

const sidebar = css`display:none; height:100%; min-height:0; overflow:hidden; border:1px solid var(--border-strong); border-radius:var(--radius-3xl); padding:1rem; background:linear-gradient(180deg,var(--panel-strong-start),var(--panel-strong-end)); box-shadow:var(--shadow-elevated); backdrop-filter:blur(18px); @media (width >= 48rem){display:flex;}`;
const sidebarInner = css`display:flex; flex-direction:column; min-height:0; width:100%;`;
const headingRow = css`display:flex; align-items:center; justify-content:space-between; gap:.75rem;`;
const heading = css`font:600 1.25rem/1.2 "Space Grotesk","IBM Plex Sans",sans-serif; color:var(--text-main);`;
const addButton = css`border:1px solid var(--border-strong); border-radius:.6rem; padding:.5rem .75rem; background:var(--panel-soft); color:var(--text-main); font-size:.82rem; &:hover{border-color:var(--border-hover);}`;
const primaryNav = css`display:grid; grid-template-columns:1fr 1fr; gap:.4rem; margin-top:1rem;`;
const navButton = css`display:flex; align-items:center; justify-content:space-between; gap:.5rem; width:100%; border:1px solid transparent; border-radius:.65rem; padding:.58rem .65rem; background:rgba(255,255,255,.015); color:var(--text-main); font-size:.88rem; text-align:left; &:hover{border-color:var(--border-soft); background:rgba(255,255,255,.045);}`;
const navButtonActive = css`border-color:rgba(196,69,255,.34); background:var(--accent-wash); color:var(--accent-text);`;
const navLabel = css`display:flex; align-items:center; gap:.45rem; min-width:0;`;
const shortcut = css`font-size:.68rem; color:var(--text-dim);`;
const count = css`font-size:.75rem; color:var(--text-dim); font-variant-numeric:tabular-nums;`;
const managerRow = css`display:grid; grid-template-columns:1fr 1fr; gap:.4rem; margin-top:.55rem;`;
const managerButton = css`border:1px solid var(--border-strong); border-radius:.58rem; padding:.5rem .6rem; background:var(--panel-soft); color:var(--text-main); font-size:.76rem;`;
const projectScroller = css`flex:1; min-height:0; overflow-y:auto; margin-top:1.25rem; padding-right:.2rem;`;
const sectionHeadingRow = css`display:flex; align-items:center; justify-content:space-between; gap:.5rem;`;
const sectionLabel = css`margin:0; padding:0 .45rem; font-size:.72rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim);`;
const smallManagerButton = css`border:0; border-radius:.45rem; padding:.3rem .45rem; background:transparent; color:var(--accent-text); font-size:.72rem;`;
const projectList = css`display:flex; flex-direction:column; gap:.42rem; margin-top:.65rem;`;
const emptyCopy = css`padding:.4rem .45rem; font-size:.82rem; color:var(--text-dim);`;
const projectsSection = css`margin-top:1.5rem;`;
const projectLine = css`display:grid; grid-template-columns:minmax(0,1fr) 2.35rem 2.35rem; gap:.35rem; align-items:stretch;`;
const favoriteLine = css`display:grid; grid-template-columns:minmax(0,1fr) 2.35rem; gap:.35rem; align-items:stretch;`;
const projectButton = css`display:flex; align-items:center; justify-content:space-between; gap:.6rem; min-width:0; width:100%; border:1px solid var(--border-soft); border-radius:.75rem; padding:.68rem .75rem; background:rgba(255,255,255,.018); color:var(--text-main); text-align:left; &:hover{border-color:var(--border-hover); background:rgba(255,255,255,.045);}`;
const projectButtonActive = css`border-color:rgba(196,69,255,.4); background:var(--accent-wash);`;
const teamBoardButton = css`border-color:rgba(218,67,255,.45); background:linear-gradient(110deg,rgba(82,22,112,.52),rgba(255,32,114,.08)); box-shadow:inset 0 0 22px rgba(196,69,255,.07),0 0 18px rgba(196,69,255,.06);`;
const projectIdentity = css`display:flex; align-items:center; gap:.5rem; min-width:0; flex-wrap:wrap;`;
const projectName = css`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.9rem; font-weight:650;`;
const teamBoardChip = css`border:1px solid rgba(218,67,255,.38); border-radius:999px; padding:.12rem .4rem; background:rgba(196,69,255,.12); color:#f1c8ff; font-size:.62rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap;`;
const favoriteGlyph = css`color:#ffd4a1;`;
const favoriteButton = css`border:1px solid var(--border-strong); border-radius:.7rem; background:var(--panel-soft); color:var(--text-dim); &:hover{border-color:var(--border-hover); color:#ffd4a1;}`;
const favoriteButtonActive = css`color:#ffd4a1; border-color:rgba(255,212,161,.32);`;
const actionWrap = css`position:relative;`;
const projectActionsButton = css`width:100%; height:100%; border:1px solid var(--border-strong); border-radius:.7rem; background:var(--panel-soft); color:var(--text-dim);`;
const menu = css`position:absolute; z-index:90; top:calc(100% + .25rem); right:0; min-width:8.5rem; display:flex; flex-direction:column; padding:.3rem; border:1px solid var(--border-strong); border-radius:.6rem; background:var(--panel); box-shadow:var(--shadow-elevated);`;
const menuItem = css`border:0; border-radius:.42rem; padding:.5rem .65rem; background:transparent; color:var(--text-main); text-align:left; &:hover{background:rgba(255,255,255,.06);}`;
const menuItemDanger = css`border:0; border-radius:.42rem; padding:.5rem .65rem; background:transparent; color:var(--danger); text-align:left; &:hover{background:rgba(255,255,255,.06);}`;
const accountArea = css`margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border-strong);`;
const backdrop = css`position:fixed; inset:0; z-index:85; display:flex; align-items:flex-start; justify-content:center; padding:3rem 1rem; overflow:auto; background:rgba(0,0,0,.72); backdrop-filter:blur(8px);`;
const dialogCard = css`width:min(30rem,100%); border:1px solid var(--border-strong); border-radius:.9rem; padding:1.2rem; background:var(--panel); color:var(--text-main); box-shadow:var(--shadow-elevated);`;
const wideDialog = css`width:min(36rem,100%); border:1px solid var(--border-strong); border-radius:.9rem; padding:1.2rem; background:var(--panel); color:var(--text-main); box-shadow:var(--shadow-elevated);`;
const dialogHeader = css`display:flex; align-items:center; justify-content:space-between; gap:1rem; margin-bottom:1rem;`;
const dialogEyebrow = css`margin:0; font-size:.68rem; letter-spacing:.13em; text-transform:uppercase; color:var(--text-dim);`;
const dialogTitle = css`margin:.15rem 0 1rem; font-size:1.15rem;`;
const dialogCopy = css`margin:0 0 1rem; color:var(--text-dim); line-height:1.5;`;
const fieldLabel = css`display:block; margin-bottom:.4rem; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const dialogInput = css`width:100%; border:1px solid var(--border-strong); border-radius:.65rem; padding:.68rem .75rem; background:rgba(255,255,255,.035); color:var(--text-main); outline:none; &:focus{border-color:var(--accent);}`;
const dialogActions = css`display:flex; justify-content:flex-end; gap:.5rem; margin-top:1rem;`;
const primaryButton = css`border:0; border-radius:.6rem; padding:.55rem .8rem; background:var(--accent); color:#1d1108; font-weight:700;`;
const dangerButton = css`border:1px solid color-mix(in srgb,var(--danger) 45%,transparent); border-radius:.6rem; padding:.55rem .8rem; background:rgba(255,70,90,.08); color:var(--danger);`;
const archivedList = css`display:flex; flex-direction:column; gap:.5rem;`;
const archivedRow = css`display:grid; grid-template-columns:minmax(0,1fr) 2.5rem; gap:.5rem;`;
const archivedNameButton = css`border:1px solid var(--border-soft); border-radius:.7rem; padding:.65rem .75rem; background:rgba(255,255,255,.02); color:var(--text-main); text-align:left;`;
const emptyDialog = css`margin:.5rem 0; color:var(--text-dim);`;
const errorText = css`margin:.75rem 0 0; color:var(--danger); font-size:.82rem;`;