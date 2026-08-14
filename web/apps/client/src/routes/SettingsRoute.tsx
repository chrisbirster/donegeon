import Button from "../components/Button";
import { css } from "@linaria/core";
import { createQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";

import AppShell from "../components/AppShell";
import { useApi } from "../context/ApiContext";
import { useTheme } from "../context/ThemeContext";
import { queryClient } from "../lib/queryClient";
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
  }), () => queryClient);

  const session = () => sessionQuery.data ?? null;

  return (
    <AppShell
      activeView="profile"
      mobileSidebar={
        <div class={style1}>
          <section class={style2}>
            <p class={style3}>Account</p>
            <p class={style4}>{session()?.user.name || "Donegeon User"}</p>
            <p class={style5}>{session()?.user.email || ""}</p>
          </section>

          <section class={style2}>
            <p class={style3}>Appearance</p>
            <p class={style6}>
              {theme.preference() === "system" ? "Using browser default" : `${preferenceLabel(theme.preference())} mode selected`}
            </p>
            <p class={style5}>Current result: {resolvedThemeLabel(theme.resolvedTheme())}</p>
          </section>
        </div>
      }
    >
      <section class={style7}>
        <div class={style8}>
          <header class={style9}>
            <p class={style3}>Personal Settings</p>
            <h1 class={style10}>
              Appearance
            </h1>
            <p class={style11}>
              Choose whether Donegeon follows your browser default, stays bright, or stays dark.
            </p>
          </header>

          <section class={style12} data-testid="settings-theme-panel">
            <div class={style13}>
              <div>
                <h2 class={style14}>Theme Preference</h2>
                <p class={style15}>
                  Browser default uses `prefers-color-scheme` and updates automatically when your system theme changes.
                </p>
              </div>
              <span class={style16}>
                Active: {resolvedThemeLabel(theme.resolvedTheme())}
              </span>
            </div>

            <div class={style17}>
              <For each={THEME_OPTIONS}>
                {(option) => {
                  const selected = () => theme.preference() === option.value;
                  return (
                    <Button
                      type="button"
                      class={` ${style18} ${
                        selected()
                          ? style19
                          : style20
                      }`}
                      onClick={() => theme.setPreference(option.value)}
                      aria-pressed={selected() ? "true" : "false"}
                      data-testid={`theme-option-${option.value}`}
                    >
                      <div class={style21}>
                        <p class={` ${style22} ${selected() ? style23 : style24}`}>
                          {option.label}
                        </p>
                        <Show when={selected()}>
                          <span class={style25}>
                            Selected
                          </span>
                        </Show>
                      </div>
                      <p class={` ${style26} ${selected() ? style24 : style27}`}>
                        {option.description}
                      </p>
                    </Button>
                  );
                }}
              </For>
            </div>

            <p class={style28}>
              {theme.preference() === "system"
                ? `Browser default is currently resolving to ${resolvedThemeLabel(theme.resolvedTheme())} mode.`
                : `You are forcing ${preferenceLabel(theme.preference())} mode until you switch back to browser default.`}
            </p>
          </section>

          <section class={style12}>
            <p class={style3}>Account</p>
            <Show when={sessionQuery.isPending}>
              <p class={style29}>
                Loading account settings...
              </p>
            </Show>

            <Show when={!sessionQuery.isPending && session()}>
              <div class={style30}>
                <div class={style31}>
                  <p class={style32}>Name</p>
                  <p class={style33}>{session()?.user.name || "Not set"}</p>
                </div>
                <div class={style31}>
                  <p class={style32}>Email</p>
                  <p class={style33}>{session()?.user.email || "Not set"}</p>
                </div>
              </div>
            </Show>
          </section>
        </div>
      </section>
    </AppShell>
  );
}


const style1 = css`
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 3) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 3) * calc(1 - var(--tw-space-y-reverse)));
  }
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
`;

const style2 = css`
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2.5);
background: var(--panel); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style3 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style4 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style5 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
`;

const style6 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
`;

const style7 = css`
height: 100%;
overflow-y: auto;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    padding-inline: calc(var(--spacing) * 6);
  }
@media (width >= 48rem) {
    padding-block: calc(var(--spacing) * 6);
  }
`;

const style8 = css`
margin-inline: auto;
display: flex;
width: 100%;
max-width: var(--container-4xl);
flex-direction: column;
gap: calc(var(--spacing) * 4);
`;

const style9 = css`
border-radius: var(--radius-2xl);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 4);
background: linear-gradient(180deg, var(--panel-strong-start), var(--panel-strong-end)); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style10 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-3xl);
  line-height: var(--tw-leading, var(--text-3xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: -0.03em;
  letter-spacing: -0.03em;
color: var(--text-main);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style11 = css`
margin-top: calc(var(--spacing) * 2);
max-width: var(--container-2xl);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style12 = css`
border-radius: var(--radius-2xl);
padding: calc(var(--spacing) * 5);
background: var(--panel); border: 1px solid var(--border-strong); box-shadow: var(--shadow-elevated); backdrop-filter: blur(18px);
`;

const style13 = css`
display: flex;
flex-wrap: wrap;
align-items: flex-start;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

const style14 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style15 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style16 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,139,80,0.24);
background-color: var(--accent-wash);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1);
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--accent-text);
text-transform: uppercase;
`;

const style17 = css`
margin-top: calc(var(--spacing) * 4);
display: grid;
gap: calc(var(--spacing) * 3);
@media (width >= 48rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

const style18 = css`
border-radius: var(--radius-2xl);
border-style: var(--tw-border-style);
  border-width: 1px;
padding: calc(var(--spacing) * 4);
text-align: left;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

const style19 = css`
background-color: var(--accent-wash);
--tw-shadow: 0 18px 36px var(--tw-shadow-color, rgba(0,0,0,0.12));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style20 = css`
&:hover {
    @media (hover: hover) {
      border-color: var(--border-hover);
    }
  }
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

const style21 = css`
display: flex;
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 3);
`;

const style22 = css`
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
`;

const style23 = css`
color: var(--accent-text);
`;

const style24 = css`
color: var(--text-main);
`;

const style25 = css`
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: rgba(255,139,80,0.24);
background-color: rgba(255,255,255,0.4);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 0.5);
font-size: 10px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.1em;
  letter-spacing: 0.1em;
color: var(--accent-text);
text-transform: uppercase;
`;

const style26 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
`;

const style27 = css`
color: var(--text-soft);
`;

const style28 = css`
margin-top: calc(var(--spacing) * 4);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-muted);
`;

const style29 = css`
margin-top: calc(var(--spacing) * 3);
border-radius: var(--radius-xl);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-soft);
background-color: var(--panel-soft);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style30 = css`
margin-top: calc(var(--spacing) * 3);
display: grid;
gap: calc(var(--spacing) * 3);
@media (width >= 48rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const style31 = css`
border-radius: var(--radius-xl);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 3);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

const style32 = css`
font-size: 11px;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style33 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
color: var(--text-main);
`;
