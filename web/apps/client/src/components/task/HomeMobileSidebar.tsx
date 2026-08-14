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
    <div class="space-y-5">
      <div class={sidebarCardClass}>
        <div class="flex items-center justify-between">
          <h2 class="font-display text-sm font-semibold tracking-tight text-white">Tasks</h2>
          <button type="button" class={smallActionButtonClass} onClick={focusComposer}>
            Add
          </button>
        </div>
        <button type="button" class={searchButtonClass} onClick={openSearchModal}>
          <span>Search</span>
          <span class="text-xs text-[var(--text-dim)]">⌘K</span>
        </button>
      </div>

      <div class={sidebarCardClass}>
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">Views</p>
        <div class="mt-2 space-y-1">
          {(["inbox", "today", "upcomming"] as const).map((view) => {
            const label = view === "upcomming" ? "Upcoming" : view[0].toUpperCase() + view.slice(1);
            const count = view === "inbox" ? inboxCount : view === "today" ? todayCount : upcomingCount;
            return (
              <button
                type="button"
                class={`${sidebarItemBaseClass} ${isViewActive(view) ? sidebarItemActiveClass : sidebarItemIdleClass}`}
                onClick={() => navigateToView(view)}
              >
                <span>{label}</span>
                <span class="text-xs text-[var(--text-dim)]">{count()}</span>
              </button>
            );
          })}
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
  );
}
