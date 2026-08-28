import { css } from "@linaria/core";
import { For, Show } from "solid-js";

import { isTeamBoardProject } from "../../features/tasks/home-model";
import { useHome } from "../../page/HomeContext";
import Button from "../Button";
import SidebarAccountCard from "../SidebarAccountCard";

export default function HomeDesktopSidebar() {
  const {
    focusComposer,
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
  } = useHome();

  const projectRowClass = (projectID: string) =>
    `${projectButton} ${isProjectActive(projectID) ? projectButtonActive : ""} ${
      isTeamBoardProject(projectID, projectMap()) ? teamBoardButton : ""
    }`;

  return (
    <aside class={sidebar}>
      <div class={sidebarInner}>
        <div class={headingRow}>
          <h1 class={heading}>Tasks</h1>
          <Button type="button" class={addButton} onClick={focusComposer}>
            Add Task
          </Button>
        </div>

        <nav class={primaryNav} aria-label="Task views">
          <Button type="button" class={navButton} onClick={openSearchModal} data-testid="open-search">
            <span class={navLabel}><span aria-hidden="true">⌕</span> Search</span>
            <span class={shortcut}>⌘K</span>
          </Button>
          <Button
            type="button"
            class={`${navButton} ${isViewActive("inbox") ? navButtonActive : ""}`}
            onClick={() => navigateToView("inbox")}
          >
            <span class={navLabel}><span aria-hidden="true">▱</span> Inbox</span>
            <span class={count}>{inboxCount()}</span>
          </Button>
          <Button
            type="button"
            class={`${navButton} ${isViewActive("today") ? navButtonActive : ""}`}
            onClick={() => navigateToView("today")}
          >
            <span class={navLabel}><span aria-hidden="true">◫</span> Today</span>
            <span class={count}>{todayCount()}</span>
          </Button>
          <Button
            type="button"
            class={`${navButton} ${isViewActive("upcomming") ? navButtonActive : ""}`}
            onClick={() => navigateToView("upcomming")}
          >
            <span class={navLabel}><span aria-hidden="true">☷</span> Upcoming</span>
            <span class={count}>{upcomingCount()}</span>
          </Button>
        </nav>

        <div class={projectScroller}>
          <section>
            <p class={sectionLabel}>Favorites</p>
            <div class={projectList}>
              <Show
                when={favoriteProjects().length > 0}
                fallback={<p class={emptyCopy}>No favorite projects yet.</p>}
              >
                <For each={favoriteProjects()}>
                  {(project) => (
                    <Button type="button" class={projectRowClass(project.id)} onClick={() => navigateToProject(project.id)}>
                      <span class={projectIdentity}>
                        <span class={favoriteGlyph} aria-hidden="true">★</span>
                        <span class={projectName}>{project.name}</span>
                        <Show when={isTeamBoardProject(project.id, projectMap())}>
                          <span class={teamBoardChip}>◆ Team Board</span>
                        </Show>
                      </span>
                      <span class={count}>{sidebarProjectCount(project)}</span>
                    </Button>
                  )}
                </For>
              </Show>
            </div>
          </section>

          <section class={projectsSection}>
            <p class={sectionLabel}>My Projects</p>
            <div class={projectList}>
              <Show
                when={sidebarProjects().length > 0}
                fallback={<p class={emptyCopy}>No projects found.</p>}
              >
                <For each={sidebarProjects()}>
                  {(project) => (
                    <div class={projectLine}>
                      <Button
                        type="button"
                        class={projectRowClass(project.id)}
                        onClick={() => navigateToProject(project.id)}
                      >
                        <span class={projectIdentity}>
                          <span class={projectName}>{project.name}</span>
                          <Show when={isTeamBoardProject(project.id, projectMap())}>
                            <span class={teamBoardChip}>◆ Team Board</span>
                          </Show>
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
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </section>
        </div>

        <div class={accountArea}>
          <SidebarAccountCard />
        </div>
      </div>
    </aside>
  );
}

const sidebar = css`
  display: none;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-3xl);
  padding: 1rem;
  background: linear-gradient(180deg, var(--panel-strong-start), var(--panel-strong-end));
  box-shadow: var(--shadow-elevated);
  backdrop-filter: blur(18px);
  @media (width >= 48rem) { display: flex; }
`;
const sidebarInner = css`display:flex; flex-direction:column; min-height:0; width:100%;`;
const headingRow = css`display:flex; align-items:center; justify-content:space-between; gap:.75rem;`;
const heading = css`font:600 1.25rem/1.2 "Space Grotesk","IBM Plex Sans",sans-serif; color:var(--text-main);`;
const addButton = css`
  border:1px solid var(--border-strong); border-radius:.6rem; padding:.5rem .75rem;
  background:var(--panel-soft); color:var(--text-main); font-size:.82rem;
  &:hover { border-color:var(--border-hover); }
`;
const primaryNav = css`display:grid; grid-template-columns:1fr 1fr; gap:.4rem; margin-top:1rem;`;
const navButton = css`
  display:flex; align-items:center; justify-content:space-between; gap:.5rem; width:100%;
  border:1px solid transparent; border-radius:.65rem; padding:.58rem .65rem;
  background:rgba(255,255,255,.015); color:var(--text-main); font-size:.88rem; text-align:left;
  &:hover { border-color:var(--border-soft); background:rgba(255,255,255,.045); }
`;
const navButtonActive = css`border-color:rgba(196,69,255,.34); background:var(--accent-wash); color:var(--accent-text);`;
const navLabel = css`display:flex; align-items:center; gap:.45rem; min-width:0;`;
const shortcut = css`font-size:.68rem; color:var(--text-dim);`;
const count = css`font-size:.75rem; color:var(--text-dim); font-variant-numeric:tabular-nums;`;
const projectScroller = css`flex:1; min-height:0; overflow-y:auto; margin-top:1.5rem; padding-right:.2rem;`;
const sectionLabel = css`padding:0 .45rem; font-size:.72rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim);`;
const projectList = css`display:flex; flex-direction:column; gap:.42rem; margin-top:.65rem;`;
const emptyCopy = css`padding:.4rem .45rem; font-size:.82rem; color:var(--text-dim);`;
const projectsSection = css`margin-top:1.5rem;`;
const projectLine = css`display:grid; grid-template-columns:minmax(0,1fr) 2.35rem; gap:.4rem; align-items:stretch;`;
const projectButton = css`
  display:flex; align-items:center; justify-content:space-between; gap:.6rem; min-width:0; width:100%;
  border:1px solid var(--border-soft); border-radius:.75rem; padding:.68rem .75rem;
  background:rgba(255,255,255,.018); color:var(--text-main); text-align:left;
  &:hover { border-color:var(--border-hover); background:rgba(255,255,255,.045); }
`;
const projectButtonActive = css`border-color:rgba(196,69,255,.4); background:var(--accent-wash);`;
const teamBoardButton = css`
  border-color:rgba(218,67,255,.45);
  background:linear-gradient(110deg, rgba(82,22,112,.52), rgba(255,32,114,.08));
  box-shadow:inset 0 0 22px rgba(196,69,255,.07), 0 0 18px rgba(196,69,255,.06);
`;
const projectIdentity = css`display:flex; align-items:center; gap:.5rem; min-width:0; flex-wrap:wrap;`;
const projectName = css`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:.9rem; font-weight:650;`;
const teamBoardChip = css`
  border:1px solid rgba(218,67,255,.38); border-radius:999px; padding:.12rem .4rem;
  background:rgba(196,69,255,.12); color:#f1c8ff; font-size:.62rem; font-weight:700;
  letter-spacing:.08em; text-transform:uppercase; white-space:nowrap;
`;
const favoriteGlyph = css`color:#ffd4a1;`;
const favoriteButton = css`
  border:1px solid var(--border-strong); border-radius:.7rem; background:var(--panel-soft); color:var(--text-dim);
  &:hover { border-color:var(--border-hover); color:#ffd4a1; }
`;
const favoriteButtonActive = css`color:#ffd4a1; border-color:rgba(255,212,161,.32);`;
const accountArea = css`margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border-strong);`;
