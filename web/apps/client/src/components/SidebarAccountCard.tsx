import Button from "./Button";
import { css } from "@linaria/core";
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
        <Button
          type="button"
          class={style1}
          onClick={() => setAccountMenuOpen((open) => !open)}
          data-testid="appshell-account-toggle"
        >
          <span class={style2}>
            {accountInitials()}
          </span>
          <span class={style3}>
            <span class={style4}>{accountName()}</span>
            <span class={style5}>
              {accountPlan()}
            </span>
          </span>
          <span class={style6}>{accountMenuOpen() ? "▲" : "▼"}</span>
        </Button>

        <Show when={accountMenuOpen()}>
          <div
            class={style7}
            data-testid="appshell-account-menu"
          >
            <a
              href="/settings"
              class={style8}
              onClick={() => {
                setAccountMenuOpen(false);
                props.onNavigate?.();
              }}
              data-testid="appshell-account-settings"
            >
              Settings
            </a>
            <a
              href="/profile"
              class={style8}
              onClick={() => {
                setAccountMenuOpen(false);
                props.onNavigate?.();
              }}
              data-testid="appshell-account-quest-log"
            >
              Quest Log
            </a>
            <Button
              type="button"
              class={style9}
              onClick={() => logout.mutate()}
              data-testid="appshell-account-signout"
            >
              Sign out
            </Button>
          </div>
        </Show>
      </div>
    </Show>
  );
}


const style1 = css`
display: flex;
width: 100%;
align-items: center;
gap: calc(var(--spacing) * 2);
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 2.5);
padding-block: calc(var(--spacing) * 2);
text-align: left;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: var(--border-hover);
    }
  }
background: var(--panel); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style2 = css`
display: flex;
height: calc(var(--spacing) * 8);
width: calc(var(--spacing) * 8);
align-items: center;
justify-content: center;
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(119,155,187,0.32);
background-color: rgba(255,139,80,0.14);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--accent-text);
`;

const style3 = css`
min-width: calc(var(--spacing) * 0);
flex: 1;
`;

const style4 = css`
display: block;
overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style5 = css`
margin-top: calc(var(--spacing) * 0.5);
display: inline-flex;
border-radius: 0.25rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,139,80,0.24);
background-color: var(--accent-wash);
padding-inline: calc(var(--spacing) * 1.5);
padding-block: calc(var(--spacing) * 0.5);
font-size: 10px;
--tw-tracking: 0.08em;
  letter-spacing: 0.08em;
color: var(--accent-text);
text-transform: uppercase;
`;

const style6 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-muted);
`;

const style7 = css`
margin-top: calc(var(--spacing) * 2);
overflow: hidden;
border-radius: var(--radius-xl);
background: var(--panel); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style8 = css`
display: block;
border-bottom-style: var(--tw-border-style);
  border-bottom-width: 1px;
border-color: var(--border-strong);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.04);
    }
  }
`;

const style9 = css`
display: block;
width: 100%;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
text-align: left;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--danger);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      background-color: var(--danger-bg);
    }
  }
`;
