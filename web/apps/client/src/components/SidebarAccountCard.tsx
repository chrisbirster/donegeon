import { A } from "@solidjs/router";
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query";
import { Show, createMemo, createSignal } from "solid-js";

import { workspacePlanLabel } from "../../../../shared/pricing/catalog";
import { useApi } from "../context/ApiContext";
import { type AuthSession } from "../server/api";

type SidebarAccountCardProps = {
  class?: string;
  onNavigate?: () => void;
};

export default function SidebarAccountCard(props: SidebarAccountCardProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [accountMenuOpen, setAccountMenuOpen] = createSignal(false);
  const sessionQuery = createQuery(() => ({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const response = await api.auth.me();
      return response.session as AuthSession;
    },
  }));
  const logout = createMutation(() => ({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      queryClient.clear();
      window.location.href = "/login";
    },
  }));

  const session = () => sessionQuery.data ?? null;

  const accountName = createMemo(() => {
    const value = session()?.user.name?.trim();
    if (value) return value;
    return session()?.user.email?.trim() || "Donegeon User";
  });
  const accountPlan = createMemo(() => {
    return workspacePlanLabel(session()?.team?.plan || "personal");
  });
  const accountInitials = createMemo(() => {
    const source = accountName().trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  });

  return (
    <Show when={session()}>
      <div class={props.class}>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[rgba(9,17,26,0.92)] px-2.5 py-2 text-left shadow-[0_16px_32px_rgba(0,0,0,0.38)] backdrop-blur transition hover:border-[#466684]"
          onClick={() => setAccountMenuOpen((open) => !open)}
          data-testid="appshell-account-toggle"
        >
          <span class="flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(119,155,187,0.32)] bg-[rgba(255,139,80,0.14)] text-xs font-semibold text-[var(--accent-text)]">
            {accountInitials()}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-white">{accountName()}</span>
            <span class="mt-0.5 inline-flex rounded border border-[rgba(255,139,80,0.24)] bg-[var(--accent-wash)] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--accent-text)]">
              {accountPlan()}
            </span>
          </span>
          <span class="text-xs text-[var(--text-muted)]">{accountMenuOpen() ? "▲" : "▼"}</span>
        </button>

        <Show when={accountMenuOpen()}>
          <div
            class="mt-2 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[rgba(6,10,16,0.96)] shadow-[0_20px_42px_rgba(0,0,0,0.5)] backdrop-blur"
            data-testid="appshell-account-menu"
          >
            <A
              href="/settings"
              class="block border-b border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--text-main)] transition hover:bg-[rgba(255,255,255,0.04)]"
              onClick={() => {
                setAccountMenuOpen(false);
                props.onNavigate?.();
              }}
              data-testid="appshell-account-settings"
            >
              Settings
            </A>
            <A
              href="/profile"
              class="block border-b border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--text-main)] transition hover:bg-[rgba(255,255,255,0.04)]"
              onClick={() => {
                setAccountMenuOpen(false);
                props.onNavigate?.();
              }}
              data-testid="appshell-account-quest-log"
            >
              Quest Log
            </A>
            <button
              type="button"
              class="block w-full px-3 py-2 text-left text-sm text-[var(--danger)] transition hover:bg-[var(--danger-bg)]"
              onClick={() => logout.mutate()}
              data-testid="appshell-account-signout"
            >
              Sign out
            </button>
          </div>
        </Show>
      </div>
    </Show>
  );
}
