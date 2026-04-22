/**
 * deprecate_workspace_template capability tool — unit tests.
 *
 * Covers Gate G4 invariants:
 *   - admin on published template → happy path, emits deprecated event
 *   - draft (published_at IS NULL) → rejected with "cannot deprecate a draft"
 *   - already deprecated → idempotent short-circuit, no second emit
 *   - employee role → denied
 *   - non-chat channel → channel guard
 *
 * Uses the schema-validated Supabase mock (L-0087).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentToolContext } from "../../types.js";
import { deprecateWorkspaceTemplate } from "../tools.js";
import { mockSupabase } from "../../__tests__/supabase-mock.js";

const emitMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@smartout/telemetry", () => ({
  emit: (...args: unknown[]) => emitMock(...args),
}));

const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const ADMIN_PROFILE_ID = "20000000-0000-0000-0000-000000000001";
const EMPLOYEE_PROFILE_ID = "20000000-0000-0000-0000-000000000002";
const TEMPLATE_ID = "30000000-0000-0000-0000-000000000010";

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

describe("deprecate_workspace_template", () => {
  beforeEach(() => {
    emitMock.mockClear();
  });

  it("deprecates a published template (admin happy path) and emits deprecated event", async () => {
    const sb = mockSupabase({
      profile: {
        data: {
          profile_id: ADMIN_PROFILE_ID,
          workspace_id: WORKSPACE_ID,
          role: "admin",
        },
        error: null,
      },
      contract_template: [
        {
          data: {
            template_id: TEMPLATE_ID,
            workspace_id: WORKSPACE_ID,
            is_system: false,
            published_at: "2026-02-01T00:00:00Z",
            deprecated_at: null,
            name: "Active template",
          },
          error: null,
        },
        {
          data: {
            template_id: TEMPLATE_ID,
            deprecated_at: "2026-04-22T12:45:00Z",
          },
          error: null,
        },
      ],
    });

    const result = await deprecateWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ supabaseAdmin: sb }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.template_id).toBe(TEMPLATE_ID);
    expect(parsed.deprecated_at).toBe("2026-04-22T12:45:00Z");

    expect(emitMock).toHaveBeenCalledTimes(1);
    const [call] = emitMock.mock.calls;
    expect(call?.[0].event).toBe("contract_template deprecated");
    expect(call?.[0].properties.entity.entity_id).toBe(TEMPLATE_ID);
  });

  it("rejects a draft (published_at IS NULL) and does NOT emit", async () => {
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
          template_id: TEMPLATE_ID,
          workspace_id: WORKSPACE_ID,
          is_system: false,
          published_at: null,
          deprecated_at: null,
          name: "Unpublished draft",
        },
        error: null,
      },
    });

    const result = await deprecateWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ supabaseAdmin: sb }),
    );

    expect(result).toContain("Cannot deprecate a draft");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("is idempotent on already-deprecated template (short-circuits, no new emit)", async () => {
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
          template_id: TEMPLATE_ID,
          workspace_id: WORKSPACE_ID,
          is_system: false,
          published_at: "2026-02-01T00:00:00Z",
          deprecated_at: "2026-03-15T00:00:00Z",
          name: "Already retired",
        },
        error: null,
      },
    });

    const result = await deprecateWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ supabaseAdmin: sb }),
    );

    const parsed = JSON.parse(result);
    expect(parsed.already_deprecated).toBe(true);
    expect(parsed.deprecated_at).toBe("2026-03-15T00:00:00Z");
    expect(emitMock).not.toHaveBeenCalled();
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

    const result = await deprecateWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ profileId: EMPLOYEE_PROFILE_ID, supabaseAdmin: sb }),
    );

    expect(result).toContain("Access denied");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("rejects voice channel", async () => {
    const result = await deprecateWorkspaceTemplate.execute(
      { workspace_template_id: TEMPLATE_ID },
      makeCtx({ channel: "voice" }),
    );
    expect(result).toContain("chat channel");
    expect(emitMock).not.toHaveBeenCalled();
  });
});
