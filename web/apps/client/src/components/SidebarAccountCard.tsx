import { A } from "@solidjs/router";
import { createMutation, createQuery, useQueryClient } from "@tanstack/solid-query";
import { Show, createMemo, createSignal } from "solid-js";

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

  return (
    <Show when={session()}>
      <div class={props.class}>
        <button
          type="button"
          class="flex w-full items-center gap-2 rounded-xl border border-[#32445f] bg-[#121a28]/95 px-2.5 py-2 text-left shadow-[0_16px_32px_rgba(0,0,0,0.45)] transition hover:border-[#4b648a]"
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
            class="mt-2 overflow-hidden rounded-xl border border-[#344a6b] bg-[#111b2b]/98 shadow-[0_20px_42px_rgba(0,0,0,0.5)]"
            data-testid="appshell-account-menu"
          >
            <A
              href="/settings"
              class="block border-b border-[#273449] px-3 py-2 text-sm text-[#dce8ff] transition hover:bg-[#17263f]"
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
              class="block border-b border-[#273449] px-3 py-2 text-sm text-[#dce8ff] transition hover:bg-[#17263f]"
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
              class="block w-full px-3 py-2 text-left text-sm text-[#ffb5ad] transition hover:bg-[#2a1719]"
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
