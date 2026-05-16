// ============================================
// chat-tool-resolver.test.ts
// Unit tests for the Phase 3 ADR-0327 chat-tool-resolver.
//
// WHY STUBS: The resolver composes three harness sources (capabilities,
// site-map, authority). This file injects stub implementations via
// vi.mock to avoid:
//   (a) real capability registry reads (which depend on @smartout/ai build state)
//   (b) real site-map.json filesystem reads (path varies by runner cwd)
//   (c) env-var Zod validation in config.ts (ENGINE_URL etc. not set in test harness)
//
// All six test cases drive the resolver's merge + cache logic directly,
// which is the non-trivial logic under test.
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  CapabilitiesSource,
  SiteMapSource,
  AuthorityEnforcer,
  ToolBundle,
  UserContext,
  ClientToolDefinition,
} from "@smartout/ai/harness/types";

// ━━━ Stub factories ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function makeToolDef(name: string): ClientToolDefinition {
  return {
    temporaryTool: {
      modelToolName: name,
      description: `Stub tool: ${name}`,
      dynamicParameters: [],
      client: {},
    },
  };
}

function makeUserContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    profile_id: "profile_test_1",
    workspace_id: "ws_test_1",
    role: "manager",
    ...overrides,
  };
}

function makeEmptyBundle(workspaceId: string): ToolBundle {
  return {
    definitions: [],
    implementations: {},
    systemPromptSlices: [],
    authority: {
      workspace_id: workspaceId,
      channel: "chat",
      role: "manager",
      blockedTools: [],
      gateActionMisses: [],
    },
  };
}

// ━━━ Module-level stubs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Stub implementations for the three harness sources.
// Each test can override these via vi.mocked(...).mockReturnValue / mockResolvedValue.

const stubCapabilities: CapabilitiesSource = {
  getToolsFor: vi.fn().mockResolvedValue({ definitions: [], implementations: {} }),
};

const stubSiteMap: SiteMapSource = {
  getSiteMap: vi.fn().mockResolvedValue({ routes: [], commonIntents: [] }),
};

// Authority stub: pass-through (returns bundle unchanged + workspace_id from context).
const stubAuthority: AuthorityEnforcer = {
  apply: vi.fn().mockImplementation((bundle: ToolBundle, userCtx: UserContext) => ({
    ...bundle,
    authority: {
      ...bundle.authority,
      workspace_id: userCtx.workspace_id,
    },
  })),
};

// ━━━ Hoisted mocks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// We mock @smartout/ai/harness so the resolver uses our stub sources instead
// of the real capability registry and site-map.json.
//
// We also mock "node:fs" to prevent any filesystem reads — the site-map path
// resolution uses import.meta.url which varies by environment.

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => {
    // Return minimal valid site-map JSON so createSiteMapSource doesn't throw.
    return JSON.stringify({ version: 1, generated_at: "2026-01-01T00:00:00.000Z", routes: [] });
  }),
}));

vi.mock("@smartout/ai/harness", async (importOriginal) => {
  // We keep real type exports but replace factory functions with stubs.
  const original = await importOriginal<typeof import("@smartout/ai/harness")>();

  return {
    ...original,
    createCapabilitiesSource: vi.fn(() => stubCapabilities),
    createSiteMapSource: vi.fn(() => stubSiteMap),
    createAuthorityEnforcer: vi.fn(() => stubAuthority),
    createHarnessAdapter: vi.fn(
      (deps: {
        capabilities: CapabilitiesSource;
        siteMap: SiteMapSource;
        authority?: AuthorityEnforcer;
      }) => ({
        getToolsForChannel: async (
          _channel: string,
          _pageRoute: string | null,
          userCtx: UserContext,
        ): Promise<ToolBundle> => {
          // Delegate to the injected stub capabilities source.
          const result = await deps.capabilities.getToolsFor("chat", userCtx);
          const base = makeEmptyBundle(userCtx.workspace_id);
          return {
            ...base,
            definitions: result.definitions,
            implementations: result.implementations,
          };
        },
        getSiteMap: async (userCtx: UserContext) => deps.siteMap.getSiteMap(userCtx),
        subscribeToRouteChange: () => () => undefined,
      }),
    ),
  };
});

