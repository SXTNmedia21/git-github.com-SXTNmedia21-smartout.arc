/**
 * use-ai-prefs — Read/write hook for Botsson AI preferences.
 *
 * Thin wrapper over ai-prefs.ts (MMKV persistence) + BotssonProvider setters.
 * Consumer-facing API: read `prefs`, call `updatePref(key, value)`.
 *
 * Design choice: this hook reads from BotssonProvider (which already holds
 * preferences in React state via useBotssonSettingsStore) rather than reading
 * directly from MMKV on every render. This ensures components re-render when
 * prefs change and stays coherent with the provider's single source of truth.
 *
 * Emits `mobile.ai_prefs.changed` on every change per ADR-0134.
 * Throws via getProfileContext() on missing IDs — telemetry is skipped
 * (not thrown to UI) so the pref write still succeeds.
 *
 * Usage:
 *   const { prefs, updatePref } = useAiPrefs();
 *   updatePref("language", "en");
 */

import { useCallback, useMemo } from "react";
import { useBotsson } from "@/providers/botsson-provider";
import { getProfileContext } from "@/lib/profile-context";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { AiPrefs, BotssonLanguage, BotssonInteractionMode } from "@/lib/ai-prefs";

export type { AiPrefs };

type UpdateableKey = keyof AiPrefs;
type UpdateableValue = boolean | BotssonLanguage | BotssonInteractionMode;

type UseAiPrefsReturn = {
  prefs: AiPrefs;
  updatePref: <K extends UpdateableKey>(key: K, value: AiPrefs[K]) => void;
};

export function useAiPrefs(): UseAiPrefsReturn {
  const {
    voiceEnabled,
    language,
    interactionMode,
    setVoiceEnabled,
    setLanguage,
    setInteractionMode,
  } = useBotsson();

  const prefs = useMemo<AiPrefs>(
    () => ({ voiceEnabled, language, interactionMode }),
    [voiceEnabled, language, interactionMode],
  );

  const updatePref = useCallback(
    <K extends UpdateableKey>(key: K, value: AiPrefs[K]) => {
      // 1. Persist + update React state via provider setters.
      switch (key) {
        case "voiceEnabled":
          setVoiceEnabled(value as boolean);
          break;
        case "language":
          setLanguage(value as BotssonLanguage);
          break;
        case "interactionMode":
          setInteractionMode(value as BotssonInteractionMode);
          break;
      }

      // 2. Emit telemetry — ADR-0134 (non-null workspace_id + actor_id required).
      //    Fire-and-forget: pref write must not block on profile resolution.
      void (async () => {
        try {
          const { profileId, workspaceId } = await getProfileContext();
          void emit({
            event: "mobile.ai_prefs.changed",
            workspace_id: nonEmpty(workspaceId, "workspace_id"),
            actor_id: nonEmpty(profileId, "actor_id"),
            properties: {
              data: {
                pref_key: key,
                // Stringify so the event schema stays consistent for booleans + strings.
                pref_value: String(value as UpdateableValue),
                device_type: "mobile",
              },
            },
          });
        } catch {
          // Profile unavailable — skip telemetry, do NOT surface to UI.
          // The pref write already succeeded above.
        }
      })();
    },
    [setVoiceEnabled, setLanguage, setInteractionMode],
  );

  return { prefs, updatePref };
}
