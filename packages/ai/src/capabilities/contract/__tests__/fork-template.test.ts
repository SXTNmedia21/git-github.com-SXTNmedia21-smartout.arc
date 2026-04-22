/**
 * fork_template capability tool — unit tests.
 *
 * Covers Gate G4 invariants:
 *   - admin role → happy path, emit fired, lineage-aware output
 *   - employee role → "Access denied", emit NOT fired
 *   - non-chat channel → channel guard returns Norwegian-leaning denial
 *   - non-system source → rejected before HTTP call
 *
 * Uses the schema-validated Supabase mock (L-0087). fetch is stubbed per
 * test to avoid hitting the real /api/contract-templates/copy route.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AgentToolContext } from "../../types.js";
import { forkTemplate } from "../tools.js";
import { mockSupabase } from "../../__tests__/supabase-mock.js";

const emitMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
}));

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const ADMIN_PROFILE_ID = "20000000-0000-0000-0000-000000000001";
const EMPLOYEE_PROFILE_ID = "20000000-0000-0000-0000-000000000002";
const SYSTEM_TEMPLATE_ID = "30000000-0000-0000-0000-000000000001";
const WORKSPACE_TEMPLATE_ID = "30000000-0000-0000-0000-000000000002";

function makeCtx(overrides: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    workspaceId: WORKSPACE_ID,
    profileId: ADMIN_PROFILE_ID,
    sessionId: "session-1",
    supabaseAdmin: mockSupabase({}),
    channel: "chat",
    ...overrides,
  };
}

describe("fork_template", () => {
  const originalFetch = globalThis.fetch;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  beforeEach(() => {
    emitMock.mockClear();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("forks a system template (admin happy path) and emits forked event", async () => {
    const sb = mockSupabase({
      profile: {
        data: {
          profile_id: ADMIN_PROFILE_ID,
          workspace_id: WORKSPACE_ID,
          role: "admin",
        },
        error: null,
      },
      contract_template: {
        data: {
          template_id: SYSTEM_TEMPLATE_ID,
          name: "Standard ansettelseskontrakt",
          version: 3,
          is_system: true,
        },
        error: null,
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        template_id: WORKSPACE_TEMPLATE_ID,
        name: "Custom fork",
        source_template_version: "3",
        forked_at: "2026-04-22T12:00:00Z",
      }),
    }) as unknown as typeof fetch;

    const result = await forkTemplate.execute(
      { system_template_id: SYSTEM_TEMPLATE_ID, name_override: "Custom fork" },
      makeCtx({ supabaseAdmin: sb }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.workspace_template_id).toBe(WORKSPACE_TEMPLATE_ID);
    expect(parsed.source_version).toBe("3");
    expect(parsed.forked_at).toBe("2026-04-22T12:00:00Z");

    expect(emitMock).toHaveBeenCalledTimes(1);
    const [call] = emitMock.mock.calls;
    expect(call?.[0].event).toBe("contract_template forked");
    expect(call?.[0].properties.entity.entity_id).toBe(WORKSPACE_TEMPLATE_ID);
    expect(call?.[0].properties.data.source_scope).toBe("system");
  });

  it("rejects non-admin with access denied and does NOT emit", async () => {
    const sb = mockSupabase({
      profile: {
        data: {
          profile_id: EMPLOYEE_PROFILE_ID,
          workspace_id: WORKSPACE_ID,
          role: "employee",
        },
        error: null,
      },
    });

    const result = await forkTemplate.execute(
      { system_template_id: SYSTEM_TEMPLATE_ID },
      makeCtx({ profileId: EMPLOYEE_PROFILE_ID, supabaseAdmin: sb }),
    );

    expect(result).toContain("Access denied");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("rejects voice channel with template authoring denial", async () => {
    const result = await forkTemplate.execute(
      { system_template_id: SYSTEM_TEMPLATE_ID },
      makeCtx({ channel: "voice" }),
    );

    expect(result).toContain("chat channel");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("rejects a non-system source template (would be workspace→workspace, not supported)", async () => {
    const sb = mockSupabase({
      profile: {
        data: {
          profile_id: ADMIN_PROFILE_ID,
          workspace_id: WORKSPACE_ID,
          role: "admin",
        },
        error: null,
      },
      contract_template: {
        data: {
          template_id: SYSTEM_TEMPLATE_ID,
          name: "Not a system template",
          version: 1,
          is_system: false,
        },
        error: null,
      },
    });

    const result = await forkTemplate.execute(
      { system_template_id: SYSTEM_TEMPLATE_ID },
      makeCtx({ supabaseAdmin: sb }),
    );

    expect(result).toContain("system (K1a)");
    expect(emitMock).not.toHaveBeenCalled();
  });
});
