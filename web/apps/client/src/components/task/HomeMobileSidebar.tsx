import Button from "../Button";
import { css } from "@linaria/core";
import { For, Show } from "solid-js";

import {
  projectQuickAddAlias,
  searchButtonClass,
  sidebarCardClass,
  sidebarItemActiveClass,
  sidebarItemBaseClass,
  sidebarItemIdleClass,
  smallActionButtonClass,
} from "../../features/tasks/home-model";
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
    sidebarProjectCount,
    sidebarProjects,
    todayCount,
    upcomingCount,
  } = useHome();

  return (
    <div class={style1}>
      <div class={sidebarCardClass}>
        <div class={style2}>
          <h2 class={style3}>Tasks</h2>
          <Button type="button" class={smallActionButtonClass} onClick={focusComposer}>
            Add
          </Button>
        </div>
        <Button type="button" class={searchButtonClass} onClick={openSearchModal}>
          <span>Search</span>
          <span class={style4}>⌘K</span>
        </Button>
      </div>

      <div class={sidebarCardClass}>
        <p class={style5}>Views</p>
        <div class={style6}>
          {(["inbox", "today", "upcomming"] as const).map((view) => {
            const label = view === "upcomming" ? "Upcoming" : view[0].toUpperCase() + view.slice(1);
            const count = view === "inbox" ? inboxCount : view === "today" ? todayCount : upcomingCount;
            return (
              <Button
                type="button"
                class={`${sidebarItemBaseClass} ${isViewActive(view) ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                onClick={() => navigateToView(view)}
              >
                <span>{label}</span>
                <span class={style4}>{count()}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div class={sidebarCardClass}>
        <p class={style5}>Projects</p>
        <div class={style6}>
          <For each={sidebarProjects()}>
            {(project) => (
              <Button
                type="button"
                class={`${sidebarItemBaseClass} ${isProjectActive(project.id) ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                onClick={() => navigateToProject(project.id)}
              >
                <span class={style7}>
                  <span class={style8}>{project.name}</span>
                  <Show when={projectQuickAddAlias(project)}>
                    {(alias) => (
                      <span class={style9}>
                        #{alias()}
                      </span>
                    )}
                  </Show>
                </span>
                <span class={style10}>{sidebarProjectCount(project)}</span>
              </Button>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}


const style1 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 5) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 5) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style2 = css`
display: flex;
align-items: center;
justify-content: space-between;
`;

const style3 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: var(--tracking-tight);
  letter-spacing: var(--tracking-tight);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style4 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;

const style5 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-dim);
text-transform: uppercase;
`;

const style6 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 1) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 1) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style7 = css`
min-width: calc(var(--spacing) * 0);
`;

const style8 = css`
display: block;
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const style9 = css`
font-size: 10px;
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style10 = css`
margin-left: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-dim);
`;
