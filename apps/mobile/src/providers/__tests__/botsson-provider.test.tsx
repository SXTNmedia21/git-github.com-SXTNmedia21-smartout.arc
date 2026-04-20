/**
 * BotssonProvider — channel derivation tests (ADR-0107).
 *
 * Verifies the security contract: the `channel` exposed on sessionContext
 * MUST be derived from session `mode`, never a platform/device label.
 * This protects the three-layer PII defence of ADR-0077/0078 and the
 * ADR-0099 gate_action RPC, which both consume `channel` verbatim.
 *
 * We test the pure derivation function (the single choke-point the provider
 * uses to compute channel) plus a simulated Layer-3 tool guard that mirrors
 * the `ctx.channel !== 'chat'` pattern used by intake tools in
 * packages/ai/src/capabilities/shift-lifecycle/tools.ts.
 *
 * The provider itself is a thin React wrapper around this function; its RN
 * rendering path requires the Expo runtime and is covered by E2E. The
 * logic that could silently regress — the channel value — is captured here.
 */

// Import from the framework-free channel module. The provider re-exports
// the same symbols, but importing through the .tsx file pulls react-native
// into the jest-node runtime. This module has zero RN dependencies.
import {
  deriveBotssonChannel,
  type BotssonMode,
  type BotssonSessionChannel,
} from "../botsson-channel";

// ─── Simulated tool context mirroring AgentToolContext (ADR-0078 Layer 3) ──

type SimulatedToolContext = {
  channel: BotssonSessionChannel;
  device_type: "mobile" | "tablet" | "web";
};

type SimulatedPiiTool = (ctx: SimulatedToolContext) => "ok" | "blocked";

/**
 * Mirrors the Layer-3 guard in
 * packages/ai/src/capabilities/contract-intake/*.ts:
 *   if (ctx.channel !== 'chat') throw ...
 */
const intakeToolGuard: SimulatedPiiTool = (ctx) => {
  if (ctx.channel !== "chat") {
    return "blocked";
  }
  return "ok";
};

/**
 * Mirrors the reverse guard used by voice-enabled capabilities that must
 * refuse non-voice sessions (no current example in code, but the gate uses
 * the exact same field).
 */
const voiceOnlyToolGuard: SimulatedPiiTool = (ctx) => {
  if (ctx.channel !== "voice") {
    return "blocked";
  }
  return "ok";
};

/**
 * Mirrors how BotssonProvider builds the session context snapshot. Kept in
 * the test (not imported) so a change to the provider structure breaks the
 * test loudly — the test is the contract, not an echo of the impl.
 */
function buildContext(mode: BotssonMode | null): SimulatedToolContext {
  return {
    channel: deriveBotssonChannel(mode),
    device_type: "mobile",
  };
}

describe("BotssonProvider channel derivation (ADR-0107)", () => {
  describe("deriveBotssonChannel — the single choke-point", () => {
    it("case 1: mode='text' produces channel='chat'", () => {
      expect(deriveBotssonChannel("text")).toBe("chat");
    });

    it("case 2: mode='voice' produces channel='voice'", () => {
      expect(deriveBotssonChannel("voice")).toBe("voice");
    });

    it("case 3: idle (mode=null) defaults to 'chat' — safest default", () => {
      // 'chat' as default keeps voice-PII tools blocked until voice is
      // explicitly chosen. Never 'voice' (would open PII surface too early).
      expect(deriveBotssonChannel(null)).toBe("chat");
    });

    it("never returns a device/platform label", () => {
      const allInputs: Array<BotssonMode | null> = ["text", "voice", null];
      for (const mode of allInputs) {
        const result = deriveBotssonChannel(mode);
        // These are the only two valid values for this provider.
        expect(["chat", "voice"]).toContain(result);
        // Explicit check against the historical bug-string.
        expect(result).not.toBe("mobile");
        expect(result).not.toBe("web");
        expect(result).not.toBe("kiosk");
      }
    });
  });

  describe("mode transitions update channel in lock-step", () => {
    it("case 4 (transition): text -> voice flips channel to 'voice'", () => {
      // Simulate two render cycles of the provider: first with mode='text',
      // then with mode='voice' after startVoiceSession().
      const before = buildContext("text");
      const after = buildContext("voice");

      expect(before.channel).toBe("chat");
      expect(after.channel).toBe("voice");
    });

    it("voice -> text flips channel back to 'chat'", () => {
      const before = buildContext("voice");
      const after = buildContext("text");

      expect(before.channel).toBe("voice");
      expect(after.channel).toBe("chat");
    });
  });

  describe("device_type is independent of channel (ADR-0107 rule 3)", () => {
    it("case 5: device_type stays 'mobile' across every channel", () => {
      const idle = buildContext(null);
      const text = buildContext("text");
      const voice = buildContext("voice");

      expect(idle.device_type).toBe("mobile");
      expect(text.device_type).toBe("mobile");
      expect(voice.device_type).toBe("mobile");

      // And device_type is never leaked into channel.
      expect(idle.channel).not.toBe(idle.device_type);
      expect(voice.channel).not.toBe(voice.device_type);
    });
  });

  describe("Layer-3 tool guard (ADR-0078) reads channel correctly", () => {
    it("case 6 (most important): voice session context blocks chat-only PII tool", () => {
      const ctx = buildContext("voice");

      // This is the exact assertion the ADR-0078 / ADR-0099 guard makes.
      // With the bug (channel='mobile'), this would have resolved to
      // 'blocked' for the wrong reason, OR — if normalised — would have
      // fallen through to 'ok' and leaked PII to voice. Neither is correct.
      expect(ctx.channel).toBe("voice");
      expect(intakeToolGuard(ctx)).toBe("blocked");
    });

    it("text session context allows chat-only PII tool", () => {
      const ctx = buildContext("text");

      expect(ctx.channel).toBe("chat");
      expect(intakeToolGuard(ctx)).toBe("ok");
    });

    it("voice-only tool is visible in voice, hidden in text", () => {
      expect(voiceOnlyToolGuard(buildContext("voice"))).toBe("ok");
      expect(voiceOnlyToolGuard(buildContext("text"))).toBe("blocked");
    });
  });
});