// ━━━ Tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import {
  resolveChatTools,
  resetChatToolResolverCache,
  harnessAdapterChatEnabled,
} from "../chat-tool-resolver.js";

describe("harnessAdapterChatEnabled()", () => {
  afterEach(() => {
    delete process.env.HARNESS_ADAPTER_CHAT;
  });

  // Test 1: returns false when env var is unset.
  it("returns false when HARNESS_ADAPTER_CHAT is not set", () => {
    delete process.env.HARNESS_ADAPTER_CHAT;
    expect(harnessAdapterChatEnabled()).toBe(false);
  });

  // Test 2: returns true when explicitly "true".
  it('returns true when HARNESS_ADAPTER_CHAT is "true"', () => {
    process.env.HARNESS_ADAPTER_CHAT = "true";
    expect(harnessAdapterChatEnabled()).toBe(true);
  });

  it('returns false for other truthy-looking values ("1", "yes", "TRUE")', () => {
    for (const val of ["1", "yes", "TRUE", "false", "0"]) {
      process.env.HARNESS_ADAPTER_CHAT = val;
      expect(harnessAdapterChatEnabled()).toBe(false);
    }
  });
});

describe("resolveChatTools()", () => {
  beforeEach(() => {
    resetChatToolResolverCache();
    vi.clearAllMocks();

    // Default: stub capabilities returns a single tool "doThing".
    vi.mocked(stubCapabilities.getToolsFor).mockResolvedValue({
      definitions: [makeToolDef("doThing")],
      implementations: {
        doThing: async () => "doThing result",
      },
    });

    // Default: authority stub passes through unchanged.
    vi.mocked(stubAuthority.apply).mockImplementation(
      (bundle: ToolBundle, userCtx: UserContext) => ({
        ...bundle,
        authority: { ...bundle.authority, workspace_id: userCtx.workspace_id },
      }),
    );
  });

  // Test 3: no clientTools → only capability tools returned, no collisions.
  it("returns only capability tools when clientTools is null", async () => {
    const ctx = makeUserContext();
    const result = await resolveChatTools({
      pageRoute: "/dashboard/schedule",
      userContext: ctx,
      clientTools: null,
    });

    expect(result.viaHarnessAdapter).toBe(true);
    expect(result.clientToolCollisions).toEqual([]);
    expect(result.bundle.definitions).toHaveLength(1);
    expect(result.bundle.definitions[0]?.temporaryTool.modelToolName).toBe("doThing");
  });

  // Test 4: non-colliding clientTools are appended to definitions.
  it("appends non-colliding client tools to bundle.definitions", async () => {
    const ctx = makeUserContext();
    const clientTool = makeToolDef("navigateTo");

    const result = await resolveChatTools({
      pageRoute: "/dashboard/schedule",
      userContext: ctx,
      clientTools: [clientTool],
    });

    expect(result.viaHarnessAdapter).toBe(true);
    expect(result.clientToolCollisions).toEqual([]);
    // Both capability tool + client tool should be present.
    const names = result.bundle.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(names).toContain("doThing");
    expect(names).toContain("navigateTo");
  });

  // Test 5: colliding clientTools replace capability tool + collision recorded.
  it("replaces capability tool on name collision and records collision", async () => {
    const ctx = makeUserContext();

    // Client ships a tool with the SAME name as the capability tool.
    const collisionTool: ClientToolDefinition = {
      temporaryTool: {
        modelToolName: "doThing", // same name as capability tool
        description: "Client-side doThing (override)",
        dynamicParameters: [],
        client: {},
      },
    };

    const result = await resolveChatTools({
      pageRoute: "/dashboard/schedule",
      userContext: ctx,
      clientTools: [collisionTool],
    });

    expect(result.clientToolCollisions).toContain("doThing");

    // Only one definition with that name (client wins).
    const doThingDefs = result.bundle.definitions.filter(
      (d) => d.temporaryTool.modelToolName === "doThing",
    );
    expect(doThingDefs).toHaveLength(1);
    expect(doThingDefs[0]?.temporaryTool.description).toBe("Client-side doThing (override)");
  });

  // Test 6: adapter is cached per workspace_id (capabilities source called once across two calls).
  it("caches adapter per workspace_id — capabilities source called once for same workspace", async () => {
    const ctx = makeUserContext({ workspace_id: "ws_cache_test" });

    await resolveChatTools({ pageRoute: null, userContext: ctx, clientTools: null });
    await resolveChatTools({ pageRoute: "/dashboard/hms", userContext: ctx, clientTools: null });

    // createCapabilitiesSource is called once (at adapter creation time) per workspace.
    // The capabilities source getToolsFor is called once per resolveChatTools call,
    // but the ADAPTER itself is re-used (createCapabilitiesSource called once).
    const { createCapabilitiesSource } = await import("@smartout/ai/harness");
    expect(vi.mocked(createCapabilitiesSource)).toHaveBeenCalledTimes(1);
  });

  // Test 7: different workspace_id creates a different adapter (separate cache entries).
  it("creates separate adapter instances for different workspace_ids", async () => {
    const ctx1 = makeUserContext({ workspace_id: "ws_A" });
    const ctx2 = makeUserContext({ workspace_id: "ws_B" });

    await resolveChatTools({ pageRoute: null, userContext: ctx1, clientTools: null });
    await resolveChatTools({ pageRoute: null, userContext: ctx2, clientTools: null });

    const { createCapabilitiesSource } = await import("@smartout/ai/harness");
    expect(vi.mocked(createCapabilitiesSource)).toHaveBeenCalledTimes(2);
  });

  // Test 8: authority is re-applied after client-tool merge (R4 mitigation).
  // A client tool with a PII-tier name gets stripped on voice channel —
  // but this resolver is chat-only. We verify authority.apply IS called
  // with the merged bundle (including client tools), not the pre-merge bundle.
  // For chat, non-PII tools pass through unchanged.
  it("re-applies authority enforcer on merged bundle (including client tools)", async () => {
    const ctx = makeUserContext();
    const clientTool = makeToolDef("navigateTo");

    // Track what the authority stub receives.
    let capturedBundle: ToolBundle | null = null;
    vi.mocked(stubAuthority.apply).mockImplementation(
      (bundle: ToolBundle, userCtx: UserContext) => {
        capturedBundle = bundle;
        return {
          ...bundle,
          authority: { ...bundle.authority, workspace_id: userCtx.workspace_id },
        };
      },
    );

    await resolveChatTools({
      pageRoute: null,
      userContext: ctx,
      clientTools: [clientTool],
    });

    // Authority must have been called with the MERGED bundle (containing navigateTo).
    expect(capturedBundle).not.toBeNull();
    const mergedNames = (capturedBundle as unknown as ToolBundle).definitions.map(
      (d) => d.temporaryTool.modelToolName,
    );
    // Both capability tool + client tool present when authority is re-applied.
    expect(mergedNames).toContain("doThing");
    expect(mergedNames).toContain("navigateTo");
  });
});

describe("resetChatToolResolverCache()", () => {
  it("clears adapter cache so next call creates a fresh adapter", async () => {
    const ctx = makeUserContext({ workspace_id: "ws_reset_test" });

    const { createCapabilitiesSource } = await import("@smartout/ai/harness");
    const mockFn = vi.mocked(createCapabilitiesSource);

    // Baseline: record how many times the factory has been called so far
    // across all preceding tests (vi.clearAllMocks only resets in beforeEach
    // of the resolveChatTools describe block).
    const callsBefore = mockFn.mock.calls.length;

    await resolveChatTools({ pageRoute: null, userContext: ctx, clientTools: null });
    // First call: adapter created for ws_reset_test → factory called once more.
    expect(mockFn.mock.calls.length).toBe(callsBefore + 1);

    resetChatToolResolverCache();

    await resolveChatTools({ pageRoute: null, userContext: ctx, clientTools: null });
    // After cache reset: same workspace_id forces a fresh adapter → factory called again.
    expect(mockFn.mock.calls.length).toBe(callsBefore + 2);
  });
});
