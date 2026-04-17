"use client";

/**
 * ThemeContext — dashboard theme (dark/light) slice.
 *
 * Why: ADR-0113 decomposes the monolithic DashboardContext so that theme
 * toggles don't cascade a re-render through every dashboard consumer.
 * Theme state is wide (every styled component subscribes) and should live
 * near the root of the dashboard tree. This provider owns `isDark`, its
 * setter, and the `themeReady` flag used to avoid an SSR flash.
 *
 * The setter persists to localStorage under key `smartout-theme`, matching
 * the prior behavior inside DashboardShell.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeContextValue = {
  /** True when the user has dark mode enabled. */
  isDark: boolean;
  /** Setter that persists choice to localStorage. */
  setIsDark: (val: boolean) => void;
  /**
   * True once the client has hydrated the stored preference.
   * Used by DashboardShell to render a hidden frame first, then reveal.
   */
  themeReady: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDarkRaw] = useState(false); // SSR-safe default
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("smartout-theme");
    if (stored === "dark") setIsDarkRaw(true);
    setThemeReady(true);
  }, []);

  const setIsDark = useCallback((val: boolean) => {
    setIsDarkRaw(val);
    localStorage.setItem("smartout-theme", val ? "dark" : "light");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ isDark, setIsDark, themeReady }),
    [isDark, setIsDark, themeReady],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within <ThemeProvider>");
  }
  return ctx;
}

/**
 * Optional variant — returns null outside the provider.
 * Prefer this in components that may also render outside the dashboard shell.
 */
export function useThemeContextOptional(): ThemeContextValue | null {
  return useContext(ThemeContext);
}
