import { type PublicConfig } from "../server/api";

const LOCAL_OPEN_BETA_KEY = "donegeon.local-open-beta";

function isLocalHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized.endsWith(".localhost");
}

export function localBetaToggleAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return isLocalHost(window.location.hostname);
}

export function readLocalOpenBetaOverride(search?: string): boolean | null {
  if (!localBetaToggleAvailable()) return null;

  const params = new URLSearchParams(search ?? window.location.search);
  const fromQuery = (params.get("local_beta") || "").trim().toLowerCase();
  if (fromQuery === "open") return true;
  if (fromQuery === "closed") return false;

  const stored = (window.localStorage.getItem(LOCAL_OPEN_BETA_KEY) || "").trim().toLowerCase();
  if (stored === "true") return true;
  if (stored === "false") return false;
  return null;
}

export function writeLocalOpenBetaOverride(next: boolean): void {
  if (!localBetaToggleAvailable()) return;
  window.localStorage.setItem(LOCAL_OPEN_BETA_KEY, next ? "true" : "false");
}

export function applyLocalOpenBetaOverride(config: PublicConfig, search?: string): PublicConfig {
  const override = readLocalOpenBetaOverride(search);
  if (override === null) return config;
  return {
    ...config,
    openBeta: override,
  };
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(fallback);
    }, timeoutMs);

    promise
      .then((value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(fallback);
      });
  });
}
