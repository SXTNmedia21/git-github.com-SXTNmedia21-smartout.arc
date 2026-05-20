// ============================================
// voice-tool-resolver.test.ts
// Unit tests for ADR-0327 Phase 4 voice-tool-resolver.
//
// WHY STUBS: The resolver composes three harness sources (capabilities,
// site-map, authority). This file injects stub implementations via
// vi.mock to avoid:
//   (a) real capability registry reads (which depend on @smartout/ai build state)
//   (b) real site-map.json filesystem reads (not present in Docker / CI)
//   (c) env-var Zod validation that may not apply in test harness
//
// All four test cases drive the resolver's flag, bundle, cache, and
// PII-strip logic directly — these are the non-trivial paths under test.
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
    profile_id: "profile_voice_1",
    workspace_id: "ws_voice_1",
    role: "manager",
    ...overrides,
  };
}

function makeBundle(workspaceId: string, definitions: ClientToolDefinition[]): ToolBundle {
  return {
    definitions,
    implementations: Object.fromEntries(
      definitions.map((d) => [d.temporaryTool.modelToolName, async () => "stub-result"]),
    ),
    systemPromptSlices: [],
    authority: {
      workspace_id: workspaceId,
      channel: "voice",
      role: "manager",
      blockedTools: [],
      gateActionMisses: [],
    },
  };
}

// ━━━ Stub instances ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const stubCapabilities: CapabilitiesSource = {
  getToolsFor: vi.fn().mockResolvedValue({ definitions: [], implementations: {} }),
};

const stubSiteMap: SiteMapSource = {
  getSiteMap: vi.fn().mockResolvedValue({ routes: [], commonIntents: [] }),
};

// Authority stub: pass-through by default (returns bundle unchanged).
const stubAuthority: AuthorityEnforcer = {
  apply: vi.fn().mockImplementation((bundle: ToolBundle, userCtx: UserContext) => ({
    ...bundle,
    authority: { ...bundle.authority, workspace_id: userCtx.workspace_id },
  })),
};

// ━━━ Hoisted mocks ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// We mock @smartout/ai/harness so the resolver uses our stub sources instead
// of the real capability registry and site-map.json.
//
// We also mock "node:fs" to prevent filesystem reads — site-map path
// resolution uses import.meta.url which varies by environment.

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() =>
    JSON.stringify({ version: 1, generated_at: "2026-01-01T00:00:00.000Z", routes: [] }),
  ),
}));

vi.mock("@smartout/ai/harness", async (importOriginal) => {
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
          channel: string,
          _pageRoute: string | null,
          userCtx: UserContext,
        ): Promise<ToolBundle> => {
          // Delegate to the injected stub capabilities source.
          const result = await deps.capabilities.getToolsFor("voice", userCtx);
          const rawBundle = makeBundle(userCtx.workspace_id, result.definitions);
          // Mirror the real HarnessAdapterImpl: apply authority AFTER building bundle.
          // This is required so the PII-strip test can observe authority.apply being called
          // with the full bundle (and the stub can strip PII tools + set blockedTools).
          const enforcer = deps.authority ?? stubAuthority;
          return enforcer.apply(rawBundle, userCtx, channel as "voice");
        },
        getSiteMap: async (userCtx: UserContext) => deps.siteMap.getSiteMap(userCtx),
        subscribeToRouteChange: () => () => undefined,
      }),
    ),
  };
});

// ━━━ Import resolver AFTER mocks are hoisted ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import {
  resolveVoiceTools,
  resetVoiceToolResolverCache,
  harnessAdapterVoiceEnabled,
} from "../src/voice-tool-resolver.js";

// ━━━ Tests ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("harnessAdapterVoiceEnabled()", () => {
  afterEach(() => {
    delete process.env.HARNESS_ADAPTER_VOICE;
  });

  // Test 1: returns false when env var is unset
  it("returns false when HARNESS_ADAPTER_VOICE is not set", () => {
    delete process.env.HARNESS_ADAPTER_VOICE;
    expect(harnessAdapterVoiceEnabled()).toBe(false);
  });

  it('returns true when HARNESS_ADAPTER_VOICE is "true"', () => {
    process.env.HARNESS_ADAPTER_VOICE = "true";
    expect(harnessAdapterVoiceEnabled()).toBe(true);
  });

  it('returns false for other truthy-looking values ("1", "yes", "TRUE", "false")', () => {
    for (const val of ["1", "yes", "TRUE", "false", "0"]) {
      process.env.HARNESS_ADAPTER_VOICE = val;
      expect(harnessAdapterVoiceEnabled()).toBe(false);
    }
  });
});

