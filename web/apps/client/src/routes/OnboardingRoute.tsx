import { useLocation, useNavigate } from "@solidjs/router";
import { createSignal, onSettled } from "solid-js";

import { pricingCatalog } from "../../../../shared/pricing/catalog";
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
  return raw
    .trim()
    .replace(/[^A-Za-z0-9\s-]+/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasBoardNameSpacingHint(raw: string): boolean {
  return /\s/.test(raw);
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

  onSettled(() => void (async () => {
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
  })());

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
    setPersonalBoardSpacingHint(hasBoardNameSpacingHint(raw));
    setPersonalBoardName(normalized);
  }

  function handleTeamBoardNameInput(raw: string) {
    const normalized = normalizeBoardNameInput(raw);
    setTeamBoardSpacingHint(hasBoardNameSpacingHint(raw));
    setTeamBoardName(normalized);
  }

  const freePlan = pricingCatalog.planFamilies.free;
  const proPlan = pricingCatalog.planFamilies.pro;
  const enterprisePlan = pricingCatalog.planFamilies.enterprise;

  return (
    <main class="flex min-h-screen items-start justify-center overflow-y-auto px-4 py-6 text-[var(--text-main)] sm:py-10">
      <form
        class="app-panel w-full max-w-xl rounded-2xl p-6"
        onSubmit={(event) => void submit(event)}
      >
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Onboarding</p>
        <h1 class="font-display mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">Set up your workspace</h1>
        <p class="mt-1 text-sm text-[var(--text-soft)]">
          Choose your board names now. Free creates a private board. Pro adds a shared team board.
        </p>

        <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Your name (optional)</label>
        <input
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          class="app-input-surface mt-2 w-full rounded-lg px-3 py-2"
          placeholder="Your name"
        />

        <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Personal board name (optional)</label>
        <input
          value={personalBoardName()}
          onInput={(event) => handlePersonalBoardNameInput(event.currentTarget.value)}
          class="app-input-surface mt-2 w-full rounded-lg px-3 py-2"
          placeholder="super-cool"
        />
        {personalBoardSpacingHint() ? (
          <p class="mt-1 text-xs text-[var(--warning)]">Spaces turn into hyphens. Example: super cool -&gt; super-cool.</p>
        ) : null}
        <p class="mt-1 text-xs text-[var(--text-muted)]">
          Leave blank to default to a quick-add-friendly version of your name (or email prefix) + &quot;board&quot;.
        </p>

        {plan() !== "personal" ? (
          <>
            <label class="mt-4 block text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Team board name (optional)</label>
            <input
              value={teamBoardName()}
              onInput={(event) => handleTeamBoardNameInput(event.currentTarget.value)}
              class="app-input-surface mt-2 w-full rounded-lg px-3 py-2"
              placeholder="team-maze"
            />
            {teamBoardSpacingHint() ? (
              <p class="mt-1 text-xs text-[var(--warning)]">Spaces turn into hyphens. Example: super cool -&gt; super-cool.</p>
            ) : null}
            <p class="mt-1 text-xs text-[var(--text-muted)]">
              Leave blank to default to a quick-add-friendly version of your name + &quot;team board&quot;.
            </p>
          </>
        ) : null}

        <fieldset class="mt-5">
          <legend class="text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Plan</legend>
          <div class="mt-2 space-y-2">
            <label class="app-panel-soft flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-main)]">
              <input
                type="radio"
                name="plan"
                value="personal"
                checked={plan() === "personal"}
                onChange={() => setPlan("personal")}
              />
              <span>
                <span class="block font-semibold">{freePlan.label}</span>
                <span class="block text-xs text-[var(--text-muted)]">{freePlan.description}</span>
              </span>
            </label>
            <label class="app-panel-soft flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-main)]">
              <input
                type="radio"
                name="plan"
                value="pro_trial"
                checked={plan() === "pro_trial"}
                onChange={() => setPlan("pro_trial")}
              />
              <span>
                <span class="block font-semibold">{proPlan.label} (14-day trial)</span>
                <span class="block text-xs text-[var(--text-muted)]">{proPlan.description}</span>
              </span>
            </label>
            <label class="app-panel-soft flex cursor-pointer items-start gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-main)]">
              <input
                type="radio"
                name="plan"
                value="enterprise"
                checked={plan() === "enterprise"}
                onChange={() => setPlan("enterprise")}
              />
              <span>
                <span class="block font-semibold">{enterprisePlan.label}</span>
                <span class="block text-xs text-[var(--text-muted)]">{enterprisePlan.description}</span>
              </span>
            </label>
          </div>
        </fieldset>

        {plan() !== "personal" ? (
          <>
            <label class="mt-4 block text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Invite emails (optional)</label>
            <textarea
              rows={4}
              value={inviteInput()}
              onInput={(event) => setInviteInput(event.currentTarget.value)}
              class="app-input-surface mt-2 w-full rounded-lg px-3 py-2"
              placeholder="teammate1@company.com, teammate2@company.com"
            />
            <p class="mt-1 text-xs text-[var(--text-muted)]">Use commas or new lines between emails.</p>
          </>
        ) : null}

        <button
          type="submit"
          disabled={saving()}
          class="app-button-primary mt-5 w-full rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {saving() ? "Finishing..." : "Finish onboarding"}
        </button>

        {error() ? <p class="mt-3 text-sm text-[var(--danger)]">{error()}</p> : null}
      </form>
    </main>
  );
}
