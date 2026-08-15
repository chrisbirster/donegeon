import { css } from "@linaria/core";
import { useLocation } from "@solidjs/router";
import { type ParentProps, Show, createSignal, onSettled } from "solid-js";

import LocalBetaToggle from "./LocalBetaToggle";
import { PublicConfigProvider } from "../context/PublicConfigContext";
import { applyLocalOpenBetaOverride, writeLocalOpenBetaOverride } from "../lib/openBeta";
import { APP_URL, PLAN_LINKS, defaultPublicConfig, loginHref, planHref, waitlistHref } from "../lib/site";

type AuthUser = {
  name: string;
  email: string;
};

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/features", label: "Features" },
  { href: "/docs", label: "Docs" },
  { href: "/blog", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
];

function userInitials(user: AuthUser): string {
  const name = (user.name || user.email || "?").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function MarketingLayout(props: ParentProps) {
  const location = useLocation();
  const [user, setUser] = createSignal<AuthUser | null>(null);
  const [checked, setChecked] = createSignal(false);
  const [publicConfig, setPublicConfig] = createSignal(applyLocalOpenBetaOverride(defaultPublicConfig()));
  const [configChecked, setConfigChecked] = createSignal(import.meta.env.DEV);

  onSettled(() => void (async () => {
    void (async () => {
      try {
        const response = await fetch(`${APP_URL}/api/public/config`);
        if (!response.ok) return;
        const data = await response.json();
        if (data?.config) {
          setPublicConfig(applyLocalOpenBetaOverride({
            openBeta: Boolean(data.config.openBeta),
            openBetaStartsAt: String(data.config.openBetaStartsAt || defaultPublicConfig().openBetaStartsAt),
            openBetaStartsLabel: String(data.config.openBetaStartsLabel || defaultPublicConfig().openBetaStartsLabel),
          }));
        }
      } catch {
        // Keep local fallback config when the API is unavailable.
      } finally {
        setConfigChecked(true);
      }
    })();

    try {
      const response = await fetch(`${APP_URL}/api/auth/me`, {
        credentials: "include",
      });
      if (!response.ok) return;

      const data = await response.json();
      if (!data?.session?.user) return;

      setUser({
        name: data.session.user.name ?? "",
        email: data.session.user.email ?? "",
      });
    } catch {
      // Intentionally silent for anonymous marketing traffic.
    } finally {
      setChecked(true);
    }
  })());

  function setLocalOpenBeta(next: boolean) {
    writeLocalOpenBetaOverride(next);
    setPublicConfig((current) => ({
      ...current,
      openBeta: next,
    }));
  }

  const signInHref = () => (publicConfig().openBeta ? loginHref() : waitlistHref({ source: "marketing-nav" }));
  const primaryCtaHref = () =>
    publicConfig().openBeta ? planHref("personal") : waitlistHref({ source: "marketing-footer", plan: "personal" });
  const secondaryCtaHref = () =>
    publicConfig().openBeta ? planHref("pro_trial") : waitlistHref({ source: "marketing-footer", plan: "pro_trial" });

  return (
    <div class={style1}>
      <div class={style2}>
        <Show when={configChecked()}>
          <div class={style3}>
            <div class={style4}>
              <p>☆ {publicConfig().openBeta ? "Open beta is live. Assemble your crew and get moving." : `Open beta starts ${publicConfig().openBetaStartsLabel}. Join the waitlist for early access.`}</p>
              <a
                href={waitlistHref({ source: "marketing-banner" })}
                class={style5}
              >
                Join the waitlist
              </a>
            </div>
          </div>
        </Show>

        <header class={style6}>
          <div class={style7}>
            <div class={style8}>
              <a href="/" class={style9}>
                <img
                  class={style10}
                  src="/images/marketing/donegeon-logo.png"
                  alt="Donegeon"
                />
              </a>
            </div>

            <nav class={style13}>
              {NAV_ITEMS.map((item) => (
                <a
                  href={item.href}
                  class={` ${style14} ${
                    isActivePath(location.pathname, item.href)
                      ? style15
                      : style16
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div class={style9}>
              <a
                href="/pricing"
                class={style17}
              >
                View plans
              </a>

              <Show
                when={checked()}
                fallback={<a href={signInHref()} class={style18}>{publicConfig().openBeta ? "Sign in" : "Join waitlist"}</a>}
              >
                <Show
                  when={user()}
                  fallback={
                    <a
                      href={signInHref()}
                      class={style18}
                    >
                      {publicConfig().openBeta ? "Sign in" : "Join waitlist"}
                    </a>
                  }
                >
                  {(currentUser) => (
                    <a
                      href={APP_URL}
                      title={currentUser().name || currentUser().email}
                      class={style19}
                    >
                      {userInitials(currentUser())}
                    </a>
                  )}
                </Show>
              </Show>
            </div>
          </div>

          <div class={style20}>
            <div class={style21}>
              {NAV_ITEMS.map((item) => (
                <a
                  href={item.href}
                  class={` ${style22} ${
                    isActivePath(location.pathname, item.href)
                      ? style15
                      : style23
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </header>

        <PublicConfigProvider config={publicConfig()}>
          <main class={style24}>{props.children}</main>
        </PublicConfigProvider>

        <section class={style25}>
          <div class={style26}>
            <div class={style27}>
              <div>
                <p class={style28}>Bring more focus, energy, and visibility</p>
                <h2 class={style29}>
                  Bring more focus, energy, and visibility to your team's work.
                </h2>
                <p class={style30}>
                  Start on Free, add collaboration when it matters, or talk to us about a broader rollout.
                </p>
              </div>

              <div class={style31}>
                <a
                  href={primaryCtaHref()}
                  class={style32}
                >
                  {publicConfig().openBeta ? "Start Free" : "Join waitlist"}
                </a>
                <a
                  href={secondaryCtaHref()}
                  class={style33}
                >
                  {publicConfig().openBeta ? "Start Pro Trial" : "Join Pro waitlist"}
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer class={style34}>
          <div class={style35}>
            <div>
              <p class={style36}>Donegeon</p>
              <p class={style37}>
                Task management for teams that want clarity, momentum, and a little more fun.
              </p>
            </div>

            <div>
              <p class={style38}>Product</p>
              <div class={style39}>
                <a href="/features">Features</a>
                <a href="/pricing">Pricing</a>
                <a href={APP_URL}>Open app</a>
              </div>
            </div>

            <div>
              <p class={style38}>Resources</p>
              <div class={style39}>
                <a href="/docs">Documentation</a>
                <a href="/blog">Blog</a>
                <a href={PLAN_LINKS.enterprise}>Enterprise contact</a>
              </div>
            </div>

            <div>
              <p class={style38}>Company</p>
              <div class={style39}>
                <a href="mailto:hello@donegeon.com">About</a>
                <a href="mailto:hello@donegeon.com?subject=Careers">Careers</a>
                <a href="mailto:hello@donegeon.com">Contact</a>
              </div>
            </div>

            <div>
              <p class={style38}>Support</p>
              <div class={style39}>
                <a href="mailto:hello@donegeon.com">hello@donegeon.com</a>
                <a href="mailto:sales@donegeon.com">sales@donegeon.com</a>
                <span>Support for teams, trials, and enterprise rollout.</span>
              </div>
            </div>
          </div>
          <div class={style40}>
            <span>© 2026 Donegeon, Inc. All rights reserved.</span>
            <div class={style41}><a href="mailto:hello@donegeon.com?subject=Privacy">Privacy</a><a href="mailto:hello@donegeon.com?subject=Terms">Terms</a><a href="mailto:hello@donegeon.com?subject=Security">Security</a><span>Status</span></div>
          </div>
        </footer>
        <LocalBetaToggle openBeta={publicConfig().openBeta} onToggle={setLocalOpenBeta} />
      </div>
    </div>
  );
}


const style1 = css`
min-height: 100vh;
background: #05040c;
color: var(--text-main);
`;

const style2 = css`
min-height: 100vh;
`;

const style3 = css`
border-bottom: 1px solid rgba(255,32,114,.24);
background: #070812;
`;

const style4 = css`
margin-inline: auto;
display: flex;
max-width: var(--container-6xl);
flex-direction: column;
gap: calc(var(--spacing) * 2);
padding-inline: calc(var(--spacing) * 6);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: #f2d6a0;
font-family: "Bebas Neue", sans-serif;
letter-spacing: .12em;
text-transform: uppercase;
@media (width >= 48rem) {
    flex-direction: row;
  }
@media (width >= 48rem) {
    align-items: center;
  }
@media (width >= 48rem) {
    justify-content: space-between;
  }
@media (width >= 48rem) {
    padding-inline: calc(var(--spacing) * 10);
  }
`;

const style5 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      color: #ffe0c8;
    }
  }
`;

const style6 = css`
position: sticky;
top: calc(var(--spacing) * 0);
z-index: 40;
border-bottom-style: var(--tw-border-style);
  border-bottom-width: 1px;
border-color: var(--border-strong);
background-color: rgba(5,6,13,.94);
box-shadow: 0 12px 36px rgba(0,0,0,.46);
--tw-backdrop-blur: blur(var(--blur-xl));
  -webkit-backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
  backdrop-filter: var(--tw-backdrop-blur,) var(--tw-backdrop-brightness,) var(--tw-backdrop-contrast,) var(--tw-backdrop-grayscale,) var(--tw-backdrop-hue-rotate,) var(--tw-backdrop-invert,) var(--tw-backdrop-opacity,) var(--tw-backdrop-saturate,) var(--tw-backdrop-sepia,);
`;

const style7 = css`
margin-inline: auto;
display: flex;
max-width: var(--container-6xl);
align-items: center;
justify-content: space-between;
gap: calc(var(--spacing) * 4);
padding-inline: calc(var(--spacing) * 6);
padding-block: calc(var(--spacing) * 4);
@media (width >= 48rem) {
    padding-inline: calc(var(--spacing) * 10);
  }
`;

const style8 = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 4);
`;

const style9 = css`
display: flex;
align-items: center;
gap: calc(var(--spacing) * 3);
`;

const style10 = css`
display: block;
width: clamp(9rem, 18vw, 13rem);
height: 3.5rem;
object-fit: contain;
object-position: left center;
mix-blend-mode: screen;
`;

const style11 = css`
font-size: 2rem;
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
letter-spacing: .01em;
color: var(--color-white);
font-family: "Permanent Marker", "Space Grotesk", sans-serif;
text-transform: uppercase;
transform: rotate(-2deg);
text-shadow: 0 0 16px rgba(255,32,114,.38);
`;

const style12 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.18em;
  letter-spacing: 0.18em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style13 = css`
display: none;
align-items: center;
gap: calc(var(--spacing) * 2);
@media (width >= 48rem) {
    display: flex;
  }
`;

const style14 = css`
border-radius: 4px;
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-family: "Bebas Neue", sans-serif;
font-size: 1.05rem;
letter-spacing: .07em;
text-transform: uppercase;
  line-height: var(--tw-leading, var(--text-sm--line-height));
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

const style15 = css`
background: linear-gradient(135deg, rgba(193,60,255,.16), rgba(239,58,215,.08));
color: #f1d7ff;
box-shadow: inset 0 -2px #d13cff, 0 0 18px rgba(193,60,255,.14);
`;

const style16 = css`
color: var(--text-muted);
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.04);
    }
  }
&:hover {
    @media (hover: hover) {
      color: var(--color-white);
    }
  }
`;

const style17 = css`
display: none;
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.03);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #466684;
    }
  }
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.06);
    }
  }
