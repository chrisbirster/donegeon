import { type MarketingPublicConfig } from "./site";

const LOCAL_OPEN_BETA_KEY = "donegeon.local-open-beta";

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized.endsWith(".localhost");
}

export function localBetaToggleAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return isLocalHost(window.location.hostname);
}

export function readLocalOpenBetaOverride(): boolean | null {
  if (!localBetaToggleAvailable()) return null;
  const stored = (window.localStorage.getItem(LOCAL_OPEN_BETA_KEY) || "").trim().toLowerCase();
  if (stored === "true") return true;
  if (stored === "false") return false;
  return null;
}

export function writeLocalOpenBetaOverride(next: boolean): void {
  if (!localBetaToggleAvailable()) return;
  window.localStorage.setItem(LOCAL_OPEN_BETA_KEY, next ? "true" : "false");
}

export function applyLocalOpenBetaOverride(config: MarketingPublicConfig): MarketingPublicConfig {
  const override = readLocalOpenBetaOverride();
  if (override === null) return config;
  return {
    ...config,
    openBeta: override,
  };
}
