/**
 * agent-router-classifier-context.test.ts
 * Unit tests for buildClassifierContext — the helper that feeds role/department/channel
 * signal into the intent classifier (Phase A5, ADR-0112, ADR-0193).
 *
 * Verifies: realistic profile rows produce a typed `ClassifierContext` object,
 * missing rows yield `{role:null, departmentName:null, ...}` (no silent empty-string
 * fallback — L-0094/L-0103), and workspace isolation is enforced.
 */
import { describe, expect, it, vi } from "vitest";
import { nonEmpty } from "@smartout/telemetry/server";

// Mock secrets so the module-level import chain doesn't try to read Vault.
vi.mock("../secrets.js", () => ({
  getSecrets: vi.fn().mockReturnValue({
    openrouterApiKey: "test-openrouter-key",
    telegramBotToken: null,
    telegramAdminChatId: null,
    telegramWebhookSecret: null,
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
  it("returns typed context for a realistic admin profile with department", async () => {
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
      workspaceId: nonEmpty("ws-1", "workspaceId"),
      profileId: nonEmpty("profile-1", "profileId"),
      channel: "chat",
    });

    expect(ctx.role).toBe("admin");
    expect(ctx.departmentName).toBe("Kjøkken");
    expect(ctx.channel).toBe("chat");
    expect(ctx.workspaceId).toBe("ws-1");
  });

  it("returns departmentName=null when department is absent", async () => {
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
      workspaceId: nonEmpty("ws-1", "workspaceId"),
      profileId: nonEmpty("profile-2", "profileId"),
      channel: "chat",
    });

    expect(ctx.role).toBe("employee");
    expect(ctx.departmentName).toBeNull();
  });

  it("returns role=null when profile.role is null (no silent 'employee' fallback)", async () => {
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
      workspaceId: nonEmpty("ws-1", "workspaceId"),
      profileId: nonEmpty("profile-3", "profileId"),
      channel: "voice",
    });

    // Honesty: we do NOT invent a role the DB did not declare.
    expect(ctx.role).toBeNull();
    expect(ctx.departmentName).toBe("Bar");
    expect(ctx.channel).toBe("voice");
  });

  it("returns all-null structured context when profile lookup finds no row (no empty-string fallback)", async () => {
    const supabase = makeSupabaseStub({ data: null, error: null });

    const ctx = await buildClassifierContext({
      supabase,
      workspaceId: nonEmpty("ws-1", "workspaceId"),
      profileId: nonEmpty("missing", "profileId"),
      channel: null,
    });

    // L-0094/L-0103: previously this returned "" which discarded the signal
    // silently. Honest shape is nulls — classifier handles them explicitly.
    expect(ctx.role).toBeNull();
    expect(ctx.departmentName).toBeNull();
    expect(ctx.channel).toBeNull();
    expect(ctx.workspaceId).toBe("ws-1");
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
      workspaceId: nonEmpty("ws-abc", "workspaceId"),
      profileId: nonEmpty("profile-xyz", "profileId"),
      channel: "chat",
    });

    // Both .eq() calls must be present — workspace_id is not optional.
    expect(eq).toHaveBeenCalledWith("profile_id", "profile-xyz");
    expect(eq).toHaveBeenCalledWith("workspace_id", "ws-abc");
  });

  it("propagates caller-supplied channel verbatim (voice)", async () => {
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
      workspaceId: nonEmpty("ws-1", "workspaceId"),
      profileId: nonEmpty("profile-v", "profileId"),
      channel: "voice",
    });

    expect(ctx.channel).toBe("voice");
  });
});
