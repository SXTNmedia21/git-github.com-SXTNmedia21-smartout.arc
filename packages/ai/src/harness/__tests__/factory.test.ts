/**
 * factory.test.ts — Integration tests for HarnessAdapter factory (Phase 2).
 *
 * Tests cover:
 *  1. chat channel: both stub tools included (no PII stripping on chat)
 *  2. voice channel: revealPersonnummer excluded; blockedTools records ADR-0078-voice-no-pii
 *  3. authority.workspace_id === userContext.workspace_id regardless of channel
 *  4. authority.channel matches the requested channel
 *  5. getSiteMap delegates to the stub and returns its result
 *  6. subscribeToRouteChange returns an Unsubscribe function without throwing
 *
 * Design: uses STUB sources (not real registry) for deterministic assertions.
 * Real registry tests live in capabilities-source.test.ts.
 */

import { describe, expect, it } from "vitest";
import { createHarnessAdapter } from "../factory.js";
import type {
  CapabilitiesSource,
  ClientToolDefinition,
  ClientToolImplementation,
  SiteMap,
  SiteMapSource,
  Unsubscribe,
  UserContext,
} from "../types.js";

/* ━━━ Stub sources ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function makeToolDefinition(name: string): ClientToolDefinition {
  return {
    temporaryTool: {
      modelToolName: name,
      description: `Stub tool: ${name}`,
      dynamicParameters: [],
      client: {},
    },
  };
}

function makeImpl(name: string): ClientToolImplementation {
  return async (_params: Record<string, unknown>) => `result-${name}`;
}

/**
 * Stub CapabilitiesSource — returns two tools:
 *  - getDaySnapshot: a clean, chat-eligible tool
 *  - revealPersonnummer: a PII tool that should be stripped on voice (ADR-0078)
 *
 * Does NOT use the real registry — deterministic for assertion.
 */
const stubCapabilities: CapabilitiesSource = {
  async getToolsFor(
    _channel,
    _userContext,
  ): Promise<{
    definitions: ClientToolDefinition[];
    implementations: Record<string, ClientToolImplementation>;
  }> {
    const names = ["getDaySnapshot", "revealPersonnummer"];
    return {
      definitions: names.map(makeToolDefinition),
      implementations: Object.fromEntries(names.map((n) => [n, makeImpl(n)])),
    };
  },
};

/**
 * Stub SiteMapSource — returns a minimal SiteMap with one route and one intent.
 */
const STUB_SITE_MAP: SiteMap = {
  routes: [
    {
      path: "/dashboard",
      purpose: "Daily console",
      module: "Core",
      tier: 1,
      toolCount: 2,
      scope: null,
    },
  ],
  commonIntents: [{ phrase: "Vis dagsplan", routePath: "/dashboard" }],
};

const stubSiteMap: SiteMapSource = {
  async getSiteMap(_userContext): Promise<SiteMap> {
    return STUB_SITE_MAP;
  },
};

/* ━━━ Shared test context ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

const USER_CTX: UserContext = {
  profile_id: "profile-test-001",
  workspace_id: "ws-test-abc123",
  role: "employee",
};

/* ━━━ Tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

describe("createHarnessAdapter — factory wiring", () => {
  it("1. chat channel: bundle includes both stub tools (PII not stripped on chat)", async () => {
    const adapter = createHarnessAdapter({
      capabilities: stubCapabilities,
      siteMap: stubSiteMap,
    });

    const bundle = await adapter.getToolsForChannel("chat", "/dashboard", USER_CTX);

    const names = bundle.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(names).toContain("getDaySnapshot");
    expect(names).toContain("revealPersonnummer");

    // No tools should be blocked on chat.
    expect(bundle.authority.blockedTools).toHaveLength(0);

    // Both implementations must be present.
    expect(bundle.implementations["getDaySnapshot"]).toBeDefined();
    expect(bundle.implementations["revealPersonnummer"]).toBeDefined();
  });

  it("2. voice channel: revealPersonnummer excluded; blockedTools records ADR-0078-voice-no-pii", async () => {
    const adapter = createHarnessAdapter({
      capabilities: stubCapabilities,
      siteMap: stubSiteMap,
    });

    const bundle = await adapter.getToolsForChannel("voice", "/dashboard", USER_CTX);

    const names = bundle.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(names).toContain("getDaySnapshot");
    expect(names).not.toContain("revealPersonnummer");

    // Implementation must also be stripped (key parity).
    expect(bundle.implementations["getDaySnapshot"]).toBeDefined();
    expect(bundle.implementations["revealPersonnummer"]).toBeUndefined();

    // Authority record must name the blocked tool + rule.
    const blocked = bundle.authority.blockedTools.find((e) => e.name === "revealPersonnummer");
    expect(blocked).toBeDefined();
    expect(blocked?.rule).toBe("ADR-0078-voice-no-pii");
  });

  it("3. authority.workspace_id === userContext.workspace_id regardless of channel", async () => {
    const adapter = createHarnessAdapter({
      capabilities: stubCapabilities,
      siteMap: stubSiteMap,
    });

    const chatBundle = await adapter.getToolsForChannel("chat", "/dashboard", USER_CTX);
    const voiceBundle = await adapter.getToolsForChannel("voice", "/dashboard", USER_CTX);

    expect(chatBundle.authority.workspace_id).toBe(USER_CTX.workspace_id);
    expect(voiceBundle.authority.workspace_id).toBe(USER_CTX.workspace_id);
  });

  it("4. authority.channel matches the requested channel", async () => {
    const adapter = createHarnessAdapter({
      capabilities: stubCapabilities,
      siteMap: stubSiteMap,
    });

    const chatBundle = await adapter.getToolsForChannel("chat", "/dashboard", USER_CTX);
    const voiceBundle = await adapter.getToolsForChannel("voice", "/dashboard", USER_CTX);

    expect(chatBundle.authority.channel).toBe("chat");
    expect(voiceBundle.authority.channel).toBe("voice");
  });

  it("5. getSiteMap delegates to stub and returns its result", async () => {
    const adapter = createHarnessAdapter({
      capabilities: stubCapabilities,
      siteMap: stubSiteMap,
    });

    const siteMap = await adapter.getSiteMap(USER_CTX);

    expect(siteMap.routes).toHaveLength(1);
    expect(siteMap.routes[0]?.path).toBe("/dashboard");
    expect(siteMap.commonIntents).toHaveLength(1);
    expect(siteMap.commonIntents[0]?.phrase).toBe("Vis dagsplan");
  });

  it("6. subscribeToRouteChange returns an Unsubscribe function without throwing", () => {
    const adapter = createHarnessAdapter({
      capabilities: stubCapabilities,
      siteMap: stubSiteMap,
    });

    let unsubscribe: Unsubscribe | undefined;

    expect(() => {
      unsubscribe = adapter.subscribeToRouteChange((_route: string) => {
        // callback intentionally empty — Phase 4 wires real handler
      });
    }).not.toThrow();

    expect(typeof unsubscribe).toBe("function");

    // Calling the unsubscribe must also not throw.
    expect(() => {
      unsubscribe?.();
    }).not.toThrow();
  });
});
