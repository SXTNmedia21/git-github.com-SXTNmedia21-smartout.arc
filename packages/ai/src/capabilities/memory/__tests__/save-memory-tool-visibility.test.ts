// packages/ai/src/capabilities/memory/__tests__/save-memory-tool-visibility.test.ts
//
// Regression net for the tier-unlock invariant on the `memory` capability.
//
// Context (G1 closure — F-MEM-UNBLOCK 2026-05-10):
//   Phase A3 shipped save_memory tool + writer infrastructure but never seeded
//   engine_authority_config. Default authority = read_only, which hides
//   save_memory (suggest-tier) from the agent toolset. Migration
//   20260528000000 seeded the 3 dev workspaces. These 4 cases exist as a
//   permanent regression net: if tool-selector.ts changes in a way that
//   silently re-hides save_memory under suggest/confirm/autonomous authority,
//   these tests will catch it before it ships.
//
// Design note — why selectTools (not selectToolsForCapability):
//   selectToolsForCapability is an internal helper, not exported. The public
//   contract exposed by tool-selector.ts is selectTools(intent, authorityConfig,
//   channel). We construct a minimal IntentResult with confidence=0.9 and
//   capability="memory" to exercise the targeted-capability path (line 101 in
//   tool-selector.ts: confidence >= 0.7 && capability !== "general").
//
//   Channel is always "chat" — memoryCapability.allowedChannels = ["chat"] and
//   selectTools applies the ADR-0078 channel guard before calling
//   selectToolsForCapability. Passing "voice" would return [] regardless of
//   authority level, which is correct but not what these tests measure.

import { describe, expect, it } from "vitest";
import { selectTools, type AuthorityConfig } from "../../../router/tool-selector.js";
import type { IntentResult } from "../../../router/intent-classifier.js";

// Minimal IntentResult with high confidence targeting the memory capability.
// confidence >= 0.7 required for the targeted-capability path in selectTools.
const memoryIntent: IntentResult = {
  intent: "remember a fact about the user",
  capability: "memory",
  confidence: 0.9,
  reasoning: "test fixture",
};

describe("memory capability — save_memory tool visibility (G1 closure)", () => {
  it("hides save_memory when authority level is read_only (default / no seed)", () => {
    // Empty config → falls through to defaultLevel="read_only" inside selectTools.
    // save_memory is suggest-tier; tierUnlocked(read_only, suggest) = false.
    const authorityConfig: AuthorityConfig = {};
    const tools = selectTools(memoryIntent, authorityConfig, "chat");
    const toolNames = tools.map((t) => (t as unknown as { name: string }).name);
    expect(toolNames).not.toContain("save_memory");
  });

  it("exposes save_memory when authority level is suggest (migration seed value)", () => {
    // This is the level seeded by migration 20260528000000 for the 3 dev
    // workspaces. tierUnlocked(suggest, suggest) = true.
    const authorityConfig: AuthorityConfig = { memory: "suggest" };
    const tools = selectTools(memoryIntent, authorityConfig, "chat");
    const toolNames = tools.map((t) => (t as unknown as { name: string }).name);
    expect(toolNames).toContain("save_memory");
  });

  it("exposes save_memory when authority level is confirm or autonomous (full unlock)", () => {
    for (const level of ["confirm", "autonomous"] as const) {
      const authorityConfig: AuthorityConfig = { memory: level };
      const tools = selectTools(memoryIntent, authorityConfig, "chat");
      const toolNames = tools.map((t) => (t as unknown as { name: string }).name);
      expect(toolNames).toContain("save_memory");
    }
  });

  it("hides save_memory when authority level is disabled (explicit opt-out)", () => {
    // disabled short-circuits regardless of tier; tierUnlocked(disabled, *) = false.
    const authorityConfig: AuthorityConfig = { memory: "disabled" };
    const tools = selectTools(memoryIntent, authorityConfig, "chat");
    const toolNames = tools.map((t) => (t as unknown as { name: string }).name);
    expect(toolNames).not.toContain("save_memory");
  });
});
