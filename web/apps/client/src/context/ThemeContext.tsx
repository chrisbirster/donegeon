import { type ParentProps, createContext, createEffect, createMemo, createSignal, onCleanup, onMount, useContext } from "solid-js";

import {
  applyResolvedTheme,
  readSystemTheme,
  readThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
  writeThemePreference,
} from "../lib/theme";

type ThemeContextValue = {
  preference: () => ThemePreference;
  resolvedTheme: () => ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue>();

export function ThemeProvider(props: ParentProps) {
  const [preference, setPreferenceState] = createSignal<ThemePreference>(readThemePreference());
  const [systemTheme, setSystemTheme] = createSignal<ResolvedTheme>(readSystemTheme());

  const resolvedTheme = createMemo<ResolvedTheme>(() => resolveTheme(preference(), systemTheme()));

  createEffect(() => {
    applyResolvedTheme(resolvedTheme());
  });

  onMount(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      onCleanup(() => mediaQuery.removeEventListener("change", handleChange));
      return;
    }

    mediaQuery.addListener(handleChange);
    onCleanup(() => mediaQuery.removeListener(handleChange));
  });

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    writeThemePreference(next);
  }

  return (
    <ThemeContext.Provider
      value={{
        preference,
        resolvedTheme,
        setPreference,
      }}
    >
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return value;
}
