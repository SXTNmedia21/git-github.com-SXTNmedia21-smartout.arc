/**
 * Botsson AI settings store — persisted via MMKV.
 *
 * Three user-configurable preferences:
 *   - voiceEnabled: whether voice mode is available as a session option
 *   - language: BCP-47 locale code used by the AI agent ("nb" | "en")
 *   - interactionMode: "push-to-talk" keeps mic silent until held;
 *     "always-on" streams audio continuously (default for voice-friendly environments)
 *
 * Defaults are intentionally voice-forward: voice on, Norwegian, always-on.
 * These live in user preferences — not workspace policy — so they belong
 * here rather than in sessionContext derivation.
 */

import { create } from "zustand";
import { storage } from "@/lib/cache/mmkv";

export type BotssonLanguage = "nb" | "en";
export type BotssonInteractionMode = "push-to-talk" | "always-on";

type BotssonSettingsState = {
  voiceEnabled: boolean;
  language: BotssonLanguage;
  interactionMode: BotssonInteractionMode;
  setVoiceEnabled: (enabled: boolean) => void;
  setLanguage: (language: BotssonLanguage) => void;
  setInteractionMode: (mode: BotssonInteractionMode) => void;
};

const KEY_VOICE_ENABLED = "cache:botsson:voice-enabled";
const KEY_LANGUAGE = "cache:botsson:language";
const KEY_INTERACTION_MODE = "cache:botsson:interaction-mode";

function loadBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = storage.getString(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    // MMKV unavailable (e.g. web/test environment)
  }
  return fallback;
}

function loadLanguage(): BotssonLanguage {
  try {
    const raw = storage.getString(KEY_LANGUAGE);
    if (raw === "nb" || raw === "en") return raw;
  } catch {
    // MMKV unavailable
  }
  return "nb";
}

function loadInteractionMode(): BotssonInteractionMode {
  try {
    const raw = storage.getString(KEY_INTERACTION_MODE);
    if (raw === "push-to-talk" || raw === "always-on") return raw;
  } catch {
    // MMKV unavailable
  }
  return "always-on";
}

export const useBotssonSettingsStore = create<BotssonSettingsState>((set) => ({
  voiceEnabled: loadBoolean(KEY_VOICE_ENABLED, true),
  language: loadLanguage(),
  interactionMode: loadInteractionMode(),

  setVoiceEnabled: (enabled) => {
    try {
      storage.set(KEY_VOICE_ENABLED, String(enabled));
    } catch {
      // MMKV unavailable
    }
    set({ voiceEnabled: enabled });
  },

  setLanguage: (language) => {
    try {
      storage.set(KEY_LANGUAGE, language);
    } catch {
      // MMKV unavailable
    }
    set({ language });
  },

  setInteractionMode: (mode) => {
    try {
      storage.set(KEY_INTERACTION_MODE, mode);
    } catch {
      // MMKV unavailable
    }
    set({ interactionMode: mode });
  },
}));
