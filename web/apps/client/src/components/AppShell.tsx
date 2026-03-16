import { A } from "@solidjs/router";
import { Show, createSignal, type JSX } from "solid-js";

import SidebarAccountCard from "./SidebarAccountCard";

type ShellProps = {
  activeView: "task" | "board" | "profile" | "team";
  headerRight?: JSX.Element;
  mobileSidebar?: JSX.Element;
  accountPlacement?: "floating" | "sidebar";
  children: JSX.Element;
};

export default function AppShell(props: ShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const accountPlacement = () => props.accountPlacement || "floating";
  const navItemClass = (active: boolean) =>
    active
      ? "bg-[var(--accent-wash)] text-[var(--accent-text)]"
      : "text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white";
  const mobileActionClass = (active: boolean) =>
    active
      ? "border-[rgba(255,139,80,0.28)] bg-[var(--accent-wash)] text-[var(--accent-text)]"
      : "app-button-secondary text-[var(--text-soft)]";

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <main class="h-screen overflow-hidden text-[var(--text-main)]">
      <header class="flex h-12 items-center justify-between border-b border-[var(--border-strong)] bg-[var(--panel-overlay)] px-3 backdrop-blur-xl">
        <div class="flex items-center gap-4">
          <Show when={props.mobileSidebar}>
            <button
              type="button"
              class="app-button-secondary rounded-md p-1.5 text-[var(--text-main)] md:hidden"
              aria-label="Open sidebar"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="appshell-mobile-menu"
            >
              ☰
            </button>
          </Show>
          <span class="font-display text-sm font-semibold tracking-[0.08em] text-white">Donegeon</span>
          <nav class="hidden items-center gap-1 text-xs md:flex">
            <A
              href="/task/inbox"
              class={`rounded-full px-3 py-1.5 transition ${navItemClass(props.activeView === "task")}`}
            >
              Tasks
            </A>
            <A
              href="/board"
              class={`rounded-full px-3 py-1.5 transition ${navItemClass(props.activeView === "board")}`}
            >
              Board
            </A>
            <A
              href="/profile"
              class={`rounded-full px-3 py-1.5 transition ${navItemClass(props.activeView === "profile")}`}
            >
              Profile
            </A>
            <A
              href="/team/settings"
              class={`rounded-full px-3 py-1.5 transition ${navItemClass(props.activeView === "team")}`}
            >
              Team
            </A>
          </nav>
        </div>

        <div class="flex items-center gap-2">
          <A
            href="/profile"
            class={`rounded-full px-3 py-1 text-xs transition md:hidden ${mobileActionClass(props.activeView === "profile")}`}
          >
            Profile
          </A>
          <A
            href="/team/settings"
            class={`rounded-full px-3 py-1 text-xs transition md:hidden ${mobileActionClass(props.activeView === "team")}`}
          >
            Team
          </A>
          {props.headerRight}
        </div>
      </header>

      <div class="h-[calc(100vh-48px-62px-env(safe-area-inset-bottom))] md:h-[calc(100vh-48px)]">
        {props.children}
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-strong)] bg-[rgba(4,8,12,0.92)] px-2 pb-[max(env(safe-area-inset-bottom),0px)] pt-1 backdrop-blur-xl md:hidden">
        <div class="grid grid-cols-2 gap-1">
          <A
            href="/task/inbox"
            class={`flex flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] transition ${
              props.activeView === "task"
                ? "bg-[var(--accent-wash)] text-[var(--accent-text)]"
                : "text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
            }`}
          >
            <span class="text-sm">✓</span>
            <span>Tasks</span>
          </A>
          <A
            href="/board"
            class={`flex flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] transition ${
              props.activeView === "board"
                ? "bg-[var(--accent-wash)] text-[var(--accent-text)]"
                : "text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
            }`}
          >
            <span class="text-sm">▦</span>
            <span>Board</span>
          </A>
        </div>
      </nav>

      <Show when={mobileMenuOpen() && !!props.mobileSidebar}>
        <div class="fixed inset-0 z-[60] md:hidden">
          <button
            type="button"
            class="absolute inset-0 bg-black/55"
            aria-label="Close sidebar"
            onClick={closeMobileMenu}
          />
          <aside class="absolute left-0 top-0 h-full w-[min(84vw,320px)] overflow-y-auto border-r border-[var(--border-strong)] bg-[rgba(6,10,16,0.96)] shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div class="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border-strong)] bg-[rgba(6,10,16,0.92)] px-3 py-2 backdrop-blur-sm">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#9db8d3]">Sidebar</p>
              <button
                type="button"
                class="app-button-secondary rounded-md px-2 py-1 text-xs"
                onClick={closeMobileMenu}
              >
                Close
              </button>
            </div>
            <div class="p-3">
              {props.mobileSidebar}
              <Show when={accountPlacement() === "sidebar"}>
                <div class="mt-3 border-t border-[var(--border-strong)] pt-3">
                  <SidebarAccountCard onNavigate={closeMobileMenu} />
                </div>
              </Show>
            </div>
          </aside>
        </div>
      </Show>

      <Show when={accountPlacement() === "floating"}>
        <div class="pointer-events-none fixed bottom-3 left-3 z-[55] hidden md:block">
          <div class="pointer-events-auto">
            <SidebarAccountCard class="w-[220px]" />
          </div>
        </div>
      </Show>
    </main>
  );
}
