import { useLocation, useNavigate } from "@solidjs/router";
import { createSignal, onMount } from "solid-js";

import { useApi } from "../context/ApiContext";

function parseInviteEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/g)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizePlan(raw: string): "personal" | "pro_trial" | "enterprise" {
  const value = raw.trim().toLowerCase();
  if (value === "pro_trial" || value === "pro") return "pro_trial";
  if (value === "enterprise") return "enterprise";
  return "personal";
}

function normalizeBoardNameInput(raw: string): string {
  return raw.trim().replace(/\s+/g, "-");
}

export default function OnboardingRoute() {
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const [name, setName] = createSignal("");
  const [personalBoardName, setPersonalBoardName] = createSignal("");
  const [teamBoardName, setTeamBoardName] = createSignal("");
  const [plan, setPlan] = createSignal<"personal" | "pro_trial" | "enterprise">("personal");
  const [inviteInput, setInviteInput] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal("");
  const [personalBoardSpacingHint, setPersonalBoardSpacingHint] = createSignal(false);
  const [teamBoardSpacingHint, setTeamBoardSpacingHint] = createSignal(false);

  onMount(async () => {
    const params = new URLSearchParams(location.search);
    setPlan(normalizePlan(params.get("plan") || "personal"));
    try {
      const { session } = await api.auth.me();
      if (!session.user.showOnboarding) {
        navigate("/task/inbox", { replace: true });
        return;
      }
      setName(session.user.name || "");
    } catch {
      navigate("/login", { replace: true });
    }
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.auth.completeOnboarding({
        personalBoardName: personalBoardName().trim(),
        teamBoardName: plan() === "personal" ? undefined : teamBoardName().trim(),
        name: name().trim(),
        emails: plan() === "personal" ? [] : parseInviteEmails(inviteInput()),
        plan: plan(),
      });
      navigate("/task/inbox", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setSaving(false);
    }
  }

  function handlePersonalBoardNameInput(raw: string) {
    const normalized = normalizeBoardNameInput(raw);
    setPersonalBoardSpacingHint(normalized !== raw);
    setPersonalBoardName(normalized);
  }

  function handleTeamBoardNameInput(raw: string) {
    const normalized = normalizeBoardNameInput(raw);
    setTeamBoardSpacingHint(normalized !== raw);
    setTeamBoardName(normalized);
  }

  return (
    <main class="flex h-screen items-center justify-center bg-[#0a0d12] px-4 text-[#eceff7]">
      <form
        class="w-full max-w-xl rounded-2xl border border-[#2c3648] bg-[#111926] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
        onSubmit={(event) => void submit(event)}
      >
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#8ea3c7]">Onboarding</p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#edf3ff]">Set up your workspace</h1>
        <p class="mt-1 text-sm text-[#9fb0cc]">
          Choose your board names now. Personal creates a private board. Pro adds a shared team board.
        </p>

        <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Your name (optional)</label>
        <input
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
          placeholder="Your name"
        />

        <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Personal board name (optional)</label>
        <input
          value={personalBoardName()}
          onInput={(event) => handlePersonalBoardNameInput(event.currentTarget.value)}
          class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
          placeholder="super-cool"
        />
        {personalBoardSpacingHint() ? (
          <p class="mt-1 text-xs text-[#ffbf78]">Spaces turn into hyphens. Example: super cool -&gt; super-cool.</p>
        ) : null}
        <p class="mt-1 text-xs text-[#8ea3c7]">
          Leave blank to default to your name (or your email prefix) + &quot;board&quot;.
        </p>

        {plan() !== "personal" ? (
          <>
            <label class="mt-4 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Team board name (optional)</label>
            <input
              value={teamBoardName()}
              onInput={(event) => handleTeamBoardNameInput(event.currentTarget.value)}
              class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              placeholder="team-maze"
            />
            {teamBoardSpacingHint() ? (
              <p class="mt-1 text-xs text-[#ffbf78]">Spaces turn into hyphens. Example: super cool -&gt; super-cool.</p>
            ) : null}
            <p class="mt-1 text-xs text-[#8ea3c7]">
              Leave blank to default to your name + &quot;team board&quot;.
            </p>
          </>
        ) : null}

        <fieldset class="mt-5">
          <legend class="text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Plan</legend>
          <div class="mt-2 space-y-2">
            <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-[#2f4465] bg-[#0d1523] px-3 py-2 text-sm text-[#dbe8ff]">
              <input
                type="radio"
                name="plan"
                value="personal"
                checked={plan() === "personal"}
                onChange={() => setPlan("personal")}
              />
              <span>
                <span class="block font-semibold">Personal (Free)</span>
                <span class="block text-xs text-[#95a9cc]">Single-player workflow and core task + board features.</span>
              </span>
            </label>
            <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-[#2f4465] bg-[#0d1523] px-3 py-2 text-sm text-[#dbe8ff]">
              <input
                type="radio"
                name="plan"
                value="pro_trial"
                checked={plan() === "pro_trial"}
                onChange={() => setPlan("pro_trial")}
              />
              <span>
                <span class="block font-semibold">Pro Trial (14 days)</span>
                <span class="block text-xs text-[#95a9cc]">Unlock pro team features now and decide later.</span>
              </span>
            </label>
            <label class="flex cursor-pointer items-start gap-2 rounded-lg border border-[#2f4465] bg-[#0d1523] px-3 py-2 text-sm text-[#dbe8ff]">
              <input
                type="radio"
                name="plan"
                value="enterprise"
                checked={plan() === "enterprise"}
                onChange={() => setPlan("enterprise")}
              />
              <span>
                <span class="block font-semibold">Enterprise</span>
                <span class="block text-xs text-[#95a9cc]">Advanced controls and SSO-ready onboarding path.</span>
              </span>
            </label>
          </div>
        </fieldset>

        {plan() !== "personal" ? (
          <>
            <label class="mt-4 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Invite emails (optional)</label>
            <textarea
              rows={4}
              value={inviteInput()}
              onInput={(event) => setInviteInput(event.currentTarget.value)}
              class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              placeholder="teammate1@company.com, teammate2@company.com"
            />
            <p class="mt-1 text-xs text-[#8ea3c7]">Use commas or new lines between emails.</p>
          </>
        ) : null}

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
