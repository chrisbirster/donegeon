import { useLocation, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, onMount } from "solid-js";

import WaitlistCard from "../components/auth/WaitlistCard";
import { useApi } from "../context/ApiContext";
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
  const [publicConfig, setPublicConfig] = createSignal<PublicConfig>(defaultPublicConfig());
  const [loadingAccess, setLoadingAccess] = createSignal(true);
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

  onMount(async () => {
    try {
      const [{ config }, currentSessionResponse] = await Promise.all([
        api.public.config().catch(() => ({ config: defaultPublicConfig() })),
        api.auth.me().catch(() => null),
      ]);
      setPublicConfig(config);
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
    } finally {
      setLoadingAccess(false);
    }
  });

  async function submitRequest(event: SubmitEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await api.auth.requestLoginCode({
        email: email().trim(),
      });
      setChallengeId(res.challengeId);
      setDebugCode((res.debugCode || "").trim());
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

  if (loadingAccess()) {
    return <main class="flex h-screen items-center justify-center bg-[#0a0d12] text-[#c8d5eb]">Loading...</main>;
  }

  if (!publicConfig().openBeta) {
    return (
      <WaitlistCard
        openBetaStartsLabel={publicConfig().openBetaStartsLabel}
        requestedPlan={preferredPlan()}
        source={waitlistSource()}
        title="Donegeon is in closed beta"
        description="Open beta has not started yet. Join the waitlist and we'll email you as soon as access opens."
      />
    );
  }

  return (
    <main class="flex h-screen items-center justify-center bg-[#0a0d12] px-4 text-[#eceff7]">
      <div class="w-full max-w-md rounded-2xl border border-[#2c3648] bg-[#111926] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
        <p class="text-xs font-semibold uppercase tracking-[0.12em] text-[#8ea3c7]">Donegeon</p>
        
        {!challengeId() ? (
          <form onSubmit={(event) => void submitRequest(event)}>
            <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#edf3ff]">Sign in</h1>
            <p class="mt-1 text-sm text-[#9fb0cc]">Log in with your email to start onboarding your team.</p>
            {inviteCode() ? (
              <p class="mt-2 text-xs text-[#8ea3c7]">
                {resolvingInvite()
                  ? "Loading invitation..."
                  : `You were invited${inviteTeamName() ? ` to ${inviteTeamName()}` : " to a team"}. Complete login to accept it.`}
              </p>
            ) : null}

            <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Email</label>
            <input
              type="email"
              required
              value={email()}
              readOnly={inviteEmailLocked()}
              onInput={(event) => {
                if (!inviteEmailLocked()) {
                  setEmail(event.currentTarget.value);
                }
              }}
              class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
              placeholder="you@company.com"
            />
            {inviteEmailLocked() ? (
              <p class="mt-2 text-xs text-[#8ea3c7]">Email is locked to your invitation address.</p>
            ) : null}

            <button
              type="submit"
              disabled={saving() || resolvingInvite() || !email().trim()}
              class="mt-5 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#161616] transition hover:bg-[var(--accent-soft)] disabled:opacity-60"
            >
              {saving() ? "Sending code..." : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={(event) => void submitVerify(event)}>
            <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#edf3ff]">Check your email</h1>
            <p class="mt-1 text-sm text-[#9fb0cc]">We sent a code to <span class="text-[#edf3ff]">{email()}</span>.</p>

            <label class="mt-5 block text-xs uppercase tracking-[0.12em] text-[#8ea3c7]">Verification Code</label>
            <input
              type="text"
              required
              autofocus
              value={code()}
              onInput={(event) => setCode(event.currentTarget.value)}
              class="mt-2 w-full rounded-lg border border-[#34486b] bg-[#0d1523] px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--accent)] text-center text-2xl tracking-[0.25em]"
              placeholder="000000"
              maxlength="6"
            />
            {debugCode() ? (
              <p class="mt-2 rounded-md border border-[#405e88] bg-[#13253f] px-2 py-1 text-xs text-[#cfe3ff]">
                Dev OTP: <span class="font-semibold text-[#f2f7ff]">{debugCode()}</span>
              </p>
            ) : null}

            <button
              type="submit"
              disabled={saving()}
              class="mt-5 w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[#161616] transition hover:bg-[var(--accent-soft)] disabled:opacity-60"
            >
              {saving() ? "Verifying..." : "Verify"}
            </button>

            {!inviteEmailLocked() ? (
              <button
                type="button"
                onClick={() => setChallengeId(null)}
                class="mt-3 w-full text-xs text-[#8ea3c7] hover:text-[#edf3ff] transition"
              >
                Use a different email
              </button>
            ) : null}
          </form>
        )}

        {error() ? <p class="mt-3 text-sm text-[#ff9b9b]">{error()}</p> : null}
      </div>
    </main>
  );
}
