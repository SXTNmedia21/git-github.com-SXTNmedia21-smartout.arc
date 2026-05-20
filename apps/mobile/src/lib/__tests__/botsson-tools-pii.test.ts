/**
 * botsson-tools-pii.test.ts
 *
 * ADR-0378 R7 + ADR-0078 compliance proof for `mobile_call_leader`.
 *
 * Asserts:
 *   1. Tool registration payload (wire args) does NOT include `leader_phone`.
 *   2. Handler called with only `leader_name` returns success when resolver resolves.
 *   3. Handler ignores any `leader_phone` passed in params (legacy call pattern).
 *   4. Handler returns graceful error when phoneResolver returns null.
 *   5. All 5 tools are registered; no other tool carries a `phone`-named param.
 */

// ── Module mocks (React Native native modules — not available in node env) ────

jest.mock("expo-router", () => ({ router: { push: jest.fn() } }), { virtual: true });
jest.mock(
  "react-native",
  () => ({
    Linking: {
      canOpenURL: jest.fn().mockResolvedValue(true),
      openURL: jest.fn().mockResolvedValue(undefined),
    },
    Alert: { alert: jest.fn() },
  }),
  { virtual: true },
);
jest.mock(
  "expo-haptics",
  () => ({
    impactAsync: jest.fn().mockResolvedValue(undefined),
    ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  }),
  { virtual: true },
);

import { Linking } from "react-native";
import { createMobileClientTools, type ClientToolDefinitionShape } from "../botsson-tools";

// ── Helpers ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

/** Collect all parameter names declared in a tool's wire definition. */
function wireParamNames(def: ClientToolDefinitionShape): string[] {
  return def.temporaryTool.dynamicParameters.map((p) => p.name);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("mobile_call_leader — ADR-0378 R7 PII wire compliance", () => {
  it("wire registration payload does NOT contain leader_phone parameter", () => {
    const bundle = createMobileClientTools({ phoneResolver: async () => null });
    const defs = bundle.getDefinitionsForRegistration();

    const callLeaderDef = defs.find((d) => d.temporaryTool.modelToolName === "mobile_call_leader");

    expect(callLeaderDef).toBeDefined();
    const paramNames = wireParamNames(callLeaderDef!);

    // PRIMARY ASSERTION: phone number must not be on the wire
    expect(paramNames).not.toContain("leader_phone");
    // Confirmatory: the only optional arg is leader_name (display/confirmation only)
    expect(paramNames).toEqual(["leader_name"]);
  });

  it("handler returns success when phoneResolver resolves a phone number", async () => {
    const mockPhone = "+4712345678";
    const phoneResolver = jest.fn().mockResolvedValue(mockPhone);
    const bundle = createMobileClientTools({ phoneResolver });

    const result = await bundle.executeTool("mobile_call_leader", {
      leader_name: "Kari Nordmann",
    });

    // phoneResolver should have been called (not params.leader_phone)
    expect(phoneResolver).toHaveBeenCalledTimes(1);
    // Linking.openURL called with the resolved phone
    expect(Linking.openURL).toHaveBeenCalledWith(`tel:${mockPhone}`);
    // Result contains leader name but NOT the phone number
    expect(result).toContain("Kari Nordmann");
    expect(result).not.toContain(mockPhone);
  });

  it("handler ignores leader_phone if accidentally passed in params (legacy call pattern)", async () => {
    const resolvedPhone = "+4799999999";
    const phoneResolver = jest.fn().mockResolvedValue(resolvedPhone);
    const bundle = createMobileClientTools({ phoneResolver });

    // Simulate a legacy call that still sends leader_phone in args
    const result = await bundle.executeTool("mobile_call_leader", {
      leader_name: "Ole Norsk",
      leader_phone: "+470000000", // should be ignored — resolver is authoritative
    });

    // Resolver was still called — not params.leader_phone
    expect(phoneResolver).toHaveBeenCalledTimes(1);
    // The dialer was opened with the RESOLVED phone, not the param
    expect(Linking.openURL).toHaveBeenCalledWith(`tel:${resolvedPhone}`);
    expect(result).not.toContain("+470000000");
    expect(result).not.toContain("leader_phone");
  });

  it("handler returns graceful error string when phoneResolver returns null", async () => {
    const bundle = createMobileClientTools({ phoneResolver: async () => null });

    const result = await bundle.executeTool("mobile_call_leader", {
      leader_name: "Ukjent leder",
    });

    // No dialer opened
    expect(Linking.openURL).not.toHaveBeenCalled();
    // Error message must NOT ask voice-agent for a phone (that would route PII back)
    expect(result).not.toContain("leader_phone");
    expect(result).not.toContain("provide");
    expect(result).not.toContain("missing");
    // Must give user actionable guidance via chat
    expect(result).toContain("chat");
  });

  it("no other tool in the bundle exposes a phone-named parameter on the wire", () => {
    const bundle = createMobileClientTools({ phoneResolver: async () => null });
    const defs = bundle.getDefinitionsForRegistration();

    // Ensure we have all 5 tools
    expect(defs).toHaveLength(5);

    for (const def of defs) {
      const paramNames = wireParamNames(def);
      for (const name of paramNames) {
        // Any param named phone/Phone/PHONE or containing 'phone' is a PII risk
        expect(name.toLowerCase()).not.toContain("phone");
      }
    }
  });
});
