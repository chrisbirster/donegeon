import { useLocation, useNavigate } from "@solidjs/router";
import { createMemo, createSignal, onMount } from "solid-js";

import WaitlistCard from "../components/auth/WaitlistCard";
import { useApi } from "../context/ApiContext";
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
  const [config, setConfig] = createSignal<PublicConfig>(defaultPublicConfig());
  const [loading, setLoading] = createSignal(true);

  const preferredPlan = createMemo(() => {
    const params = new URLSearchParams(location.search);
    return normalizePreferredPlan(params.get("plan") || "");
  });

  const source = createMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("source") || "app-waitlist").trim();
  });

  onMount(async () => {
    try {
      const [{ config: publicConfig }, currentSession] = await Promise.all([
        api.public.config().catch(() => ({ config: defaultPublicConfig() })),
        api.auth.me().catch(() => null),
      ]);

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
    } finally {
      setLoading(false);
    }
  });

  if (loading()) {
    return <main class="flex h-screen items-center justify-center bg-[#0a0d12] text-[#c8d5eb]">Loading...</main>;
  }

  return (
    <WaitlistCard
      openBetaStartsLabel={config().openBetaStartsLabel}
      requestedPlan={preferredPlan()}
      source={source()}
    />
  );
}
