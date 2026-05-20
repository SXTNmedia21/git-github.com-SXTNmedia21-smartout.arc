/**
 * useBotssonSettingsStore — pure-store unit tests (P2 coverage gap).
 *
 * Strategy: replace the MMKV `storage` import with an in-memory map so that
 * `getString` / `set` calls are fully controlled without native bindings.
 * The store module is re-imported after the mock is installed so that the
 * module-load-time `loadBoolean` / `loadLanguage` / `loadInteractionMode`
 * calls pick up the mock rather than the real MMKV singleton.
 *
 * Tests:
 *   T1: fresh store has correct default values
 *   T2: setVoiceEnabled writes to MMKV and updates state
 *   T3: setLanguage persists the new locale
 *   T4: setInteractionMode persists the new mode
 *   T5: setHasSeenFabHint(true) writes MMKV; fresh re-import reads it back
 */

// ─── In-memory MMKV mock ──────────────────────────────────────────────────────

// Declare the in-memory map in module scope so that jest.mock factory can
// close over it. Reset between tests via beforeEach.
const mmkvMap = new Map<string, string>();

const storageMock = {
  getString: jest.fn((key: string) => mmkvMap.get(key)),
  set: jest.fn((key: string, value: string) => {
    mmkvMap.set(key, value);
  }),
};

// Path must match exactly what the store imports.
jest.mock("@/lib/cache/mmkv", () => ({ storage: storageMock }), { virtual: true });

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Re-import the store after the module registry is reset (for T5). */
function freshImport() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/hooks/stores/use-botsson-settings-store") as typeof import("@/hooks/stores/use-botsson-settings-store");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useBotssonSettingsStore — defaults + setters (P2 coverage gap)", () => {
  beforeEach(() => {
    // Fresh MMKV state and clean call history for each test.
    mmkvMap.clear();
    storageMock.getString.mockClear();
    storageMock.set.mockClear();

    // Reset the module registry so each describe-block test gets a clean store
    // (store module initializes state on first require).
    jest.resetModules();
  });

  // T1: With an empty MMKV map the store should initialize to the spec defaults.
  it("T1: defaults — voiceEnabled: true, language: 'nb', interactionMode: 'always-on', hasSeenFabHint: false", () => {
    const { useBotssonSettingsStore } = freshImport();
    const state = useBotssonSettingsStore.getState();

    expect(state.voiceEnabled).toBe(true);
    expect(state.language).toBe("nb");
    expect(state.interactionMode).toBe("always-on");
    expect(state.hasSeenFabHint).toBe(false);
  });

  // T2: setVoiceEnabled(false) must update in-memory state AND persist to MMKV.
  it("T2: setVoiceEnabled(false) updates state and writes 'false' to MMKV", () => {
    const { useBotssonSettingsStore } = freshImport();
    const { setVoiceEnabled } = useBotssonSettingsStore.getState();

    setVoiceEnabled(false);

    expect(useBotssonSettingsStore.getState().voiceEnabled).toBe(false);
    expect(storageMock.set).toHaveBeenCalledWith("cache:botsson:voice-enabled", "false");
  });

  // T3: setLanguage("en") must persist the new locale.
  it("T3: setLanguage('en') updates state and writes 'en' to MMKV", () => {
    const { useBotssonSettingsStore } = freshImport();
    const { setLanguage } = useBotssonSettingsStore.getState();

    setLanguage("en");

    expect(useBotssonSettingsStore.getState().language).toBe("en");
    expect(storageMock.set).toHaveBeenCalledWith("cache:botsson:language", "en");
  });

  // T4: setInteractionMode("push-to-talk") must persist the new mode.
  it("T4: setInteractionMode('push-to-talk') updates state and writes to MMKV", () => {
    const { useBotssonSettingsStore } = freshImport();
    const { setInteractionMode } = useBotssonSettingsStore.getState();

    setInteractionMode("push-to-talk");

    expect(useBotssonSettingsStore.getState().interactionMode).toBe("push-to-talk");
    expect(storageMock.set).toHaveBeenCalledWith("cache:botsson:interaction-mode", "push-to-talk");
  });

  // T5: setHasSeenFabHint(true) writes MMKV; a fresh re-import reads it back
  // via loadBoolean(). This verifies the MMKV persistence round-trip that
  // FabHint depends on to stay suppressed across app restarts.
  it("T5: setHasSeenFabHint(true) persists; fresh re-import yields hasSeenFabHint: true", () => {
    // First load — write to MMKV via the setter.
    const { useBotssonSettingsStore: store1 } = freshImport();
    store1.getState().setHasSeenFabHint(true);

    // Verify MMKV was written.
    expect(storageMock.set).toHaveBeenCalledWith("cache:botsson:seen-fab-hint", "true");

    // The in-memory mmkvMap now holds "true" for the key.
    // Simulate app restart: reset modules, re-import — loadBoolean reads MMKV.
    jest.resetModules();
    const { useBotssonSettingsStore: store2 } = freshImport();

    expect(store2.getState().hasSeenFabHint).toBe(true);
  });
});
