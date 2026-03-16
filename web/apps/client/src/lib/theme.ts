export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const THEME_PREFERENCE_KEY = "donegeon.theme.preference";

function isThemePreference(value: string): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_PREFERENCE_KEY);
  return stored && isThemePreference(stored) ? stored : "system";
}

export function writeThemePreference(next: ThemePreference): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_PREFERENCE_KEY, next);
}

export function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme = readSystemTheme()): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

export function applyResolvedTheme(theme: ResolvedTheme): ResolvedTheme {
  if (typeof document === "undefined") return theme;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  return theme;
}

export function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  return applyResolvedTheme(resolveTheme(preference));
}

export function initializeTheme(): ResolvedTheme {
  return applyThemePreference(readThemePreference());
}
