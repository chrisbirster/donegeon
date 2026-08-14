import { css } from "@linaria/core";
import { useLocation, useNavigate } from "@solidjs/router";
import { Show, createMemo, createSignal, onSettled } from "solid-js";

import LocalBetaToggle from "../components/auth/LocalBetaToggle";
import WaitlistCard from "../components/auth/WaitlistCard";
import Button from "../components/Button";
import { useApi } from "../context/ApiContext";
import { applyLocalOpenBetaOverride, withTimeout, writeLocalOpenBetaOverride } from "../lib/openBeta";
import { type PublicConfig } from "../server/api";

function normalizePreferredPlan(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (value === "pro_trial" || value === "pro" || value === "enterprise" || value === "personal") {
    return value;
  }
  if (value === "free") {
    return "personal";
  }
  return "personal";
}

function defaultPublicConfig(): PublicConfig {
  return {
    openBeta: import.meta.env.DEV,
    openBetaStartsAt: "2026-06-01",
    openBetaStartsLabel: "June 1, 2026",
  };
}

export default function LoginRoute() {
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const [publicConfig, setPublicConfig] = createSignal<PublicConfig>(applyLocalOpenBetaOverride(defaultPublicConfig()));
  const [email, setEmail] = createSignal("");
  const [code, setCode] = createSignal("");
  const [debugCode, setDebugCode] = createSignal("");
  const [challengeId, setChallengeId] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);
  const [resolvingInvite, setResolvingInvite] = createSignal(false);
  const [inviteEmailLocked, setInviteEmailLocked] = createSignal(false);
  const [inviteTeamName, setInviteTeamName] = createSignal("");
  const [error, setError] = createSignal("");
  const inviteCode = createMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("invite") || "").trim();
  });
  const preferredPlan = createMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizePreferredPlan(params.get("plan") || "personal");
  });
  const onboardingHref = createMemo(() => `/onboarding?plan=${encodeURIComponent(preferredPlan())}`);
  const waitlistSource = createMemo(() => (inviteCode() ? "app-login-invite" : "app-login"));

  function setLocalOpenBeta(next: boolean) {
    writeLocalOpenBetaOverride(next);
    setPublicConfig((current) => ({
      ...current,
      openBeta: next,
    }));
  }

  onSettled(() => void (async () => {
    try {
      const configResponse = await withTimeout(api.public.config(), 1500, { config: defaultPublicConfig() });
      const config = applyLocalOpenBetaOverride(configResponse.config, location.search);
      setPublicConfig(config);

      const currentSessionResponse = await withTimeout(api.auth.me(), 1500, null);
      const currentSession = currentSessionResponse?.session;
      const code = inviteCode();

      if (code) {
        if (currentSession) {
          try {
            const accepted = await api.team.acceptInvitation(code);
            if (accepted.session.user.showOnboarding) {
              navigate(onboardingHref(), { replace: true });
              return;
            }
            navigate("/task/inbox", { replace: true });
            return;
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to accept invitation");
            return;
          }
        }
        if (config.openBeta) {
          setResolvingInvite(true);
          try {
            const { invitation } = await api.auth.invitation(code);
            setEmail(invitation.email);
            setInviteEmailLocked(true);
            setInviteTeamName(invitation.teamName || "");
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load invitation");
          } finally {
            setResolvingInvite(false);
          }
        }
      }

      if (currentSession) {
        if (currentSession.user.showOnboarding) {
          navigate(onboardingHref(), { replace: true });
          return;
        }
        navigate("/task/inbox", { replace: true });
        return;
      }
    } catch {
      // Not logged in yet.
    }
  })());

  async function submitRequest(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await api.auth.requestLoginCode({
        email: email().trim(),
      });
      setChallengeId(res.challengeId);
      const developmentCode = (res.debugCode || "").trim();
      setDebugCode(developmentCode);
      // The API only returns debugCode when the backend explicitly enables the
      // local-development auth helper. Pre-fill it so a nearly invisible code
      // cannot leave local users stuck on the verification step.
      if (developmentCode) {
        setCode(developmentCode);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitVerify(event: SubmitEvent) {
    event.preventDefault();
    const id = challengeId();
    if (!id) return;

    setError("");
    setSaving(true);
    try {
      const { session } = await api.auth.verifyLoginCode({
        challengeId: id,
        code: code().trim(),
        invitationCode: inviteCode() || undefined,
      });
      if (session.user.showOnboarding) {
        navigate(onboardingHref(), { replace: true });
        return;
      }
      navigate("/task/inbox", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Show
        when={publicConfig().openBeta}
        fallback={
          <WaitlistCard
            openBetaStartsLabel={publicConfig().openBetaStartsLabel}
            requestedPlan={preferredPlan()}
            source={waitlistSource()}
            title="Donegeon is in closed beta"
            description="Open beta has not started yet. Join the waitlist and we'll email you as soon as access opens."
          />
        }
      >
        <main class={style1}>
          <div class={style2}>
            <p class={style3}>Donegeon</p>

            {!challengeId() ? (
              <form onSubmit={(event) => void submitRequest(event)}>
                <h1 class={style4}>Sign in</h1>
                <p class={style5}>Log in with your email to start onboarding your team.</p>
                {inviteCode() ? (
                  <p class={style6}>
                    {resolvingInvite()
                      ? "Loading invitation..."
                      : `You were invited${inviteTeamName() ? ` to ${inviteTeamName()}` : " to a team"}. Complete login to accept it.`}
                  </p>
                ) : null}

                <label class={style7}>Email</label>
                <input
                  type="email"
                  required
                  value={email()}
                  readonly={inviteEmailLocked()}
                  onInput={(event) => {
                    if (!inviteEmailLocked()) {
                      setEmail(event.currentTarget.value);
                    }
                  }}
                  class={style8}
                  placeholder="you@company.com"
                />
                {inviteEmailLocked() ? (
                  <p class={style6}>Email is locked to your invitation address.</p>
                ) : null}

                <Button
                  type="submit"
                  disabled={saving() || resolvingInvite() || !email().trim()}
                  variant="primary"
                  size="lg"
                  block
                  class={style9}
                >
                  {saving() ? "Sending code..." : "Continue"}
                </Button>
              </form>
            ) : (
              <form onSubmit={(event) => void submitVerify(event)}>
                <h1 class={style4}>Check your email</h1>
                <p class={style5}>
                  We sent a code to <span class={style10}>{email()}</span>.
                </p>

                <label class={style7}>Verification Code</label>
                <input
                  type="text"
                  required
                  autofocus
                  value={code()}
                  onInput={(event) => setCode(event.currentTarget.value)}
                  class={style11}
                  placeholder="000000"
                  maxlength="6"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                />
                {debugCode() ? (
                  <p class={style12}>
                    Dev OTP (filled automatically): <span class={style13}>{debugCode()}</span>
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={saving()}
                  variant="primary"
                  size="lg"
                  block
                  class={style9}
                >
                  {saving() ? "Verifying..." : "Verify"}
                </Button>

                {!inviteEmailLocked() ? (
                  <Button
                    type="button"
                    onClick={() => setChallengeId(null)}
                    variant="ghost"
                    size="lg"
                    block
                    class={style14}
                  >
                    Use a different email
                  </Button>
                ) : null}
              </form>
            )}

            {error() ? <p class={style15}>{error()}</p> : null}
          </div>
        </main>
      </Show>
      <LocalBetaToggle openBeta={publicConfig().openBeta} onToggle={setLocalOpenBeta} />
    </>
  );
}


const style1 = css`
display: flex;
height: 100vh;
align-items: center;
justify-content: center;
padding-inline: calc(var(--spacing) * 4);
color: var(--text-main);
`;

const style2 = css`
width: 100%;
max-width: var(--container-md);
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
color: var(--text-main);
font-family: "Space Grotesk", "IBM Plex Sans", sans-serif;
`;

const style5 = css`
margin-top: calc(var(--spacing) * 1);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--text-soft);
`;

const style6 = css`
margin-top: calc(var(--spacing) * 2);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-muted);
`;

const style7 = css`
margin-top: calc(var(--spacing) * 5);
display: block;
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
--tw-tracking: 0.12em;
  letter-spacing: 0.12em;
color: var(--text-muted);
text-transform: uppercase;
`;

const style8 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

const style9 = css`
margin-top: calc(var(--spacing) * 5);
`;

const style10 = css`
--tw-font-weight: var(--font-weight-medium);
  font-weight: var(--font-weight-medium);
color: var(--text-main);
`;

const style11 = css`
margin-top: calc(var(--spacing) * 2);
width: 100%;
border-radius: var(--radius-lg);
padding-inline: calc(var(--spacing) * 3);
padding-block: calc(var(--spacing) * 2);
text-align: center;
font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
--tw-tracking: 0.25em;
  letter-spacing: 0.25em;
background: var(--panel-soft); border: 1px solid var(--border-strong); color: var(--text-main); &:focus { border-color: var(--accent); outline: none; }
`;

const style12 = css`
margin-top: calc(var(--spacing) * 2);
border-radius: var(--radius-md);
padding-inline: calc(var(--spacing) * 2);
padding-block: calc(var(--spacing) * 1);
font-size: var(--text-xs);
  line-height: var(--tw-leading, var(--text-xs--line-height));
color: var(--text-soft);
background: var(--panel-soft); border: 1px solid var(--border-soft); backdrop-filter: blur(12px);
`;

const style13 = css`
--tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
color: var(--text-main);
`;

const style14 = css`
margin-top: calc(var(--spacing) * 3);
`;

const style15 = css`
margin-top: calc(var(--spacing) * 3);
font-size: var(--text-sm);
  line-height: var(--tw-leading, var(--text-sm--line-height));
color: var(--danger);
`;
