import { useNavigate } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";

import { authApi } from "../server/api";

export default function LoginRoute() {
  const navigate = useNavigate();
  const [email, setEmail] = createSignal("");
  const [name, setName] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  onMount(async () => {
    try {
      const { session } = await authApi.me();
      if (session.user.showOnboarding) {
        navigate("/onboarding", { replace: true });
        return;
      }
      navigate("/task/inbox", { replace: true });
    } catch {
      // Not logged in yet.
    }
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const { session } = await authApi.login({
        email: email().trim(),
        name: name().trim() || undefined,
      });
      if (session.user.showOnboarding) {
        navigate("/onboarding", { replace: true });
        return;
      }
      navigate("/task/inbox", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main class="flex h-screen items-center justify-center bg-[#0a0d12] px-4 text-[#eceff7]">
      <form
        class="w-full max-w-md rounded-2xl border border-[#2c3648] bg-[#111926] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
        onSubmit={(event) => void submit(event)}
      >
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#8ea3c7]">Donegeon</p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#edf3ff]">Sign in</h1>
        <p class="mt-1 text-sm text-[#9fb0cc]">Log in with your email to start onboarding your team.</p>

        <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Email</label>
        <input
          type="email"
          required
          value={email()}
          onInput={(event) => setEmail(event.currentTarget.value)}
          class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
          placeholder="you@company.com"
        />

        <label class="mt-4 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Name (optional)</label>
        <input
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
          placeholder="Your name"
        />

        <button
          type="submit"
          disabled={saving()}
          class="mt-5 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#161616] transition hover:bg-[var(--accent-soft)] disabled:opacity-60"
        >
          {saving() ? "Signing in..." : "Continue"}
        </button>

        {error() ? <p class="mt-3 text-sm text-[#ff9b9b]">{error()}</p> : null}
      </form>
    </main>
  );
}

