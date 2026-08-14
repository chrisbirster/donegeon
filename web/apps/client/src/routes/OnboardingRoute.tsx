import Button from "../components/Button";
import { css } from "@linaria/core";
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
    <main class={style1}>
      <form
        class={style2}
        onSubmit={(event) => void submit(event)}
      >
        <p class={style3}>Onboarding</p>
        <h1 class={style4}>Set up your workspace</h1>
        <p class={style5}>
          Choose your board names now. Free creates a private board. Pro adds a shared team board.
        </p>

        <label class={style6}>Your name (optional)</label>
        <input
          value={name()}
          onInput={(event) => setName(event.currentTarget.value)}
          class={style7}
          placeholder="Your name"
        />

        <label class={style6}>Personal board name (optional)</label>
        <input
          value={personalBoardName()}
          onInput={(event) => handlePersonalBoardNameInput(event.currentTarget.value)}
          class={style7}
          placeholder="super-cool"
        />
        {personalBoardSpacingHint() ? (
          <p class={style8}>Spaces turn into hyphens. Example: super cool -&gt; super-cool.</p>
        ) : null}
        <p class={style9}>
          Leave blank to default to a quick-add-friendly version of your name (or email prefix) + &quot;board&quot;.
        </p>

        {plan() !== "personal" ? (
          <>
            <label class={style10}>Team board name (optional)</label>
            <input
              value={teamBoardName()}
              onInput={(event) => handleTeamBoardNameInput(event.currentTarget.value)}
              class={style7}
              placeholder="team-maze"
            />
            {teamBoardSpacingHint() ? (
              <p class={style8}>Spaces turn into hyphens. Example: super cool -&gt; super-cool.</p>
            ) : null}
            <p class={style9}>
              Leave blank to default to a quick-add-friendly version of your name + &quot;team board&quot;.
            </p>
          </>
        ) : null}

        <fieldset class={style11}>
          <legend class={style12}>Plan</legend>
          <div class={style13}>
            <label class={style14}>
              <input
                type="radio"
                name="plan"
                value="personal"
                checked={plan() === "personal"}
                onChange={() => setPlan("personal")}
              />
              <span>
                <span class={style15}>{freePlan.label}</span>
                <span class={style16}>{freePlan.description}</span>
              </span>
            </label>
            <label class={style14}>
              <input
                type="radio"
                name="plan"
                value="pro_trial"
                checked={plan() === "pro_trial"}
                onChange={() => setPlan("pro_trial")}
              />
              <span>
                <span class={style15}>{proPlan.label} (14-day trial)</span>
                <span class={style16}>{proPlan.description}</span>
              </span>
            </label>
            <label class={style14}>
              <input
                type="radio"
                name="plan"
                value="enterprise"
                checked={plan() === "enterprise"}
                onChange={() => setPlan("enterprise")}
              />
              <span>
                <span class={style15}>{enterprisePlan.label}</span>
                <span class={style16}>{enterprisePlan.description}</span>
              </span>
            </label>
          </div>
        </fieldset>

        {plan() !== "personal" ? (
          <>
            <label class={style10}>Invite emails (optional)</label>
            <textarea
              rows={4}
              value={inviteInput()}
              onInput={(event) => setInviteInput(event.currentTarget.value)}
              class={style7}
              placeholder="teammate1@company.com, teammate2@company.com"
            />
            <p class={style9}>Use commas or new lines between emails.</p>
          </>
        ) : null}

        <Button
          type="submit"
          disabled={saving()}
          class={style17}
        >
          {saving() ? "Finishing..." : "Finish onboarding"}
        </Button>

        {error() ? <p class={style18}>{error()}</p> : null}
      </form>
    </main>
  );
}


const style1 = css`
display: flex;
min-height: 100vh;
align-items: flex-start;
justify-content: center;
overflow-y: auto;
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 6);
color: var(--text-main);
@media (width >= 40rem) {
    padding-block: calc(var(--spacing) * 10);
  }
`;

const style2 = css`
width: 100%;
max-width: var(--container-xl);
border-radius: var(--radius-2xl);
padding: calc(var(--spacing) * 6);
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
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
--tw-tracking: -0.03em;
  letter-spacing: -0.03em;
color: var(--color-white);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style5 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style6 = css`
margin-top: calc(var(--spacing) * 5);
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style7 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

const style8 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--warning);
`;

const style9 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-muted);
`;

const style10 = css`
margin-top: calc(var(--spacing) * 4);
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style11 = css`
margin-top: calc(var(--spacing) * 5);
`;

const style12 = css`
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style13 = css`
margin-top: calc(var(--spacing) * 2);
:where(& > :not(:last-child)) {
    --tw-space-y-reverse: 0;
    margin-block-start: calc(calc(var(--spacing) * 2) * var(--tw-space-y-reverse));
    margin-block-end: calc(calc(var(--spacing) * 2) * calc(1 - var(--tw-space-y-reverse)));
  }
`;

const style14 = css`
display: flex;
cursor: pointer;
align-items: flex-start;
gap: calc(var(--spacing) * 2);
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-main);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

const style15 = css`
display: block;
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
`;

const style16 = css`
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-muted);
`;

const style17 = css`
margin-top: calc(var(--spacing) * 5);
width: 100%;
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 4);
padding-block: calc(var(--spacing) * 2);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
&:disabled {
    opacity: 60%;
  }
background: var(--accent); color: #1d1108; transition: background-color 160ms ease; &:hover { background: var(--accent-soft); }
`;

const style18 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--danger);
`;