describe("resolveVoiceTools()", () => {
  beforeEach(() => {
    resetVoiceToolResolverCache();
    vi.clearAllMocks();

    // Default: stub capabilities returns a voice-safe tool.
    vi.mocked(stubCapabilities.getToolsFor).mockResolvedValue({
      definitions: [makeToolDef("get_my_shifts")],
      implementations: {
        get_my_shifts: async () => "shift result",
      },
    });

    // Default: authority passes through unchanged.
    vi.mocked(stubAuthority.apply).mockImplementation(
      (bundle: ToolBundle, userCtx: UserContext) => ({
        ...bundle,
        authority: { ...bundle.authority, workspace_id: userCtx.workspace_id },
      }),
    );
  });

  // Test 2: returns ToolBundle with channel="voice" + authority.workspace_id matching userContext
  it("returns ToolBundle with channel=voice and authority.workspace_id matching userContext", async () => {
    const ctx = makeUserContext({ workspace_id: "ws_voice_test" });

    const bundle = await resolveVoiceTools({ pageRoute: null, userContext: ctx });

    expect(bundle.authority.workspace_id).toBe("ws_voice_test");
    expect(bundle.authority.channel).toBe("voice");
    expect(bundle.definitions).toHaveLength(1);
    expect(bundle.definitions[0]?.temporaryTool.modelToolName).toBe("get_my_shifts");
  });

  // Test 3: adapter cached per workspace_id (factory called once for two calls with same ws)
  it("caches adapter per workspace_id — createCapabilitiesSource called once for same workspace", async () => {
    const ctx = makeUserContext({ workspace_id: "ws_voice_cache" });

    await resolveVoiceTools({ pageRoute: null, userContext: ctx });
    await resolveVoiceTools({ pageRoute: "/dashboard/schedule", userContext: ctx });

    // createCapabilitiesSource is called once (at adapter creation) per workspace.
    const { createCapabilitiesSource } = await import("@smartout/ai/harness");
    expect(vi.mocked(createCapabilitiesSource)).toHaveBeenCalledTimes(1);
  });

  // Test 4: PII tool stripped from voice bundle by authority enforcer.
  // Verifies authority.apply is called and its result (with blockedTools) is returned.
  it("strips PII tools from voice bundle via authority enforcer (ADR-0078 voice-no-PII)", async () => {
    const ctx = makeUserContext({ workspace_id: "ws_voice_pii" });

    // Capabilities source returns a mix: one safe tool + one PII tool.
    vi.mocked(stubCapabilities.getToolsFor).mockResolvedValue({
      definitions: [makeToolDef("get_my_shifts"), makeToolDef("revealPersonnummer")],
      implementations: {
        get_my_shifts: async () => "shift result",
        revealPersonnummer: async () => "REDACTED",
      },
    });

    // Authority stub strips the PII tool and records it in blockedTools.
    vi.mocked(stubAuthority.apply).mockImplementation(
      (bundle: ToolBundle, userCtx: UserContext) => {
        const stripped = bundle.definitions.filter(
          (d) => d.temporaryTool.modelToolName !== "revealPersonnummer",
        );
        return {
          ...bundle,
          definitions: stripped,
          authority: {
            ...bundle.authority,
            workspace_id: userCtx.workspace_id,
            blockedTools: [{ name: "revealPersonnummer", rule: "ADR-0078-voice-no-pii" as const }],
          },
        };
      },
    );

    const bundle = await resolveVoiceTools({ pageRoute: null, userContext: ctx });

    // PII tool must not appear in the final bundle definitions.
    const names = bundle.definitions.map((d) => d.temporaryTool.modelToolName);
    expect(names).not.toContain("revealPersonnummer");
    expect(names).toContain("get_my_shifts");

    // Blocked tools audit record must be present.
    expect(bundle.authority.blockedTools).toHaveLength(1);
    expect(bundle.authority.blockedTools[0]?.name).toBe("revealPersonnummer");
    expect(bundle.authority.blockedTools[0]?.rule).toBe("ADR-0078-voice-no-pii");
  });
});

describe("resetVoiceToolResolverCache()", () => {
  it("clears adapter cache so next call creates a fresh adapter", async () => {
    const ctx = makeUserContext({ workspace_id: "ws_voice_reset" });
    const { createCapabilitiesSource } = await import("@smartout/ai/harness");
    const mockFn = vi.mocked(createCapabilitiesSource);

    const callsBefore = mockFn.mock.calls.length;

    await resolveVoiceTools({ pageRoute: null, userContext: ctx });
    expect(mockFn.mock.calls.length).toBe(callsBefore + 1);

    resetVoiceToolResolverCache();

    await resolveVoiceTools({ pageRoute: null, userContext: ctx });
    expect(mockFn.mock.calls.length).toBe(callsBefore + 2);
  });
});
