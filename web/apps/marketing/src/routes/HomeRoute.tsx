import { createSignal, onMount, Show } from "solid-js";

const APP_URL = "https://app.donegeon.com";

type AuthUser = {
  name: string;
  email: string;
};

function userInitials(user: AuthUser): string {
  const name = (user.name || user.email || "?").trim();
  const parts = name.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function HomeRoute() {
  const [user, setUser] = createSignal<AuthUser | null>(null);
  const [checked, setChecked] = createSignal(false);

  onMount(async () => {
    try {
      const res = await fetch(`${APP_URL}/api/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data?.session?.user) {
          setUser({ name: data.session.user.name ?? "", email: data.session.user.email ?? "" });
        }
      }
    } catch {
      // not logged in or network error — show sign-in button
    } finally {
      setChecked(true);
    }
  });

  return (
    <main class="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#2e5a3f_0%,#0d1523_45%,#070b13_100%)] text-[#e9f0ff]">
      {/* Top nav */}
      <nav class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-10">
        <span class="text-sm font-bold tracking-wide text-[#9ec6ff]">Donegeon</span>

        <Show when={checked()}>
          <Show
            when={user()}
            fallback={
              <a
                class="rounded-lg border border-[#36527a] bg-[#0f2037]/80 px-4 py-1.5 text-xs font-semibold text-[#d7e5ff] transition hover:border-[#4f77b0]"
                href={`${APP_URL}/login`}
              >
                Sign In
              </a>
            }
          >
            {(u) => (
              <a
                href={APP_URL}
                title={u().name || u().email}
                class="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff6a4a] text-xs font-bold text-[#1a0d08] transition hover:bg-[#ff845f]"
              >
                {userInitials(u())}
              </a>
            )}
          </Show>
        </Show>
      </nav>

      <section class="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12 md:px-10 md:py-20">
        <div class="grid gap-10 md:grid-cols-[minmax(0,1fr)_320px] md:items-end">
          <div>
            <h1 class="max-w-3xl text-4xl font-black leading-tight md:text-6xl">
              Turn Chaotic Tasks Into a Living Strategy Board
            </h1>
            <p class="mt-5 max-w-2xl text-lg text-[#b8c8e2] md:text-xl">
              Donegeon blends tasks, recurrence, deadlines, and resource management into one tactical workspace for teams.
            </p>
            <div class="mt-8 flex flex-wrap gap-3">
              <a
                class="rounded-lg bg-[#ff6a4a] px-5 py-2.5 text-sm font-semibold text-[#1a0d08] transition hover:bg-[#ff845f]"
                href={APP_URL}
              >
                Open App
              </a>
              <a
                class="rounded-lg border border-[#36527a] bg-[#0f2037]/80 px-5 py-2.5 text-sm font-semibold text-[#d7e5ff] transition hover:border-[#4f77b0]"
                href="mailto:hello@donegeon.com"
              >
                Contact Team
              </a>
            </div>
          </div>

          <aside class="rounded-2xl border border-[#324f74] bg-[#0e1b2e]/85 p-6 shadow-[0_16px_40px_rgba(4,9,18,0.45)]">
            <p class="text-sm font-semibold uppercase tracking-[0.08em] text-[#9ec6ff]">Built For</p>
            <ul class="mt-4 space-y-2 text-sm text-[#d6e4fb]">
              <li>Recurring task workflows</li>
              <li>Priority and deadline control</li>
              <li>Gamified team execution</li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  );
}
