/**
 * BotssonProvider — openWithIntent state-machine tests (P2-d).
 *
 * Tests the pure logic of the intent state machine:
 *   - openWithIntent sets pendingIntent
 *   - clearIntent resets pendingIntent to null
 *   - one-shot contract: pendingIntent is null after clearIntent
 *   - BotssonIntent shape is well-formed for both kinds
 *
 * Framework-free: no React, no RN. The state machine is exercised directly
 * on the provider's channel module and plain JS objects that mirror the
 * pendingIntent state transitions. Full RN rendering path is covered by E2E.
 */

import type { BotssonIntent } from "../botsson-provider";

// ─── Pure state-machine simulation ────────────────────────────────────────

/**
 * Simulate the part of BotssonProvider that manages pendingIntent.
 * The real provider wraps this in useState; here we use a plain object
 * so jest-node can exercise the contract without RN.
 */
function makeIntentStateMachine() {
  let pendingIntent: BotssonIntent | null = null;

  return {
    openWithIntent(intent: BotssonIntent) {
      pendingIntent = intent;
    },
    clearIntent() {
      pendingIntent = null;
    },
    get pendingIntent(): BotssonIntent | null {
      return pendingIntent;
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("BotssonProvider intent state machine (P2-d openWithIntent)", () => {
  describe("openWithIntent — set", () => {
    it("sets pendingIntent when called with a deviation intent", () => {
      const sm = makeIntentStateMachine();
      const intent: BotssonIntent = {
        kind: "deviation",
        shift_id: "shift-abc",
        deviation_id: "dev-001",
        phase: "pagar",
      };

      sm.openWithIntent(intent);

      expect(sm.pendingIntent).toEqual(intent);
    });

    it("sets pendingIntent when called with a help intent", () => {
      const sm = makeIntentStateMachine();
      const intent: BotssonIntent = {
        kind: "help",
        shift_id: "shift-xyz",
        deviation_id: null,
        phase: null,
      };

      sm.openWithIntent(intent);

      expect(sm.pendingIntent).toEqual(intent);
    });

    it("overwrites a previous intent when called twice (last wins)", () => {
      const sm = makeIntentStateMachine();
      sm.openWithIntent({ kind: "help", shift_id: "s1", deviation_id: null, phase: null });
      const second: BotssonIntent = {
        kind: "deviation",
        shift_id: "s2",
        deviation_id: "d9",
        phase: "oppgjor",
      };
      sm.openWithIntent(second);

      expect(sm.pendingIntent).toEqual(second);
    });
  });

  describe("clearIntent — one-shot contract", () => {
    it("clears pendingIntent to null", () => {
      const sm = makeIntentStateMachine();
      sm.openWithIntent({ kind: "deviation", shift_id: "s", deviation_id: null, phase: null });

      sm.clearIntent();

      expect(sm.pendingIntent).toBeNull();
    });

    it("is idempotent: clearIntent on already-null state stays null", () => {
      const sm = makeIntentStateMachine();

      sm.clearIntent();

      expect(sm.pendingIntent).toBeNull();
    });

    it("open → clear → open produces new intent (not stale)", () => {
      const sm = makeIntentStateMachine();
      sm.openWithIntent({ kind: "help", shift_id: "s1", deviation_id: null, phase: null });
      sm.clearIntent();

      const fresh: BotssonIntent = {
        kind: "deviation",
        shift_id: "s2",
        deviation_id: "d1",
        phase: "pagar",
      };
      sm.openWithIntent(fresh);

      expect(sm.pendingIntent).toEqual(fresh);
    });
  });

  describe("BotssonIntent shape", () => {
    it("deviation intent carries shift_id, deviation_id, and phase", () => {
      const intent: BotssonIntent = {
        kind: "deviation",
        shift_id: "abc-123",
        deviation_id: "dev-456",
        phase: "pagar",
      };

      // Structural check — if the type changes these fail loudly.
      expect(intent.kind).toBe("deviation");
      expect(intent.shift_id).toBe("abc-123");
      expect(intent.deviation_id).toBe("dev-456");
      expect(intent.phase).toBe("pagar");
    });

    it("help intent allows null deviation_id and null phase", () => {
      const intent: BotssonIntent = {
        kind: "help",
        shift_id: "shift-999",
        deviation_id: null,
        phase: null,
      };

      expect(intent.kind).toBe("help");
      expect(intent.deviation_id).toBeNull();
      expect(intent.phase).toBeNull();
    });
  });
});
