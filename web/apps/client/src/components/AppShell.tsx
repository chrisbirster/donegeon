import { A } from "@solidjs/router";
import { Show, createMemo, createSignal, onMount, type JSX } from "solid-js";

import { authApi, type AuthSession } from "../server/api";

type ShellProps = {
  activeView: "task" | "board" | "builder" | "profile" | "team";
  headerRight?: JSX.Element;
  mobileSidebar?: JSX.Element;
  children: JSX.Element;
};

export default function AppShell(props: ShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const [session, setSession] = createSignal<AuthSession | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = createSignal(false);

  const accountName = createMemo(() => {
    const value = session()?.user.name?.trim();
    if (value) return value;
    return session()?.user.email?.trim() || "Donegeon User";
  });
  const accountPlan = createMemo(() => {
    const raw = session()?.team?.plan?.trim().toLowerCase() || "personal";
    if (raw === "pro_trial") return "Pro Trial";
    if (raw === "pro") return "Pro";
    if (raw === "enterprise") return "Enterprise";
    return "Free";
  });
  const accountInitials = createMemo(() => {
    const source = accountName().trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  });

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  async function signOut() {
    try {
      await authApi.logout();
    } finally {
      window.location.href = "/login";
    }
  }

  onMount(async () => {
    try {
      const response = await authApi.me();
      setSession(response.session);
    } catch {
      setSession(null);
    }
  });

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
              href="/builder"
              class={`rounded px-2 py-1 transition ${props.activeView === "builder" ? "bg-[#1c2431] text-[#eef2fa]" : "hover:bg-[#1a202b] hover:text-[#eef2fa]"}`}
            >
              Builder
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
        <div class="grid grid-cols-3 gap-1">
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
          <A
            href="/builder"
            class={`flex flex-col items-center justify-center rounded-lg px-2 py-1 text-[11px] transition ${
              props.activeView === "builder"
                ? "bg-[#1f2a3c] text-[#eef2fa]"
                : "text-[#9ea9bb] hover:bg-[#1a202b] hover:text-[#eef2fa]"
            }`}
          >
            <span class="text-sm">⌂</span>
            <span>Builder</span>
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
            <div class="p-3">{props.mobileSidebar}</div>
          </aside>
        </div>
      </Show>

      <Show when={session()}>
        <div class="pointer-events-none fixed bottom-3 left-3 z-[55] hidden md:block">
          <div class="pointer-events-auto">
            <button
              type="button"
              class="flex min-w-[180px] items-center gap-2 rounded-xl border border-[#32445f] bg-[#121a28]/95 px-2.5 py-2 text-left shadow-[0_16px_32px_rgba(0,0,0,0.45)] transition hover:border-[#4b648a]"
              onClick={() => setAccountMenuOpen((open) => !open)}
              data-testid="appshell-account-toggle"
            >
              <span class="flex h-8 w-8 items-center justify-center rounded-full border border-[#48608a] bg-[#1a2a43] text-xs font-semibold text-[#e3eeff]">
                {accountInitials()}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-[#edf4ff]">{accountName()}</span>
                <span class="mt-0.5 inline-flex rounded border border-[#455d82] bg-[#182b45] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[#d4e4ff]">
                  {accountPlan()}
                </span>
              </span>
              <span class="text-xs text-[#93a8c8]">{accountMenuOpen() ? "▲" : "▼"}</span>
            </button>

            <Show when={accountMenuOpen()}>
              <div
                class="mt-2 w-[220px] overflow-hidden rounded-xl border border-[#344a6b] bg-[#111b2b]/98 shadow-[0_20px_42px_rgba(0,0,0,0.5)]"
                data-testid="appshell-account-menu"
              >
                <A
                  href="/settings"
                  class="block border-b border-[#273449] px-3 py-2 text-sm text-[#dce8ff] transition hover:bg-[#17263f]"
                  onClick={() => setAccountMenuOpen(false)}
                  data-testid="appshell-account-settings"
                >
                  Settings
                </A>
                <A
                  href="/profile"
                  class="block border-b border-[#273449] px-3 py-2 text-sm text-[#dce8ff] transition hover:bg-[#17263f]"
                  onClick={() => setAccountMenuOpen(false)}
                  data-testid="appshell-account-quest-log"
                >
                  Quest Log
                </A>
                <button
                  type="button"
                  class="block w-full px-3 py-2 text-left text-sm text-[#ffb5ad] transition hover:bg-[#2a1719]"
                  onClick={() => void signOut()}
                  data-testid="appshell-account-signout"
                >
                  Sign out
                </button>
              </div>
            </Show>
          </div>
        </div>
      </Show>
    </main>
  );
}
