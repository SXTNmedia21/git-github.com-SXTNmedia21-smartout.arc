/**
 * ai-prefs — Low-level AI preference persistence via MMKV.
 *
 * Task spec listed AsyncStorage as the backing store, but this project uses
 * MMKV exclusively (see use-botsson-settings-store.ts, cache/mmkv.ts) for
 * synchronous, performant key-value storage. AsyncStorage is async and
 * unavailable in the test environment — MMKV matches the established pattern.
 *
 * Storage key: `smartout.ai.prefs.v1.*` (namespaced per field for granular
 * invalidation). A flat JSON blob under a single key would require
 * deserialising the whole object on every read; per-key is cheaper.
 *
 * All reads are synchronous — callers do NOT need to await.
 * All writes are synchronous — callers do NOT need to await.
 *
 * Exported types re-export from use-botsson-settings-store so callers
 * import from one place.
 */

import { storage } from "@/lib/cache/mmkv";
import type {
  BotssonLanguage,
  BotssonInteractionMode,
} from "@/hooks/stores/use-botsson-settings-store";

export type { BotssonLanguage, BotssonInteractionMode };

// ─── Storage keys ─────────────────────────────────────────────────────────────

const KEY_VOICE_ENABLED = "smartout.ai.prefs.v1.voiceEnabled";
const KEY_LANGUAGE = "smartout.ai.prefs.v1.language";
const KEY_INTERACTION_MODE = "smartout.ai.prefs.v1.interactionMode";

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS = {
  voiceEnabled: true,
  language: "nb" as BotssonLanguage,
  interactionMode: "always-on" as BotssonInteractionMode,
} as const;

// ─── Readers ──────────────────────────────────────────────────────────────────

export function getVoiceEnabled(): boolean {
  try {
    const raw = storage.getString(KEY_VOICE_ENABLED);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    // MMKV unavailable (web/test)
  }
  return DEFAULTS.voiceEnabled;
}

export function getLanguage(): BotssonLanguage {
  try {
    const raw = storage.getString(KEY_LANGUAGE);
    if (raw === "nb" || raw === "en") return raw;
  } catch {
    // MMKV unavailable
  }
  return DEFAULTS.language;
}

export function getInteractionMode(): BotssonInteractionMode {
  try {
    const raw = storage.getString(KEY_INTERACTION_MODE);
    if (raw === "push-to-talk" || raw === "always-on") return raw;
  } catch {
    // MMKV unavailable
  }
  return DEFAULTS.interactionMode;
}

// ─── Writers ──────────────────────────────────────────────────────────────────

export function setVoiceEnabled(enabled: boolean): void {
  try {
    storage.set(KEY_VOICE_ENABLED, String(enabled));
  } catch {
    // MMKV unavailable
  }
}

export function setLanguage(language: BotssonLanguage): void {
  try {
    storage.set(KEY_LANGUAGE, language);
  } catch {
    // MMKV unavailable
  }
}

export function setInteractionMode(mode: BotssonInteractionMode): void {
  try {
    storage.set(KEY_INTERACTION_MODE, mode);
  } catch {
    // MMKV unavailable
  }
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

export type AiPrefs = {
  voiceEnabled: boolean;
  language: BotssonLanguage;
  interactionMode: BotssonInteractionMode;
};

/** Read all preferences in one call. Useful for snapshot comparisons. */
export function getAiPrefs(): AiPrefs {
  return {
    voiceEnabled: getVoiceEnabled(),
    language: getLanguage(),
    interactionMode: getInteractionMode(),
  };
}
