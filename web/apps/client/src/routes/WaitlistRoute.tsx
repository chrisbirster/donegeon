import { useLocation, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, onMount } from "solid-js";

import LocalBetaToggle from "../components/auth/LocalBetaToggle";
import WaitlistCard from "../components/auth/WaitlistCard";
import { useApi } from "../context/ApiContext";
import { applyLocalOpenBetaOverride, withTimeout, writeLocalOpenBetaOverride } from "../lib/openBeta";
import { type PublicConfig } from "../server/api";

function defaultPublicConfig(): PublicConfig {
  return {
    openBeta: import.meta.env.DEV,
    openBetaStartsAt: "2026-06-01",
    openBetaStartsLabel: "June 1, 2026",
  };
}

function normalizePreferredPlan(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (value === "pro_trial" || value === "pro" || value === "enterprise" || value === "personal") {
    return value;
  }
  if (value === "free") {
    return "personal";
  }
  return "";
}

export default function WaitlistRoute() {
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
  const [config, setConfig] = createSignal<PublicConfig>(applyLocalOpenBetaOverride(defaultPublicConfig(), location.search));

  const preferredPlan = createMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizePreferredPlan(params.get("plan") || "");
  });

  const source = createMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("source") || "app-waitlist").trim();
  });

  function setLocalOpenBeta(next: boolean) {
    writeLocalOpenBetaOverride(next);
    setConfig((current) => ({
      ...current,
      openBeta: next,
    }));
    if (next) {
      navigate(`/login${location.search}`, { replace: true });
    }
  }

  onMount(async () => {
    const configResponse = await withTimeout(api.public.config(), 1500, { config: defaultPublicConfig() });
    const publicConfig = applyLocalOpenBetaOverride(configResponse.config, location.search);
    const currentSession = await withTimeout(api.auth.me(), 1500, null);

    setConfig(publicConfig);

    if (currentSession?.session) {
      if (currentSession.session.user.showOnboarding) {
        navigate("/onboarding", { replace: true });
        return;
      }
      navigate("/task/inbox", { replace: true });
      return;
    }

    if (publicConfig.openBeta) {
      navigate(`/login${location.search}`, { replace: true });
      return;
    }
  });

  return (
    <>
      <WaitlistCard
        openBetaStartsLabel={config().openBetaStartsLabel}
        requestedPlan={preferredPlan()}
        source={source()}
      />
      <LocalBetaToggle openBeta={config().openBeta} onToggle={setLocalOpenBeta} />
    </>
  );
}
