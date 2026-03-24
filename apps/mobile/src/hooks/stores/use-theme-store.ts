/**
 * Zustand store to manage theme preference ("light", "dark", "system").
 * Uses MMKV for persistence.
 */

import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";

type ThemeState = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

// Try to use MMKV, fallback to memory if not available
const CACHE_KEY = "cache:theme-preference";

function loadInitialTheme(): ThemePreference {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    const cached = mmkvStorage?.getString(CACHE_KEY);
    if (cached === "light" || cached === "dark" || cached === "system") {
      return cached;
    }
  } catch {
    // Ignore
  }
  return "system";
}

function persistTheme(theme: ThemePreference) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { mmkvStorage } = require("@/lib/cache/persister");
    mmkvStorage?.set(CACHE_KEY, theme);
  } catch {
    // Ignore
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadInitialTheme(),
  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },
}));
