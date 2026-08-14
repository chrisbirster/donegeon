import { useLocation, useNavigate } from "@solidjs/router";
import { Show, createMemo, createSignal, onSettled } from "solid-js";

import LocalBetaToggle from "../components/auth/LocalBetaToggle";
import WaitlistCard from "../components/auth/WaitlistCard";
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
        <main class="flex h-screen items-center justify-center px-4 text-[var(--text-main)]">
          <div class="app-panel w-full max-w-md rounded-2xl p-6">
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Donegeon</p>

            {!challengeId() ? (
              <form onSubmit={(event) => void submitRequest(event)}>
                <h1 class="font-display mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-main)]">Sign in</h1>
                <p class="mt-1 text-sm text-[var(--text-soft)]">Log in with your email to start onboarding your team.</p>
                {inviteCode() ? (
                  <p class="mt-2 text-xs text-[var(--text-muted)]">
                    {resolvingInvite()
                      ? "Loading invitation..."
                      : `You were invited${inviteTeamName() ? ` to ${inviteTeamName()}` : " to a team"}. Complete login to accept it.`}
                  </p>
                ) : null}

                <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Email</label>
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
                  class="app-input-surface mt-2 w-full rounded-lg px-3 py-2"
                  placeholder="you@company.com"
                />
                {inviteEmailLocked() ? (
                  <p class="mt-2 text-xs text-[var(--text-muted)]">Email is locked to your invitation address.</p>
                ) : null}

                <button
                  type="submit"
                  disabled={saving() || resolvingInvite() || !email().trim()}
                  class="app-button-primary mt-5 w-full rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {saving() ? "Sending code..." : "Continue"}
                </button>
              </form>
            ) : (
              <form onSubmit={(event) => void submitVerify(event)}>
                <h1 class="font-display mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text-main)]">Check your email</h1>
                <p class="mt-1 text-sm text-[var(--text-soft)]">
                  We sent a code to <span class="font-medium text-[var(--text-main)]">{email()}</span>.
                </p>

                <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[var(--text-muted)]">Verification Code</label>
                <input
                  type="text"
                  required
                  autofocus
                  value={code()}
                  onInput={(event) => setCode(event.currentTarget.value)}
                  class="app-input-surface mt-2 w-full rounded-lg px-3 py-2 text-center text-2xl tracking-[0.25em]"
                  placeholder="000000"
                  maxlength="6"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                />
                {debugCode() ? (
                  <p class="app-panel-soft mt-2 rounded-md px-2 py-1 text-xs text-[var(--text-soft)]">
                    Dev OTP (filled automatically): <span class="font-semibold text-[var(--text-main)]">{debugCode()}</span>
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={saving()}
                  class="app-button-primary mt-5 w-full rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  {saving() ? "Verifying..." : "Verify"}
                </button>

                {!inviteEmailLocked() ? (
                  <button
                    type="button"
                    onClick={() => setChallengeId(null)}
                    class="mt-3 w-full text-xs text-[var(--text-muted)] transition hover:text-[var(--text-main)]"
                  >
                    Use a different email
                  </button>
                ) : null}
              </form>
            )}

            {error() ? <p class="mt-3 text-sm text-[var(--danger)]">{error()}</p> : null}
          </div>
        </main>
      </Show>
      <LocalBetaToggle openBeta={publicConfig().openBeta} onToggle={setLocalOpenBeta} />
    </>
  );
}
