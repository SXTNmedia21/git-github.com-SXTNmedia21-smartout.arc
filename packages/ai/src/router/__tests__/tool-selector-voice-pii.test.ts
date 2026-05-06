/**
 * Regression test for ADR-0078 voice channel-guard, scoped to the REAL
 * registered capabilities (no mocking). Locks Phase C1 acceptance gate #6:
 *
 *   "Voice-forbidden capability filtered (e.g. contract_intake) when
 *    channel='voice' — even with autonomous authority + 100% confidence."
 *
 * If a future capability change drops `allowedChannels: ['chat']` from
 * contract_intake, or if selectTools stops honouring the channel filter,
 * this test fails and the merge is blocked.
 *
 * Why a separate file from tool-selector.test.ts:
 *   tool-selector.test.ts mocks the registry to keep its unit tests
 *   hermetic. This file deliberately uses the LIVE registry to catch
 *   capability-side regressions (the kind that grep-only audits miss).
 */
import { describe, it, expect } from "vitest";

// Live registry — no vi.mock here. The selectTools import below resolves
// against the real capability map.
import { selectTools, type AuthorityConfig } from "../tool-selector.js";
import type { IntentResult } from "../intent-classifier.js";

const intent = (capability: IntentResult["capability"], confidence: number): IntentResult => ({
  intent: "test_intent",
  capability,
  confidence,
  reasoning: "test",
});

describe("selectTools — voice channel guard (ADR-0078, Phase C1 acceptance #6)", () => {
  it("contract_intake is excluded when channel='voice', even with autonomous authority", () => {
    // Highest possible permission + highest possible intent confidence — the
    // only thing standing between the agent and a PII tool is the channel
    // guard. If anyone weakens it, this test breaks.
    const auth: AuthorityConfig = { contract_intake: "autonomous" };
    const tools = selectTools(intent("contract_intake", 1.0), auth, "voice");
    expect(tools).toEqual([]);
  });

  it("contract_intake remains available on chat channel with the same authority", () => {
    const auth: AuthorityConfig = { contract_intake: "autonomous" };
    const tools = selectTools(intent("contract_intake", 1.0), auth, "chat");
    expect(tools.length).toBeGreaterThan(0);
  });

  it("when no channel is provided (legacy callers), contract_intake stays available", () => {
    // Backwards-compat: callers that pre-date ADR-0078 do not pass channel.
    // Filtering kicks in only when channel is explicitly provided.
    const auth: AuthorityConfig = { contract_intake: "autonomous" };
    const tools = selectTools(intent("contract_intake", 1.0), auth);
    expect(tools.length).toBeGreaterThan(0);
  });
});
