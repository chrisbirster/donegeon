import { Show, createSignal } from "solid-js";
import type { JSX } from "@solidjs/web";

import { storedBoardHref } from "../lib/boardSelection";
import SidebarAccountCard from "./SidebarAccountCard";

type ShellProps = {
  activeView: "task" | "board" | "profile" | "team";
  headerRight?: JSX.Element;
  mobileSidebar?: JSX.Element;
  accountPlacement?: "floating" | "sidebar";
  chromeTone?: "default" | "board";
  children: JSX.Element;
};

export default function AppShell(props: ShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const accountPlacement = () => props.accountPlacement || "floating";
  const chromeTone = () => props.chromeTone || "default";
  const boardTone = () => chromeTone() === "board";
  const boardHref = () => storedBoardHref();
  const navItemClass = (active: boolean) =>
    boardTone()
      ? active
        ? "bg-[rgba(255,139,80,0.14)] text-[#ffd7b7]"
        : "text-[#b7c4d7] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
      : active
        ? "bg-[var(--accent-wash)] text-[var(--accent-text)]"
        : "text-[var(--text-muted)] hover:bg-[var(--panel-soft)] hover:text-[var(--text-main)]";
  const mobileActionClass = (active: boolean) =>
    boardTone()
      ? active
        ? "border-[rgba(255,139,80,0.28)] bg-[rgba(255,139,80,0.14)] text-[#ffd7b7]"
        : "border-[#31445f] bg-[#131b27] text-[#c9d4e3] hover:border-[#466684]"
      : active
        ? "border-[rgba(255,139,80,0.28)] bg-[var(--accent-wash)] text-[var(--accent-text)]"
        : "app-button-secondary text-[var(--text-soft)]";

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  const bottomNavItemClass = (active: boolean) =>
    boardTone()
      ? active
        ? "bg-[rgba(255,139,80,0.14)] text-[#ffd7b7]"
        : "text-[#b7c4d7] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
      : active
        ? "bg-[var(--accent-wash)] text-[var(--accent-text)]"
        : "text-[var(--text-muted)] hover:bg-[var(--panel-soft)] hover:text-[var(--text-main)]";

  return (
    <main class="h-screen overflow-hidden text-[var(--text-main)]">
      <header
        class={`flex h-12 items-center justify-between px-3 backdrop-blur-xl ${
          boardTone()
            ? "border-b border-[#252c39] bg-[#11161e]/96 text-[#edf4ff]"
            : "border-b border-[var(--border-strong)] bg-[var(--panel-overlay)]"
        }`}
      >
        <div class="flex items-center gap-4">
          <Show when={props.mobileSidebar}>
            <button
              type="button"
              class={`rounded-md p-1.5 md:hidden ${boardTone() ? "border border-[#31445f] bg-[#131b27] text-[#edf4ff] hover:border-[#466684]" : "app-button-secondary text-[var(--text-main)]"}`}
              aria-label="Open sidebar"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="appshell-mobile-menu"
            >
              ☰
            </button>
          </Show>
          <span class={`font-display text-sm font-semibold tracking-[0.08em] ${boardTone() ? "text-white" : "text-[var(--text-main)]"}`}>Donegeon</span>
          <nav class="hidden items-center gap-1 text-xs md:flex">
            <a
              href="/task/inbox"
              class={`rounded-full px-3 py-1.5 transition ${navItemClass(props.activeView === "task")}`}
            >
              Tasks
            </a>
            <a
              href={boardHref()}
              class={`rounded-full px-3 py-1.5 transition ${navItemClass(props.activeView === "board")}`}
            >
              Board
            </a>
            <a
              href="/profile"
              class={`rounded-full px-3 py-1.5 transition ${navItemClass(props.activeView === "profile")}`}
            >
              Profile
            </a>
            <a
              href="/team/settings"
              class={`rounded-full px-3 py-1.5 transition ${navItemClass(props.activeView === "team")}`}
            >
              Team
            </a>
          </nav>
        </div>

        <div class="flex items-center gap-2">
          <a
            href="/profile"
            class={`rounded-full px-3 py-1 text-xs transition md:hidden ${mobileActionClass(props.activeView === "profile")}`}
          >
            Profile
          </a>
          <a
            href="/team/settings"
            class={`rounded-full px-3 py-1 text-xs transition md:hidden ${mobileActionClass(props.activeView === "team")}`}
          >
            Team
          </a>
          {props.headerRight}
        </div>
      </header>

      <div class="h-[calc(100vh-48px-62px-env(safe-area-inset-bottom))] md:h-[calc(100vh-48px)]">
        {props.children}
      </div>

      <nav
        class={`fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(env(safe-area-inset-bottom),0px)] pt-1 backdrop-blur-xl md:hidden ${
          boardTone()
            ? "border-t border-[#252c39] bg-[#11161e]/96"
            : "border-t border-[var(--border-strong)] bg-[rgba(4,8,12,0.92)]"
        }`}
      >
        <div class="grid grid-cols-2 gap-1">
          <a
            href="/task/inbox"
            class={`flex flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] transition ${bottomNavItemClass(props.activeView === "task")}`}
          >
            <span class="text-sm">✓</span>
            <span>Tasks</span>
          </a>
          <a
            href={boardHref()}
            class={`flex flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] transition ${bottomNavItemClass(props.activeView === "board")}`}
          >
            <span class="text-sm">▦</span>
            <span>Board</span>
          </a>
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
          <aside
            class={`absolute left-0 top-0 h-full w-[min(84vw,320px)] overflow-y-auto border-r shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
              boardTone()
                ? "border-[#252c39] bg-[#151a23]"
                : "border-[var(--border-strong)] bg-[var(--panel-strong-start)]"
            }`}
          >
            <div
              class={`sticky top-0 z-10 flex items-center justify-between px-3 py-2 backdrop-blur-sm ${
                boardTone()
                  ? "border-b border-[#252c39] bg-[#151a23]/96"
                  : "border-b border-[var(--border-strong)] bg-[var(--panel-overlay)]"
              }`}
            >
              <p class={`text-xs font-semibold uppercase tracking-[0.12em] ${boardTone() ? "text-[#b9c8e3]" : "text-[#9db8d3]"}`}>Sidebar</p>
              <button
                type="button"
                class={`rounded-md px-2 py-1 text-xs ${boardTone() ? "border border-[#31445f] bg-[#131b27] text-[#dce8ff] hover:border-[#466684]" : "app-button-secondary"}`}
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
