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

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <main class="h-screen overflow-hidden bg-[#0a0d12] text-[#eceff7]">
      <header class="flex h-12 items-center justify-between border-b border-[#262d3a] bg-[#11151d]/95 px-3">
        <div class="flex items-center gap-4">
          <Show when={props.mobileSidebar}>
            <button
              type="button"
              class="rounded-md border border-[#35455f] p-1.5 text-[#dce5f7] transition hover:border-[var(--accent)] md:hidden"
              aria-label="Open sidebar"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="appshell-mobile-menu"
            >
              ☰
            </button>
          </Show>
          <span class="text-sm font-semibold tracking-wide text-[#e7ebf3]">Donegeon</span>
          <nav class="hidden items-center gap-1 text-xs text-[#9ea9bb] md:flex">
            <A
              href="/task/inbox"
              class={`rounded px-2 py-1 transition ${props.activeView === "task" ? "bg-[#1c2431] text-[#eef2fa]" : "hover:bg-[#1a202b] hover:text-[#eef2fa]"}`}
            >
              Tasks
            </A>
            <A
              href="/board"
              class={`rounded px-2 py-1 transition ${props.activeView === "board" ? "bg-[#1c2431] text-[#eef2fa]" : "hover:bg-[#1a202b] hover:text-[#eef2fa]"}`}
            >
              Board
            </A>
            <A
              href="/profile"
              class={`rounded px-2 py-1 transition ${props.activeView === "profile" ? "bg-[#1c2431] text-[#eef2fa]" : "hover:bg-[#1a202b] hover:text-[#eef2fa]"}`}
            >
              Profile
            </A>
            <A
              href="/team/settings"
              class={`rounded px-2 py-1 transition ${props.activeView === "team" ? "bg-[#1c2431] text-[#eef2fa]" : "hover:bg-[#1a202b] hover:text-[#eef2fa]"}`}
            >
              Team
            </A>
          </nav>
        </div>

        <div class="flex items-center gap-2">
          <A
            href="/profile"
            class={`rounded-md border px-2 py-1 text-xs transition md:hidden ${
              props.activeView === "profile"
                ? "border-[#4a6084] bg-[#1f2a3d] text-[#eef3ff]"
                : "border-[#334258] bg-[#141b28] text-[#c8d4ea] hover:border-[#4a6084] hover:text-[#eef3ff]"
            }`}
          >
            Profile
          </A>
          <A
            href="/team/settings"
            class={`rounded-md border px-2 py-1 text-xs transition md:hidden ${
              props.activeView === "team"
                ? "border-[#4a6084] bg-[#1f2a3d] text-[#eef3ff]"
                : "border-[#334258] bg-[#141b28] text-[#c8d4ea] hover:border-[#4a6084] hover:text-[#eef3ff]"
            }`}
          >
            Team
          </A>
          {props.headerRight}
        </div>
      </header>

      <div class="h-[calc(100vh-48px-62px-env(safe-area-inset-bottom))] md:h-[calc(100vh-48px)]">
        {props.children}
      </div>

      <nav class="fixed inset-x-0 bottom-0 z-50 border-t border-[#2f3848] bg-[#10151f]/98 px-2 pb-[max(env(safe-area-inset-bottom),0px)] pt-1 md:hidden">
        <div class="grid grid-cols-2 gap-1">
          <A
            href="/task/inbox"
            class={`flex flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] transition ${
              props.activeView === "task"
                ? "bg-[#1f2a3c] text-[#eef2fa]"
                : "text-[#9ea9bb] hover:bg-[#1a202b] hover:text-[#eef2fa]"
            }`}
          >
            <span class="text-sm">✓</span>
            <span>Tasks</span>
          </A>
          <A
            href="/board"
            class={`flex flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] transition ${
              props.activeView === "board"
                ? "bg-[#1f2a3c] text-[#eef2fa]"
                : "text-[#9ea9bb] hover:bg-[#1a202b] hover:text-[#eef2fa]"
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
          <aside class="absolute left-0 top-0 h-full w-[min(84vw,320px)] overflow-y-auto border-r border-[#2a3242] bg-[#121824] shadow-[0_20px_50px_rgba(0,0,0,0.55)]">
            <div class="sticky top-0 z-10 flex items-center justify-between border-b border-[#273247] bg-[#121824]/95 px-3 py-2 backdrop-blur-sm">
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#b9c8e3]">Sidebar</p>
              <button
                type="button"
                class="rounded-md border border-[#3b4f70] px-2 py-1 text-xs text-[#d8e6ff] hover:border-[var(--accent)]"
                onClick={closeMobileMenu}
              >
                Close
              </button>
            </div>
            <div class="p-3">
              {props.mobileSidebar}
              <Show when={accountPlacement() === "sidebar"}>
                <div class="mt-3 border-t border-[#273247] pt-3">
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
