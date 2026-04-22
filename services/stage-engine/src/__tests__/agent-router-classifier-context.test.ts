/**
 * agent-router-classifier-context.test.ts
 * Unit tests for buildClassifierContext — the helper that feeds role/department/team
 * signal into the intent classifier (Phase A5, ADR-0112).
 *
 * Verifies: realistic profile rows produce non-empty context, missing rows yield "",
 * and department/team are treated as optional additive segments.
 */
import { describe, expect, it, vi } from "vitest";

// Mock secrets so the module-level import chain doesn't try to read Vault.
vi.mock("../secrets.js", () => ({
  getSecrets: vi.fn().mockReturnValue({
    openrouterApiKey: "test-openrouter-key",
    telegramBotToken: null,
    telegramAdminChatId: null,
    telegramWebhookSecret: null,
    ultravoxApiKey: null,
  }),
}));

// Mock supabase client so the imported module's top-level `supabaseAdmin` is harmless.
vi.mock("../lib/supabase.js", () => ({
  supabaseAdmin: {},
  createUserClient: vi.fn(),
}));

// Mock WS connection manager (pulled in via agent-router.ts module graph).
vi.mock("../ws/connection-manager.js", () => ({
  broadcastToSession: vi.fn(),
}));

// Mock routes/ws.js (also pulled in via module graph).
vi.mock("../routes/ws.js", () => ({
  getBufferedActions: vi.fn().mockReturnValue([]),
}));

// Import AFTER mocks so module resolution picks them up.
import { buildClassifierContext } from "../core/agent-router.js";
import type { SupabaseClient } from "@supabase/supabase-js";

type ProfileQueryResult = {
  data: {
    role: string | null;
    display_name: string | null;
    department: { name: string } | null;
  } | null;
  error: null;
};

/** Minimal query-builder stub that matches the shape buildClassifierContext walks. */
function makeSupabaseStub(result: ProfileQueryResult): SupabaseClient {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  const client = {
    from: vi.fn().mockReturnValue(builder),
  };
  return client as unknown as SupabaseClient;
}

describe("buildClassifierContext", () => {
  it("returns non-empty context for a realistic admin profile with department", async () => {
    const supabase = makeSupabaseStub({
      data: {
        role: "admin",
        display_name: "Pontus",
        department: { name: "Kjøkken" },
      },
      error: null,
    });

    const ctx = await buildClassifierContext({
      supabase,
      workspaceId: "ws-1",
      profileId: "profile-1",
    });

    expect(ctx).not.toBe("");
    expect(ctx).toContain("Rolle: admin.");
    expect(ctx).toContain("Avdeling: Kjøkken.");
  });

  it("returns role-only context when department is absent", async () => {
    const supabase = makeSupabaseStub({
      data: {
        role: "employee",
        display_name: "Ansatt",
        department: null,
      },
      error: null,
    });

    const ctx = await buildClassifierContext({
      supabase,
      workspaceId: "ws-1",
      profileId: "profile-2",
    });

    expect(ctx).toBe("Rolle: employee.");
  });

  it("defaults role to employee when profile.role is null", async () => {
    const supabase = makeSupabaseStub({
      data: {
        role: null,
        display_name: null,
        department: { name: "Bar" },
      },
      error: null,
    });

    const ctx = await buildClassifierContext({
      supabase,
      workspaceId: "ws-1",
      profileId: "profile-3",
    });

    expect(ctx).toBe("Rolle: employee. Avdeling: Bar.");
  });

  it("returns empty string when profile lookup finds no row", async () => {
    const supabase = makeSupabaseStub({ data: null, error: null });

    const ctx = await buildClassifierContext({
      supabase,
      workspaceId: "ws-1",
      profileId: "missing",
    });

    expect(ctx).toBe("");
  });

  it("scopes query by BOTH profile_id AND workspace_id (workspace isolation)", async () => {
    const eq = vi.fn().mockReturnThis();
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq,
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue(builder),
    } as unknown as SupabaseClient;

    await buildClassifierContext({
      supabase,
      workspaceId: "ws-abc",
      profileId: "profile-xyz",
    });

    // Both .eq() calls must be present — workspace_id is not optional.
    expect(eq).toHaveBeenCalledWith("profile_id", "profile-xyz");
    expect(eq).toHaveBeenCalledWith("workspace_id", "ws-abc");
  });
});
