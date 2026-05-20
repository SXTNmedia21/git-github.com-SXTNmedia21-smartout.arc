/**
 * ai-prefs — Type-only re-export shim.
 *
 * This file exists solely to provide a stable import path for AI preference
 * types consumed by hooks and providers. All runtime logic (MMKV reads/writes,
 * default values, state management) lives in the canonical store:
 *
 *   apps/mobile/src/hooks/stores/use-botsson-settings-store.ts
 *
 * Do NOT add MMKV instantiation, getter functions, or setter functions here.
 * If you need to read or write AI preferences at runtime, use either:
 *   - useBotssonSettingsStore() (component-level, reactive)
 *   - useBotsson() via BotssonProvider (component-level, full context)
 *   - useAiPrefs() (component-level, thin wrapper with telemetry)
 */

export type {
  BotssonLanguage,
  BotssonInteractionMode,
} from "@/hooks/stores/use-botsson-settings-store";

export type AiPrefs = {
  voiceEnabled: boolean;
  language: import("@/hooks/stores/use-botsson-settings-store").BotssonLanguage;
  interactionMode: import("@/hooks/stores/use-botsson-settings-store").BotssonInteractionMode;
};
