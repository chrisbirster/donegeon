import { useNavigate } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";

import { authApi } from "../server/api";

function parseInviteEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export default function OnboardingRoute() {
  const navigate = useNavigate();
  const [teamName, setTeamName] = createSignal("");
  const [inviteInput, setInviteInput] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");

  onMount(async () => {
    try {
      const { session } = await authApi.me();
      if (!session.user.showOnboarding) {
        navigate("/task/inbox", { replace: true });
      }
    } catch {
      navigate("/login", { replace: true });
    }
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await authApi.completeOnboarding(teamName().trim(), parseInviteEmails(inviteInput()));
      navigate("/task/inbox", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main class="flex h-screen items-center justify-center bg-[#0a0d12] px-4 text-[#eceff7]">
      <form
        class="w-full max-w-xl rounded-2xl border border-[#2c3648] bg-[#111926] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
        onSubmit={(event) => void submit(event)}
      >
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#8ea3c7]">Onboarding</p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#edf3ff]">Create your team</h1>
        <p class="mt-1 text-sm text-[#9fb0cc]">
          Set your team/workspace name and optionally invite teammates by email.
        </p>

        <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Team name</label>
        <input
          required
          value={teamName()}
          onInput={(event) => setTeamName(event.currentTarget.value)}
          class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
          placeholder="My Team"
        />

        <label class="mt-4 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Invite emails (optional)</label>
        <textarea
          rows={4}
          value={inviteInput()}
          onInput={(event) => setInviteInput(event.currentTarget.value)}
          class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
          placeholder="teammate1@company.com, teammate2@company.com"
        />
        <p class="mt-1 text-xs text-[#8ea3c7]">Use commas or new lines between emails.</p>

        <button
          type="submit"
          disabled={saving()}
          class="mt-5 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#161616] transition hover:bg-[var(--accent-soft)] disabled:opacity-60"
        >
          {saving() ? "Finishing..." : "Finish onboarding"}
        </button>

        {error() ? <p class="mt-3 text-sm text-[#ff9b9b]">{error()}</p> : null}
      </form>
    </main>
  );
}

