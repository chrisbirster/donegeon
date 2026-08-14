import { type ParentProps, createContext, createMemo, createSignal, createTrackedEffect, onSettled, useContext } from "solid-js";

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

  createTrackedEffect(() => {
    applyResolvedTheme(resolvedTheme());
  });

  onSettled(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light");
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  });

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    writeThemePreference(next);
  }

  return (
    <ThemeContext
      value={{
        preference,
        resolvedTheme,
        setPreference,
      }}
    >
      {props.children}
    </ThemeContext>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
