import { css } from "@linaria/core";
import { For, Show, createSignal } from "solid-js";

import { isTeamBoardProject } from "../../features/tasks/home-model";
import { organizationApi } from "../../lib/organizationApi";
import { useHome } from "../../page/HomeContext";
import type { Project } from "../../server/api";
import Button from "../Button";
import SidebarAccountCard from "../SidebarAccountCard";
import ActionMenu from "../ui/ActionMenu";
import Dialog, { dialogEyebrow, dialogHeader, dialogTitle } from "../ui/Dialog";

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
  const [projectEditing, setProjectEditing] = createSignal(false);
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

  const projectLineClass = (project: Project) =>
    `${projectLine} ${projectEditing() && !isProtectedProject(project) ? projectLineEditing : ""}`;

  function toggleProjectEditing() {
    setProjectEditing((value) => !value);
  }

  function beginCreateProject() {
    setProjectNameInput("");
    setProjectError("");
    setDialog({ kind: "create" });
  }

  function beginRenameProject(project: Project) {
    setProjectNameInput(project.name);
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

  const activeProjectActions = (project: Project) => (
    <ActionMenu
      ariaLabel={`Project actions ${project.name}`}
      items={[
        { label: "Rename", onSelect: () => beginRenameProject(project) },
        { label: "Archive", onSelect: () => void archiveProject(project) },
        { label: "Delete", danger: true, onSelect: () => setDialog({ kind: "delete", project }) },
      ]}
    />
  );

  const archivedProjectActions = (project: Project) => (
    <ActionMenu
      ariaLabel={`Project actions ${project.name}`}
      items={[
        { label: "Unarchive", onSelect: () => void unarchiveProject(project) },
        { label: "Delete", danger: true, onSelect: () => setDialog({ kind: "delete", project }) },
      ]}
    />
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
          <Button type="button" class={`${navButton} ${isViewActive("upcoming") ? navButtonActive : ""}`} onClick={() => navigateToView("upcoming")}>
            <span class={navLabel}><span aria-hidden="true">☷</span> Upcoming</span><span class={count}>{upcomingCount()}</span>
          </Button>
        </nav>

        <div class={managerRow}>
          <Button type="button" class={managerButton} onClick={openLabels}>Manage labels</Button>
          <Button type="button" class={managerButton} onClick={() => void openArchivedProjects()}>Archived projects</Button>
        </div>

        <div class={projectScroller}>
          <section aria-labelledby="favorites-heading">
            <p class={sectionLabel} id="favorites-heading">Favorites</p>
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
                        <span aria-hidden="true">★</span>
                      </Button>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>

          <section class={projectsSection} aria-labelledby="projects-heading">
            <div class={sectionHeadingRow}>
              <p class={sectionLabel} id="projects-heading">My Projects</p>
              <div class={sectionHeadingActions}>
                <Button type="button" class={smallManagerButton} onClick={beginCreateProject}>Add project</Button>
                <Button
                  type="button"
                  class={`${editProjectsButton} ${projectEditing() ? editProjectsButtonActive : ""}`}
                  aria-label={projectEditing() ? "Done editing projects" : "Edit projects"}
                  aria-pressed={projectEditing()}
                  onClick={toggleProjectEditing}
                >
                  <span aria-hidden="true">✎</span>
                </Button>
              </div>
            </div>
            <div class={projectList}>
              <Show when={sidebarProjects().length > 0} fallback={<p class={emptyCopy}>No projects found.</p>}>
                <For each={sidebarProjects()}>
                  {(project) => (
                    <div class={projectLineClass(project)}>
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
                        aria-label={project.isFavorite ? `Remove favorite ${project.name}` : `Add favorite ${project.name}`}
                      >
                        <span aria-hidden="true">★</span>
                      </Button>
                      <Show when={projectEditing() && !isProtectedProject(project)}>
                        {activeProjectActions(project)}
                      </Show>
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
        <Dialog ariaLabel="Archived projects" onClose={() => setArchivedOpen(false)} class={wideDialog}>
          <header class={dialogHeader}>
            <div><p class={dialogEyebrow}>Projects</p><h2 class={dialogTitle}>Archived projects</h2></div>
            <Button type="button" onClick={() => setArchivedOpen(false)}>Close</Button>
          </header>
          <div class={archivedBody}>
            <Show when={archivedProjects().length > 0} fallback={<p class={emptyDialog}>No archived projects.</p>}>
              <div class={archivedList}>
                <For each={archivedProjects()}>
                  {(project) => (
                    <div class={archivedRow}>
                      <span class={archivedName}>{project.name}</span>
                      {archivedProjectActions(project)}
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={projectError()}><p class={errorText} role="alert">{projectError()}</p></Show>
          </div>
        </Dialog>
      </Show>

      <Show when={dialog()}>
        {(activeDialog) => (
          <Dialog
            ariaLabel={activeDialog().kind === "rename" ? "Rename project" : activeDialog().kind === "delete" ? "Delete project" : "Create project"}
            onClose={() => setDialog(null)}
            class={projectDialog}
          >
            <div class={projectDialogBody}>
              <h2 class={projectDialogTitle}>
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
                  class={dialogInput}
                  value={projectNameInput()}
                  autofocus
                  onInput={(event) => setProjectNameInput(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") { event.preventDefault(); void saveProject(); }
                  }}
                />
              </Show>
              <Show when={projectError()}><p class={errorText} role="alert">{projectError()}</p></Show>
              <div class={dialogActions}>
                <Show
                  when={activeDialog().kind === "delete"}
                  fallback={<Button type="button" variant="primary" disabled={busy()} onClick={() => void saveProject()}>{activeDialog().kind === "rename" ? "Save" : "Create"}</Button>}
                >
                  <Button
                    type="button"
                    variant="danger"
                    disabled={busy()}
                    onClick={() => {
                      const project = deletableProject(activeDialog());
                      if (project) void deleteProject(project);
                    }}
                  >
                    Delete
                  </Button>
                </Show>
                <Button type="button" onClick={() => setDialog(null)}>Cancel</Button>
              </div>
            </div>
          </Dialog>
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
const sectionHeadingActions = css`display:flex; align-items:stretch; gap:.35rem;`;
const sectionLabel = css`margin:0; padding:0 .45rem; font-size:.72rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim);`;
const smallManagerButton = css`border:1px solid transparent; border-radius:.5rem; padding:.35rem .55rem; background:transparent; color:var(--accent-text); font-size:.72rem; &:hover{border-color:var(--border-soft); background:rgba(255,255,255,.035);}`;
const editProjectsButton = css`width:2.2rem; min-width:2.2rem; padding:0; border:1px solid var(--border-strong); border-radius:.5rem; background:var(--panel-soft); color:var(--text-dim);`;
const editProjectsButtonActive = css`border-color:var(--accent); color:var(--accent-text); background:var(--accent-wash);`;
const projectList = css`display:flex; flex-direction:column; gap:.42rem; margin-top:.65rem;`;
const emptyCopy = css`padding:.4rem .45rem; font-size:.82rem; color:var(--text-dim);`;
const projectsSection = css`margin-top:1.5rem;`;
const projectLine = css`display:grid; grid-template-columns:minmax(0,1fr) 2.35rem; gap:.35rem; align-items:stretch;`;
const projectLineEditing = css`grid-template-columns:minmax(0,1fr) 2.35rem 2.35rem;`;
const favoriteLine = css`display:grid; grid-template-columns:minmax(0,1fr) 2.35rem; gap:.35rem; align-items:stretch;`;
const projectButton = css`display:flex; align-items:center; justify-content:space-between; gap:.6rem; min-width:0; width:100%; border:1px solid var(--border-soft); border-radius:.75rem; padding:.68rem .75rem; background:rgba(255,255,255,.018); color:var(--text-main); text-align:left; &:hover{border-color:var(--border-hover); background:rgba(255,255,255,.045);}`;
const projectButtonActive = css`border-color:rgba(196,69,255,.4); background:var(--accent-wash);`;
const teamBoardButton = css`border-color:rgba(218,67,255,.45); background:linear-gradient(110deg,rgba(82,22,112,.52),rgba(255,32,114,.08)); box-shadow:inset 0 0 22px rgba(196,69,255,.07),0 0 18px rgba(196,69,255,.06);`;
const projectIdentity = css`display:flex; align-items:center; gap:.5rem; min-width:0; overflow:hidden;`;
const projectName = css`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.9rem; font-weight:650;`;
const teamBoardChip = css`flex:0 0 auto; border:1px solid rgba(218,67,255,.38); border-radius:999px; padding:.12rem .4rem; background:rgba(196,69,255,.12); color:#f1c8ff; font-size:.62rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap;`;
const favoriteGlyph = css`color:#ffd4a1;`;
const favoriteButton = css`border:1px solid var(--border-strong); border-radius:.7rem; background:var(--panel-soft); color:var(--text-dim); &:hover{border-color:var(--border-hover); color:#ffd4a1;}`;
const favoriteButtonActive = css`color:#ffd4a1; border-color:rgba(255,212,161,.32);`;
const accountArea = css`margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border-strong);`;
const wideDialog = css`width:min(36rem,100%);`;
const archivedBody = css`padding:1rem 1.2rem 1.2rem;`;
const archivedList = css`display:flex; flex-direction:column; gap:.5rem;`;
const archivedRow = css`display:grid; grid-template-columns:minmax(0,1fr) 2.5rem; gap:.5rem; align-items:stretch; border:1px solid var(--border-soft); border-radius:.7rem; padding:.45rem;`;
const archivedName = css`display:flex; align-items:center; padding:.35rem .45rem; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;`;
const emptyDialog = css`margin:.5rem 0; color:var(--text-dim);`;
const projectDialog = css`width:min(30rem,100%);`;
const projectDialogBody = css`padding:1.2rem;`;
const projectDialogTitle = css`margin:0 0 1rem; font-size:1.15rem;`;
const dialogCopy = css`margin:0 0 1rem; color:var(--text-dim); line-height:1.5;`;
const fieldLabel = css`display:block; margin-bottom:.4rem; font-size:.7rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--text-dim);`;
const dialogInput = css`width:100%; border:1px solid var(--border-strong); border-radius:.65rem; padding:.68rem .75rem; background:rgba(255,255,255,.035); color:var(--text-main); outline:none; &:focus-visible{border-color:var(--accent); outline:2px solid #00e0ff; outline-offset:2px;}`;
const dialogActions = css`display:flex; justify-content:flex-end; gap:.5rem; margin-top:1rem;`;
const errorText = css`margin:.75rem 0 0; color:var(--danger); font-size:.82rem;`;
