/**
 * Zustand store to manage theme preference ("light", "dark", "system").
 * Uses MMKV for persistence.
 */

import { create } from "zustand";
import { storage } from "@/lib/cache/mmkv";

export type ThemePreference = "light" | "dark" | "system";

type ThemeState = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const CACHE_KEY = "cache:theme-preference";

function loadInitialTheme(): ThemePreference {
  try {
    const cached = storage.getString(CACHE_KEY);
    if (cached === "light" || cached === "dark" || cached === "system") {
      return cached;
    }
  } catch {
    // MMKV not available (e.g. web platform)
  }
  return "system";
}

function persistTheme(theme: ThemePreference) {
  try {
    storage.set(CACHE_KEY, theme);
  } catch {
    // MMKV not available (e.g. web platform)
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: loadInitialTheme(),
  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },
}));
