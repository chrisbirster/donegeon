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
    <div class="min-h-screen bg-[radial-gradient(circle_at_top,#163049_0%,#09131c_40%,#04070c_100%)] text-[var(--text-main)]">
      <div class="surface-grid min-h-screen">
        <Show when={configChecked() && !publicConfig().openBeta}>
          <div class="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(255,139,80,0.14)]">
            <div class="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-3 text-sm text-[#ffe0c8] md:flex-row md:items-center md:justify-between md:px-10">
              <p>Open beta starts {publicConfig().openBetaStartsLabel}. Join the waitlist for early access.</p>
              <a
                href={waitlistHref({ source: "marketing-banner" })}
                class="font-semibold text-white transition hover:text-[#ffe0c8]"
              >
                Join the waitlist
              </a>
            </div>
          </div>
        </Show>

        <header class="sticky top-0 z-40 border-b border-[var(--border-strong)] bg-[rgba(6,10,16,0.78)] backdrop-blur-xl">
          <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 md:px-10">
            <div class="flex items-center gap-4">
              <a href="/" class="flex items-center gap-3">
                <span class="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#355471] bg-[#0f1d2c] text-sm font-semibold text-[#ffd8ad] shadow-[0_12px_24px_rgba(0,0,0,0.28)]">
                  D
                </span>
                <div>
                  <p class="font-display text-lg font-semibold tracking-[0.08em] text-white">Donegeon</p>
                  <p class="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">Task management for teams</p>
                </div>
              </a>
            </div>

            <nav class="hidden items-center gap-2 md:flex">
              {NAV_ITEMS.map((item) => (
                <a
                  href={item.href}
                  class={`rounded-full px-3 py-2 text-sm transition ${
                    isActivePath(location.pathname, item.href)
                      ? "bg-[rgba(255,139,80,0.14)] text-[#ffd7b7]"
                      : "text-[var(--text-muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div class="flex items-center gap-3">
              <a
                href="/pricing"
                class="hidden rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm text-[var(--text-main)] transition hover:border-[#466684] hover:bg-[rgba(255,255,255,0.06)] md:inline-flex"
              >
                View plans
              </a>

              <Show when={checked()}>
                <Show
                  when={user()}
                  fallback={
                    <a
                      href={signInHref()}
                      class="inline-flex rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#1d1108] transition hover:bg-[#ff9f6d]"
                    >
                      {publicConfig().openBeta ? "Sign in" : "Join waitlist"}
                    </a>
                  }
                >
                  {(currentUser) => (
                    <a
                      href={APP_URL}
                      title={currentUser().name || currentUser().email}
                      class="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#ff8b50] text-sm font-bold text-[#180d05] shadow-[0_12px_24px_rgba(255,139,80,0.2)] transition hover:bg-[#ffa16f]"
                    >
                      {userInitials(currentUser())}
                    </a>
                  )}
                </Show>
              </Show>
            </div>
          </div>

          <div class="border-t border-[rgba(255,255,255,0.04)] md:hidden">
            <div class="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-6 py-3 md:px-10">
              {NAV_ITEMS.map((item) => (
                <a
                  href={item.href}
                  class={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition ${
                    isActivePath(location.pathname, item.href)
                      ? "bg-[rgba(255,139,80,0.14)] text-[#ffd7b7]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        </header>

        <PublicConfigProvider config={publicConfig()}>
          <main class="mx-auto max-w-6xl px-6 py-10 md:px-10 md:py-14">{props.children}</main>
        </PublicConfigProvider>

        <section class="mx-auto max-w-6xl px-6 pb-8 md:px-10 md:pb-12">
          <div class="overflow-hidden rounded-[2rem] border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(255,139,80,0.12),rgba(103,187,255,0.07)_55%,rgba(138,228,163,0.08))] p-8 shadow-[0_30px_60px_rgba(0,0,0,0.28)]">
            <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div>
                <p class="section-label">Bring more focus, energy, and visibility</p>
                <h2 class="font-display text-3xl font-semibold text-white md:text-4xl">
                  Bring more focus, energy, and visibility to your team's work.
                </h2>
                <p class="mt-3 max-w-2xl text-base text-[var(--text-soft)] md:text-lg">
                  Start on Free, add collaboration when it matters, or talk to us about a broader rollout.
                </p>
              </div>

              <div class="flex flex-wrap gap-3">
                <a
                  href={primaryCtaHref()}
                  class="inline-flex rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[#1d1108] transition hover:bg-[#ff9f6d]"
                >
                  {publicConfig().openBeta ? "Start Free" : "Join waitlist"}
                </a>
                <a
                  href={secondaryCtaHref()}
                  class="inline-flex rounded-full border border-[var(--border-strong)] bg-[rgba(255,255,255,0.05)] px-5 py-3 text-sm font-semibold text-[var(--text-main)] transition hover:border-[#4a6c8b] hover:bg-[rgba(255,255,255,0.08)]"
                >
                  {publicConfig().openBeta ? "Start Pro Trial" : "Join Pro waitlist"}
                </a>
              </div>
            </div>
          </div>
        </section>

        <footer class="border-t border-[var(--border-strong)] bg-[rgba(4,8,12,0.82)]">
          <div class="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-sm md:grid-cols-4 md:px-10">
            <div>
              <p class="font-display text-lg font-semibold text-white">Donegeon</p>
              <p class="mt-3 max-w-xs text-[var(--text-muted)]">
                Task management for teams that want clarity, momentum, and a little more fun.
              </p>
            </div>

            <div>
              <p class="font-semibold uppercase tracking-[0.12em] text-[#9db8d3]">Product</p>
              <div class="mt-3 flex flex-col gap-2 text-[var(--text-muted)]">
                <a href="/features">Features</a>
                <a href="/pricing">Pricing</a>
                <a href={APP_URL}>Open app</a>
              </div>
            </div>

            <div>
              <p class="font-semibold uppercase tracking-[0.12em] text-[#9db8d3]">Resources</p>
              <div class="mt-3 flex flex-col gap-2 text-[var(--text-muted)]">
                <a href="/docs">Documentation</a>
                <a href="/blog">Blog</a>
                <a href={PLAN_LINKS.enterprise}>Enterprise contact</a>
              </div>
            </div>

            <div>
              <p class="font-semibold uppercase tracking-[0.12em] text-[#9db8d3]">Support</p>
              <div class="mt-3 flex flex-col gap-2 text-[var(--text-muted)]">
                <a href="mailto:hello@donegeon.com">hello@donegeon.com</a>
                <a href="mailto:sales@donegeon.com">sales@donegeon.com</a>
                <span>Support for teams, trials, and enterprise rollout.</span>
              </div>
            </div>
          </div>
        </footer>
        <LocalBetaToggle openBeta={publicConfig().openBeta} onToggle={setLocalOpenBeta} />
      </div>
    </div>
  );
}
