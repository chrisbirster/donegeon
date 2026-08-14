import { createQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";

import AppShell from "../components/AppShell";
import { useApi } from "../context/ApiContext";
import { useTheme } from "../context/ThemeContext";
import { type AuthSession } from "../server/api";

const THEME_OPTIONS = [
  {
    value: "system",
    label: "Use Browser Default",
    description: "Follow your browser or operating system preference automatically.",
  },
  {
    value: "light",
    label: "Light Mode",
    description: "Bright surfaces with the same orange and blue Donegeon accents.",
  },
  {
    value: "dark",
    label: "Dark Mode",
    description: "Keep the current marketing-inspired dark theme everywhere.",
  },
] as const;

function resolvedThemeLabel(value: "light" | "dark"): string {
  return value === "light" ? "Light" : "Dark";
}

function preferenceLabel(value: "system" | "light" | "dark"): string {
  if (value === "system") return "Browser Default";
  return resolvedThemeLabel(value);
}

export default function SettingsRoute() {
  const api = useApi();
  const theme = useTheme();
  const sessionQuery = createQuery(() => ({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await api.auth.me();
      return response.session as AuthSession;
    },
  }));

  const session = () => sessionQuery.data ?? null;

  return (
    <AppShell
      activeView="profile"
      mobileSidebar={
        <div class="space-y-3 text-sm">
          <section class="app-panel rounded-lg px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Account</p>
            <p class="mt-1 text-sm font-semibold text-[var(--text-main)]">{session()?.user.name || "Donegeon User"}</p>
            <p class="text-xs text-[var(--text-soft)]">{session()?.user.email || ""}</p>
          </section>

          <section class="app-panel rounded-lg px-3 py-2.5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Appearance</p>
            <p class="mt-1 text-sm text-[var(--text-main)]">
              {theme.preference() === "system" ? "Using browser default" : `${preferenceLabel(theme.preference())} mode selected`}
            </p>
            <p class="text-xs text-[var(--text-soft)]">Current result: {resolvedThemeLabel(theme.resolvedTheme())}</p>
          </section>
        </div>
      }
    >
      <section class="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6">
        <div class="mx-auto flex w-full max-w-4xl flex-col gap-4">
          <header class="app-panel-strong rounded-2xl px-5 py-4">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Personal Settings</p>
            <h1 class="font-display mt-2 text-3xl font-semibold tracking-[-0.03em] text-[var(--text-main)]">
              Appearance
            </h1>
            <p class="mt-2 max-w-2xl text-sm text-[var(--text-soft)]">
              Choose whether Donegeon follows your browser default, stays bright, or stays dark.
            </p>
          </header>

          <section class="app-panel rounded-2xl p-5" data-testid="settings-theme-panel">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Theme Preference</h2>
                <p class="mt-2 text-sm text-[var(--text-soft)]">
                  Browser default uses `prefers-color-scheme` and updates automatically when your system theme changes.
                </p>
              </div>
              <span class="rounded-full border border-[rgba(255,139,80,0.24)] bg-[var(--accent-wash)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-text)]">
                Active: {resolvedThemeLabel(theme.resolvedTheme())}
              </span>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-3">
              <For each={THEME_OPTIONS}>
                {(option) => {
                  const selected = () => theme.preference() === option.value;
                  return (
                    <button
                      type="button"
                      class={`rounded-2xl border p-4 text-left transition ${
                        selected()
                          ? "border-[rgba(255,139,80,0.28)] bg-[var(--accent-wash)] shadow-[0_18px_36px_rgba(0,0,0,0.12)]"
                          : "app-panel-soft hover:border-[var(--border-hover)]"
                      }`}
                      onClick={() => theme.setPreference(option.value)}
                      aria-pressed={selected() ? "true" : "false"}
                      data-testid={`theme-option-${option.value}`}
                    >
                      <div class="flex items-center justify-between gap-3">
                        <p class={`text-sm font-semibold ${selected() ? "text-[var(--accent-text)]" : "text-[var(--text-main)]"}`}>
                          {option.label}
                        </p>
                        <Show when={selected()}>
                          <span class="rounded-full border border-[rgba(255,139,80,0.24)] bg-[rgba(255,255,255,0.4)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--accent-text)]">
                            Selected
                          </span>
                        </Show>
                      </div>
                      <p class={`mt-2 text-sm ${selected() ? "text-[var(--text-main)]" : "text-[var(--text-soft)]"}`}>
                        {option.description}
                      </p>
                    </button>
                  );
                }}
              </For>
            </div>

            <p class="mt-4 text-xs text-[var(--text-muted)]">
              {theme.preference() === "system"
                ? `Browser default is currently resolving to ${resolvedThemeLabel(theme.resolvedTheme())} mode.`
                : `You are forcing ${preferenceLabel(theme.preference())} mode until you switch back to browser default.`}
            </p>
          </section>

          <section class="app-panel rounded-2xl p-5">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Account</p>
            <Show when={sessionQuery.isPending}>
              <p class="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--panel-soft)] px-4 py-3 text-sm text-[var(--text-soft)]">
                Loading account settings...
              </p>
            </Show>

            <Show when={!sessionQuery.isPending && session()}>
              <div class="mt-3 grid gap-3 md:grid-cols-2">
                <div class="app-panel-soft rounded-xl px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Name</p>
                  <p class="mt-2 text-sm font-medium text-[var(--text-main)]">{session()?.user.name || "Not set"}</p>
                </div>
                <div class="app-panel-soft rounded-xl px-4 py-3">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Email</p>
                  <p class="mt-2 text-sm font-medium text-[var(--text-main)]">{session()?.user.email || "Not set"}</p>
                </div>
              </div>
            </Show>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
