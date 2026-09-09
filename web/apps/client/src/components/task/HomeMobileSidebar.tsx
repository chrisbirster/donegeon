import Button from "../Button";
import { css } from "@linaria/core";
import { For, Show } from "solid-js";

import { isTeamBoardProject } from "../../features/tasks/home-model";
import { useHome } from "../../page/HomeContext";

export default function HomeMobileSidebar() {
  const {
    focusComposer,
    inboxCount,
    isProjectActive,
    isViewActive,
    navigateToProject,
    navigateToView,
    openSearchModal,
    projectMap,
    sidebarProjectCount,
    sidebarProjects,
    todayCount,
    upcomingCount,
  } = useHome();

  return (
    <div class={stack}>
      <section class={card}>
        <div class={headingRow}>
          <h2 class={heading}>Tasks</h2>
          <Button type="button" class={smallButton} onClick={focusComposer}>Add</Button>
        </div>
        <Button type="button" class={searchButton} onClick={openSearchModal}>
          <span>⌕ Search</span><span class={muted}>⌘K</span>
        </Button>
      </section>

      <section class={card}>
        <p class={sectionLabel}>Views</p>
        <div class={list}>
          {(["inbox", "today", "upcomming"] as const).map((view) => {
            const label = view === "upcomming" ? "Upcoming" : view[0].toUpperCase() + view.slice(1);
            const count = view === "inbox" ? inboxCount : view === "today" ? todayCount : upcomingCount;
            return (
              <Button
                type="button"
                class={`${row} ${isViewActive(view) ? activeRow : ""}`}
                onClick={() => navigateToView(view)}
              >
                <span>{label}</span><span class={muted}>{count()}</span>
              </Button>
            );
          })}
        </div>
      </section>

      <section class={card}>
        <p class={sectionLabel}>Projects</p>
        <div class={list}>
          <For each={sidebarProjects()}>
            {(project) => (
              <Button
                type="button"
                class={`${row} ${isProjectActive(project.id) ? activeRow : ""} ${
                  isTeamBoardProject(project.id, projectMap()) ? teamRow : ""
                }`}
                onClick={() => navigateToProject(project.id)}
              >
                <span class={projectIdentity}>
                  <span class={projectName}>{project.name}</span>
                  <Show when={isTeamBoardProject(project.id, projectMap())}>
                    <span class={teamChip}>◆ Team Board</span>
                  </Show>
                </span>
                <span class={muted}>{sidebarProjectCount(project)}</span>
              </Button>
            )}
          </For>
        </div>
      </section>
    </div>
  );
}

const stack = css`display:flex; flex-direction:column; gap:1rem;`;
const card = css`border:1px solid var(--border-strong); border-radius:.9rem; padding:.85rem; background:var(--panel-soft);`;
const headingRow = css`display:flex; align-items:center; justify-content:space-between; gap:.75rem;`;
const heading = css`font-size:1rem; font-weight:650; color:var(--text-main);`;
const smallButton = css`border:1px solid var(--border-strong); border-radius:.55rem; padding:.4rem .65rem; background:rgba(255,255,255,.025); color:var(--text-main); font-size:.8rem;`;
const searchButton = css`display:flex; justify-content:space-between; width:100%; margin-top:.75rem; border:1px solid var(--border-soft); border-radius:.65rem; padding:.58rem .65rem; background:rgba(255,255,255,.02); color:var(--text-main); font-size:.88rem;`;
const sectionLabel = css`font-size:.7rem; font-weight:750; letter-spacing:.12em; color:var(--text-dim); text-transform:uppercase;`;
const list = css`display:flex; flex-direction:column; gap:.38rem; margin-top:.55rem;`;
const row = css`display:flex; align-items:center; justify-content:space-between; gap:.6rem; width:100%; border:1px solid transparent; border-radius:.65rem; padding:.6rem .65rem; background:transparent; color:var(--text-main); text-align:left; font-size:.88rem;`;
const activeRow = css`border-color:rgba(196,69,255,.35); background:var(--accent-wash);`;
const teamRow = css`border-color:rgba(218,67,255,.34); background:linear-gradient(110deg,rgba(82,22,112,.46),rgba(255,32,114,.06));`;
const muted = css`flex:0 0 auto; color:var(--text-dim); font-size:.72rem;`;
const projectIdentity = css`display:flex; align-items:center; gap:.45rem; min-width:0; flex-wrap:wrap;`;
const projectName = css`overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600;`;
const teamChip = css`border:1px solid rgba(218,67,255,.32); border-radius:999px; padding:.1rem .35rem; color:#efc4ff; font-size:.58rem; font-weight:750; letter-spacing:.08em; text-transform:uppercase;`;