@media (width >= 48rem) {
    display: inline-flex;
  }
`;

const style18 = css`
display: inline-flex;
border-radius: 5px;
background: linear-gradient(135deg,#a51be8,#7211c2);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #fff;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      filter: brightness(1.12);
    }
  }
`;

const style19 = css`
display: inline-flex;
height: calc(var(--spacing) * 10);
width: calc(var(--spacing) * 10);
align-items: center;
justify-content: center;
border-radius: calc(infinity * 1px);
background-color: #ff8b50;
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-bold);
  font-weight: var(--font-weight-bold);
color: #180d05;
--tw-shadow: 0 12px 24px var(--tw-shadow-color, rgba(255,139,80,0.2));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      background-color: #ffa16f;
    }
  }
`;

const style20 = css`
border-color: rgba(255,255,255,0.04);
@media (width >= 48rem) {
    display: none;
  }
`;

const style21 = css`
margin-inline: auto;
display: flex;
max-width: var(--container-6xl);
gap: calc(var(--spacing) * 1);
overflow-x: auto;
padding-inline: calc(var(--spacing) * 6);
padding-block: calc(var(--spacing) * 3);
@media (width >= 48rem) {
    padding-inline: calc(var(--spacing) * 10);
  }
`;

const style22 = css`
border-radius: calc(infinity * 1px);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 1.5);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
white-space: nowrap;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
`;

const style23 = css`
color: var(--text-muted);
`;

const style24 = css`
margin-inline: auto;
max-width: var(--container-6xl);
padding-inline: calc(var(--spacing) * 6);
padding-block: calc(var(--spacing) * 10);
@media (width >= 48rem) {
    padding-inline: calc(var(--spacing) * 10);
  }
@media (width >= 48rem) {
    padding-block: calc(var(--spacing) * 14);
  }
`;

const style25 = css`
margin-inline: auto;
max-width: var(--container-6xl);
padding-inline: calc(var(--spacing) * 6);
padding-bottom: calc(var(--spacing) * 8);
@media (width >= 48rem) {
    padding-inline: calc(var(--spacing) * 10);
  }
@media (width >= 48rem) {
    padding-bottom: calc(var(--spacing) * 12);
  }
`;

const style26 = css`
overflow: hidden;
border-radius: 2rem;
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-image: linear-gradient(90deg,rgba(23,8,39,.96),rgba(13,18,35,.78)),url('/images/donegeon-hero-city.png');
background-size: cover;
background-position: center 62%;
padding: calc(var(--spacing) * 8);
--tw-shadow: 0 30px 60px var(--tw-shadow-color, rgba(0,0,0,0.28));
  box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow);
`;

const style27 = css`
display: grid;
gap: calc(var(--spacing) * 6);
@media (width >= 48rem) {
    grid-template-columns: minmax(0,1fr) auto;
  }
@media (width >= 48rem) {
    align-items: flex-end;
  }
`;

const style28 = css`
color: #9fe8b4; font-size: .75rem; font-weight: 700; letter-spacing: .18em; margin: 0 0 .6rem; text-transform: uppercase;
`;

const style29 = css`
font-size: var(--text-3xl);
  line-height: var(--tw-leading, var(--text-3xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
@media (width >= 48rem) {
    font-size: var(--text-4xl);
    line-height: var(--tw-leading, var(--text-4xl--line-height));
  }
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style30 = css`
margin-top: calc(var(--spacing) * 3);
max-width: var(--container-2xl);
font-size: var(--text-base);
  line-height: var(--tw-leading, var(--text-base--line-height));
color: var(--text-soft);
@media (width >= 48rem) {
    font-size: var(--text-lg);
    line-height: var(--tw-leading, var(--text-lg--line-height));
  }
`;

const style31 = css`
display: flex;
flex-wrap: wrap;
gap: calc(var(--spacing) * 3);
`;

const style32 = css`
display: inline-flex;
border-radius: calc(infinity * 1px);
background: linear-gradient(135deg,#a51be8,#7211c2);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: #fff;
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      filter: brightness(1.12);
    }
  }
`;

const style33 = css`
display: inline-flex;
border-radius: calc(infinity * 1px);
border-style: var(--tw-border-style);
  border-width: 1px;
border-color: var(--border-strong);
background-color: rgba(255,255,255,0.05);
padding-inline: calc(var(--spacing) * 5);
padding-block: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
transition-property: color, background-color, border-color, outline-color, text-decoration-color, fill, stroke, --tw-gradient-from, --tw-gradient-via, --tw-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter, display, content-visibility, overlay, pointer-events;
  transition-timing-function: var(--tw-ease, var(--default-transition-timing-function));
  transition-duration: var(--tw-duration, var(--default-transition-duration));
&:hover {
    @media (hover: hover) {
      border-color: #4a6c8b;
    }
  }
&:hover {
    @media (hover: hover) {
      background-color: rgba(255,255,255,0.08);
    }
  }
`;

const style34 = css`
border-color: var(--border-strong);
background-color: rgba(4,8,12,0.82);
`;

const style35 = css`
margin-inline: auto;
display: grid;
max-width: var(--container-6xl);
gap: calc(var(--spacing) * 8);
padding-inline: calc(var(--spacing) * 6);
padding-block: calc(var(--spacing) * 10);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
@media (width >= 48rem) {
    grid-template-columns: 1.35fr repeat(4, minmax(0, 1fr));
  }
@media (width >= 48rem) {
    padding-inline: calc(var(--spacing) * 10);
  }
`;

const style36 = css`
font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style37 = css`
margin-top: calc(var(--spacing) * 3);
max-width: var(--container-xs);
color: var(--text-muted);
`;

const style38 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: #9db8d3;
text-transform: uppercase;
`;

const style39 = css`
margin-top: calc(var(--spacing) * 3);
display: flex;
flex-direction: column;
gap: calc(var(--spacing) * 2);
color: var(--text-muted);
`;

const style40 = css`
margin-inline:auto;display:flex;max-width:var(--container-6xl);align-items:center;justify-content:space-between;gap:20px;border-top:1px solid rgba(255,255,255,.08);padding:18px 24px;color:var(--text-muted);font-size:.68rem;@media(width>=48rem){padding-inline:40px}@media(width<600px){align-items:flex-start;flex-direction:column}
`;

const style41 = css`
display:flex;flex-wrap:wrap;gap:18px;
`;
